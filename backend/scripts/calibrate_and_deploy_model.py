"""
Phase 4: Rigorous XGBoost Probability Calibration and Deployment Engine
Evaluates Uncalibrated vs. Platt/Sigmoid vs. Isotonic Calibration on held-out Tier C benchmark.
Generates official reliability diagrams and registers thermo_xgb_v1.1.0 in PostgreSQL.
"""
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.base import BaseEstimator, ClassifierMixin
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import GroupKFold
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score, log_loss
from sklearn.preprocessing import LabelEncoder

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.db.database import SessionLocal
from app.domain.ml_models import Float64XGBClassifier
from app.db.models import MlModel

# Float64XGBClassifier imported from app.domain.ml_models

def compute_multiclass_ece(y_true, probs, n_bins=10):
    """
    Computes multi-class Expected Calibration Error (ECE) and Max Calibration Error (MCE).
    """
    n_samples, n_classes = probs.shape
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
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            diff = np.abs(avg_confidence_in_bin - accuracy_in_bin)
            ece += diff * prop_in_bin
            mce = max(mce, diff)
            bin_details.append({
                "bin": f"({bin_lower:.1f}, {bin_upper:.1f}]",
                "count": int(np.sum(in_bin)),
                "prop": float(prop_in_bin),
                "avg_confidence": float(avg_confidence_in_bin),
                "accuracy": float(accuracy_in_bin),
                "gap": float(diff)
            })

    return float(ece), float(mce), bin_details

def train_calibrate_and_deploy():
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/processed/three_tier_training_dataset.csv'))
    df = pd.read_csv(data_path)
    print(f"Loaded dataset: {len(df)} total rows from {data_path}")

    feature_cols = [
        "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
        "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
        "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
        "pct_forest", "pct_urban", "is_industrial_zone"
    ]

    train_df = df[df["tier"].isin(["TIER_A", "TIER_B"])].copy()
    eval_df = df[df["tier"] == "TIER_C"].copy()

    print(f"Training split (Tier A + B): {len(train_df)} samples")
    print(f"Quarantined Evaluation split (Tier C): {len(eval_df)} samples")

    le = LabelEncoder()
    y_train = le.fit_transform(train_df["label"]).astype(np.int64)
    y_eval = le.transform(eval_df["label"]).astype(np.int64)
    X_train = np.ascontiguousarray(train_df[feature_cols].values, dtype=np.float64)
    X_eval = np.ascontiguousarray(eval_df[feature_cols].values, dtype=np.float64)
    classes = le.classes_

    # 1. Base XGBoost Estimator
    base_xgb = Float64XGBClassifier(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42
    )

    # 2. Calibrated Models (Platt/Sigmoid vs. Isotonic)
    print("\n--- Fitting Base & Calibrated Models (5-Fold CV) ---")
    
    # Uncalibrated (fit directly on train)
    base_xgb.fit(X_train, y_train)
    probs_uncal = np.asarray(base_xgb.predict_proba(X_eval), dtype=np.float64)
    preds_uncal = base_xgb.predict(X_eval)

    # Sigmoid / Platt Scaling
    cal_sigmoid = CalibratedClassifierCV(estimator=base_xgb, method='sigmoid', cv=5)
    cal_sigmoid.fit(X_train, y_train)
    probs_sigmoid = np.asarray(cal_sigmoid.predict_proba(X_eval), dtype=np.float64)
    preds_sigmoid = cal_sigmoid.predict(X_eval)

    # Isotonic Regression
    cal_isotonic = CalibratedClassifierCV(estimator=base_xgb, method='isotonic', cv=5)
    cal_isotonic.fit(X_train, y_train)
    probs_isotonic = np.asarray(cal_isotonic.predict_proba(X_eval), dtype=np.float64)
    preds_isotonic = cal_isotonic.predict(X_eval)

    # 3. Compute Calibration Metrics on Tier C Ground Truth
    ece_uncal, mce_uncal, bins_uncal = compute_multiclass_ece(y_eval, probs_uncal)
    ece_sigmoid, mce_sigmoid, bins_sigmoid = compute_multiclass_ece(y_eval, probs_sigmoid)
    ece_isotonic, mce_isotonic, bins_isotonic = compute_multiclass_ece(y_eval, probs_isotonic)

    loss_uncal = log_loss(y_eval, probs_uncal)
    loss_sigmoid = log_loss(y_eval, probs_sigmoid)
    loss_isotonic = log_loss(y_eval, probs_isotonic)

    f1_uncal = f1_score(y_eval, preds_uncal, average="macro")
    f1_sigmoid = f1_score(y_eval, preds_sigmoid, average="macro")
    f1_isotonic = f1_score(y_eval, preds_isotonic, average="macro")

    print("\n=== CALIBRATION BENCHMARK RESULTS (Tier C Held-Out Set) ===")
    print(f"1. Uncalibrated XGBoost:   Macro F1 = {f1_uncal:.4f} | Log Loss = {loss_uncal:.4f} | ECE = {ece_uncal*100:.2f}% | MCE = {mce_uncal*100:.2f}%")
    print(f"2. Platt/Sigmoid Scaling:  Macro F1 = {f1_sigmoid:.4f} | Log Loss = {loss_sigmoid:.4f} | ECE = {ece_sigmoid*100:.2f}% | MCE = {mce_sigmoid*100:.2f}%")
    print(f"3. Isotonic Regression:    Macro F1 = {f1_isotonic:.4f} | Log Loss = {loss_isotonic:.4f} | ECE = {ece_isotonic*100:.2f}% | MCE = {mce_isotonic*100:.2f}%")

    # Select Champion Model: Prefer Platt/Sigmoid scaling to eliminate saturated 1.0/100% isotonic plateaus
    champion_model = cal_sigmoid
    champion_method = "CalibratedClassifierCV_Sigmoid"
    champion_ece = ece_sigmoid
    champion_loss = loss_sigmoid
    champion_f1 = f1_sigmoid
    champion_probs = probs_sigmoid
    champion_bins = bins_sigmoid

    print(f"\n>> CHAMPION SELECTED: {champion_method} (ECE: {champion_ece*100:.2f}% | Log Loss: {champion_loss:.4f})")

    # 4. Generate Official Reliability Diagram & Calibration Curve Chart
    print("\n--- Generating Reliability Diagram Artifact ---")
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), dpi=300)

    # Plot 1: Multi-Class Overall Reliability Curve
    conf_bins = np.linspace(0.1, 1.0, 10)
    
    # Perfect Calibration Line
    ax1.plot([0, 1], [0, 1], "k--", label="Perfect Calibration (y = x)", linewidth=1.5, alpha=0.7)
    
    def get_curve_points(probs_matrix, y_true):
        confs = np.max(probs_matrix, axis=1)
        preds = np.argmax(probs_matrix, axis=1)
        accs = (preds == y_true)
        x_pts, y_pts = [], []
        for i in range(len(conf_bins)-1):
            mask = (confs >= conf_bins[i]) & (confs < conf_bins[i+1])
            if np.sum(mask) > 0:
                x_pts.append(np.mean(confs[mask]))
                y_pts.append(np.mean(accs[mask]))
        return x_pts, y_pts

    x_u, y_u = get_curve_points(probs_uncal, y_eval)
    x_s, y_s = get_curve_points(probs_sigmoid, y_eval)
    x_i, y_i = get_curve_points(probs_isotonic, y_eval)

    ax1.plot(x_u, y_u, "s-", color="#94A3B8", label=f"Uncalibrated (ECE: {ece_uncal*100:.1f}%)", linewidth=1.8)
    ax1.plot(x_s, y_s, "o-", color="#EA580C", label=f"Platt / Sigmoid (ECE: {ece_sigmoid*100:.1f}%)", linewidth=2.2)
    ax1.plot(x_i, y_i, "^-", color="#0284C7", label=f"Isotonic (ECE: {ece_isotonic*100:.1f}%)", linewidth=2.0)

    ax1.set_xlabel("Mean Predicted Confidence (Bucket)", fontsize=11, fontweight="bold", labelpad=8)
    ax1.set_ylabel("Empirical Accuracy", fontsize=11, fontweight="bold", labelpad=8)
    ax1.set_title("Multi-Class Reliability Diagram (Tier C Ground Truth)", fontsize=12, fontweight="bold", pad=12)
    ax1.set_xlim([0.0, 1.05])
    ax1.set_ylim([0.0, 1.05])
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.legend(loc="lower right", frameon=True, facecolor="white", edgecolor="#CBD5E1", fontsize=9)

    # Plot 2: Confidence Histogram Distribution
    ax2.hist(np.max(probs_uncal, axis=1), bins=15, alpha=0.45, color="#94A3B8", label="Uncalibrated", edgecolor="white")
    ax2.hist(np.max(champion_probs, axis=1), bins=15, alpha=0.75, color="#EA580C", label=f"Calibrated ({champion_method})", edgecolor="white")
    ax2.set_xlabel("Predicted Confidence Value", fontsize=11, fontweight="bold", labelpad=8)
    ax2.set_ylabel("Number of Events", fontsize=11, fontweight="bold", labelpad=8)
    ax2.set_title("Probability Distribution & Honesty Spread", fontsize=12, fontweight="bold", pad=12)
    ax2.grid(True, linestyle="--", alpha=0.5)
    ax2.legend(loc="upper left", frameon=True, facecolor="white", edgecolor="#CBD5E1", fontsize=9)

    plt.suptitle("ThermoTrace AI — Defense-Grade Model Calibration Report (v1.1.0)", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()

    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/models'))
    os.makedirs(models_dir, exist_ok=True)
    report_img_path = os.path.join(models_dir, 'calibration_report_v1.1.0.png')
    plt.savefig(report_img_path, bbox_inches="tight")
    plt.close()
    print(f"Saved Reliability Diagram Chart to: {report_img_path}")

    # 5. Model Serialization & Artifact Versioning
    model_artifact_path = os.path.join(models_dir, 'thermo_xgb_v1.1.0.joblib')
    classes_artifact_path = os.path.join(models_dir, 'classes.npy')
    
    joblib.dump(champion_model, model_artifact_path)
    np.save(classes_artifact_path, classes)
    
    # Also update default active link
    default_model_path = os.path.join(models_dir, 'thermo_xgb_v1.0.0.joblib')
    joblib.dump(champion_model, default_model_path)
    print(f"Serialized champion model to {model_artifact_path} and updated active pipeline artifact.")

    # 6. Database Model Registry Registration (`ml_models` table)
    print("\n--- Registering Version v1.1.0 in PostgreSQL ml_models Registry ---")
    db = SessionLocal()
    
    ind_preds = champion_model.predict(X_eval)
    ind_precision = precision_score(y_eval, ind_preds, average="macro")

    # Update or insert model record
    model_record = db.query(MlModel).filter(MlModel.version == "v1.1.0").first()
    if not model_record:
        model_record = MlModel(
            model_name="thermo_xgb",
            version="v1.1.0",
            model_type=champion_method,
            feature_schema_hash="canonical_14d_v1",
            training_dataset_version="three_tier_v3.3.0",
            macro_f1_score=round(champion_f1, 4),
            industrial_precision=round(ind_precision, 4),
            artifact_path="data/models/thermo_xgb_v1.1.0.joblib",
            is_deployed=True
        )
        db.add(model_record)
    else:
        model_record.model_type = champion_method
        model_record.macro_f1_score = round(champion_f1, 4)
        model_record.industrial_precision = round(ind_precision, 4)
        model_record.is_deployed = True

    # Mark old versions as not current deployed
    db.query(MlModel).filter(MlModel.version != "v1.1.0").update({"is_deployed": False})
    db.commit()
    db.close()
    print("Successfully registered and activated thermo_xgb_v1.1.0 in PostgreSQL ml_models table.")

if __name__ == "__main__":
    train_calibrate_and_deploy()
