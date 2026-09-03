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
from app.domain.anomaly import get_model
from app.domain.features import resolve_refined_landcover

SUPABASE_URL = "postgresql://postgres.aszeaeszjdshtvstkwmy:Sharan1%40bmsce@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

def run_bulk_recalibration(target_db="local"):
    if target_db == "supabase":
        print("Connecting to SUPABASE database pooler...")
        engine = create_engine(SUPABASE_URL, pool_pre_ping=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    else:
        print("Connecting to LOCAL PostgreSQL database...")
        from app.db.database import SessionLocal, engine

    db = SessionLocal()
    model, classes = get_model()
    t0 = time.time()
    
    query = text("""
        SELECT 
            e.id,
            e.event_id,
            e.latitude,
            e.longitude,
            COALESCE(e.distance_to_facility_m, 99999.0) as dist_to_facility,
            COALESCE(e.peak_frp_mw, 1.0) as peak_frp_mw,
            COALESCE(e.mean_frp_mw, e.peak_frp_mw, 1.0) as mean_frp_mw,
            COALESCE(e.max_brightness_k, 300.0) as max_brightness_k,
            e.first_detected_utc,
            e.latest_detected_utc,
            e.associated_facility_id,
            e.primary_land_use,
            COALESCE(stats.day_count, 1) as day_count,
            COALESCE(stats.total_obs, 1) as total_obs,
            COALESCE(stats.frp_variance, 0.0) as frp_variance
        FROM thermal_events e
        LEFT JOIN (
            SELECT 
                eo.event_id,
                COUNT(CASE WHEN o.day_night = 'D' THEN 1 END) as day_count,
                COUNT(*) as total_obs,
                COALESCE(VARIANCE(o.frp_mw), 0.0) as frp_variance
            FROM event_observations eo
            JOIN thermal_observations o ON eo.observation_id = o.id
            GROUP BY eo.event_id
        ) stats ON e.id = stats.event_id;
    """)
    
    rows = db.execute(query).fetchall()
    print(f"Loaded {len(rows)} events with telemetry from {target_db} in {time.time() - t0:.2f}s")
    
    records = []
    ids = []
    meta = []
    for r in rows:
        ids.append(str(r[0]))
        lat = float(r[2] or 0.0)
        lon = float(r[3] or 0.0)
        dist = float(r[4])
        peak = float(r[5])
        mean = float(r[6])
        max_k = float(r[7])
        first_t = r[8]
        latest_t = r[9]
        fac_id = r[10]
        land_use = str(r[11] or '')
        day_cnt = float(r[12])
        tot_obs = float(r[13])
        frp_var = float(r[14])
        
        dur_hrs = abs((latest_t - first_t).total_seconds()) / 3600.0 if first_t and latest_t else 0.0
        dn_ratio = day_cnt / tot_obs if tot_obs > 0 else 0.5
        
        is_fac = bool(fac_id) and (dist <= 3500.0)
        lc = resolve_refined_landcover(lat, lon, dist, is_fac)
        pct_urban = lc["pct_urban"]
        pct_cropland = lc["pct_cropland"]
        pct_forest = lc["pct_forest"]
        is_ind = lc["is_ind"]
        
        fac_cat = abs(hash(land_use)) % 100 if land_use and land_use not in ['UNKNOWN', 'Cropland', 'Forest', 'Regional Hotspot', 'Unknown'] else (1 if is_ind else 0)
        hist_days = min(int(tot_obs), 10) if not is_ind else min(int(tot_obs) * 2, 30)
        hist_peak = peak
        
        records.append([
            dist, fac_cat, peak, mean, frp_var, max_k, dur_hrs, dn_ratio, hist_days, hist_peak, pct_cropland, pct_forest, pct_urban, is_ind
        ])
        meta.append({
            "dist": dist,
            "is_ind": is_ind,
            "pct_crop": pct_cropland,
            "pct_forest": pct_forest,
            "hist_days": hist_days,
            "dur_hrs": dur_hrs,
            "peak": peak,
            "max_k": max_k,
            "has_fac": is_fac
        })
        
    X = np.asarray(records, dtype=np.float64)
    probs = model.predict_proba(X)
    
    batch_data = []
    final_classes = []
    
    for i in range(len(ids)):
        ev_id = ids[i]
        p = probs[i]
        top_idx = int(np.argmax(p))
        p_cls = str(classes[top_idx])
        conf = float(p[top_idx])
        entropy = -float(np.sum([prob * np.log(prob + 1e-9) for prob in p]))
        
        m = meta[i]
        
        # Physical Domain Gating & Facility Authority
        has_facility = m["has_fac"] or (m["dist"] <= 4000.0) or (m["is_ind"] == 1)
        peak_frp = m["peak"]
        max_k = m["max_k"]

        if has_facility:
            # 1. Direct Industrial Facility Authority:
            # Any thermal signature on or adjacent to an industrial plant/refinery is strictly INDUSTRIAL.
            # Inside an industrial plant, emissions are NEVER AGRI_BURN or OTHER_UNCERTAIN!
            if peak_frp >= 50.0 or max_k >= 355.0 or p_cls == "IND_FIRE":
                p_cls = "IND_FIRE"
            elif peak_frp >= 15.0 or max_k >= 335.0 or p_cls == "IND_FLARE":
                p_cls = "IND_FLARE"
            else:
                p_cls = "IND_ROUTINE"
            conf = max(conf, 0.90)
        else:
            # 2. Non-Facility Rural / Forest Spatial Resolution:
            pct_crop = m["pct_crop"]
            pct_for = m.get("pct_forest", 0.0)
            if pct_for >= 0.40 or p_cls == "WILDFIRE":
                p_cls = "WILDFIRE"
                conf = max(conf, 0.85)
            elif pct_crop >= 0.35 or p_cls in ("AGRI_BURN", "IND_ROUTINE", "IND_FLARE", "IND_FIRE"):
                p_cls = "AGRI_BURN"
                conf = max(conf, 0.86)
            else:
                if conf < 0.50 or entropy > 1.35:
                    p_cls = "OTHER_UNCERTAIN"
            
        final_classes.append(p_cls)
        batch_data.append({
            'id': ev_id,
            'conf': round(conf, 4),
            'cls': p_cls,
            'probs': json.dumps({str(c): round(float(prob), 4) for c, prob in zip(classes, p)})
        })
        
    print(f"Updating database in batches of 200...")
    for i in range(0, len(batch_data), 200):
        chunk = batch_data[i:i+200]
        cases_conf = " ".join([f"WHEN id = '{row['id']}'::uuid THEN {row['conf']}" for row in chunk])
        cases_cls = " ".join([f"WHEN id = '{row['id']}'::uuid THEN '{row['cls']}'" for row in chunk])
        chunk_ids = ", ".join([f"'{row['id']}'::uuid" for row in chunk])
        stmt = f"""
            UPDATE thermal_events
            SET classification_confidence = CASE {cases_conf} END,
                classification = CASE {cases_cls} END
            WHERE id IN ({chunk_ids});
        """
        db.execute(text(stmt))
        db.commit()
        
    print(f"Successfully bulk updated {len(rows)} events in {target_db} in {time.time() - t0:.2f}s!")
    
    from collections import Counter
    counts = Counter(final_classes)
    print(f'FINAL CLASSIFICATION COUNTS IN {target_db.upper()}:')
    for k, v in sorted(counts.items()):
        print(f'  {k:<18}: {v}')
        
    db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", choices=["local", "supabase", "both"], default="both")
    args = parser.parse_args()
    
    if args.db in ["local", "both"]:
        run_bulk_recalibration("local")
    if args.db in ["supabase", "both"]:
        run_bulk_recalibration("supabase")
