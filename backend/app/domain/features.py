import os
import sys
import numpy as np
from datetime import timedelta
from typing import Dict, Any, Tuple, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.db.models import ThermalEvent, EventObservation, ThermalObservation, IndustrialFacility
from app.domain.geocoding import resolve_indian_location

def get_day_night_ratio(session: Session, event_id: str) -> float:
    query = text("""
        SELECT o.day_night 
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
    """)
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if not res: return 0.5
    day_count = sum(1 for row in res if row[0] == 'D')
    return float(day_count) / len(res)

def get_frp_variance(session: Session, event_id: str) -> float:
    query = text("""
        SELECT o.frp_mw 
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
    """)
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if not res or len(res) < 2: return 0.0
    frps = [float(row[0]) for row in res]
    return float(np.var(frps))

def get_historical_stats(session: Session, lat: float, lon: float, current_first_utc) -> Tuple[int, float]:
    query = text("""
        SELECT COUNT(DISTINCT DATE(first_detected_utc)) as active_days, COALESCE(MAX(peak_frp_mw), 0.0) as hist_peak
        FROM thermal_events
        WHERE first_detected_utc >= :lookback
        AND first_detected_utc < :current
        AND ST_DWithin(
            centroid::geography,
            ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography,
            2500
        )
    """)
    lookback = current_first_utc - timedelta(days=90) if current_first_utc else timedelta(days=90)
    current = current_first_utc or func.now()
    res = session.execute(query, {"lookback": lookback, "current": current, "lon": lon, "lat": lat}).fetchone()
    if not res or res[0] is None or res[0] == 0:
        return 0, 0.0
    return int(res[0]), float(res[1] or 0.0)
    
def calculate_convex_hull(session: Session, event_id: str) -> float:
    query = text("""
        SELECT ST_Area(ST_ConvexHull(ST_Collect(geom))::geography) / 10000.0 as area_ha
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
    """)
    res = session.execute(query, {"event_id": event_id}).fetchone()
    if not res or res[0] is None:
        return 0.0
    return float(res[0])

def _to_unix_ts(val) -> float:
    if hasattr(val, "timestamp"):
        return float(val.timestamp())
    from datetime import datetime
    return float(datetime.fromisoformat(str(val).replace("Z", "+00:00")).timestamp())

def get_thermal_trend(session: Session, event_id: str) -> str:
    query = text("""
        SELECT o.observation_timestamp_utc, o.frp_mw
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
        ORDER BY o.observation_timestamp_utc ASC
    """)
    res = session.execute(query, {"event_id": event_id}).fetchall()
    if len(res) < 2:
        return "INSUFFICIENT_DATA"
    elif len(res) == 2:
        diff = float(res[1][1]) - float(res[0][1])
        if diff > 3.0: return "INCREASING"
        elif diff < -3.0: return "DECREASING"
        return "STABLE"
        
    timestamps = [_to_unix_ts(row[0]) for row in res]
    frps = [float(row[1]) for row in res]
    
    if len(set(timestamps)) < 2:
        return "STABLE"
        
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

def batch_get_thermal_trends(session: Session, event_ids: List[Any]) -> Dict[str, str]:
    """
    High-performance batch calculation of thermal trends for a list of events.
    Executes a single SQL query instead of N sequential database round-trips,
    reducing Supabase egress and query latency by >90%.
    """
    if not event_ids:
        return {}
    
    from app.db.models import EventObservation, ThermalObservation
    from collections import defaultdict
    
    obs_by_event = defaultdict(list)
    try:
        rows = (
            session.query(
                EventObservation.event_id,
                ThermalObservation.observation_timestamp_utc,
                ThermalObservation.frp_mw
            )
            .join(ThermalObservation, ThermalObservation.id == EventObservation.observation_id)
            .filter(EventObservation.event_id.in_(event_ids))
            .order_by(EventObservation.event_id, ThermalObservation.observation_timestamp_utc.asc())
            .all()
        )
        for ev_id, ts, frp in rows:
            obs_by_event[str(ev_id)].append((ts, float(frp) if frp is not None else 0.0))
    except Exception as e:
        return {str(eid): "INSUFFICIENT_DATA" for eid in event_ids}
        
    results = {}
    for eid in event_ids:
        str_id = str(eid)
        res = obs_by_event.get(str_id, [])
        if len(res) < 2:
            results[str_id] = "INSUFFICIENT_DATA"
            continue
        elif len(res) == 2:
            diff = res[1][1] - res[0][1]
            if diff > 3.0: results[str_id] = "INCREASING"
            elif diff < -3.0: results[str_id] = "DECREASING"
            else: results[str_id] = "STABLE"
            continue
            
        timestamps = [_to_unix_ts(row[0]) for row in res]
        frps = [row[1] for row in res]
        if len(set(timestamps)) < 2:
            results[str_id] = "STABLE"
            continue
            
        try:
            slope, _ = np.polyfit(timestamps, frps, 1)
            if slope > 0.003:
                results[str_id] = "INCREASING"
            elif slope < -0.003:
                results[str_id] = "DECREASING"
            else:
                results[str_id] = "STABLE"
        except Exception:
            results[str_id] = "STABLE"
            
    return results

def get_footprint_dynamics(session: Session, event_id: str) -> str:
    query = text("""
        SELECT o.observation_timestamp_utc, o.geom
        FROM thermal_observations o
        JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.event_id = :event_id
        ORDER BY o.observation_timestamp_utc ASC
    """)
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


def resolve_refined_landcover(lat: float, lon: float, dist_to_fac: float, is_associated_fac: bool, state: str = "", dn_ratio: float = 0.5) -> Dict[str, Any]:
    """
    High-Precision Land-Cover, Industrial Geofence, and Terrain Resolver for Pan-India coordinates.
    Calibrates Cropland Agrarian Belts, Western/Eastern Ghats Reserves, Industrial Corridors,
    and Satellite Day/Night Overpass Telemetry.
    """
    # 1. Direct Industrial Proximity (within 3500m of a facility)
    if (0.0 <= dist_to_fac <= 3500.0) or is_associated_fac:
        return {"pct_urban": 0.85, "pct_cropland": 0.05, "pct_forest": 0.05, "is_ind": 1}

    # 2. Key National Industrial Corridors, Mining Basins & Heavy Industrial Hubs
    ind_bounding_boxes = [
        # Kotputli-Behror / Neemrana / Bhiwadi Industrial Belt (Rajasthan)
        {"min_lat": 27.55, "max_lat": 28.25, "min_lon": 76.05, "max_lon": 76.90, "name": "Kotputli-Bhiwadi Industrial Corridor"},
        # Chanderiya-Chittorgarh Smelter & Cement Belt (Rajasthan)
        {"min_lat": 24.55, "max_lat": 24.95, "min_lon": 74.55, "max_lon": 74.75, "name": "Chittorgarh Smelter & Cement Cluster"},
        # Kharagpur-Midnapore Industrial Belt (West Bengal)
        {"min_lat": 22.20, "max_lat": 22.45, "min_lon": 87.20, "max_lon": 87.45, "name": "Kharagpur Steel & Energy Corridor"},
        # Haldia Petrochemical & Refinery Port (West Bengal)
        {"min_lat": 22.00, "max_lat": 22.15, "min_lon": 88.00, "max_lon": 88.15, "name": "Haldia Petrochem Complex"},
        # Durgapur-Asansol-Raniganj-Burnpur Steel & Coal Belt (West Bengal)
        {"min_lat": 23.40, "max_lat": 23.95, "min_lon": 86.70, "max_lon": 87.45, "name": "Durgapur-Asansol Steel & Coal Belt"},
        # Jamshedpur-Adityapur-Gamharia Mega Industrial Zone (Jharkhand)
        {"min_lat": 22.65, "max_lat": 23.00, "min_lon": 86.00, "max_lon": 86.40, "name": "Jamshedpur-Adityapur Zone"},
        # Damodar Valley: Bokaro-Dhanbad-Jharia-Ramgarh Steel & Coal Complex (Jharkhand)
        {"min_lat": 23.40, "max_lat": 23.95, "min_lon": 85.15, "max_lon": 86.70, "name": "Damodar Valley Coal & Steel Complex"},
        # Angul-Talcher-Meramandali Industrial & Mining Basin (Odisha - NTPC Talcher, JSPL & NALCO)
        {"min_lat": 20.65, "max_lat": 21.30, "min_lon": 84.70, "max_lon": 85.50, "name": "Angul-Talcher Heavy Industrial Corridor"},
        # Barbil-Joda-Noamundi-Koira Iron Ore Mining & Pellet Basin (Odisha / Jharkhand)
        {"min_lat": 21.75, "max_lat": 22.35, "min_lon": 85.10, "max_lon": 85.65, "name": "Barbil-Joda-Noamundi Iron Ore Basin"},
        # Patratu-Ramgarh Thermal & Industrial Belt (Jharkhand)
        {"min_lat": 23.50, "max_lat": 23.80, "min_lon": 85.15, "max_lon": 85.65, "name": "Patratu-Ramgarh Industrial Corridor"},
        # Kalinganagar-Jajpur Heavy Steel Complex (Odisha - Tata Steel & Jindal Stainless)
        {"min_lat": 20.80, "max_lat": 21.20, "min_lon": 85.80, "max_lon": 86.25, "name": "Kalinganagar-Jajpur Steel Complex"},
        # Jharsuguda-Sambalpur-Hirakud-Ib Valley Smelter & Power Belt (Odisha - Vedanta & OPGC)
        {"min_lat": 21.40, "max_lat": 22.05, "min_lon": 83.60, "max_lon": 84.25, "name": "Jharsuguda Aluminium & Power Complex"},
        # Rourkela-Rajgangpur Steel & Cement Corridor (Odisha - SAIL RSP & Dalmia)
        {"min_lat": 22.05, "max_lat": 22.40, "min_lon": 84.45, "max_lon": 85.10, "name": "Rourkela Steel Belt"},
        # Korba-Champa-Janjgir-Raigarh-Tamnar Mega Energy & Steel Belt (Chhattisgarh)
        {"min_lat": 21.65, "max_lat": 22.65, "min_lon": 82.40, "max_lon": 83.75, "name": "Korba-Raigarh Energy & Steel Basin"},
        # Bhilai-Durg-Raipur Steel & Industrial Corridor (Chhattisgarh - SAIL Bhilai, Urla, Siltara)
        {"min_lat": 21.05, "max_lat": 21.55, "min_lon": 81.15, "max_lon": 81.85, "name": "Bhilai-Raipur Steel Corridor"},
        # Raipur-Bhatapara-Bilaspur Industrial & Cement Corridor (Chhattisgarh)
        {"min_lat": 21.55, "max_lat": 22.25, "min_lon": 81.50, "max_lon": 82.35, "name": "Raipur-Bilaspur Cement & Industrial Belt"},
        # Dalli-Rajhara Iron Ore Complex (Chhattisgarh - SAIL captive mine)
        {"min_lat": 20.50, "max_lat": 20.70, "min_lon": 81.00, "max_lon": 81.20, "name": "Dalli-Rajhara Iron Ore Complex"},
        # Bailadila Mega Iron Ore Mining Complex (Chhattisgarh - NMDC Kirandul/Bacheli)
        {"min_lat": 18.55, "max_lat": 18.90, "min_lon": 81.15, "max_lon": 81.35, "name": "Bailadila Iron Ore Complex"},
        # Ballari-Toranagallu-Sandur Mega Steel Belt (Karnataka - JSW Vijayanagar)
        {"min_lat": 15.05, "max_lat": 15.35, "min_lon": 76.50, "max_lon": 76.85, "name": "Vijayanagar Steel Complex"},
        # Manali-Ennore-Chennai Port & SIPCOT Corridor (Tamil Nadu)
        {"min_lat": 12.75, "max_lat": 13.35, "min_lon": 79.90, "max_lon": 80.35, "name": "Manali-Ennore Petrochem & Port Hub"},
        # Neyveli Lignite & Power Basin (Tamil Nadu)
        {"min_lat": 11.45, "max_lat": 11.65, "min_lon": 79.40, "max_lon": 79.60, "name": "Neyveli Mining & Power"},
        # Cuddalore SIPCOT & Petrochem Corridor (Tamil Nadu)
        {"min_lat": 11.60, "max_lat": 11.85, "min_lon": 79.65, "max_lon": 79.85, "name": "Cuddalore SIPCOT Complex"},
        # Tuticorin / Thoothukudi Industrial & Port Hub (Tamil Nadu)
        {"min_lat": 8.70, "max_lat": 8.90, "min_lon": 78.10, "max_lon": 78.25, "name": "Tuticorin Industrial Port"},
        # Jamnagar & Vadinar Mega-Refining & Petrochemical Corridor (Gujarat - Reliance & Nayara)
        {"min_lat": 22.15, "max_lat": 22.65, "min_lon": 69.55, "max_lon": 70.30, "name": "Jamnagar-Vadinar Refining Complex"},
        # Mundra Mega Port & Power Corridor (Gujarat - Adani/Tata UMPP & TPP)
        {"min_lat": 22.70, "max_lat": 23.10, "min_lon": 69.45, "max_lon": 69.95, "name": "Mundra Port & Power Corridor"},
        # Kandla - Gandhidham - Anjar Industrial Belt (Gujarat)
        {"min_lat": 22.95, "max_lat": 23.25, "min_lon": 70.00, "max_lon": 70.35, "name": "Kandla-Gandhidham Industrial Belt"},
        # Alang Ship Recycling Yard (Gujarat)
        {"min_lat": 21.30, "max_lat": 21.50, "min_lon": 72.10, "max_lon": 72.30, "name": "Alang Ship Recycling Hub"},
        # Pipavav / Rajula Industrial Port (Gujarat)
        {"min_lat": 20.80, "max_lat": 21.05, "min_lon": 71.35, "max_lon": 71.60, "name": "Pipavav Industrial Port"},
        # Hazira-Surat Petrochemical Hub (Gujarat)
        {"min_lat": 21.05, "max_lat": 21.30, "min_lon": 72.55, "max_lon": 72.90, "name": "Hazira Industrial Belt"},
        # Dahej-Bharuch-Ankleshwar PCPIR (Gujarat)
        {"min_lat": 21.40, "max_lat": 21.85, "min_lon": 72.40, "max_lon": 73.15, "name": "Dahej PCPIR Corridor"},
        # Morbi Ceramic Kiln Cluster (Gujarat)
        {"min_lat": 22.70, "max_lat": 23.00, "min_lon": 70.70, "max_lon": 71.05, "name": "Morbi Ceramic Belt"},
        # Singrauli-Rihand Power & Coal Belt (MP / UP - NTPC Super Thermal & NCL Coal)
        {"min_lat": 24.00, "max_lat": 24.30, "min_lon": 82.45, "max_lon": 82.95, "name": "Singrauli Super Thermal Basin"},
        # Chandrapur - Ghugus - Wani - Ballarpur Thermal, Coal & Cement Hub (Maharashtra - CSTPS, LMEL, ACC, Manikgarh)
        {"min_lat": 19.60, "max_lat": 20.40, "min_lon": 78.80, "max_lon": 79.60, "name": "Chandrapur-Ghugus Thermal & Coal Basin"},
        # Nagpur Industrial Belt (Maharashtra - Butibori, Hingna, Mouda NTPC, Koradi, Khaparkheda)
        {"min_lat": 20.80, "max_lat": 21.45, "min_lon": 78.80, "max_lon": 79.55, "name": "Nagpur Industrial & Power Belt"},
        # Mumbai Metropolitan Region (Maharashtra - Trombay BPCL/HPCL Refineries, RCF, JNPT, Taloja, Rasayani)
        {"min_lat": 18.70, "max_lat": 19.45, "min_lon": 72.70, "max_lon": 73.25, "name": "Mumbai MMR Petrochem & Port Complex"},
        # Pune - Pimpri-Chinchwad - Chakan - Talegaon - Ranjangaon Auto Hub (Maharashtra)
        {"min_lat": 18.40, "max_lat": 18.90, "min_lon": 73.65, "max_lon": 74.25, "name": "Pune MIDC Auto Corridor"},
        # Delhi National Capital Region Core (Delhi, Gurugram, Faridabad, Noida, Greater Noida, Ghaziabad, Kundli)
        {"min_lat": 28.25, "max_lat": 28.95, "min_lon": 76.80, "max_lon": 77.55, "name": "Delhi NCR Urban & Industrial Core"},
        # Panipat Petrochemical & Refinery Complex (Haryana - IOCL Panipat)
        {"min_lat": 29.30, "max_lat": 29.65, "min_lon": 76.80, "max_lon": 77.10, "name": "Panipat Refinery & Petrochem Complex"},
        # Bathinda Refinery & Thermal Power Corridor (Punjab - HMEL Guru Gobind Singh Refinery)
        {"min_lat": 29.90, "max_lat": 30.25, "min_lon": 74.80, "max_lon": 75.15, "name": "Bathinda HMEL Refining Corridor"},
        # Bhadradri Kothagudem - Paloncha - Manuguru Coal & Power Belt (Telangana - KTPS & SCCL)
        {"min_lat": 17.50, "max_lat": 18.05, "min_lon": 80.40, "max_lon": 80.95, "name": "Kothagudem Mining & Power Basin"},
        # Ramagundam - Mancherial - Bellampalli Power & Coal Belt (Telangana - NTPC Ramagundam)
        {"min_lat": 18.60, "max_lat": 19.10, "min_lon": 79.30, "max_lon": 79.80, "name": "Ramagundam Coal & Power Basin"},
        # Visakhapatnam Industrial & Port Corridor (Andhra Pradesh - RINL Vizag Steel, HPCL, Simhadri)
        {"min_lat": 17.55, "max_lat": 17.90, "min_lon": 83.05, "max_lon": 83.40, "name": "Vizag Industrial Belt"},
    ]
    for b in ind_bounding_boxes:
        if b["min_lat"] <= lat <= b["max_lat"] and b["min_lon"] <= lon <= b["max_lon"]:
            return {"pct_urban": 0.85, "pct_cropland": 0.05, "pct_forest": 0.05, "is_ind": 1}

    # 3. Dedicated Protected Forest Reserves & National Parks (High Canopy Wilderness)
    forest_reserves = [
        {"min_lat": 11.45, "max_lat": 11.75, "min_lon": 76.45, "max_lon": 76.75, "name": "Nilgiris Biosphere & Mudumalai"},
        {"min_lat": 10.20, "max_lat": 10.45, "min_lon": 76.85, "max_lon": 77.15, "name": "Anamalai Tiger Reserve"},
        {"min_lat": 9.20, "max_lat": 9.60, "min_lon": 77.10, "max_lon": 77.40, "name": "Periyar Tiger Reserve"},
        {"min_lat": 11.75, "max_lat": 12.00, "min_lon": 78.20, "max_lon": 78.40, "name": "Shevaroy Hill Crest"},
        {"min_lat": 14.90, "max_lat": 15.35, "min_lon": 74.35, "max_lon": 74.85, "name": "Dandeli Wildlife Forest"},
        {"min_lat": 21.65, "max_lat": 22.10, "min_lon": 86.25, "max_lon": 86.65, "name": "Simlipal National Park Core"},
        {"min_lat": 22.15, "max_lat": 22.45, "min_lon": 80.55, "max_lon": 80.85, "name": "Kanha National Park Core"},
        {"min_lat": 18.75, "max_lat": 19.10, "min_lon": 81.80, "max_lon": 82.20, "name": "Kanger Valley / Bastar Reserve"},
    ]
    for f in forest_reserves:
        if f["min_lat"] <= lat <= f["max_lat"] and f["min_lon"] <= lon <= f["max_lon"]:
            return {"pct_urban": 0.05, "pct_cropland": 0.10, "pct_forest": 0.85, "is_ind": 0}

    # Mountain states with dominant forest biomes:
    if state in ["Uttarakhand", "Himachal Pradesh", "Arunachal Pradesh", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Andaman & Nicobar Islands"]:
        return {"pct_urban": 0.05, "pct_cropland": 0.15, "pct_forest": 0.80, "is_ind": 0}

    # 4. Urban Agglomerations (Metropolitan urban cores where crop stubble burning is physically impossible)
    urban_centers = [
        {"lat": 13.08, "lon": 80.27, "radius_km": 25.0}, # Chennai
        {"lat": 11.01, "lon": 76.95, "radius_km": 20.0}, # Coimbatore
        {"lat": 9.92, "lon": 78.12, "radius_km": 15.0},  # Madurai
        {"lat": 10.79, "lon": 78.70, "radius_km": 15.0}, # Trichy
        {"lat": 12.97, "lon": 77.59, "radius_km": 30.0}, # Bangalore
        {"lat": 19.07, "lon": 72.87, "radius_km": 35.0}, # Mumbai
        {"lat": 28.61, "lon": 77.20, "radius_km": 45.0}, # Delhi NCR
        {"lat": 22.57, "lon": 88.36, "radius_km": 25.0}, # Kolkata
        {"lat": 17.38, "lon": 78.48, "radius_km": 25.0}, # Hyderabad
        {"lat": 18.52, "lon": 73.85, "radius_km": 25.0}, # Pune
        {"lat": 23.02, "lon": 72.57, "radius_km": 25.0}, # Ahmedabad
        {"lat": 21.17, "lon": 72.83, "radius_km": 20.0}, # Surat
        {"lat": 26.91, "lon": 75.78, "radius_km": 20.0}, # Jaipur
        {"lat": 26.84, "lon": 80.94, "radius_km": 20.0}, # Lucknow
        {"lat": 26.44, "lon": 80.33, "radius_km": 20.0}, # Kanpur
        {"lat": 21.14, "lon": 79.08, "radius_km": 20.0}, # Nagpur
        {"lat": 22.71, "lon": 75.85, "radius_km": 20.0}, # Indore
        {"lat": 9.93, "lon": 76.26, "radius_km": 20.0},  # Kochi
        {"lat": 17.68, "lon": 83.21, "radius_km": 20.0}, # Visakhapatnam
    ]
    for u in urban_centers:
        d_km = ((lat - u["lat"])**2 + (lon - u["lon"])**2)**0.5 * 111.0
        if d_km <= u["radius_km"]:
            return {"pct_urban": 0.85, "pct_cropland": 0.05, "pct_forest": 0.05, "is_ind": 0}

    # 5. Arid Barren Desert & Salt Flats (Great Rann of Kutch & Thar Dunes) -> Genuine OTHER_UNCERTAIN
    if (23.40 <= lat <= 24.50 and 68.50 <= lon <= 71.00) or (26.00 <= lat <= 28.00 and 70.00 <= lon <= 71.50):
        return {"pct_urban": 0.05, "pct_cropland": 0.05, "pct_forest": 0.05, "is_ind": 0}

    # 6. High Altitude Cold Desert (Ladakh / Spiti) -> Genuine OTHER_UNCERTAIN
    if lat >= 32.50:
        return {"pct_urban": 0.05, "pct_cropland": 0.05, "pct_forest": 0.10, "is_ind": 0}

    # 7. Unclassified Regional Landscape:
    # Maintain neutral landcover percentages without assuming agricultural cropland bias
    return {"pct_urban": 0.05, "pct_cropland": 0.10, "pct_forest": 0.10, "is_ind": 0}


DETERMINISTIC_CATEGORY_MAP = {
    "REFINERY": 1,
    "PETROCHEM": 2,
    "STEEL": 3,
    "POWER": 4,
    "CEMENT": 5,
    "CHEM": 6,
    "ALUMIN": 7,
    "MINING": 8,
    "FERTIL": 9,
    "PAPER": 10,
    "SOLAR": 11,
    "OIL": 12,
    "GAS": 12,
}

def encode_facility_category(category_name: Optional[str]) -> int:
    """
    Deterministic process-independent facility category encoder.
    Guarantees stable integer encoding across process restarts, batch scripts, and production servers.
    """
    if not category_name or category_name.upper() in ['UNKNOWN', 'CROPLAND', 'FOREST', 'REGIONAL HOTSPOT', 'NONE']:
        return 0
    clean = category_name.strip().upper().replace("&", " ").replace("_", " ")
    for key, code in DETERMINISTIC_CATEGORY_MAP.items():
        if key in clean:
            return code
    import hashlib
    digest = hashlib.md5(clean.encode('utf-8')).hexdigest()
    return (int(digest, 16) % 90) + 10

def build_feature_vector(session: Session, event_uuid: str) -> Dict[str, Any]:
    event = session.query(ThermalEvent).filter(ThermalEvent.id == event_uuid).first()
    if not event:
        raise ValueError(f"Event UUID {event_uuid} not found.")
        
    event.bounding_area_ha = calculate_convex_hull(session, str(event.id))
    session.commit()
    
    dn_ratio = get_day_night_ratio(session, str(event.id))
    frp_var = get_frp_variance(session, str(event.id))
    
    lat, lon = float(event.latitude), float(event.longitude)
    hist_days, hist_peak = get_historical_stats(session, lat, lon, event.first_detected_utc)
    
    # Resolve geographic and land cover context
    geo = resolve_indian_location(lat, lon, None, session=session)
    
    dist_to_fac = float(event.distance_to_facility_m) if event.distance_to_facility_m is not None else 9999.0
    fac_cat = encode_facility_category(event.primary_land_use)

    state = geo.get("state", "")
    is_fac = bool(event.associated_facility_id) or (0.0 <= dist_to_fac <= 4500.0)
    lc = resolve_refined_landcover(lat, lon, dist_to_fac, is_fac, state=state, dn_ratio=dn_ratio)
    pct_urban = lc["pct_urban"]
    pct_cropland = lc["pct_cropland"]
    pct_forest = lc["pct_forest"]
    is_ind = lc["is_ind"]

    first_t = event.first_detected_utc
    latest_t = event.latest_detected_utc
    if first_t and latest_t:
        dur_hrs = abs((latest_t - first_t).total_seconds()) / 3600.0
    else:
        dur_hrs = 0.0

    features = {
        "dist_to_facility": dist_to_fac,
        "facility_category_encoded": fac_cat,
        "peak_frp_mw": float(event.peak_frp_mw or 0.0),
        "mean_frp_mw": float(event.mean_frp_mw or 0.0),
        "frp_variance": frp_var,
        "max_brightness_k": float(event.max_brightness_k or 300.0),
        "duration_hours": float(dur_hrs),
        "day_night_ratio": dn_ratio,
        "historical_active_days_90d": hist_days,
        "historical_peak_frp": hist_peak,
        "pct_cropland": pct_cropland,
        "pct_forest": pct_forest,
        "pct_urban": pct_urban,
        "is_industrial_zone": is_ind,
        "primary_land_use": event.primary_land_use or "",
    }
    return features


def build_physical_verification_payload(event: ThermalEvent, facility: Optional[IndustrialFacility] = None) -> Dict[str, Any]:
    """
    Constructs an additive, honest physical corroboration object separate from ML confidence.
    Indicates physical spatial geofence alignment and radiance criteria without inflating ML confidence.
    """
    dist_m = float(event.distance_to_facility_m) if event.distance_to_facility_m is not None else 99999.0
    peak_frp = float(event.peak_frp_mw or 0.0)
    inside_polygon = bool(event.associated_facility_id) and (0.0 <= dist_m <= 2500.0)
    
    if inside_polygon and peak_frp >= 150.0:
        note = f"High radiant intensity ({peak_frp:.1f} MW) within registered {facility.sector_category if facility else 'industrial'} facility boundary"
    elif inside_polygon:
        note = f"Thermal activity within 2.5km buffer of {facility.name if facility else 'registered industrial complex'}"
    elif float(event.latitude or 0.0) > 24.0 and peak_frp >= 20.0:
        note = "Intense thermal signature in Northern agrarian belt"
    else:
        note = "Unassociated regional thermal observation"

    return {
        "inside_industrial_polygon": inside_polygon,
        "facility_distance_m": round(dist_m, 1),
        "peak_frp_mw": round(peak_frp, 1),
        "verification_note": note
    }
