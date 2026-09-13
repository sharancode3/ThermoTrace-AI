"""
Snapshot Current Baseline Model (v1.1.0)
Captures immutable baseline state into backend/ml_experiments/baseline_v1_1_0/
Includes metadata, dataset manifests, feature schema, model hashes, predictions, and calibration metrics.
"""
import os
import sys
import json
import hashlib
import subprocess
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score, recall_score, log_loss, brier_score_loss

# Add backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.domain.ml_models import Float64XGBClassifier

def compute_sha256(filepath: str) -> str:
    if not os.path.exists(filepath):
        return "FILE_NOT_FOUND"
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def compute_multiclass_brier(y_true, probs):
    # One-hot encode y_true
    n_classes = probs.shape[1]
    y_true_oh = np.eye(n_classes)[y_true]
    return float(np.mean(np.sum((probs - y_true_oh) ** 2, axis=1)))

def compute_multiclass_ece(y_true, probs, n_bins=10):
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == y_true)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    mce = 0.0
    bin_details = []

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            accuracy_in_bin = float(np.mean(accuracies[in_bin]))
            avg_confidence_in_bin = float(np.mean(confidences[in_bin]))
            diff = float(np.abs(avg_confidence_in_bin - accuracy_in_bin))
            ece += diff * float(prop_in_bin)
            mce = max(mce, diff)
            bin_details.append({
                "bin": f"({bin_lower:.2f}, {bin_upper:.2f}]",
                "count": int(np.sum(in_bin)),
                "prop": float(prop_in_bin),
                "avg_confidence": avg_confidence_in_bin,
                "accuracy": accuracy_in_bin,
                "gap": diff
            })

    return float(ece), float(mce), bin_details

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    backend_dir = os.path.join(root_dir, 'backend')
    exp_dir = os.path.join(backend_dir, 'ml_experiments', 'baseline_v1_1_0')
    os.makedirs(exp_dir, exist_ok=True)

    print(f"Creating immutable snapshot in: {exp_dir}")

    # 1. Git Commit Hash
    try:
        commit_hash = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root_dir, text=True).strip()
        git_branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=root_dir, text=True).strip()
    except Exception as e:
        commit_hash = "UNKNOWN"
        git_branch = "UNKNOWN"

    # 2. Model & Artifact Hashes
    model_path = os.path.join(backend_dir, 'data', 'models', 'thermo_xgb_v1.1.0.joblib')
    classes_path = os.path.join(backend_dir, 'data', 'models', 'classes.npy')
    report_img_path = os.path.join(backend_dir, 'data', 'models', 'calibration_report_v1.1.0.png')
    
    model_hash = compute_sha256(model_path)
    classes_hash = compute_sha256(classes_path)

    with open(os.path.join(exp_dir, 'model_hash.txt'), 'w') as f:
        f.write(f"model_path: {model_path}\n")
        f.write(f"model_sha256: {model_hash}\n")
        f.write(f"classes_path: {classes_path}\n")
        f.write(f"classes_sha256: {classes_hash}\n")

    # 3. Feature Schema Specification
    feature_cols = [
        "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
        "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
        "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
        "pct_forest", "pct_urban", "is_industrial_zone"
    ]
    
    feature_schema = {
        "version": "canonical_14d_v1.1.0",
        "dimension": 14,
        "features": [
            {"name": "dist_to_facility", "type": "float64", "unit": "meters", "description": "Haversine distance to nearest registered industrial plant boundary or centroid"},
            {"name": "facility_category_encoded", "type": "int64", "unit": "category_id", "description": "Encoded category of industrial facility (1=Petrochem, 2=Power, 3=Smelter, 4=Steel, 0=None)"},
            {"name": "peak_frp_mw", "type": "float64", "unit": "megawatts", "description": "Maximum Fire Radiative Power across cluster observations"},
            {"name": "mean_frp_mw", "type": "float64", "unit": "megawatts", "description": "Mean Fire Radiative Power across cluster observations"},
            {"name": "frp_variance", "type": "float64", "unit": "mw^2", "description": "Variance of FRP across cluster observations (0.0 for N=1)"},
            {"name": "max_brightness_k", "type": "float64", "unit": "kelvin", "description": "Maximum 4um brightness temperature (T4 / T21)"},
            {"name": "duration_hours", "type": "float64", "unit": "hours", "description": "Temporal span between earliest and latest observation in cluster"},
            {"name": "day_night_ratio", "type": "float64", "unit": "ratio", "description": "Proportion of daytime satellite passes in cluster [0.0 to 1.0]"},
            {"name": "historical_active_days_90d", "type": "int64", "unit": "days", "description": "Distinct active thermal days within 2.5km over trailing 90 days"},
            {"name": "historical_peak_frp", "type": "float64", "unit": "megawatts", "description": "Historical peak FRP recorded within 2.5km over trailing 90 days"},
            {"name": "pct_cropland", "type": "float64", "unit": "fraction", "description": "Fractional land cover: Cropland / Agrarian [0.0 to 1.0]"},
            {"name": "pct_forest", "type": "float64", "unit": "fraction", "description": "Fractional land cover: Forest / Woodland canopy [0.0 to 1.0]"},
            {"name": "pct_urban", "type": "float64", "unit": "fraction", "description": "Fractional land cover: Built-up / Urban infrastructure [0.0 to 1.0]"},
            {"name": "is_industrial_zone", "type": "int64", "unit": "binary", "description": "Binary flag indicating industrial corridor or facility buffer intersection (0 or 1)"}
        ]
    }
    with open(os.path.join(exp_dir, 'feature_schema.json'), 'w') as f:
        json.dump(feature_schema, f, indent=2)

    # 4. Dataset Manifest
    data_three_tier = os.path.join(backend_dir, 'data', 'processed', 'three_tier_training_dataset.csv')
    data_hardened = os.path.join(backend_dir, 'data', 'processed', 'hardened_training_dataset.csv')
    df_tt = pd.read_csv(data_three_tier) if os.path.exists(data_three_tier) else pd.DataFrame()
    df_hd = pd.read_csv(data_hardened) if os.path.exists(data_hardened) else pd.DataFrame()

    dataset_manifest = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "datasets": {
            "three_tier_training_dataset": {
                "path": data_three_tier,
                "sha256": compute_sha256(data_three_tier),
                "rows": len(df_tt),
                "columns": list(df_tt.columns) if not df_tt.empty else [],
                "tier_breakdown": df_tt['tier'].value_counts().to_dict() if 'tier' in df_tt.columns else {},
                "label_breakdown": df_tt['label'].value_counts().to_dict() if 'label' in df_tt.columns else {}
            },
            "hardened_training_dataset": {
                "path": data_hardened,
                "sha256": compute_sha256(data_hardened),
                "rows": len(df_hd),
                "tier_breakdown": df_hd['tier'].value_counts().to_dict() if 'tier' in df_hd.columns else {},
                "label_breakdown": df_hd['label'].value_counts().to_dict() if 'label' in df_hd.columns else {}
            }
        }
    }
    with open(os.path.join(exp_dir, 'dataset_manifest.json'), 'w') as f:
        json.dump(dataset_manifest, f, indent=2)

    # 5. Load Model & Evaluate on Tier C Ground Truth Benchmark
    classes = np.load(classes_path, allow_pickle=True)
    model = joblib.load(model_path)

    eval_df = df_tt[df_tt["tier"] == "TIER_C"].copy().reset_index(drop=True)
    X_eval = np.ascontiguousarray(eval_df[feature_cols].values, dtype=np.float64)
    y_true_str = eval_df["label"].values
    
    class_to_idx = {c: i for i, c in enumerate(classes)}
    y_true_idx = np.array([class_to_idx[c] for c in y_true_str], dtype=np.int64)

    probs = model.predict_proba(X_eval)
    preds_idx = np.argmax(probs, axis=1)
    preds_str = classes[preds_idx]

    # Metrics Computation
    macro_f1 = float(f1_score(y_true_idx, preds_idx, average="macro"))
    weighted_f1 = float(f1_score(y_true_idx, preds_idx, average="weighted"))
    macro_precision = float(precision_score(y_true_idx, preds_idx, average="macro"))
    macro_recall = float(recall_score(y_true_idx, preds_idx, average="macro"))
    eval_loss = float(log_loss(y_true_idx, probs, labels=range(len(classes))))
    brier_score = compute_multiclass_brier(y_true_idx, probs)
    ece, mce, bin_details = compute_multiclass_ece(y_true_idx, probs)

    cm = confusion_matrix(y_true_idx, preds_idx, labels=range(len(classes)))
    cm_dict = {
        "classes": list(classes),
        "matrix": cm.tolist()
    }
    with open(os.path.join(exp_dir, 'confusion_matrix.json'), 'w') as f:
        json.dump(cm_dict, f, indent=2)

    calib_dict = {
        "ece": ece,
        "mce": mce,
        "brier_score": brier_score,
        "log_loss": eval_loss,
        "n_bins": 10,
        "bins": bin_details
    }
    with open(os.path.join(exp_dir, 'calibration.json'), 'w') as f:
        json.dump(calib_dict, f, indent=2)

    # Per-Class Precision / Recall / F1
    report = classification_report(y_true_idx, preds_idx, target_names=classes, output_dict=True)

    metrics = {
        "model_version": "v1.1.0",
        "eval_dataset": "three_tier_training_dataset.csv (Tier C Quarantined Benchmark)",
        "eval_samples": len(eval_df),
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "log_loss": eval_loss,
        "brier_score": brier_score,
        "expected_calibration_error_ece": ece,
        "max_calibration_error_mce": mce,
        "per_class_metrics": report
    }
    with open(os.path.join(exp_dir, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    # 6. Single Source-of-Truth Predictions File (predictions.parquet)
    pred_records = []
    for i in range(len(eval_df)):
        pred_records.append({
            "event_id": eval_df.loc[i, "event_id"],
            "true_label": y_true_str[i],
            "predicted_label": preds_str[i],
            "is_correct": bool(y_true_str[i] == preds_str[i]),
            "confidence": float(np.max(probs[i])),
            "entropy": float(-np.sum([p * np.log(p + 1e-9) for p in probs[i]])),
            "tier": eval_df.loc[i, "tier"],
            "spatial_group": eval_df.loc[i, "spatial_group"],
            "dist_to_facility": float(eval_df.loc[i, "dist_to_facility"]),
            "peak_frp_mw": float(eval_df.loc[i, "peak_frp_mw"]),
            "duration_hours": float(eval_df.loc[i, "duration_hours"]),
            "prob_AGRI_BURN": float(probs[i][class_to_idx.get("AGRI_BURN", 0)]),
            "prob_IND_FIRE": float(probs[i][class_to_idx.get("IND_FIRE", 1)]),
            "prob_IND_FLARE": float(probs[i][class_to_idx.get("IND_FLARE", 2)]),
            "prob_IND_ROUTINE": float(probs[i][class_to_idx.get("IND_ROUTINE", 3)]),
            "prob_OTHER_UNCERTAIN": float(probs[i][class_to_idx.get("OTHER_UNCERTAIN", 4)]),
            "prob_WILDFIRE": float(probs[i][class_to_idx.get("WILDFIRE", 5)]),
        })
    pred_df = pd.DataFrame(pred_records)
    pred_df.to_parquet(os.path.join(exp_dir, 'predictions.parquet'), index=False)
    pred_df.to_csv(os.path.join(exp_dir, 'predictions.csv'), index=False)

    # 7. Metadata JSON
    metadata = {
        "snapshot_created_at": datetime.now(timezone.utc).isoformat(),
        "git_commit": commit_hash,
        "git_branch": git_branch,
        "model_version": "v1.1.0",
        "model_type": "CalibratedClassifierCV(Float64XGBClassifier, method='sigmoid', cv=5)",
        "classes": list(classes),
        "feature_count": len(feature_cols),
        "champion_status": "CURRENT_BASELINE_CHAMPION",
        "provenance": "Phase 4 Calibration Output (August 30, 2026)",
        "notes": "Immutable baseline snapshot captured prior to scientific audit and leakage-safe splits."
    }
    with open(os.path.join(exp_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)

    print("\n=== BASELINE SNAPSHOT COMPLETED SUCCESSFULLY ===")
    print(f"Directory: {exp_dir}")
    print(f"Git Commit: {commit_hash} ({git_branch})")
    print(f"Macro F1: {macro_f1:.4f} | ECE: {ece*100:.2f}% | Brier: {brier_score:.4f} | LogLoss: {eval_loss:.4f}")
    print(f"Saved artifacts: metadata.json, feature_schema.json, dataset_manifest.json, metrics.json, confusion_matrix.json, calibration.json, model_hash.txt, predictions.parquet, predictions.csv")

if __name__ == "__main__":
    main()
