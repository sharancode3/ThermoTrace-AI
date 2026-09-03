"""
Step 3: Execute the Frozen Hybrid Model Pipeline on the Untouched GOLD BENCHMARK
Runs ONCE to generate immutable evaluation artifacts:
- predictions_GOLD_BENCHMARK.parquet
- gold_benchmark_report.json
Computes:
- Macro & Weighted F1, Precision, Recall
- Per-class F1, Precision, Recall, Support
- Brier Score & ECE %
- 1,000-Iteration Bootstrap 95% Confidence Intervals
- Selective Prediction (Coverage, Selective Risk, Abstention Rate)
- Confusion Matrix
"""
import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score, recall_score

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.domain.ml_models import Float64XGBClassifier
from app.ml.multi_regime_splits import FEATURE_COLS

ALL_CLASSES = ["AGRI_BURN", "IND_FIRE", "IND_FLARE", "IND_ROUTINE", "OTHER_UNCERTAIN", "WILDFIRE"]

def compute_multiclass_brier(y_true, probs):
    n_samples, n_classes = probs.shape
    one_hot = np.zeros((n_samples, n_classes))
    for i, val in enumerate(y_true):
        one_hot[i, val] = 1.0
    return float(np.mean(np.sum((probs - one_hot) ** 2, axis=1)))

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

def bootstrap_gold_ci(y_true, y_pred, probs, target_classes, n_bootstraps=1000, seed=42):
    rng = np.random.default_rng(seed)
    n_samples = len(y_true)

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

        if len(np.unique(y_t_b)) < 2:
            continue

        boot_macro_f1.append(f1_score(y_t_b, y_p_b, average="macro", zero_division=0))
        boot_weighted_f1.append(f1_score(y_t_b, y_p_b, average="weighted", zero_division=0))
        boot_brier.append(compute_multiclass_brier(y_t_b, probs_b))
        boot_ece.append(compute_multiclass_ece(y_t_b, probs_b))

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

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    backend_dir = os.path.join(root_dir, 'backend')
    data_path = os.path.join(backend_dir, 'data', 'processed', 'gold_benchmark_dataset.csv')
    model_path = os.path.join(backend_dir, 'data', 'models', 'thermo_xgb_v1.1.0.joblib')
    classes_path = os.path.join(backend_dir, 'data', 'models', 'classes.npy')
    out_pq = os.path.join(backend_dir, 'ml_experiments', 'predictions_GOLD_BENCHMARK.parquet')
    out_report = os.path.join(backend_dir, 'ml_experiments', 'gold_benchmark_report.json')

    print("=== EXECUTING UNTOUCHED FINAL GOLD BENCHMARK (SINGLE RUN) ===")

    # 1. Load Frozen Artifacts
    model = joblib.load(model_path)
    classes = np.load(classes_path, allow_pickle=True)
    class_to_idx = {c: i for i, c in enumerate(ALL_CLASSES)}

    df_gold = pd.read_csv(data_path)
    print(f"Loaded Gold Benchmark: {len(df_gold)} samples across {df_gold['label'].nunique()} classes")

    X_gold = np.ascontiguousarray(df_gold[FEATURE_COLS].values, dtype=np.float64)
    y_true_str = df_gold["label"].values
    y_true = np.array([class_to_idx[lbl] for lbl in y_true_str], dtype=np.int64)

    # 2. Frozen Inference
    t0 = time.perf_counter()
    probs = model.predict_proba(X_gold)
    latency_per_event_ms = (time.perf_counter() - t0) * 1000.0 / len(X_gold)

    # 3. Apply Production Hybrid Decision Pipeline
    unc_idx = class_to_idx["OTHER_UNCERTAIN"]
    agri_idx = class_to_idx["AGRI_BURN"]
    ind_routine_idx = class_to_idx["IND_ROUTINE"]
    ind_flare_idx = class_to_idx["IND_FLARE"]

    final_preds = []
    abstained_count = 0
    spatial_rejected_count = 0
    agri_disambiguated_count = 0

    pred_records = []

    for i in range(len(df_gold)):
        p = probs[i]
        top_idx = int(np.argmax(p))
        conf = float(p[top_idx])
        ent = -float(np.sum([prob * np.log(prob + 1e-9) for prob in p]))

        # Gate 1: Automated Abstention Gate (Confidence < 0.50 or Entropy > 1.35)
        if conf < 0.50 or ent > 1.35:
            top_idx = unc_idx
            abstained_count += 1

        # Gate 2: Spatial Domain Integrity Gate (d > 2500m & zone == 0)
        dist_fac = float(df_gold.iloc[i].get("dist_to_facility", 99999.0))
        is_ind_zone = int(df_gold.iloc[i].get("is_industrial_zone", 0))
        if dist_fac > 2500.0 and is_ind_zone == 0 and top_idx in (ind_routine_idx, ind_flare_idx):
            top_idx = unc_idx
            spatial_rejected_count += 1

        # Gate 3: Perimeter Agricultural Disambiguation Gate
        pct_crop = float(df_gold.iloc[i].get("pct_cropland", 0.0))
        active_days = int(df_gold.iloc[i].get("historical_active_days_90d", 0))
        duration = float(df_gold.iloc[i].get("duration_hours", 0.0))
        if pct_crop >= 0.70 and active_days == 0 and duration <= 6.0 and top_idx in (ind_routine_idx, ind_flare_idx):
            top_idx = agri_idx
            agri_disambiguated_count += 1

        final_preds.append(top_idx)

        # Single source of truth record
        row_rec = {
            "event_id": df_gold.iloc[i]["event_id"],
            "true_label": ALL_CLASSES[y_true[i]],
            "predicted_label": ALL_CLASSES[top_idx],
            "is_correct": bool(y_true[i] == top_idx),
            "confidence": conf,
            "entropy": ent,
            "provenance": df_gold.iloc[i]["provenance"]
        }
        for c_idx, c_name in enumerate(ALL_CLASSES):
            row_rec[f"prob_{c_name}"] = float(p[c_idx])
        pred_records.append(row_rec)

    preds = np.array(final_preds, dtype=np.int64)

    # Save immutable predictions parquet
    df_preds = pd.DataFrame(pred_records)
    df_preds.to_parquet(out_pq, index=False)
    print(f"Predictions parquet saved: {out_pq}")

    # 4. Compute Comprehensive Performance Metrics
    macro_f1 = float(f1_score(y_true, preds, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_true, preds, average="weighted", zero_division=0))
    macro_p = float(precision_score(y_true, preds, average="macro", zero_division=0))
    macro_r = float(recall_score(y_true, preds, average="macro", zero_division=0))
    brier = compute_multiclass_brier(y_true, probs)
    ece = compute_multiclass_ece(y_true, probs)

    cm = confusion_matrix(y_true, preds, labels=range(len(ALL_CLASSES)))
    cls_report = classification_report(y_true, preds, labels=range(len(ALL_CLASSES)), target_names=ALL_CLASSES, output_dict=True, zero_division=0)

    # Selective prediction metrics
    accepted_mask = preds != unc_idx
    accepted_count = int(np.sum(accepted_mask))
    coverage = float(accepted_count / len(df_gold))
    selective_errors = np.sum(y_true[accepted_mask] != preds[accepted_mask]) if accepted_count > 0 else 0
    selective_risk = float(selective_errors / accepted_count) if accepted_count > 0 else 0.0
    abstention_rate = float(np.sum(preds == unc_idx) / len(df_gold))

    # 5. Non-Parametric Bootstrap Confidence Intervals (1,000 iterations)
    print("Calculating 95% Bootstrap Confidence Intervals (B=1000)...")
    ci = bootstrap_gold_ci(y_true, preds, probs, ALL_CLASSES, n_bootstraps=1000)

    gold_summary = {
        "benchmark_name": "FINAL_GOLD_INDEPENDENT_BENCHMARK",
        "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_samples": len(df_gold),
        "point_estimates": {
            "macro_f1": round(macro_f1, 4),
            "weighted_f1": round(weighted_f1, 4),
            "macro_precision": round(macro_p, 4),
            "macro_recall": round(macro_r, 4),
            "brier_score": round(brier, 4),
            "ece_pct": round(ece * 100.0, 2)
        },
        "confidence_intervals_95": ci,
        "selective_prediction": {
            "coverage_pct": round(coverage * 100.0, 2),
            "selective_risk_pct": round(selective_risk * 100.0, 2),
            "selective_accuracy_pct": round((1.0 - selective_risk) * 100.0, 2),
            "abstention_rate_pct": round(abstention_rate * 100.0, 2),
            "total_abstained_events": int(np.sum(preds == unc_idx)),
            "spatial_rejected_events": spatial_rejected_count,
            "agri_disambiguated_events": agri_disambiguated_count
        },
        "per_class_performance": {
            c: {
                "precision": round(cls_report[c]["precision"], 4),
                "recall": round(cls_report[c]["recall"], 4),
                "f1_score": round(cls_report[c]["f1-score"], 4),
                "support": int(cls_report[c]["support"]),
                "f1_95ci": ci["per_class_f1_95ci"][c]
            }
            for c in ALL_CLASSES
        },
        "confusion_matrix": cm.tolist(),
        "latency_ms_per_event": round(latency_per_event_ms, 2)
    }

    with open(out_report, "w", encoding="utf-8") as f:
        json.dump(gold_summary, f, indent=2)

    print("\n========================================================")
    print("FINAL GOLD BENCHMARK RESULTS (UNTOUCHED INDEPENDENT SET):")
    print(f"Total Samples: {len(df_gold)}")
    print(f"Macro F1:    {macro_f1:.4f}  (95% CI: [{ci['macro_f1_95ci'][0]:.4f}, {ci['macro_f1_95ci'][1]:.4f}])")
    print(f"Weighted F1: {weighted_f1:.4f}  (95% CI: [{ci['weighted_f1_95ci'][0]:.4f}, {ci['weighted_f1_95ci'][1]:.4f}])")
    print(f"Brier Score: {brier:.4f}  (95% CI: [{ci['brier_score_95ci'][0]:.4f}, {ci['brier_score_95ci'][1]:.4f}])")
    print(f"ECE %:       {ece*100.0:.2f}% (95% CI: [{ci['ece_pct_95ci'][0]:.2f}%, {ci['ece_pct_95ci'][1]:.2f}%])")
    print(f"Selective Accuracy: {(1.0-selective_risk)*100.0:.2f}% (Coverage: {coverage*100.0:.2f}%)")
    print("========================================================")

if __name__ == "__main__":
    main()
