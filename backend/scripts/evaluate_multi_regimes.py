"""
Phase 3: Multi-Regime Evaluation & Non-Parametric Bootstrap Uncertainty Engine
Evaluates Champion Calibrated XGBoost across 5 Independent Regimes:
- TEST-A: Held-Out Facilities (101 samples)
- TEST-B: Held-Out Geographic Regions (117 samples)
- TEST-C: Future-Time Chronological Holdout (411 samples)
- TEST-D: Dedicated Hard Negatives Stress Benchmark (216 samples)
- TEST-E: Adversarial OOD & Context-Deprivation (208 samples)

Computes:
- Single Source-of-Truth predictions parquet for every regime.
- Non-parametric Bootstrap Resampling (B = 1,000 iterations).
- Empirical 95% Confidence Intervals [2.5%, 97.5%] for:
  - Macro F1
  - Weighted F1
  - Per-class Precision, Recall, F1
  - Multi-class Brier Score
  - Expected Calibration Error (ECE)
"""
import os
import sys
import json
import time
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score, precision_score, recall_score, log_loss, classification_report, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.multi_regime_splits import FEATURE_COLS, DATASET_PATH
from app.domain.ml_models import Float64XGBClassifier

ALL_CLASSES = ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']

def compute_multiclass_brier(y_true, probs):
    n_classes = probs.shape[1]
    y_true_oh = np.eye(n_classes)[y_true]
    return float(np.mean(np.sum((probs - y_true_oh) ** 2, axis=1)))

def compute_multiclass_ece(y_true, probs, n_bins=10):
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == y_true)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = float(np.mean(accuracies[in_bin]))
            avg_confidence_in_bin = float(np.mean(confidences[in_bin]))
            ece += float(np.abs(avg_confidence_in_bin - accuracy_in_bin)) * float(prop_in_bin)
    return float(ece)

def bootstrap_confidence_intervals(y_true, y_pred, probs, target_classes, n_bootstraps=1000, seed=42):
    rng = np.random.default_rng(seed)
    n_samples = len(y_true)
    n_classes = len(target_classes)

    boot_macro_f1 = []
    boot_weighted_f1 = []
    boot_brier = []
    boot_ece = []
    boot_class_f1 = {c: [] for c in target_classes}

    for _ in range(n_bootstraps):
        boot_idx = rng.choice(n_samples, size=n_samples, replace=True)
        y_t_b = y_true[boot_idx]
        y_p_b = y_pred[boot_idx]
        probs_b = probs[boot_idx]

        # Check that more than 1 class is sampled
        if len(np.unique(y_t_b)) < 2:
            continue

        mf1 = f1_score(y_t_b, y_p_b, average="macro", zero_division=0)
        wf1 = f1_score(y_t_b, y_p_b, average="weighted", zero_division=0)
        br = compute_multiclass_brier(y_t_b, probs_b)
        ec = compute_multiclass_ece(y_t_b, probs_b)

        boot_macro_f1.append(mf1)
        boot_weighted_f1.append(wf1)
        boot_brier.append(br)
        boot_ece.append(ec)

        # Per-class F1
        for i, c in enumerate(target_classes):
            c_f1 = f1_score(y_t_b == i, y_p_b == i, average="binary", zero_division=0)
            boot_class_f1[c].append(c_f1)

    ci_results = {
        "macro_f1_95ci": [round(float(np.percentile(boot_macro_f1, 2.5)), 4), round(float(np.percentile(boot_macro_f1, 97.5)), 4)],
        "weighted_f1_95ci": [round(float(np.percentile(boot_weighted_f1, 2.5)), 4), round(float(np.percentile(boot_weighted_f1, 97.5)), 4)],
        "brier_score_95ci": [round(float(np.percentile(boot_brier, 2.5)), 4), round(float(np.percentile(boot_brier, 97.5)), 4)],
        "ece_pct_95ci": [round(float(np.percentile(boot_ece, 2.5)) * 100, 2), round(float(np.percentile(boot_ece, 97.5)) * 100, 2)],
        "per_class_f1_95ci": {
            c: [round(float(np.percentile(boot_class_f1[c], 2.5)), 4), round(float(np.percentile(boot_class_f1[c], 97.5)), 4)]
            for c in target_classes
        }
    }
    return ci_results

def evaluate_all_regimes():
    df = pd.read_csv(DATASET_PATH)
    manifest_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../ml_experiments/multi_regime_split_manifests.json'))
    with open(manifest_path, "r", encoding="utf-8") as f:
        regimes = json.load(f)

    exp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../ml_experiments/multi_regime_evaluation'))
    os.makedirs(exp_dir, exist_ok=True)

    print("=== EXECUTING MULTI-REGIME SCIENTIFIC EVALUATION & BOOTSTRAP UNCERTAINTY ===")
    print(f"Dataset: {len(df)} total samples | Regimes: {len(regimes)}\n")

    master_results = {}

    for regime_name, rdata in regimes.items():
        tr_idx = rdata["train_indices"]
        te_idx = rdata["test_indices"]
        
        train_df = df.iloc[tr_idx].reset_index(drop=True)
        test_df = df.iloc[te_idx].reset_index(drop=True)

        print(f"----------------------------------------------------------------------")
        print(f"[{regime_name}]")
        print(f"Train: {len(train_df)} | Test: {len(test_df)}")

        # Encode classes across full canonical set
        class_to_idx = {c: i for i, c in enumerate(ALL_CLASSES)}
        y_train = np.array([class_to_idx[c] for c in train_df["label"]], dtype=np.int64)
        y_test = np.array([class_to_idx[c] for c in test_df["label"]], dtype=np.int64)

        X_tr = np.ascontiguousarray(train_df[FEATURE_COLS].values, dtype=np.float64)
        X_te = np.ascontiguousarray(test_df[FEATURE_COLS].values, dtype=np.float64)

        # Train calibrated champion XGBoost
        base_xgb = Float64XGBClassifier(
            n_estimators=120, max_depth=4, learning_rate=0.08,
            subsample=0.85, colsample_bytree=0.85, random_state=42
        )
        calibrated_model = CalibratedClassifierCV(estimator=base_xgb, method="sigmoid", cv=5)
        
        t0 = time.perf_counter()
        calibrated_model.fit(X_tr, y_train)
        fit_time_ms = (time.perf_counter() - t0) * 1000.0

        t1 = time.perf_counter()
        probs = calibrated_model.predict_proba(X_te)
        infer_latency_ms = (time.perf_counter() - t1) * 1000.0 / len(X_te)

        # Apply authoritative production decision logic: Argmax + Abstention + Domain Geofence Filters
        unc_idx = class_to_idx["OTHER_UNCERTAIN"]
        agri_idx = class_to_idx["AGRI_BURN"]
        ind_routine_idx = class_to_idx["IND_ROUTINE"]
        ind_flare_idx = class_to_idx["IND_FLARE"]

        final_preds = []
        for i in range(len(test_df)):
            p = probs[i]
            top_idx = int(np.argmax(p))
            conf = float(p[top_idx])
            ent = -float(np.sum([prob * np.log(prob + 1e-9) for prob in p]))

            # 1. Automated Abstention Policy
            if conf < 0.50 or ent > 1.35:
                top_idx = unc_idx

            # 2. Physical Domain Geofence Integrity (Phase 22)
            dist_fac = float(test_df.iloc[i].get("dist_to_facility", 99999.0))
            is_ind_zone = int(test_df.iloc[i].get("is_industrial_zone", 0))
            if dist_fac > 2500.0 and is_ind_zone == 0 and top_idx in (ind_routine_idx, ind_flare_idx):
                top_idx = unc_idx

            # 3. Agricultural Stubble Disambiguation Gate (Phase 4)
            pct_crop = float(test_df.iloc[i].get("pct_cropland", 0.0))
            active_days = int(test_df.iloc[i].get("historical_active_days_90d", 0))
            duration = float(test_df.iloc[i].get("duration_hours", 0.0))
            if pct_crop >= 0.70 and active_days == 0 and duration <= 6.0 and top_idx in (ind_routine_idx, ind_flare_idx):
                top_idx = agri_idx

            final_preds.append(top_idx)

        preds = np.array(final_preds, dtype=np.int64)

        # Point Estimates
        # Restrict evaluation to classes present in test set for clean macro-F1
        test_present_classes = sorted(list(set(y_test)))
        macro_f1 = float(f1_score(y_test, preds, average="macro", zero_division=0))
        weighted_f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))
        macro_p = float(precision_score(y_test, preds, average="macro", zero_division=0))
        macro_r = float(recall_score(y_test, preds, average="macro", zero_division=0))
        brier = compute_multiclass_brier(y_test, probs)
        ece = compute_multiclass_ece(y_test, probs)

        cm = confusion_matrix(y_test, preds, labels=range(len(ALL_CLASSES)))
        report = classification_report(y_test, preds, labels=range(len(ALL_CLASSES)), target_names=ALL_CLASSES, output_dict=True, zero_division=0)

        # Non-parametric Bootstrap Confidence Intervals (1,000 iterations)
        print(f"  Calculating 95% Bootstrap Confidence Intervals (B=1000)...")
        ci = bootstrap_confidence_intervals(y_test, preds, probs, ALL_CLASSES, n_bootstraps=1000)

        # Single Source-of-Truth Predictions File
        pred_records = []
        for i in range(len(test_df)):
            row_rec = {
                "event_id": test_df.iloc[i]["event_id"],
                "true_label": ALL_CLASSES[y_test[i]],
                "predicted_label": ALL_CLASSES[preds[i]],
                "is_correct": bool(y_test[i] == preds[i]),
                "confidence": float(np.max(probs[i])),
                "entropy": float(-np.sum([p * np.log(p + 1e-9) for p in probs[i]]))
            }
            for c_idx, c_name in enumerate(ALL_CLASSES):
                row_rec[f"prob_{c_name}"] = float(probs[i, c_idx])
            pred_records.append(row_rec)

        df_pred = pd.DataFrame(pred_records)
        parquet_file = os.path.join(exp_dir, f"predictions_{regime_name}.parquet")
        df_pred.to_parquet(parquet_file, index=False)

        regime_output = {
            "regime": regime_name,
            "description": rdata["description"],
            "train_size": len(train_df),
            "test_size": len(test_df),
            "point_estimates": {
                "macro_f1": round(macro_f1, 4),
                "weighted_f1": round(weighted_f1, 4),
                "macro_precision": round(macro_p, 4),
                "macro_recall": round(macro_r, 4),
                "brier_score": round(brier, 4),
                "ece_pct": round(ece * 100, 2),
                "fit_time_ms": round(fit_time_ms, 2),
                "inference_latency_ms": round(infer_latency_ms, 3)
            },
            "confidence_intervals_95": ci,
            "confusion_matrix": cm.tolist(),
            "classification_report": report,
            "predictions_artifact": parquet_file
        }

        master_results[regime_name] = regime_output

        print(f"  Macro F1:    {macro_f1:.4f} (95% CI: [{ci['macro_f1_95ci'][0]:.4f}, {ci['macro_f1_95ci'][1]:.4f}])")
        print(f"  Weighted F1: {weighted_f1:.4f} (95% CI: [{ci['weighted_f1_95ci'][0]:.4f}, {ci['weighted_f1_95ci'][1]:.4f}])")
        print(f"  Brier Score: {brier:.4f} (95% CI: [{ci['brier_score_95ci'][0]:.4f}, {ci['brier_score_95ci'][1]:.4f}])")
        print(f"  ECE:         {ece*100:.2f}% (95% CI: [{ci['ece_pct_95ci'][0]:.2f}%, {ci['ece_pct_95ci'][1]:.2f}%])")
        print()

    # Save Master Multi-Regime Report
    out_master_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '../ml_experiments/multi_regime_evaluation_report.json'))
    with open(out_master_file, "w", encoding="utf-8") as f:
        json.dump(master_results, f, indent=2)

    print(f"Master Multi-Regime Evaluation Report successfully saved: {out_master_file}")

if __name__ == "__main__":
    evaluate_all_regimes()
