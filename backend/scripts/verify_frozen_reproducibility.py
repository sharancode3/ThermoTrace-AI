"""
Phase 1: Verify Current Benchmark Reproducibility
Re-runs the evaluation pipeline from the frozen artifacts to confirm bitwise reproducibility:
- Model hash & classes hash
- Prediction counts & row-level alignment
- Exact class predictions matching frozen predictions.parquet
- Metric exact match: Macro F1, Weighted F1, Brier Score, ECE %
"""
import os
import sys
import json
import hashlib
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import f1_score, precision_score, recall_score, confusion_matrix, brier_score_loss

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.multi_regime_splits import FEATURE_COLS, DATASET_PATH
from app.domain.ml_models import Float64XGBClassifier

def compute_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def compute_ece(probs, y_true, n_bins=10):
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == y_true).astype(float)
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper) if i > 0 else (confidences >= bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            acc_in_bin = np.mean(accuracies[in_bin])
            conf_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(acc_in_bin - conf_in_bin) * prop_in_bin
    return float(ece * 100.0)

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    backend_dir = os.path.join(root_dir, 'backend')
    baseline_dir = os.path.join(backend_dir, 'ml_experiments', 'final_robustness_baseline')

    print("=== EXECUTING PHASE 1: BENCHMARK REPRODUCIBILITY VERIFICATION ===")

    # 1. Model & Classes Hash Check
    model_path = os.path.join(backend_dir, 'data', 'models', 'thermo_xgb_v1.1.0.joblib')
    classes_path = os.path.join(backend_dir, 'data', 'models', 'classes.npy')
    
    current_model_hash = compute_sha256(model_path)
    current_classes_hash = compute_sha256(classes_path)

    with open(os.path.join(baseline_dir, "model_hash.txt"), "r") as f:
        content = f.read()

    assert current_model_hash in content, f"Model hash mismatch! {current_model_hash}"
    assert current_classes_hash in content, f"Classes hash mismatch! {current_classes_hash}"
    print(f"[*] PASS: Model and Classes SHA-256 hashes match frozen baseline bitwise.")

    # 2. Load Model & Schema
    model = joblib.load(model_path)
    classes = np.load(classes_path, allow_pickle=True)
    class_to_idx = {c: i for i, c in enumerate(classes)}

    with open(os.path.join(baseline_dir, "feature_schema.json"), "r") as f:
        schema = json.load(f)
    assert schema["features"] == FEATURE_COLS, "Feature column mismatch!"
    print(f"[*] PASS: Canonical 14-D feature schema verified.")

    # 3. Load Splits & Dataset
    df_hard = pd.read_csv(DATASET_PATH)
    with open(os.path.join(baseline_dir, "split_manifest.json"), "r") as f:
        splits = json.load(f)

    with open(os.path.join(baseline_dir, "metrics.json"), "r") as f:
        frozen_metrics = json.load(f)

    with open(os.path.join(baseline_dir, "calibration.json"), "r") as f:
        frozen_calib = json.load(f)

    regimes = [
        "TEST_A_FACILITY_HOLDOUT",
        "TEST_B_SPATIAL_HOLDOUT",
        "TEST_C_TEMPORAL_HOLDOUT",
        "TEST_D_HARD_NEGATIVES",
        "TEST_E_OOD_ADVERSARIAL"
    ]

    all_passed = True

    for reg in regimes:
        print(f"\n--- Verifying {reg} ---")
        test_indices = splits[reg]["test_indices"]
        df_test = df_hard.iloc[test_indices].copy()
        X_test = df_test[FEATURE_COLS].copy()
        y_true_str = df_test["label"].values
        y_true = np.array([class_to_idx[lbl] for lbl in y_true_str])

        # Fresh inference
        probs_fresh = model.predict_proba(X_test)
        preds_fresh_idx = np.argmax(probs_fresh, axis=1)
        preds_fresh_str = classes[preds_fresh_idx]

        # Load frozen prediction parquet
        pq_path = os.path.join(baseline_dir, f"predictions_{reg}.parquet")
        df_frozen = pd.read_parquet(pq_path)

        assert len(df_frozen) == len(df_test), f"Size mismatch for {reg}: {len(df_frozen)} vs {len(df_test)}"
        print(f"[*] Test sample count matches exactly: {len(df_test)}")

        # Check prediction string parity
        preds_frozen_str = df_frozen["predicted_label"].values
        mismatches = np.sum(preds_fresh_str != preds_frozen_str)
        assert mismatches == 0, f"Found {mismatches} prediction discrepancies in {reg}!"
        print(f"[*] Row-level predictions match frozen parquet 100% bitwise.")

        # Re-compute metrics
        macro_f1_fresh = float(f1_score(y_true, preds_fresh_idx, average='macro', zero_division=0))
        weighted_f1_fresh = float(f1_score(y_true, preds_fresh_idx, average='weighted', zero_division=0))
        brier_fresh = float(np.mean(np.sum((probs_fresh - np.eye(len(classes))[y_true])**2, axis=1)))
        ece_fresh = float(compute_ece(probs_fresh, y_true))

        f_macro_f1 = frozen_metrics[reg]["macro_f1"]
        f_weighted_f1 = frozen_metrics[reg]["weighted_f1"]
        f_brier = frozen_calib[reg]["brier_score"]
        f_ece = frozen_calib[reg]["ece_pct"]

        diff_f1 = abs(macro_f1_fresh - f_macro_f1)
        diff_wf1 = abs(weighted_f1_fresh - f_weighted_f1)
        diff_brier = abs(brier_fresh - f_brier)
        diff_ece = abs(ece_fresh - f_ece)

        print(f"  Macro F1:    Fresh={macro_f1_fresh:.4f} | Frozen={f_macro_f1:.4f} (diff={diff_f1:.6f})")
        print(f"  Weighted F1: Fresh={weighted_f1_fresh:.4f} | Frozen={f_weighted_f1:.4f} (diff={diff_wf1:.6f})")
        print(f"  Brier Score: Fresh={brier_fresh:.4f} | Frozen={f_brier:.4f} (diff={diff_brier:.6f})")
        print(f"  ECE %:       Fresh={ece_fresh:.2f}% | Frozen={f_ece:.2f}% (diff={diff_ece:.6f})")

        assert diff_f1 < 1e-4, f"Macro F1 divergence in {reg}!"
        assert diff_wf1 < 1e-4, f"Weighted F1 divergence in {reg}!"
        assert diff_brier < 1e-4, f"Brier score divergence in {reg}!"
        assert diff_ece < 1e-4, f"ECE divergence in {reg}!"
        print(f"[*] {reg} VERIFICATION: 100% REPRODUCIBLE (PASS)")

    print("\n========================================================")
    print("PHASE 1 COMPLETE: BENCHMARK REPRODUCIBILITY CONFIRMED.")
    print("The frozen baseline is stable, deterministic, and immutable.")
    print("========================================================")

if __name__ == "__main__":
    main()
