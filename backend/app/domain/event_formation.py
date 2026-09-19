"""
Spatio-Temporal Event Formation & Facility Association Pipeline
Runs ST-DBSCAN clustering on thermal observations, associates nearest industrial facilities
via PostGIS spatial queries, and triggers full ML intelligence classification.
"""
import uuid
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.db.models import ThermalObservation, ThermalEvent, EventObservation, IndustrialFacility
from app.domain.clustering import run_st_dbscan, compute_event_metrics
from app.domain.anomaly import process_event_intelligence

def form_events_from_observations(session: Session, lookback_days: int = 7) -> int:
    """
    Gathers active observations from database within lookback window,
    runs ST-DBSCAN spatio-temporal clustering, associates nearest industrial facility,
    and updates/creates thermal_events with attached event_observations.
    Optimized with in-memory facility caching and batch transactions.
    """
    import math
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=lookback_days)
    recent_24h = now_utc - timedelta(hours=24)

    # Query unlinked observations OR recent 24h observations within the lookback window
    obs_query = text("""
        SELECT o.id, o.latitude, o.longitude, o.frp_mw, o.brightness_temp_k, 
               o.observation_timestamp_utc, o.satellite_sensor, o.day_night
        FROM thermal_observations o
        WHERE (o.observation_timestamp_utc >= :cutoff)
          AND (
            (NOT EXISTS (SELECT 1 FROM event_observations eo WHERE eo.observation_id = o.id))
            OR (o.observation_timestamp_utc >= :recent_24h)
          )
        ORDER BY o.observation_timestamp_utc ASC
    """)
    obs_rows = session.execute(obs_query, {"cutoff": cutoff, "recent_24h": recent_24h}).fetchall()
    if not obs_rows:
        return 0

    obs_dicts = [
        {
            "id": str(r[0]),
            "latitude": float(r[1]),
            "longitude": float(r[2]),
            "frp_mw": float(r[3] or 1.0),
            "brightness_temp_k": float(r[4] or 300.0),
            "observation_timestamp_utc": r[5],
            "satellite_sensor": r[6],
            "day_night": r[7]
        }
        for r in obs_rows
    ]

    clusters = run_st_dbscan(obs_dicts, eps_spatial_m=750.0, eps_temporal_hours=12.0, min_pts=1)
    if not clusters:
        return 0

    # Pre-cache active industrial facilities in memory for ultra-fast spatial search
    fac_rows = session.query(
        IndustrialFacility.id,
        IndustrialFacility.name,
        IndustrialFacility.sector_category,
        IndustrialFacility.latitude,
        IndustrialFacility.longitude
    ).filter(IndustrialFacility.is_active == True).all()

    fac_coords = np.array([[float(f.latitude), float(f.longitude)] for f in fac_rows]) if fac_rows else np.empty((0, 2))

    # Pre-cache recent events within 48h for matching
    recent_events = session.query(ThermalEvent).filter(
        ThermalEvent.latest_detected_utc >= now_utc - timedelta(hours=48)
    ).all()

    events_formed_or_updated = 0

    for i, cluster in enumerate(clusters):
        metrics = compute_event_metrics(cluster)
        c_lat = metrics["centroid_lat"]
        c_lon = metrics["centroid_lon"]
        first_utc = metrics["first_detected_utc"]
        latest_utc = metrics["latest_detected_utc"]
        peak_frp = metrics["peak_frp_mw"]
        mean_frp = metrics["mean_frp_mw"]
        total_frp = metrics["aggregate_frp_mw"]
        max_k = metrics["max_brightness_k"]
        obs_count = metrics["observation_count"]
        area_ha = metrics["bounding_area_ha"]
        boundary_wkt = metrics["boundary_wkt"]

        # In-memory nearest facility search
        associated_fac_id = None
        dist_to_fac = 99999.0
        primary_land_use = "Regional Hotspot"

        if len(fac_coords) > 0:
            dlat = (fac_coords[:, 0] - c_lat) * 111000.0
            dlon = (fac_coords[:, 1] - c_lon) * (111000.0 * math.cos(math.radians(c_lat)))
            dists = np.sqrt(dlat**2 + dlon**2)
            min_idx = int(np.argmin(dists))
            min_dist = float(dists[min_idx])
            dist_to_fac = min_dist
            
            nearest_fac = fac_rows[min_idx]
            sec = (nearest_fac.sector_category or "").upper()
            is_mega_sector = any(k in sec for k in [
                "REFIN", "PETRO", "POWER", "STEEL", "CEMENT", "MINE", "MINING",
                "CHEM", "SMELT", "ALUMIN", "FERTIL", "PORT", "OIL", "GAS", "LNG"
            ])
            fac_threshold = 4500.0 if is_mega_sector else 3000.0
            if min_dist <= fac_threshold:
                associated_fac_id = nearest_fac.id
                primary_land_use = nearest_fac.sector_category or "Industrial"

        # Check if an existing event covers this cluster:
        existing_event = None
        for evt in recent_events:
            if associated_fac_id and evt.associated_facility_id == associated_fac_id:
                if evt.latest_detected_utc and evt.latest_detected_utc >= first_utc - timedelta(hours=24):
                    existing_event = evt
                    break
            elif evt.latitude is not None and evt.longitude is not None:
                edlat = (float(evt.latitude) - c_lat) * 111000.0
                edlon = (float(evt.longitude) - c_lon) * (111000.0 * math.cos(math.radians(c_lat)))
                if math.sqrt(edlat**2 + edlon**2) <= 1500.0:
                    if evt.latest_detected_utc and evt.latest_detected_utc >= first_utc - timedelta(hours=24):
                        existing_event = evt
                        break

        if existing_event:
            existing_event.latest_detected_utc = max(existing_event.latest_detected_utc, latest_utc) if existing_event.latest_detected_utc else latest_utc
            existing_event.distance_to_facility_m = dist_to_fac
            if associated_fac_id:
                existing_event.associated_facility_id = associated_fac_id
                existing_event.primary_land_use = primary_land_use
            existing_event.peak_frp_mw = max(float(existing_event.peak_frp_mw or 0.0), peak_frp)
            existing_event.aggregate_frp_mw = float(existing_event.aggregate_frp_mw or 0.0) + total_frp
            existing_event.max_brightness_k = max(float(existing_event.max_brightness_k or 300.0), max_k)
            target_event = existing_event
        else:
            short_id = f"EVT-{datetime.now().year}-{str(uuid.uuid4())[:6].upper()}"
            target_event = ThermalEvent(
                event_id=short_id,
                centroid=f"SRID=4326;POINT({c_lon} {c_lat})",
                boundary_geom=f"SRID=4326;{boundary_wkt}",
                latitude=c_lat,
                longitude=c_lon,
                bounding_area_ha=area_ha,
                first_detected_utc=first_utc,
                latest_detected_utc=latest_utc,
                peak_frp_mw=peak_frp,
                mean_frp_mw=mean_frp,
                aggregate_frp_mw=total_frp,
                max_brightness_k=max_k,
                observation_count=obs_count,
                associated_facility_id=associated_fac_id,
                distance_to_facility_m=dist_to_fac,
                primary_land_use=primary_land_use,
                classification="OTHER_UNCERTAIN",
                anomaly_tier="NORMAL",
                lifecycle_status="ACTIVE"
            )
            session.add(target_event)
            session.flush()
            recent_events.append(target_event)

        for o_dict in cluster:
            o_uuid = uuid.UUID(o_dict["id"])
            session.execute(text("""
                INSERT INTO event_observations (id, event_id, observation_id)
                VALUES (:id, :event_id, :obs_id)
                ON CONFLICT DO NOTHING
            """), {"id": str(uuid.uuid4()), "event_id": str(target_event.id), "obs_id": str(o_uuid)})

        target_event.observation_count = obs_count
        events_formed_or_updated += 1

        # Trigger ML intelligence & Anomaly scoring
        try:
            process_event_intelligence(session, target_event.event_id)
        except Exception as e:
            print(f"Intelligence processing exception for {target_event.event_id}: {e}")

        # Batch commit every 25 clusters
        if (i + 1) % 25 == 0 or (i + 1) == len(clusters):
            session.commit()

    # Reconcile lifecycles: Hotspots without fresh passes in 3-4 days normalize to NORMAL and EXTINGUISHED
    reconcile_event_lifecycles(session)

    return events_formed_or_updated

def reconcile_event_lifecycles(session: Session, reference_time: Optional[datetime] = None) -> Dict[str, int]:
    """
    Normalizes and reconciles event lifecycles:
    - Recent detections (< 24h) remain ACTIVE.
    - Detections between 24h and 72h transition to COOLING.
    - Detections with no new passes for >= 3 days (>= 72h) transition to EXTINGUISHED.
    
    IMPORTANT: Historical anomaly_tier (CRITICAL, ABNORMAL, ELEVATED, NORMAL) is
    preserved immutably as a factual record of the observed event severity.
    Elapsed time affects operational freshness/lifecycle ONLY, never historical severity.
    """
    ref_utc = reference_time or datetime.now(timezone.utc)
    if ref_utc.tzinfo is None:
        ref_utc = ref_utc.replace(tzinfo=timezone.utc)

    t24 = ref_utc - timedelta(hours=24)
    t72 = ref_utc - timedelta(days=3)

    # 1. Extinguished (> 72h / 3 days): Aging detection, anomaly_tier preserved
    ext_res = session.execute(text("""
        UPDATE thermal_events
        SET lifecycle_status = 'EXTINGUISHED'
        WHERE latest_detected_utc < :t72
          AND lifecycle_status != 'EXTINGUISHED';
    """), {"t72": t72})

    # 2. Cooling (24h - 72h)
    cool_res = session.execute(text("""
        UPDATE thermal_events
        SET lifecycle_status = 'COOLING'
        WHERE latest_detected_utc < :t24
          AND latest_detected_utc >= :t72
          AND lifecycle_status != 'COOLING';
    """), {"t24": t24, "t72": t72})

    # 3. Active (< 24h)
    act_res = session.execute(text("""
        UPDATE thermal_events
        SET lifecycle_status = 'ACTIVE'
        WHERE latest_detected_utc >= :t24
          AND lifecycle_status != 'ACTIVE';
    """), {"t24": t24})

    session.commit()
    return {
        "extinguished_normalized": ext_res.rowcount,
        "cooling": cool_res.rowcount,
        "active": act_res.rowcount
    }
