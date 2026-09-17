import os
import sys
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.db.models import ThermalEvent, EventClassification, EventAnomaly
from app.domain.features import build_feature_vector
from app.domain.anomaly import get_model, process_event_intelligence
from app.domain.lifecycle import evaluate_lifecycle

def dry_run_reclassify(event_ids=None, limit=20, apply_changes=False):
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    model, classes = get_model()
    
    if model is None or classes is None:
        print("ERROR: ML model or classes artifact could not be loaded!")
        db.close()
        return

    query = db.query(ThermalEvent)
    if event_ids:
        query = query.filter(ThermalEvent.event_id.in_(event_ids))
    else:
        query = query.order_by(ThermalEvent.latest_detected_utc.desc())
        
    events = query.limit(limit).all()
    print(f"\n=========================================================================")
    print(f"THERMOTRACE DRY-RUN RECLASSIFICATION & FRESHNESS CHECK")
    print(f"Mode: {'APPLY (COMMITTING CHANGES)' if apply_changes else 'DRY-RUN (READ-ONLY PREVIEW)'}")
    print(f"Total events to inspect: {len(events)}")
    print(f"Model: thermo_xgb_v1.1.0 | Classes: {list(classes)}")
    print(f"=========================================================================\n")
    
    feature_cols = [
        "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
        "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
        "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
        "pct_forest", "pct_urban", "is_industrial_zone"
    ]
    
    reclassified_count = 0
    
    for evt in events:
        latest = evt.latest_detected_utc
        if latest and latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)
        
        life_info = evaluate_lifecycle(latest, reference_time=now, current_persisted_status=evt.lifecycle_status)
        
        # Current DB classification
        existing_cls = db.query(EventClassification).filter(EventClassification.event_id == evt.id).first()
        existing_anom = db.query(EventAnomaly).filter(EventAnomaly.event_id == evt.id).first()
        
        cur_class = existing_cls.predicted_class if existing_cls else "NONE"
        cur_conf = (existing_cls.confidence_pct / 100.0 if existing_cls.confidence_pct > 1.0 else existing_cls.confidence_pct) if existing_cls else 0.0
        cur_tier = evt.anomaly_tier or (existing_anom.anomaly_severity if existing_anom else "NONE")
        
        # Build 14-D features and compute genuine ML prediction
        features = build_feature_vector(db, str(evt.id))
        x_df = pd.DataFrame([features])[feature_cols].astype(np.float64)
        probs = model.predict_proba(x_df)[0]
        pred_idx = int(np.argmax(probs))
        raw_pred_class = str(classes[pred_idx])
        raw_pred_conf = float(probs[pred_idx])
        
        # Evaluate physical gating rules
        dist_fac = float(features.get("dist_to_facility", 99999.0))
        is_immediate_plant_boundary = bool(evt.associated_facility_id) and (dist_fac <= 500.0)
        peak_frp = float(evt.peak_frp_mw or 0.0)
        max_bright = float(features.get("max_brightness_k", 300.0))
        
        assigned_class = raw_pred_class
        if is_immediate_plant_boundary and peak_frp >= 500.0 and max_bright >= 380.0:
            assigned_class = "IND_FIRE"
        elif is_immediate_plant_boundary and ("flare" in str(features.get("primary_land_use", "")).lower() or "refin" in str(features.get("primary_land_use", "")).lower()):
            assigned_class = "IND_FLARE"
        elif is_immediate_plant_boundary and raw_pred_conf < 0.50:
            assigned_class = "IND_ROUTINE"
            
        class_prob_map = {str(c): float(p) for c, p in zip(classes, probs)}
        assigned_conf = class_prob_map.get(assigned_class, raw_pred_conf)
        
        elapsed_str = f"{life_info['elapsed_hours']:.1f}h" if life_info['elapsed_hours'] is not None else "N/A"
        is_diff = (cur_class != assigned_class) or (evt.lifecycle_status != life_info["lifecycle_status"])
        if is_diff:
            reclassified_count += 1
            
        diff_flag = " [*DIFFERENCE*]" if is_diff else ""
        print(f"Event: {evt.event_id:<18} | Age: {elapsed_str:<7} | Freshness: {life_info['freshness_status']:<10}{diff_flag}")
        print(f"  Lifecycle:      {evt.lifecycle_status:<15} -> {life_info['lifecycle_status']}")
        print(f"  Classification: {cur_class:<15} -> {assigned_class:<15} (Conf: {cur_conf:.3f} -> {assigned_conf:.3f})")
        print(f"  Anomaly Tier:   {cur_tier:<15} (Preserved: True)")
        print(f"  Dist to Plant:  {dist_fac:.0f}m (Immediate Parcel <=500m: {is_immediate_plant_boundary})")
        print(f"  Raw ML Probs:   " + ", ".join([f"{k}: {v:.2f}" for k, v in class_prob_map.items()]))
        print(f"  -----------------------------------------------------------------------")
        
        if apply_changes:
            process_event_intelligence(db, evt.event_id)
            evt.lifecycle_status = life_info["lifecycle_status"]
            db.commit()

    print(f"\nSummary:")
    print(f"  Inspected: {len(events)}")
    print(f"  Differences detected: {reclassified_count}")
    if not apply_changes:
        print(f"  Database was NOT modified (run with --apply to commit changes).")
    else:
        print(f"  Successfully applied and committed updates to database.")
    db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dry-run or apply reclassification and lifecycle normalization.")
    parser.add_argument("--event-id", nargs="+", help="Specific event IDs to inspect (e.g. EVT-IN-GUJ-0001)")
    parser.add_argument("--limit", type=int, default=10, help="Number of events to inspect (default: 10)")
    parser.add_argument("--apply", action="store_true", help="Commit changes to database (default: False)")
    args = parser.parse_args()
    
    dry_run_reclassify(event_ids=args.event_id, limit=args.limit, apply_changes=args.apply)
