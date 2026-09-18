"""
Bulk Recalibration and Synchronization Engine
Synchronizes thermal_events, event_classifications, and event_anomalies with:
- Calibrated Float64XGBClassifier (v1.1.0)
- Automated Abstention Gate (conf < 0.50 or entropy > 1.35 -> OTHER_UNCERTAIN)
- Spatial Domain Integrity Gate (d > 2500m & non-industrial -> OTHER_UNCERTAIN)
- Perimeter Agricultural Disambiguation Gate (crop >= 70% & 0 active days -> AGRI_BURN)
- Robust Median/MAD anomaly baselines
Supports local PostgreSQL and remote Supabase (--supabase).
"""
import os
import sys
import json
import time
import argparse
import numpy as np
import pandas as pd
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.domain.anomaly import get_model, process_event_intelligence
from app.db.models import ThermalEvent

def run_bulk_recalibration(target_db="local"):
    if target_db == "supabase":
        print("Connecting to SUPABASE database pooler...")
        from app.db.database import DATABASE_URL
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    else:
        print("Connecting to LOCAL PostgreSQL database...")
        from app.db.database import SessionLocal, engine

    db = SessionLocal()
    t0 = time.time()
    
    events = db.query(ThermalEvent).all()
    print(f"Loaded {len(events)} events for canonical recalibration in {target_db} in {time.time() - t0:.2f}s")
    
    recalibrated_count = 0
    for ev in events:
        process_event_intelligence(db, ev.event_id)
        recalibrated_count += 1
        if recalibrated_count % 100 == 0:
            print(f"Processed {recalibrated_count}/{len(events)} events...")

    print(f"Successfully canonical-recalibrated {recalibrated_count} events in {target_db} in {time.time() - t0:.2f}s!")
    db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", choices=["local", "supabase", "both"], default="local")
    args = parser.parse_args()
    
    if args.db in ["local", "both"]:
        run_bulk_recalibration("local")
    if args.db in ["supabase", "both"]:
        run_bulk_recalibration("supabase")
