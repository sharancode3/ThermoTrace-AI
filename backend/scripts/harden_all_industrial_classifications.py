"""
Harden All Industrial and Urban Classifications Across ThermoTrace AI
Associates events with nearest facilities, enforces corridor geofencing,
runs ML intelligence inference, and updates database records.
"""
import os
import sys
import math
import numpy as np

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_dir)

from app.db.database import SessionLocal
from app.db.models import ThermalEvent, IndustrialFacility
from app.domain.anomaly import process_event_intelligence
from app.domain.features import resolve_refined_landcover
from app.api.endpoints import clear_gis_cache

def harden_events():
    session = SessionLocal()
    print("Loading all facilities from database...")
    facs = session.query(IndustrialFacility).all()
    print(f"Loaded {len(facs)} facilities.")
    
    fac_coords = np.array([[float(f.latitude), float(f.longitude)] for f in facs])
    
    print("\nLoading active events and candidate industrial events...")
    all_events = session.query(ThermalEvent).all()
    print(f"Loaded {len(all_events)} total events from database.")
    
    updated_count = 0
    reclassified_count = 0
    
    # Process events
    for i, ev in enumerate(all_events):
        lat = float(ev.latitude)
        lon = float(ev.longitude)
        
        # 1. Spatial distance to nearest facility
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
        
        # 2. Check corridor landcover
        lc = resolve_refined_landcover(lat, lon, min_dist, min_dist <= threshold)
        is_ind_corridor = (lc["is_ind"] == 1)
        
        needs_update = False
        
        # Associate facility if within threshold
        if min_dist <= threshold:
            if ev.associated_facility_id != nearest_fac.id or ev.distance_to_facility_m != min_dist:
                ev.associated_facility_id = nearest_fac.id
                ev.distance_to_facility_m = min_dist
                ev.primary_land_use = nearest_fac.sector_category or "Industrial"
                needs_update = True
        elif is_ind_corridor:
            if ev.primary_land_use != "Industrial Corridor":
                ev.primary_land_use = "Industrial Corridor"
                ev.distance_to_facility_m = min_dist
                needs_update = True
                
        # If event was previously AGRI_BURN or OTHER_UNCERTAIN in an industrial zone/corridor or urban core:
        old_cls = ev.classification
        
        # Re-evaluate event intelligence
        if needs_update or min_dist <= threshold or is_ind_corridor or lc["pct_urban"] >= 0.70:
            process_event_intelligence(session, ev.event_id)
            if ev.classification != old_cls:
                reclassified_count += 1
            updated_count += 1
            
        if (i + 1) % 50 == 0:
            session.commit()
            print(f"[{i+1}/{len(all_events)}] processed... Updated: {updated_count}, Reclassified: {reclassified_count}", flush=True)
            
    session.commit()
    session.close()
    clear_gis_cache()
    print(f"\nFinished hardening! Processed: {len(all_events)}, Updated/Checked: {updated_count}, Reclassified: {reclassified_count}")

if __name__ == "__main__":
    harden_events()
