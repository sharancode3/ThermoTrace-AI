import os
import sys
import numpy as np
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import SessionLocal
from app.db.models import IndustrialFacility

def update_all_facility_baselines():
    print("Starting Baseline Persistence Pipeline...")
    session = SessionLocal()
    try:
        # Get all facilities
        facilities = session.query(IndustrialFacility).all()
        count = 0
        for fac in facilities:
            # Calculate stats for the last 90 days (or all time if we prefer, but standard is 90)
            query = text('''
                SELECT 
                    AVG(peak_frp_mw) as mean_frp,
                    STDDEV(peak_frp_mw) as std_frp,
                    COUNT(*) as event_count,
                    PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY peak_frp_mw) as median_frp
                FROM thermal_events
                WHERE associated_facility_id = :fac_id
            ''')
            res = session.execute(query, {"fac_id": fac.id}).fetchone()
            
            if res and res.event_count > 0:
                fac.baseline_frp_mean = float(res.mean_frp) if res.mean_frp is not None else 0.0
                fac.baseline_frp_std = float(res.std_frp) if res.std_frp is not None else 0.0
                fac.baseline_frp_median = float(res.median_frp) if res.median_frp is not None else 0.0
                fac.historical_event_count = res.event_count
                count += 1
            else:
                fac.baseline_frp_mean = 0.0
                fac.baseline_frp_std = 0.0
                fac.baseline_frp_median = 0.0
                fac.historical_event_count = 0
                
        session.commit()
        print(f"Successfully updated baselines for {count} facilities.")
    except Exception as e:
        session.rollback()
        print(f"Failed to update baselines: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    update_all_facility_baselines()
