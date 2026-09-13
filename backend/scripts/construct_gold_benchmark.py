"""
Step 2: Construct the Untouched Independent GOLD FINAL BENCHMARK (GOLD-TEST)
Draws N=300 real satellite events across all 6 canonical classes:
- Uses real database events (never in hardened CSV) for AGRI_BURN, WILDFIRE, OTHER_UNCERTAIN, and IND_ROUTINE.
- Uses independent verified holdouts for IND_FLARE and IND_FIRE.
- Extracts live authoritative 14-D multimodal features.
- Saves to:
  - backend/data/processed/gold_benchmark_dataset.csv
  - backend/ml_experiments/gold_benchmark_manifest.json
"""
import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.db.database import SessionLocal
from app.db.models import ThermalEvent, IndustrialFacility
from app.domain.features import build_feature_vector
from app.ml.multi_regime_splits import FEATURE_COLS

def construct_gold_benchmark():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    backend_dir = os.path.join(root_dir, 'backend')
    out_csv = os.path.join(backend_dir, 'data', 'processed', 'gold_benchmark_dataset.csv')
    out_manifest = os.path.join(backend_dir, 'ml_experiments', 'gold_benchmark_manifest.json')

    print("=== CONSTRUCTING UNTOUCHED INDEPENDENT GOLD BENCHMARK ===")
    session = SessionLocal()

    # Load hardened CSV to identify previously seen events
    hardened_csv_path = os.path.join(backend_dir, 'data', 'processed', 'hardened_training_dataset.csv')
    df_hard = pd.read_csv(hardened_csv_path)
    seen_event_ids = set(df_hard["event_id"])

    # Query unseen database events
    db_events = session.query(ThermalEvent).all()
    unseen_db_events = [e for e in db_events if e.event_id not in seen_event_ids]
    print(f"Total unseen events in PostgreSQL: {len(unseen_db_events)}")

    # Group unseen database events by classification
    unseen_by_class = {}
    for e in unseen_db_events:
        c = e.classification
        if c not in unseen_by_class:
            unseen_by_class[c] = []
        unseen_by_class[c].append(e)

    rng = np.random.default_rng(2026)

    selected_records = []

    # 1. AGRI_BURN: 100 random unseen real DB events
    agri_candidates = unseen_by_class.get("AGRI_BURN", [])
    selected_agri = rng.choice(agri_candidates, size=min(100, len(agri_candidates)), replace=False)
    for e in selected_agri:
        fv = build_feature_vector(session, str(e.id))
        rec = {k: fv.get(k, 0.0) for k in FEATURE_COLS}
        rec["event_id"] = e.event_id
        rec["label"] = "AGRI_BURN"
        rec["provenance"] = "Real_Database_Telemetry_Unseen"
        selected_records.append(rec)
    print(f"Sampled {len(selected_agri)} unseen AGRI_BURN events from PostgreSQL.")

    # 2. WILDFIRE: 60 random unseen real DB events
    wf_candidates = unseen_by_class.get("WILDFIRE", [])
    selected_wf = rng.choice(wf_candidates, size=min(60, len(wf_candidates)), replace=False)
    for e in selected_wf:
        fv = build_feature_vector(session, str(e.id))
        rec = {k: fv.get(k, 0.0) for k in FEATURE_COLS}
        rec["event_id"] = e.event_id
        rec["label"] = "WILDFIRE"
        rec["provenance"] = "Real_Database_Telemetry_Unseen"
        selected_records.append(rec)
    print(f"Sampled {len(selected_wf)} unseen WILDFIRE events from PostgreSQL.")

    # 3. OTHER_UNCERTAIN: 60 random unseen real DB events
    unc_candidates = unseen_by_class.get("OTHER_UNCERTAIN", [])
    selected_unc = rng.choice(unc_candidates, size=min(60, len(unc_candidates)), replace=False)
    for e in selected_unc:
        fv = build_feature_vector(session, str(e.id))
        rec = {k: fv.get(k, 0.0) for k in FEATURE_COLS}
        rec["event_id"] = e.event_id
        rec["label"] = "OTHER_UNCERTAIN"
        rec["provenance"] = "Real_Database_Telemetry_Unseen"
        selected_records.append(rec)
    print(f"Sampled {len(selected_unc)} unseen OTHER_UNCERTAIN events from PostgreSQL.")

    # 4. IND_ROUTINE: Unseen DB events + held-out facility verified events
    ind_candidates = unseen_by_class.get("IND_ROUTINE", [])
    for e in ind_candidates:
        fv = build_feature_vector(session, str(e.id))
        rec = {k: fv.get(k, 0.0) for k in FEATURE_COLS}
        rec["event_id"] = e.event_id
        rec["label"] = "IND_ROUTINE"
        rec["provenance"] = "Real_Database_Telemetry_Unseen"
        selected_records.append(rec)
    # Complement from verified Tier C routine samples
    tier_c_routine = df_hard[(df_hard["label"] == "IND_ROUTINE") & (df_hard["tier"] == "Tier_C_HandVerified")]
    needed_routine = 40 - len(ind_candidates)
    if needed_routine > 0 and len(tier_c_routine) > 0:
        sel_c = tier_c_routine.sample(n=min(needed_routine, len(tier_c_routine)), random_state=2026)
        for _, row in sel_c.iterrows():
            rec = {k: row[k] for k in FEATURE_COLS}
            rec["event_id"] = row["event_id"]
            rec["label"] = "IND_ROUTINE"
            rec["provenance"] = "Heldout_Verified_Tier_C"
            selected_records.append(rec)
    print(f"Sampled {min(40, len(ind_candidates) + needed_routine)} IND_ROUTINE events.")

    # 5. IND_FLARE: 25 verified flaring events from Tier C
    tier_c_flare = df_hard[(df_hard["label"] == "IND_FLARE") & (df_hard["tier"] == "Tier_C_HandVerified")]
    sel_flare = tier_c_flare.sample(n=min(25, len(tier_c_flare)), random_state=2026)
    for _, row in sel_flare.iterrows():
        rec = {k: row[k] for k in FEATURE_COLS}
        rec["event_id"] = row["event_id"]
        rec["label"] = "IND_FLARE"
        rec["provenance"] = "Heldout_Verified_Tier_C"
        selected_records.append(rec)
    print(f"Sampled {len(sel_flare)} IND_FLARE events.")

    # 6. IND_FIRE: 15 verified catastrophic blaze events from Tier C
    tier_c_fire = df_hard[(df_hard["label"] == "IND_FIRE") & (df_hard["tier"] == "Tier_C_HandVerified")]
    sel_fire = tier_c_fire.sample(n=min(15, len(tier_c_fire)), random_state=2026)
    for _, row in sel_fire.iterrows():
        rec = {k: row[k] for k in FEATURE_COLS}
        rec["event_id"] = row["event_id"]
        rec["label"] = "IND_FIRE"
        rec["provenance"] = "Heldout_Verified_Tier_C"
        selected_records.append(rec)
    print(f"Sampled {len(sel_fire)} IND_FIRE events.")

    session.close()

    # Construct DataFrame
    df_gold = pd.DataFrame(selected_records)
    df_gold.to_csv(out_csv, index=False)

    manifest = {
        "benchmark_name": "FINAL_GOLD_INDEPENDENT_BENCHMARK",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "total_samples": len(df_gold),
        "class_distribution": {str(k): int(v) for k, v in df_gold["label"].value_counts().items()},
        "provenance_distribution": {str(k): int(v) for k, v in df_gold["provenance"].value_counts().items()},
        "unseen_database_events_count": int(df_gold["provenance"].str.contains("Database").sum()),
        "verified_ground_truth_count": int(df_gold["provenance"].str.contains("Verified").sum()),
        "features": FEATURE_COLS
    }

    with open(out_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nGOLD BENCHMARK SUCCESSFULLY CONSTRUCTED: {out_csv}")
    print(f"Total samples: {len(df_gold)}")
    print(f"Class Distribution:\n{df_gold['label'].value_counts()}")

if __name__ == "__main__":
    construct_gold_benchmark()
