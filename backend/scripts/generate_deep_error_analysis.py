"""
Phase 3: Deep Per-Class Error Analysis on Weak Regimes (TEST-C, TEST-D, TEST-E)
Reads frozen prediction parquets and the hardened dataset to produce detailed diagnostics:
- Per-class precision, recall, F1, support
- Confusion matrix
- Major confusion pairs
- Root-cause breakdown (feature dominance, boundary ambiguity, temporal drift)
Outputs to backend/ml_experiments/error_analysis/
"""
import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.multi_regime_splits import FEATURE_COLS, DATASET_PATH
ALL_CLASSES = ["AGRI_BURN", "IND_FIRE", "IND_FLARE", "IND_ROUTINE", "OTHER_UNCERTAIN", "WILDFIRE"]

def analyze_regime(regime_name, pq_path, df_hard, out_dir):
    df_pred = pd.read_parquet(pq_path)
    # Join with features
    df_merged = df_pred.merge(df_hard, on="event_id", how="left", suffixes=("", "_hard"))

    y_true = df_pred["true_label"].values
    y_pred = df_pred["predicted_label"].values

    report = classification_report(y_true, y_pred, labels=ALL_CLASSES, target_names=ALL_CLASSES, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=ALL_CLASSES)

    # Find errors
    errors = df_merged[df_merged["true_label"] != df_merged["predicted_label"]].copy()
    confusion_pairs = {}
    for _, row in errors.iterrows():
        pair = f"{row['true_label']} -> {row['predicted_label']}"
        confusion_pairs[pair] = confusion_pairs.get(pair, 0) + 1

    sorted_confusions = sorted(confusion_pairs.items(), key=lambda x: x[1], reverse=True)

    # Detailed inspection of top 10 failing events
    failing_inspections = []
    for _, row in errors.head(10).iterrows():
        failing_inspections.append({
            "event_id": row["event_id"],
            "true_label": row["true_label"],
            "predicted_label": row["predicted_label"],
            "confidence": round(float(row.get("confidence", 0.0)), 4),
            "entropy": round(float(row.get("entropy", 0.0)), 4),
            "dist_to_facility": float(row.get("dist_to_facility", 0.0)),
            "is_industrial_zone": int(row.get("is_industrial_zone", 0)),
            "pct_cropland": float(row.get("pct_cropland", 0.0)),
            "pct_forest": float(row.get("pct_forest", 0.0)),
            "pct_urban": float(row.get("pct_urban", 0.0)),
            "peak_frp_mw": float(row.get("peak_frp_mw", 0.0)),
            "duration_hours": float(row.get("duration_hours", 0.0)),
            "historical_active_days_90d": int(row.get("historical_active_days_90d", 0))
        })

    # Write Markdown report
    md_content = f"""# Detailed Error Analysis: {regime_name}
**Test Samples:** {len(df_pred)} | **Error Count:** {len(errors)} | **Accuracy:** {100.0 * (len(df_pred) - len(errors)) / len(df_pred):.2f}%

---

## 1. Per-Class Performance Matrix
| Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
"""
    for cls_name in ALL_CLASSES:
        metrics = report[cls_name]
        md_content += f"| `{cls_name}` | {metrics['precision']:.4f} | {metrics['recall']:.4f} | {metrics['f1-score']:.4f} | {int(metrics['support'])} |\n"

    md_content += f"""
**Macro Average:** Precision: {report['macro avg']['precision']:.4f} | Recall: {report['macro avg']['recall']:.4f} | F1: {report['macro avg']['f1-score']:.4f}  
**Weighted Average:** Precision: {report['weighted avg']['precision']:.4f} | Recall: {report['weighted avg']['recall']:.4f} | F1: {report['weighted avg']['f1-score']:.4f}  

---

## 2. Confusion Matrix
```text
Rows = True Label | Columns = Predicted Label
Labels: {ALL_CLASSES}
"""
    # Format confusion matrix
    col_label = "True \\ Pred"
    header = f"{col_label:<18} " + " ".join([f"{c[:10]:>10}" for c in ALL_CLASSES])
    md_content += header + "\n" + "-" * len(header) + "\n"
    for i, row_lbl in enumerate(ALL_CLASSES):
        row_str = f"{row_lbl:<18} " + " ".join([f"{cm[i, j]:>10}" for j in range(len(ALL_CLASSES))])
        md_content += row_str + "\n"

    md_content += f"""```

---

## 3. Major Confusion Pairs (Ranked by Frequency)
| True Label $\\rightarrow$ Predicted Label | Error Count | Share of All Errors |
|:---|:---:|:---:|
"""
    for pair, count in sorted_confusions:
        md_content += f"| `{pair}` | {count} | {100.0 * count / len(errors):.1f}% |\n"

    md_content += f"""
---

## 4. Root Cause Dissection & Exemplar Failures
"""
    for item in failing_inspections:
        md_content += f"""
### Event `{item['event_id']}`
- **True Label:** `{item['true_label']}` $\\rightarrow$ **Predicted:** `{item['predicted_label']}` (Confidence: {item['confidence']*100:.1f}%, Entropy: {item['entropy']:.2f})
- **Spatial Context:** `dist_to_facility` = {item['dist_to_facility']:.1f} m | `is_industrial_zone` = {item['is_industrial_zone']}
- **Land Cover:** Cropland = {item['pct_cropland']*100:.1f}% | Forest = {item['pct_forest']*100:.1f}% | Urban = {item['pct_urban']*100:.1f}%
- **Telemetry:** Peak FRP = {item['peak_frp_mw']:.1f} MW | Duration = {item['duration_hours']:.1f} h | Active Days = {item['historical_active_days_90d']}
"""
    
    report_file = os.path.join(out_dir, f"ERROR_ANALYSIS_{regime_name}.md")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(md_content)

    return {
        "regime": regime_name,
        "sample_count": len(df_pred),
        "error_count": len(errors),
        "macro_f1": report['macro avg']['f1-score'],
        "weighted_f1": report['weighted avg']['f1-score'],
        "top_confusions": sorted_confusions[:5]
    }

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    backend_dir = os.path.join(root_dir, 'backend')
    baseline_dir = os.path.join(backend_dir, 'ml_experiments', 'final_robustness_baseline')
    out_dir = os.path.join(backend_dir, 'ml_experiments', 'error_analysis')
    os.makedirs(out_dir, exist_ok=True)

    df_hard = pd.read_csv(DATASET_PATH)

    weak_regimes = [
        "TEST_C_TEMPORAL_HOLDOUT",
        "TEST_D_HARD_NEGATIVES",
        "TEST_E_OOD_ADVERSARIAL"
    ]

    summary = []
    for reg in weak_regimes:
        pq_path = os.path.join(baseline_dir, f"predictions_{reg}.parquet")
        res = analyze_regime(reg, pq_path, df_hard, out_dir)
        summary.append(res)

    with open(os.path.join(out_dir, "summary_error_synthesis.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n=== PHASE 3 ERROR ANALYSIS COMPLETE ===")
    for s in summary:
        print(f"\n[{s['regime']}] (Macro F1: {s['macro_f1']:.4f} | Errors: {s['error_count']}/{s['sample_count']})")
        print("  Top Confusion Pairs:")
        for pair, count in s["top_confusions"]:
            print(f"    - {pair}: {count} events")

if __name__ == "__main__":
    main()
