"""
High-Performance Industrial & Urban Classification Hardening
ThermoTrace AI
"""
import os
import sys
import math
import numpy as np
from datetime import datetime, timezone, timedelta

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_dir)

from app.db.database import SessionLocal
from app.db.models import ThermalEvent, IndustrialFacility
from app.domain.anomaly import process_event_intelligence
from app.domain.features import resolve_refined_landcover
from app.api.endpoints import clear_gis_cache

def run_hardening():
    session = SessionLocal(expire_on_commit=False)
    print("Loading all facilities from database...", flush=True)
    facs = session.query(IndustrialFacility).all()
    print(f"Loaded {len(facs)} facilities.", flush=True)
    
    fac_coords = np.array([[float(f.latitude), float(f.longitude)] for f in facs])
    
    # 1. First extract all active 24-hour events (the ones visible on the user's map!)
    now_utc = datetime.now(timezone.utc)
    cutoff_24h = now_utc - timedelta(hours=24)
    active_events = session.query(ThermalEvent).filter(ThermalEvent.latest_detected_utc >= cutoff_24h).all()
    print(f"\nPhase 1: Hardening {len(active_events)} Active 24-Hour Events...", flush=True)
    
    reclassified_active = 0
    for i, ev in enumerate(active_events):
        lat = float(ev.latitude)
        lon = float(ev.longitude)
        old_cls = ev.classification
        
        # Spatial distance to nearest facility
        dlat = (fac_coords[:, 0] - lat) * 111000.0
        dlon = (fac_coords[:, 1] - lon) * (111000.0 * math.cos(math.radians(lat)))
        dists = np.sqrt(dlat**2 + dlon**2)
        min_idx = int(np.argmin(dists))
        min_dist = float(dists[min_idx])
        nearest_fac = facs[min_idx]
        
        sec = (nearest_fac.sector_category or "").upper()
        is_mega = any(k in sec for k in [
            "REFIN", "PETRO", "POWER", "STEEL", "CEMENT", "MINE", "MINING",
            "CHEM", "SMELT", "ALUMIN", "FERTIL", "PORT", "OIL", "GAS", "LNG"
        ])
        threshold = 5000.0 if is_mega else 3500.0
        
        lc = resolve_refined_landcover(lat, lon, min_dist, min_dist <= threshold)
        is_ind = (lc["is_ind"] == 1)
        
        # Update facility association if within threshold
        if min_dist <= threshold:
            ev.associated_facility_id = nearest_fac.id
            ev.distance_to_facility_m = min_dist
            ev.primary_land_use = nearest_fac.sector_category or "Industrial"
        elif is_ind:
            ev.distance_to_facility_m = min_dist
            if not ev.primary_land_use or ev.primary_land_use == "Regional Hotspot":
                ev.primary_land_use = "Industrial Corridor"
        else:
            ev.distance_to_facility_m = min_dist
            
        process_event_intelligence(session, ev.event_id)
        if ev.classification != old_cls:
            reclassified_active += 1
            print(f"  -> [{ev.event_id}] {old_cls} => {ev.classification} ({ev.anomaly_tier}) at {lat:.3f}, {lon:.3f} (dist: {min_dist:.0f}m, ind: {is_ind})", flush=True)
            
        if (i + 1) % 15 == 0:
            session.commit()
            print(f"Active events progress: {i+1}/{len(active_events)} processed...", flush=True)
            
    session.commit()
    print(f"Phase 1 Complete! Active events reclassified: {reclassified_active}/{len(active_events)}", flush=True)
    
    # 2. Phase 2: Historical events in industrial corridors or near facilities
    print("\nPhase 2: Hardening near-facility and industrial corridor historical events...", flush=True)
    candidate_historical = session.query(ThermalEvent).filter(
        ThermalEvent.latest_detected_utc < cutoff_24h,
        (
            (ThermalEvent.associated_facility_id != None) |
            (ThermalEvent.distance_to_facility_m <= 5000.0) |
            (ThermalEvent.classification.in_(["OTHER_UNCERTAIN", "AGRI_BURN"]))
        )
    ).all()
    print(f"Loaded {len(candidate_historical)} candidate historical events.", flush=True)
    
    reclassified_hist = 0
    hist_to_process = []
    for ev in candidate_historical:
        lat = float(ev.latitude)
        lon = float(ev.longitude)
        dlat = (fac_coords[:, 0] - lat) * 111000.0
        dlon = (fac_coords[:, 1] - lon) * (111000.0 * math.cos(math.radians(lat)))
        dists = np.sqrt(dlat**2 + dlon**2)
        min_idx = int(np.argmin(dists))
        min_dist = float(dists[min_idx])
        nearest_fac = facs[min_idx]
        
        sec = (nearest_fac.sector_category or "").upper()
        is_mega = any(k in sec for k in [
            "REFIN", "PETRO", "POWER", "STEEL", "CEMENT", "MINE", "MINING",
            "CHEM", "SMELT", "ALUMIN", "FERTIL", "PORT", "OIL", "GAS", "LNG"
        ])
        threshold = 5000.0 if is_mega else 3500.0
        
        lc = resolve_refined_landcover(lat, lon, min_dist, min_dist <= threshold)
        is_ind = (lc["is_ind"] == 1)
        is_urban = (lc["pct_urban"] >= 0.70)
        
        if min_dist <= threshold or is_ind or is_urban:
            hist_to_process.append((ev, min_dist, nearest_fac, threshold, is_ind, is_urban))
            
    print(f"Filtering narrowed to {len(hist_to_process)} historical events needing hardening.", flush=True)
    
    for i, (ev, min_dist, nearest_fac, threshold, is_ind, is_urban) in enumerate(hist_to_process):
        old_cls = ev.classification
        if min_dist <= threshold:
            ev.associated_facility_id = nearest_fac.id
            ev.distance_to_facility_m = min_dist
            ev.primary_land_use = nearest_fac.sector_category or "Industrial"
        elif is_ind:
            ev.distance_to_facility_m = min_dist
            if not ev.primary_land_use or ev.primary_land_use == "Regional Hotspot":
                ev.primary_land_use = "Industrial Corridor"
        else:
            ev.distance_to_facility_m = min_dist
            
        process_event_intelligence(session, ev.event_id)
        if ev.classification != old_cls:
            reclassified_hist += 1
            
        if (i + 1) % 25 == 0:
            session.commit()
            print(f"Historical progress: {i+1}/{len(hist_to_process)} (Reclassified: {reclassified_hist})...", flush=True)
            
    session.commit()
    session.close()
    clear_gis_cache()
    print(f"\nALL HARDENING COMPLETE! Total reclassified: {reclassified_active + reclassified_hist}")

if __name__ == "__main__":
    run_hardening()
