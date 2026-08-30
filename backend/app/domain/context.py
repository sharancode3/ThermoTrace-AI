import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.models import ThermalEvent
from app.db.database import SessionLocal

def attach_spatial_context(session: Session, event_id: str) -> None:
    # 2000 meters = ~0.018 degrees, much faster for PostGIS to pre-filter
    query = text('''
        SELECT 
            f.id as facility_id,
            f.sector_category,
            ST_Distance(e.centroid::geography, f.facility_geom::geography) as dist_m
        FROM thermal_events e
        JOIN industrial_facilities f ON ST_DWithin(e.centroid, f.facility_geom, 0.05)
        WHERE e.event_id = :event_id
        AND ST_DWithin(e.centroid::geography, f.facility_geom::geography, 2000)
        ORDER BY dist_m ASC
        LIMIT 1
    ''')
    
    result = session.execute(query, {"event_id": event_id}).fetchone()
    
    event = session.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not event:
        return
        
    if result:
        event.associated_facility_id = result.facility_id
        event.distance_to_facility_m = result.dist_m
        event.primary_land_use = result.sector_category
    else:
        event.associated_facility_id = None
        event.distance_to_facility_m = -1.0
        event.primary_land_use = 'UNKNOWN'
            
    session.commit()

def process_all_active_contexts() -> int:
    session = SessionLocal()
    events = session.query(ThermalEvent.event_id).filter(ThermalEvent.lifecycle_status == 'ACTIVE').all()
    event_ids = [e[0] for e in events]
    session.close()

    count = 0
    total = len(event_ids)
    print(f"Processing context for {total} events...")
    
    for idx, evt_id in enumerate(event_ids):
        s2 = SessionLocal()
        try:
            attach_spatial_context(s2, evt_id)
            count += 1
            if count % 50 == 0:
                print(f"  Processed {count}/{total}")
        except Exception as e:
            print(f"Error processing {evt_id}: {e}")
        finally:
            s2.close()
    return count

if __name__ == "__main__":
    c = process_all_active_contexts()
    print(f"CHECKPOINT B: Attached context to {c} events.")
