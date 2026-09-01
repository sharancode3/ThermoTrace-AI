"""
Spatio-Temporal Event Formation & Facility Association Pipeline
Runs ST-DBSCAN clustering on thermal observations, associates nearest industrial facilities
via PostGIS spatial queries, and triggers full ML intelligence classification.
"""
import uuid
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.models import ThermalObservation, ThermalEvent, EventObservation, IndustrialFacility
from app.domain.clustering import run_st_dbscan, compute_event_metrics
from app.domain.anomaly import process_event_intelligence

def form_events_from_observations(session: Session, lookback_days: int = 7) -> int:
    """
    Gathers active observations from database within lookback window,
    runs ST-DBSCAN spatio-temporal clustering, associates nearest industrial facility,
    and updates/creates thermal_events with attached event_observations.
    """
    query = session.query(ThermalObservation).order_by(ThermalObservation.observation_timestamp_utc.asc())
    all_obs = query.all()
    if not all_obs:
        return 0

    obs_dicts = [
        {
            "id": str(o.id),
            "latitude": float(o.latitude),
            "longitude": float(o.longitude),
            "frp_mw": float(o.frp_mw or 1.0),
            "brightness_temp_k": float(o.brightness_temp_k or 300.0),
            "observation_timestamp_utc": o.observation_timestamp_utc,
            "satellite_sensor": o.satellite_sensor,
            "day_night": o.day_night
        }
        for o in all_obs
    ]

    clusters = run_st_dbscan(obs_dicts, eps_spatial_m=750.0, eps_temporal_hours=12.0, min_pts=1)
    
    events_formed_or_updated = 0

    for cluster in clusters:
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

        # Spatial Query: Find closest industrial facility
        fac_q = text("""
            SELECT id, name, sector_category, state, district,
                   ST_Distance(centroid::geography, ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography) as dist_m
            FROM industrial_facilities
            WHERE is_active = true
            ORDER BY centroid <-> ST_SetSRID(ST_Point(:lon, :lat), 4326)
            LIMIT 1;
        """)
        fac_res = session.execute(fac_q, {"lat": c_lat, "lon": c_lon}).fetchone()

        associated_fac_id = None
        dist_to_fac = 99999.0
        primary_land_use = "Cropland"

        if fac_res and fac_res[5] is not None:
            dist_to_fac = float(fac_res[5])
            if dist_to_fac <= 3500.0:  # Within 3.5km industrial boundary
                associated_fac_id = fac_res[0]
                primary_land_use = fac_res[2] or "Industrial"
            else:
                primary_land_use = "Cropland" if c_lat > 24.0 else "Regional Hotspot"

        # Check if an existing event covers this cluster (same centroid proximity < 500m)
        existing_event = session.query(ThermalEvent).filter(
            text("ST_DWithin(centroid::geography, ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography, 500)")
        ).params(lon=c_lon, lat=c_lat).first()

        if existing_event:
            existing_event.peak_frp_mw = max(float(existing_event.peak_frp_mw or 0.0), peak_frp)
            existing_event.mean_frp_mw = (float(existing_event.mean_frp_mw or 0.0) + mean_frp) / 2.0
            existing_event.aggregate_frp_mw = max(float(existing_event.aggregate_frp_mw or 0.0), total_frp)
            existing_event.observation_count = obs_count
            existing_event.latest_detected_utc = latest_utc
            existing_event.distance_to_facility_m = dist_to_fac
            if associated_fac_id and not existing_event.associated_facility_id:
                existing_event.associated_facility_id = associated_fac_id
                existing_event.primary_land_use = primary_land_use
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

        for o_dict in cluster:
            o_uuid = uuid.UUID(o_dict["id"])
            existing_link = session.query(EventObservation).filter(
                EventObservation.event_id == target_event.id,
                EventObservation.observation_id == o_uuid
            ).first()
            if not existing_link:
                link = EventObservation(
                    event_id=target_event.id,
                    observation_id=o_uuid
                )
                session.add(link)

        session.commit()

        # Trigger ML intelligence & Anomaly scoring
        process_event_intelligence(session, target_event.event_id)
        events_formed_or_updated += 1

    return events_formed_or_updated
