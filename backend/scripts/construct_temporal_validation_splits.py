"""
Phase 9: Redesign Temporal Splits with Non-Contaminating Multi-Stage Time Horizons
Splits the temporal training reservoir into:
PAST TRAIN -> EARLY VALIDATION -> LATER VALIDATION -> FUTURE TEST (Untouched)
Guarantees zero future leakage while enabling tuning against temporal shift.
Outputs to backend/ml_experiments/temporal_validation_splits.json.
"""
import os
import sys
import json
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.multi_regime_splits import DATASET_PATH

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    backend_dir = os.path.join(root_dir, 'backend')
    baseline_dir = os.path.join(backend_dir, 'ml_experiments', 'final_robustness_baseline')

    with open(os.path.join(baseline_dir, "split_manifest.json"), "r") as f:
        splits = json.load(f)

    df_hard = pd.read_csv(DATASET_PATH)

    # Keep FUTURE TEST strictly untouched!
    future_test_indices = splits["TEST_C_TEMPORAL_HOLDOUT"]["test_indices"]
    train_pool_indices = splits["TEST_C_TEMPORAL_HOLDOUT"]["train_indices"]

    print(f"Constructing Multi-Stage Temporal Validation:")
    print(f"  Total Temporal Reservoir: {len(train_pool_indices)} samples")
    print(f"  Future Test (Untouched): {len(future_test_indices)} samples")

    # Chronologically split the training pool into 3 non-overlapping windows:
    # 70% Past Train, 15% Early Validation, 15% Later Validation
    n_train_pool = len(train_pool_indices)
    split_1 = int(n_train_pool * 0.70)
    split_2 = int(n_train_pool * 0.85)

    past_train_indices = train_pool_indices[:split_1]
    early_val_indices = train_pool_indices[split_1:split_2]
    later_val_indices = train_pool_indices[split_2:]

    temporal_stages = {
        "description": "Multi-stage temporal validation pipeline. Evaluates tuning under temporal shift without touching FUTURE TEST.",
        "past_train_size": len(past_train_indices),
        "past_train_indices": past_train_indices,
        "early_val_size": len(early_val_indices),
        "early_val_indices": early_val_indices,
        "later_val_size": len(later_val_indices),
        "later_val_indices": later_val_indices,
        "future_test_size": len(future_test_indices),
        "future_test_indices": future_test_indices,
        "future_test_untouched": True
    }

    out_path = os.path.join(backend_dir, 'ml_experiments', 'temporal_validation_splits.json')
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(temporal_stages, f, indent=2)

    print(f"Phase 9 Temporal Validation Stages Created: {out_path}")
    print(f"  Past Train: {len(past_train_indices)} | Early Val: {len(early_val_indices)} | Later Val: {len(later_val_indices)} | Future Test: {len(future_test_indices)}")

if __name__ == "__main__":
    main()
