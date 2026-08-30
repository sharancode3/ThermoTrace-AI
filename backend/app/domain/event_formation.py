import os
import sys
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import psycopg2

sys.path.append(os.path.abspath('backend'))
from app.db.database import engine, SessionLocal
from app.db.models import ThermalObservation, ThermalEvent
from app.domain.clustering import run_st_dbscan, compute_event_metrics

def process_events(session: Session, eps_spatial: float = 750.0, eps_temporal_hours: float = 12.0) -> int:
    """
    Idempotent ST-DBSCAN Event Formation Pipeline.
    Preserves raw observation telemetry and lineage in event_observations.
    """
    # 1. Fetch raw observations
    observations = session.query(ThermalObservation).order_by(ThermalObservation.observation_timestamp_utc.asc()).all()
    if not observations:
        print("No observations to process.")
        return 0

    obs_dicts = []
    for o in observations:
        obs_dicts.append({
            "id": str(o.id),
            "latitude": float(o.latitude),
            "longitude": float(o.longitude),
            "frp_mw": float(o.frp_mw),
            "brightness_temp_k": float(o.brightness_temp_k),
            "observation_timestamp_utc": o.observation_timestamp_utc
        })

    # Release connection before heavy CPU bound ST-DBSCAN
    session.commit()
    session.close()

    # 2. Run ST-DBSCAN
    clusters = run_st_dbscan(obs_dicts, eps_spatial_m=eps_spatial, eps_temporal_hours=eps_temporal_hours, min_pts=1)

    # Re-open session
    from app.db.database import SessionLocal
    session = SessionLocal()
    print(f"ST-DBSCAN formed {len(clusters)} events from {len(observations)} observations.")

    # TRUNCATE events to ensure idempotency in batch MVP mode
    session.execute(text("TRUNCATE TABLE event_observations CASCADE;"))
    session.execute(text("TRUNCATE TABLE event_anomalies CASCADE;"))
    session.execute(text("TRUNCATE TABLE event_classifications CASCADE;"))
    session.execute(text("TRUNCATE TABLE thermal_events CASCADE;"))
    session.commit()

    # 3. Persist Events and Observation Lineage
    events_created = 0

    for cluster in clusters:
        metrics = compute_event_metrics(cluster)
        c_lat = metrics["centroid_lat"]
        c_lon = metrics["centroid_lon"]
        wkt = metrics["boundary_wkt"]
        
        # Sort observation IDs to create a stable hash for this exact cluster
        obs_ids = sorted([str(obs["id"]) for obs in cluster])
        stable_hash = uuid.uuid5(uuid.NAMESPACE_OID, "".join(obs_ids))
        
        state_code = "IND"
        dt_str = metrics["first_detected_utc"].strftime("%Y%m")
        # Generate a deterministic short hash for the public ID
        short_hash = str(stable_hash).split('-')[0].upper()
        event_public_id = f"EVT-{state_code}-{dt_str}-{short_hash}"

        evt = ThermalEvent(
            id=stable_hash,
            event_id=event_public_id,
            centroid=f"SRID=4326;POINT({c_lon} {c_lat})",
            boundary_geom=f"SRID=4326;{wkt}",
            latitude=c_lat,
            longitude=c_lon,
            bounding_area_ha=metrics["bounding_area_ha"],
            first_detected_utc=metrics["first_detected_utc"],
            latest_detected_utc=metrics["latest_detected_utc"],
            observation_count=metrics["observation_count"],
            peak_frp_mw=metrics["peak_frp_mw"],
            mean_frp_mw=metrics["mean_frp_mw"],
            aggregate_frp_mw=metrics["aggregate_frp_mw"],
            max_brightness_k=metrics["max_brightness_k"],
            lifecycle_status="ACTIVE"
        )
        session.add(evt)
        session.flush()
        events_created += 1

        # Insert lineage in event_observations junction table
        for obs_id in obs_ids:
            link_sql = text("""
                INSERT INTO event_observations (id, event_id, observation_id, attached_at)
                VALUES (:id, :evt_id, :obs_id, NOW())
                ON CONFLICT (event_id, observation_id) DO NOTHING;
            """)
            session.execute(link_sql, {"id": str(uuid.uuid4()), "evt_id": stable_hash, "obs_id": obs_id})

    session.commit()
    return events_created

if __name__ == "__main__":
    session = SessionLocal()
    count = process_events(session)
    print(f"CHECKPOINT A: Formed and persisted {count} thermal events in PostGIS.")
    session.close()
