"""
Step 7 & 8: Model Benchmarking, Challenger Suite & Controlled Experiments
Evaluates:
- EXP-001: Champion XGBoost (Float64XGBClassifier)
- EXP-002: Challenger LightGBM (LGBMClassifier)
- EXP-003: Challenger Random Forest (RandomForestClassifier)

Standardized on:
- Identical Split E dataset partitions (794 train, 56 pure independent test)
- Identical 14-D feature schema
- Identical calibration protocol (CalibratedClassifierCV Sigmoid, cv=5)
- Identical metrics (Macro F1, Precision, Recall, Brier Score, ECE, MCE, Inference Latency)
"""
import os
import sys
import json
import time
import hashlib
import numpy as np
import pandas as pd
import joblib

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import f1_score, precision_score, recall_score, log_loss, classification_report, confusion_matrix

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.ml.splits import load_canonical_dataset, generate_split_e_strict_combined, FEATURE_COLS
from app.domain.ml_models import Float64XGBClassifier

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

def benchmark_models():
    df = load_canonical_dataset()
    tr_idx, te_idx = generate_split_e_strict_combined(df)
    train_df = df.iloc[tr_idx].reset_index(drop=True)
    test_df = df.iloc[te_idx].reset_index(drop=True)

    le = LabelEncoder()
    y_train = le.fit_transform(train_df["label"]).astype(np.int64)
    y_test = le.transform(test_df["label"]).astype(np.int64)
    classes = list(le.classes_)

    X_tr = np.ascontiguousarray(train_df[FEATURE_COLS].values, dtype=np.float64)
    X_te = np.ascontiguousarray(test_df[FEATURE_COLS].values, dtype=np.float64)

    experiments_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../ml_experiments/experiments'))
    os.makedirs(experiments_dir, exist_ok=True)

    candidates = [
        {
            "id": "EXP-001",
            "name": "Champion_XGBoost",
            "model_type": "XGBoost",
            "base_estimator": Float64XGBClassifier(
                n_estimators=120, max_depth=4, learning_rate=0.08,
                subsample=0.85, colsample_bytree=0.85, random_state=42
            ),
            "hyperparams": {
                "n_estimators": 120, "max_depth": 4, "learning_rate": 0.08,
                "subsample": 0.85, "colsample_bytree": 0.85, "random_state": 42
            }
        },
        {
            "id": "EXP-002",
            "name": "Challenger_LightGBM",
            "model_type": "LightGBM",
            "base_estimator": LGBMClassifier(
                n_estimators=120, max_depth=4, learning_rate=0.08,
                subsample=0.85, colsample_bytree=0.85, random_state=42,
                verbosity=-1
            ),
            "hyperparams": {
                "n_estimators": 120, "max_depth": 4, "learning_rate": 0.08,
                "subsample": 0.85, "colsample_bytree": 0.85, "random_state": 42
            }
        },
        {
            "id": "EXP-003",
            "name": "Challenger_RandomForest",
            "model_type": "RandomForest",
            "base_estimator": RandomForestClassifier(
                n_estimators=150, max_depth=8, min_samples_split=3,
                random_state=42, n_jobs=-1
            ),
            "hyperparams": {
                "n_estimators": 150, "max_depth": 8, "min_samples_split": 3, "random_state": 42
            }
        }
    ]

    benchmark_summary = {}

    print("=== EXECUTING MODEL BENCHMARKING & CHALLENGER SUITE ===")
    print(f"Dataset Size: {len(df)} total | Train (Split E): {len(train_df)} | Test (Split E): {len(test_df)}")
    print(f"Features: 14 dimensions | Classes: {classes}\n")

    for cand in candidates:
        exp_id = cand["id"]
        name = cand["name"]
        exp_out_dir = os.path.join(experiments_dir, f"{exp_id}_{name}")
        os.makedirs(exp_out_dir, exist_ok=True)

        print(f"[{exp_id}] Fitting {name}...")

        # 1. Fit Uncalibrated Base Model
        base = cand["base_estimator"]
        t0 = time.perf_counter()
        base.fit(X_tr, y_train)
        uncal_fit_time = (time.perf_counter() - t0) * 1000.0

        probs_uncal = np.asarray(base.predict_proba(X_te), dtype=np.float64)
        preds_uncal = np.argmax(probs_uncal, axis=1)

        f1_uncal = float(f1_score(y_test, preds_uncal, average="macro"))
        brier_uncal = compute_multiclass_brier(y_test, probs_uncal)
        ece_uncal, mce_uncal, _ = compute_multiclass_ece(y_test, probs_uncal)

        # 2. Fit Calibrated Model (Platt / Sigmoid CalibratedClassifierCV)
        calibrated = CalibratedClassifierCV(estimator=cand["base_estimator"], method="sigmoid", cv=5)
        t1 = time.perf_counter()
        calibrated.fit(X_tr, y_train)
        cal_fit_time = (time.perf_counter() - t1) * 1000.0

        # Measure Single-Sample Inference Latency over 100 runs
        latencies = []
        single_x = X_te[0:1]
        for _ in range(100):
            t_start = time.perf_counter()
            _ = calibrated.predict_proba(single_x)
            latencies.append((time.perf_counter() - t_start) * 1000.0)
        single_infer_latency_ms = float(np.median(latencies))

        probs_cal = np.asarray(calibrated.predict_proba(X_te), dtype=np.float64)
        preds_cal = np.argmax(probs_cal, axis=1)

        f1_cal = float(f1_score(y_test, preds_cal, average="macro"))
        weighted_f1_cal = float(f1_score(y_test, preds_cal, average="weighted"))
        prec_cal = float(precision_score(y_test, preds_cal, average="macro", zero_division=0))
        rec_cal = float(recall_score(y_test, preds_cal, average="macro", zero_division=0))
        loss_cal = float(log_loss(y_test, probs_cal, labels=range(len(classes))))
        brier_cal = compute_multiclass_brier(y_test, probs_cal)
        ece_cal, mce_cal, bin_details = compute_multiclass_ece(y_test, probs_cal)

        # Confusion Matrix
        cm = confusion_matrix(y_test, preds_cal, labels=range(len(classes)))
        report = classification_report(y_test, preds_cal, target_names=classes, output_dict=True, zero_division=0)

        # Serialize Model Artifact
        artifact_file = os.path.join(exp_out_dir, f"{name}_calibrated.joblib")
        joblib.dump(calibrated, artifact_file)
        model_size_kb = round(os.path.getsize(artifact_file) / 1024.0, 2)

        # Single Source-of-Truth Predictions File
        pred_records = []
        for i in range(len(test_df)):
            pred_records.append({
                "event_id": test_df.loc[i, "event_id"],
                "true_label": classes[y_test[i]],
                "predicted_label": classes[preds_cal[i]],
                "is_correct": bool(y_test[i] == preds_cal[i]),
                "confidence": float(np.max(probs_cal[i])),
                "entropy": float(-np.sum([p * np.log(p + 1e-9) for p in probs_cal[i]])),
                "uncalibrated_f1": f1_uncal,
                "calibrated_f1": f1_cal
            })
        pred_df = pd.DataFrame(pred_records)
        pred_df.to_parquet(os.path.join(exp_out_dir, "predictions.parquet"), index=False)

        exp_result = {
            "experiment_id": exp_id,
            "model_name": name,
            "model_type": cand["model_type"],
            "hyperparameters": cand["hyperparams"],
            "uncalibrated": {
                "macro_f1": round(f1_uncal, 4),
                "brier_score": round(brier_uncal, 4),
                "ece_pct": round(ece_uncal * 100, 2),
                "mce_pct": round(mce_uncal * 100, 2)
            },
            "calibrated": {
                "macro_f1": round(f1_cal, 4),
                "weighted_f1": round(weighted_f1_cal, 4),
                "macro_precision": round(prec_cal, 4),
                "macro_recall": round(rec_cal, 4),
                "brier_score": round(brier_cal, 4),
                "log_loss": round(loss_cal, 4),
                "ece_pct": round(ece_cal * 100, 2),
                "mce_pct": round(mce_cal * 100, 2),
                "confusion_matrix": cm.tolist()
            },
            "operational_metrics": {
                "train_time_ms": round(cal_fit_time, 2),
                "single_sample_inference_latency_ms": round(single_infer_latency_ms, 3),
                "model_size_kb": model_size_kb
            },
            "classification_report": report
        }

        with open(os.path.join(exp_out_dir, "results.json"), "w") as f:
            json.dump(exp_result, f, indent=2)

        benchmark_summary[exp_id] = {
            "model_name": name,
            "calibrated_macro_f1": round(f1_cal, 4),
            "brier_score": round(brier_cal, 4),
            "ece_pct": round(ece_cal * 100, 2),
            "latency_ms": round(single_infer_latency_ms, 3),
            "model_size_kb": model_size_kb
        }

        print(f"  Uncalibrated: F1={f1_uncal:.4f} | ECE={ece_uncal*100:.2f}% | Brier={brier_uncal:.4f}")
        print(f"  Calibrated:   F1={f1_cal:.4f} | ECE={ece_cal*100:.2f}% | Brier={brier_cal:.4f} | Latency={single_infer_latency_ms:.3f}ms")
        print()

    # Save Master Comparison
    summary_path = os.path.join(os.path.dirname(experiments_dir), "champion_vs_challengers_benchmark.json")
    with open(summary_path, "w") as f:
        json.dump(benchmark_summary, f, indent=2)

    print(f"Benchmark summary saved to: {summary_path}")
    print("\n=== CHAMPION VS CHALLENGERS SUMMARY ===")
    print(pd.DataFrame.from_dict(benchmark_summary, orient="index"))

if __name__ == "__main__":
    benchmark_models()
