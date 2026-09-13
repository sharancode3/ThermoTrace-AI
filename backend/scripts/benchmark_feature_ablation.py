"""
Step 6: Feature Ablation & Contextual Fusion Benchmark
Evaluates 5 feature configurations on the strict leakage-safe Split E benchmark:
1. Thermal-only: FRP/brightness
2. Thermal + Temporal: Thermal + duration, day/night ratio
3. Thermal + Land Cover: Thermal + cropland, forest, urban
4. Thermal + Industrial Context: Thermal + dist_to_facility, facility_category, is_industrial_zone
5. Full Multimodal: All 14 features

Empirically proves whether and how contextual fusion elevates performance over raw thermal radiance.
"""
import os
import sys
import json
import time
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score, precision_score, recall_score, log_loss, classification_report

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.splits import load_canonical_dataset, generate_split_e_strict_combined

def compute_multiclass_brier(y_true, probs):
    n_classes = probs.shape[1]
    y_true_oh = np.eye(n_classes)[y_true]
    return float(np.mean(np.sum((probs - y_true_oh) ** 2, axis=1)))

def run_feature_ablation():
    df = load_canonical_dataset()
    tr_idx, te_idx = generate_split_e_strict_combined(df)
    train_df = df.iloc[tr_idx].reset_index(drop=True)
    test_df = df.iloc[te_idx].reset_index(drop=True)

    le = LabelEncoder()
    y_train = le.fit_transform(train_df["label"]).astype(np.int64)
    y_test = le.transform(test_df["label"]).astype(np.int64)
    classes = list(le.classes_)

    feature_groups = {
        "1_Thermal_Only": [
            "peak_frp_mw", "mean_frp_mw", "frp_variance", "max_brightness_k"
        ],
        "2_Thermal_Temporal": [
            "peak_frp_mw", "mean_frp_mw", "frp_variance", "max_brightness_k",
            "duration_hours", "day_night_ratio"
        ],
        "3_Thermal_LandCover": [
            "peak_frp_mw", "mean_frp_mw", "frp_variance", "max_brightness_k",
            "pct_cropland", "pct_forest", "pct_urban"
        ],
        "4_Thermal_Industrial": [
            "peak_frp_mw", "mean_frp_mw", "frp_variance", "max_brightness_k",
            "dist_to_facility", "facility_category_encoded", "is_industrial_zone",
            "historical_active_days_90d", "historical_peak_frp"
        ],
        "5_Full_Multimodal_14D": [
            "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
            "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
            "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
            "pct_forest", "pct_urban", "is_industrial_zone"
        ]
    }

    results = {}

    print("=== EXECUTING FEATURE ABLATION & CONTEXTUAL FUSION BENCHMARK (SPLIT E) ===")
    print(f"Train Set: {len(train_df)} samples (Quarantined Tier A + B/C)")
    print(f"Test Set: {len(test_df)} samples (Pure Independent Tier B/C Holdouts)")
    print(f"Target Classes: {classes}\n")

    for name, cols in feature_groups.items():
        X_tr = np.ascontiguousarray(train_df[cols].values, dtype=np.float64)
        X_te = np.ascontiguousarray(test_df[cols].values, dtype=np.float64)

        model = XGBClassifier(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="multi:softprob",
            random_state=42,
            eval_metric="mlogloss"
        )

        t0 = time.perf_counter()
        model.fit(X_tr, y_train)
        fit_time_ms = (time.perf_counter() - t0) * 1000.0

        t1 = time.perf_counter()
        probs = model.predict_proba(X_te)
        infer_time_ms = (time.perf_counter() - t1) * 1000.0 / len(X_te)

        preds = np.argmax(probs, axis=1)

        macro_f1 = float(f1_score(y_test, preds, average="macro"))
        weighted_f1 = float(f1_score(y_test, preds, average="weighted"))
        macro_p = float(precision_score(y_test, preds, average="macro", zero_division=0))
        macro_r = float(recall_score(y_test, preds, average="macro", zero_division=0))
        brier = compute_multiclass_brier(y_test, probs)
        loss = float(log_loss(y_test, probs, labels=range(len(classes))))

        per_class = classification_report(y_test, preds, target_names=classes, output_dict=True, zero_division=0)

        results[name] = {
            "feature_count": len(cols),
            "features": cols,
            "macro_f1": round(macro_f1, 4),
            "weighted_f1": round(weighted_f1, 4),
            "macro_precision": round(macro_p, 4),
            "macro_recall": round(macro_r, 4),
            "brier_score": round(brier, 4),
            "log_loss": round(loss, 4),
            "fit_time_ms": round(fit_time_ms, 2),
            "inference_time_ms_per_sample": round(infer_time_ms, 4),
            "per_class_f1": {c: round(per_class[c]["f1-score"], 4) for c in classes}
        }

        print(f"[{name}] (Dims: {len(cols)})")
        print(f"  Macro F1: {macro_f1:.4f} | Weighted F1: {weighted_f1:.4f} | Brier: {brier:.4f} | LogLoss: {loss:.4f}")
        for c in classes:
            print(f"    - {c:<16}: F1 = {per_class[c]['f1-score']:.4f} (Support: {per_class[c]['support']})")
        print()

    # Save to backend/ml_experiments
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../ml_experiments'))
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "feature_ablation_results.json")
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Feature ablation benchmark saved to: {out_file}")

if __name__ == "__main__":
    run_feature_ablation()
