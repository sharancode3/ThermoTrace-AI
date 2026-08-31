import os
import sys
import numpy as np
from datetime import timedelta
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.db.models import ThermalEvent, EventObservation, ThermalObservation, IndustrialFacility
from app.domain.geocoding import resolve_indian_location

def get_day_night_ratio(session: Session, event_id: str) -> float:
    query = text('''
        SELECT o.day_night 
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
    ''')
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if not res: return 0.5
    day_count = sum(1 for row in res if row[0] == 'D')
    return float(day_count) / len(res)

def get_frp_variance(session: Session, event_id: str) -> float:
    query = text('''
        SELECT o.frp_mw 
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
    ''')
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if not res or len(res) < 2: return 0.0
    frps = [float(row[0]) for row in res]
    return float(np.var(frps))

def get_historical_stats(session: Session, centroid_wkt: str, current_first_utc) -> Tuple[int, float]:
    query = text('''
        SELECT COUNT(DISTINCT DATE(first_detected_utc)) as active_days, MAX(peak_frp_mw) as hist_peak
        FROM thermal_events
        WHERE first_detected_utc >= :lookback
        AND first_detected_utc < :current
        AND ST_DWithin(centroid::geography, ST_GeomFromEWKB(decode(:wkt, 'hex'))::geography, 2000)
    ''')
    lookback = current_first_utc - timedelta(days=90)
    res = session.execute(query, {"lookback": lookback, "current": current_first_utc, "wkt": centroid_wkt}).fetchone()
    if not res or res[0] == 0:
        return 0, 0.0
    return int(res[0]), float(res[1])
    
def calculate_convex_hull(session: Session, event_id: str) -> float:
    query = text('''
        SELECT ST_Area(ST_ConvexHull(ST_Collect(geom))::geography) / 10000.0 as area_ha
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
    ''')
    res = session.execute(query, {"event_id": event_id}).fetchone()
    if not res or res[0] is None:
        return 0.0
    return float(res[0])

def get_thermal_trend(session: Session, event_id: str) -> str:
    query = text('''
        SELECT o.observation_timestamp_utc, o.frp_mw
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
        ORDER BY o.observation_timestamp_utc ASC
    ''')
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if len(res) < 2:
        return "INSUFFICIENT_DATA"
    elif len(res) == 2:
        diff = float(res[1][1]) - float(res[0][1])
        if diff > 3.0: return "INCREASING"
        elif diff < -3.0: return "DECREASING"
        return "STABLE"
        
    timestamps = [row[0].timestamp() for row in res]
    frps = [float(row[1]) for row in res]
    
    try:
        slope, _ = np.polyfit(timestamps, frps, 1)
        if slope > 0.003:
            return "INCREASING"
        elif slope < -0.003:
            return "DECREASING"
        else:
            return "STABLE"
    except Exception:
        return "STABLE"

def get_footprint_dynamics(session: Session, event_id: str) -> str:
    query = text('''
        SELECT o.observation_timestamp_utc, o.geom
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
        ORDER BY o.observation_timestamp_utc ASC
    ''')
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if len(res) < 3:
        return "INSUFFICIENT_DATA"
    return "STABLE"

def get_evidence_completeness(obs_count: int, has_facility: bool, has_history: bool) -> str:
    if obs_count >= 3 and (has_facility or has_history):
        return "GOOD"
    elif obs_count >= 1:
        return "LIMITED"
    return "INSUFFICIENT"

def get_evidence_strength(obs_count: int, hist_days: int, has_facility: bool, facility_name: Optional[str] = None) -> Tuple[str, str]:
    """
    Computes evidence strength tag (STRONG / MODERATE / LIMITED) and human rationale.
    Driven strictly by real data volume: observation count, facility baseline depth, and facility association.
    """
    if obs_count >= 4 and (hist_days >= 15 or has_facility):
        fac_ctx = f"at {facility_name}" if facility_name else f"{hist_days}-day facility history"
        return "STRONG", f"{obs_count} satellite passes, {fac_ctx}"
    elif obs_count >= 2 or (has_facility and hist_days >= 3):
        fac_ctx = f"{hist_days}-day facility history" if hist_days > 0 else "associated facility"
        return "MODERATE", f"{obs_count} observation{'s' if obs_count > 1 else ''}, {fac_ctx}"
    else:
        obs_text = f"{obs_count} satellite pass" if obs_count == 1 else f"{obs_count} observations"
        fac_text = "unassociated facility" if not has_facility else "sparse baseline"
        return "LIMITED", f"{obs_text}, {fac_text}"


def build_feature_vector(session: Session, event_uuid: str) -> Dict[str, Any]:
    event = session.query(ThermalEvent).filter(ThermalEvent.id == event_uuid).first()
    if not event:
        raise ValueError(f"Event UUID {event_uuid} not found.")
        
    event.bounding_area_ha = calculate_convex_hull(session, str(event.id))
    session.commit()
    
    dn_ratio = get_day_night_ratio(session, str(event.id))
    frp_var = get_frp_variance(session, str(event.id))
    
    wkt = str(event.centroid).split(";")[-1] if ";" in str(event.centroid) else str(event.centroid)
    hist_days, hist_peak = get_historical_stats(session, wkt, event.first_detected_utc)
    
    # Resolve geographic and land cover context
    lat, lon = float(event.latitude), float(event.longitude)
    geo = resolve_indian_location(lat, lon, None)
    
    dist_to_fac = float(event.distance_to_facility_m) if event.distance_to_facility_m is not None else 9999.0
    fac_cat = 0
    if event.primary_land_use and event.primary_land_use != 'UNKNOWN':
        fac_cat = abs(hash(event.primary_land_use)) % 100

    # Land cover distribution based on Indian geographic regional knowledge
    pct_cropland = 0.0
    pct_forest = 0.0
    pct_urban = 0.0
    
    state = geo.get("state", "")
    hub = geo.get("hub_description", "")
    
    if dist_to_fac < 2500.0 or event.associated_facility_id:
        pct_urban = 0.70
        pct_cropland = 0.20
        pct_forest = 0.10
        is_ind = 1
    elif state in ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal"]:
        pct_cropland = 0.85
        pct_forest = 0.05
        pct_urban = 0.10
        is_ind = 0
    elif state in ["Uttarakhand", "Himachal Pradesh", "Arunachal Pradesh", "Assam", "Meghalaya", "Odisha", "Chhattisgarh", "Madhya Pradesh", "Kerala"]:
        pct_forest = 0.75
        pct_cropland = 0.15
        pct_urban = 0.10
        is_ind = 0
    else:
        pct_cropland = 0.50
        pct_forest = 0.30
        pct_urban = 0.20
        is_ind = 0

    features = {
        "dist_to_facility": dist_to_fac if dist_to_fac < 50000.0 else -1.0,
        "facility_category_encoded": fac_cat,
        "peak_frp_mw": float(event.peak_frp_mw),
        "mean_frp_mw": float(event.mean_frp_mw),
        "frp_variance": frp_var,
        "max_brightness_k": float(event.max_brightness_k),
        "duration_hours": float((event.latest_detected_utc - event.first_detected_utc).total_seconds() / 3600.0),
        "day_night_ratio": dn_ratio,
        "historical_active_days_90d": hist_days,
        "historical_peak_frp": hist_peak,
        "pct_cropland": pct_cropland,
        "pct_forest": pct_forest,
        "pct_urban": pct_urban,
        "is_industrial_zone": is_ind,
    }
    return features
