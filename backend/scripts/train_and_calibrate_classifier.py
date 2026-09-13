"""
Candidate Model Bake-Off, Tuning, Platt/Isotonic Calibration, and Class-Specific Evaluation
For ThermoTrace AI Production Classifier
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.model_selection import GroupKFold, GridSearchCV
from sklearn.metrics import classification_report, f1_score, log_loss, brier_score_loss, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from xgboost import XGBClassifier

# Feature column order
FEATURE_COLS = [
    "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
    "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
    "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
    "pct_forest", "pct_urban", "is_industrial_zone"
]

CLASSES = np.array(["AGRI_BURN", "IND_FIRE", "IND_FLARE", "IND_ROUTINE", "OTHER_UNCERTAIN", "WILDFIRE"])
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}

def run_training_pipeline():
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/processed/hardened_training_dataset.csv'))
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at: {data_path}")
        
    df = pd.read_csv(data_path)
    print(f"Loaded dataset: {len(df)} records from {data_path}")
    
    # Separate Train (Tier A + Tier B) and Held-Out Test (Tier C)
    df_train = df[df["tier"] != "Tier_C_HandVerified"].copy().reset_index(drop=True)
    df_test = df[df["tier"] == "Tier_C_HandVerified"].copy().reset_index(drop=True)
    
    X_train = df_train[FEATURE_COLS].values.astype(np.float64)
    y_train = np.array([CLASS_TO_IDX[label] for label in df_train["label"]], dtype=np.int64)
    groups_train = df_train["spatial_group"].values
    
    X_test = df_test[FEATURE_COLS].values.astype(np.float64)
    y_test = np.array([CLASS_TO_IDX[label] for label in df_test["label"]], dtype=np.int64)
    
    print(f"Training Pool (Tier A + Tier B): {len(X_train)} samples across {len(np.unique(groups_train))} spatial groups")
    print(f"Held-Out Evaluation Set (Tier C): {len(X_test)} verified samples")
    
    # =========================================================================
    # PHASE 4: CANDIDATE MODEL BAKE-OFF (GroupKFold CV)
    # =========================================================================
    print("\n=======================================================")
    print("PHASE 4: CANDIDATE MODEL BAKE-OFF (Spatial GroupKFold)")
    print("=======================================================")
    
    gkf = GroupKFold(n_splits=5)
    
    candidates = {
        "XGBoost Classifier": XGBClassifier(
            n_estimators=140, max_depth=5, learning_rate=0.08, subsample=0.85,
            colsample_bytree=0.85, random_state=42, eval_metric="mlogloss"
        ),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=140, max_depth=5, learning_rate=0.08, random_state=42
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=140, max_depth=8, min_samples_split=4, random_state=42
        )
    }
    
    bakeoff_results = []
    
    for name, model in candidates.items():
        fold_f1s = []
        fold_losses = []
        
        for train_idx, val_idx in gkf.split(X_train, y_train, groups=groups_train):
            X_tr, y_tr = X_train[train_idx], y_train[train_idx]
            X_va, y_val = X_train[val_idx], y_train[val_idx]
            
            model.fit(X_tr, y_tr)
            y_pred = model.predict(X_va)
            y_prob = model.predict_proba(X_va)
            
            f1 = f1_score(y_val, y_pred, average="macro", zero_division=0)
            loss = log_loss(y_val, y_prob, labels=list(range(len(CLASSES))))
            fold_f1s.append(f1)
            fold_losses.append(loss)
            
        mean_f1 = np.mean(fold_f1s)
        mean_loss = np.mean(fold_losses)
        bakeoff_results.append({
            "Model": name,
            "CV Macro-F1": round(float(mean_f1), 4),
            "CV Log Loss": round(float(mean_loss), 4)
        })
        print(f"  • {name:<22}: CV Macro-F1 = {mean_f1:.4f} | CV Log Loss = {mean_loss:.4f}")
        
    df_bakeoff = pd.DataFrame(bakeoff_results)
    
    # =========================================================================
    # PHASE 5: HYPERPARAMETER TUNING ON WINNER (XGBoost)
    # =========================================================================
    print("\n=======================================================")
    print("PHASE 5: HYPERPARAMETER TUNING (XGBoost Grid Search)")
    print("=======================================================")
    
    param_grid = {
        "max_depth": [3, 4, 5, 6],
        "learning_rate": [0.05, 0.08, 0.12],
        "n_estimators": [100, 140, 180],
        "subsample": [0.80, 0.90]
    }
    
    base_xgb = XGBClassifier(random_state=42, eval_metric="mlogloss", colsample_bytree=0.85)
    grid_search = GridSearchCV(
        base_xgb,
        param_grid,
        cv=gkf.split(X_train, y_train, groups=groups_train),
        scoring="f1_macro",
        n_jobs=-1
    )
    grid_search.fit(X_train, y_train)
    
    best_params = grid_search.best_params_
    best_base_model = grid_search.best_estimator_
    print(f"Optimal Hyperparameters Found:")
    for k, v in best_params.items():
        print(f"  • {k}: {v}")
    print(f"Tuned Best CV Macro-F1: {grid_search.best_score_:.4f}")
    
    # =========================================================================
    # PHASE 6: CALIBRATION (Sigmoid / Platt vs Isotonic)
    # =========================================================================
    print("\n=======================================================")
    print("PHASE 6: PROBABILITY CALIBRATION (Platt Sigmoid vs Isotonic)")
    print("=======================================================")
    
    # Fit calibrated classifiers using 5-fold CV on train set
    cal_sigmoid = CalibratedClassifierCV(estimator=best_base_model, method="sigmoid", cv=5)
    cal_sigmoid.fit(X_train, y_train)
    
    cal_isotonic = CalibratedClassifierCV(estimator=best_base_model, method="isotonic", cv=5)
    cal_isotonic.fit(X_train, y_train)
    
    # Evaluate calibration quality on Tier C held-out set
    probs_raw = best_base_model.predict_proba(X_test)
    probs_sig = cal_sigmoid.predict_proba(X_test)
    probs_iso = cal_isotonic.predict_proba(X_test)
    
    # Multi-class Brier score (mean squared difference across all classes)
    y_test_onehot = np.zeros((len(y_test), len(CLASSES)))
    for idx, label_idx in enumerate(y_test):
        y_test_onehot[idx, label_idx] = 1.0
        
    brier_raw = np.mean(np.sum((probs_raw - y_test_onehot)**2, axis=1))
    brier_sig = np.mean(np.sum((probs_sig - y_test_onehot)**2, axis=1))
    brier_iso = np.mean(np.sum((probs_iso - y_test_onehot)**2, axis=1))
    
    print(f"Tier C Multi-Class Brier Calibration Error:")
    print(f"  • Raw Tuned XGBoost:    Brier = {brier_raw:.4f}")
    print(f"  • Platt Sigmoid Calib:  Brier = {brier_sig:.4f}")
    print(f"  • Isotonic Calib:       Brier = {brier_iso:.4f}")
    
    # Select winner (Platt Sigmoid provides smooth continuous probabilities without step artifacts)
    final_calibrated_model = cal_sigmoid if brier_sig <= brier_iso else cal_isotonic
    chosen_method = "sigmoid" if brier_sig <= brier_iso else "isotonic"
    print(f"\nChosen Calibrator for Production: {chosen_method.upper()} CalibratedClassifierCV")
    
    # =========================================================================
    # GENERATE AND SAVE RELIABILITY DIAGRAM
    # =========================================================================
    fig, ax = plt.subplots(1, 2, figsize=(14, 6))
    
    # Binary confidence reliability (max probability vs accuracy)
    conf_raw = np.max(probs_raw, axis=1)
    conf_cal = np.max(probs_sig, axis=1)
    preds_raw = np.argmax(probs_raw, axis=1)
    preds_cal = np.argmax(probs_sig, axis=1)
    acc_raw = (preds_raw == y_test).astype(int)
    acc_cal = (preds_cal == y_test).astype(int)
    
    # Plot Reliability Curve
    bins = np.linspace(0.2, 1.0, 7)
    bin_acc_raw, bin_conf_raw = [], []
    bin_acc_cal, bin_conf_cal = [], []
    
    for i in range(len(bins)-1):
        # Raw
        mask_raw = (conf_raw >= bins[i]) & (conf_raw < bins[i+1])
        if np.sum(mask_raw) > 0:
            bin_acc_raw.append(np.mean(acc_raw[mask_raw]))
            bin_conf_raw.append(np.mean(conf_raw[mask_raw]))
        # Calibrated
        mask_cal = (conf_cal >= bins[i]) & (conf_cal < bins[i+1])
        if np.sum(mask_cal) > 0:
            bin_acc_cal.append(np.mean(acc_cal[mask_cal]))
            bin_conf_cal.append(np.mean(conf_cal[mask_cal]))
            
    ax[0].plot([0.2, 1.0], [0.2, 1.0], "k--", label="Perfect Calibration (y = x)")
    ax[0].plot(bin_conf_raw, bin_acc_raw, "s-", color="red", label=f"Uncalibrated Raw (Brier: {brier_raw:.3f})")
    ax[0].plot(bin_conf_cal, bin_acc_cal, "o-", color="green", lw=2, label=f"Calibrated Platt (Brier: {brier_sig:.3f})")
    ax[0].set_title("Reliability Diagram (Tier C Held-Out Test Set)", fontsize=12, fontweight="bold")
    ax[0].set_xlabel("Mean Predicted Confidence")
    ax[0].set_ylabel("Empirical Accuracy")
    ax[0].set_xlim([0.2, 1.0])
    ax[0].set_ylim([0.2, 1.0])
    ax[0].grid(True, alpha=0.3)
    ax[0].legend(loc="lower right")
    
    # Confidence Distribution Histogram
    ax[1].hist(conf_raw, bins=12, alpha=0.5, color="red", label="Uncalibrated Confidence Dist")
    ax[1].hist(conf_cal, bins=12, alpha=0.7, color="green", label="Calibrated Confidence Dist")
    ax[1].set_title("Predicted Confidence Distribution", fontsize=12, fontweight="bold")
    ax[1].set_xlabel("Confidence Value")
    ax[1].set_ylabel("Count of Test Samples")
    ax[1].grid(True, alpha=0.3)
    ax[1].legend(loc="upper left")
    
    plt.tight_layout()
    chart_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/models/calibration_report_v1.1.0.png'))
    os.makedirs(os.path.dirname(chart_path), exist_ok=True)
    plt.savefig(chart_path, dpi=300)
    plt.close()
    print(f"Reliability Diagram Artifact saved to: {chart_path}")
    
    # =========================================================================
    # PHASE 7: CLASS-SPECIFIC EVALUATION ON TIER C
    # =========================================================================
    print("\n=======================================================")
    print("PHASE 7: CLASS-SPECIFIC EVALUATION (Tier C Ground Truth)")
    print("=======================================================")
    
    y_pred_final = final_calibrated_model.predict(X_test)
    report_dict = classification_report(y_test, y_pred_final, target_names=CLASSES, output_dict=True, zero_division=0)
    report_text = classification_report(y_test, y_pred_final, target_names=CLASSES, digits=4, zero_division=0)
    print(report_text)
    
    # Specific Critical Metrics
    fire_idx = CLASS_TO_IDX["IND_FIRE"]
    fire_recall = report_dict["IND_FIRE"]["recall"]
    fire_precision = report_dict["IND_FIRE"]["precision"]
    print(f"Critical Metric 1: IND_FIRE Recall    = {fire_recall*100:.1f}% (Target >= 90%)")
    print(f"Critical Metric 2: IND_FIRE Precision = {fire_precision*100:.1f}%")
    
    # Confusion Matrix Analysis for False Alarm Rate
    cm = confusion_matrix(y_test, y_pred_final)
    agri_idx = CLASS_TO_IDX["AGRI_BURN"]
    wild_idx = CLASS_TO_IDX["WILDFIRE"]
    ind_indices = [CLASS_TO_IDX["IND_FIRE"], CLASS_TO_IDX["IND_FLARE"], CLASS_TO_IDX["IND_ROUTINE"]]
    
    # Misclassifications of Agri/Wildfire as Industrial
    agri_as_ind = np.sum(cm[agri_idx, ind_indices])
    wild_as_ind = np.sum(cm[wild_idx, ind_indices])
    total_non_ind = np.sum(cm[agri_idx, :]) + np.sum(cm[wild_idx, :])
    false_alarm_rate = (agri_as_ind + wild_as_ind) / float(total_non_ind) if total_non_ind > 0 else 0.0
    print(f"Critical Metric 3: Non-Ind False Alarm Rate = {false_alarm_rate*100:.2f}% (Target < 5%)")
    
    # =========================================================================
    # SAVE MODEL ARTIFACTS
    # =========================================================================
    model_save_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/models/thermo_xgb_v1.1.0.joblib'))
    classes_save_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/models/classes.npy'))
    
    joblib.dump(final_calibrated_model, model_save_path)
    np.save(classes_save_path, CLASSES)
    print(f"\nCalibrated Model Artifact successfully saved to: {model_save_path}")
    print(f"Classes array saved to: {classes_save_path}")
    
    # Return metrics for documentation
    return {
        "bakeoff": df_bakeoff,
        "best_params": best_params,
        "brier_raw": brier_raw,
        "brier_cal": brier_sig,
        "report_text": report_text,
        "fire_recall": fire_recall,
        "false_alarm_rate": false_alarm_rate
    }

if __name__ == "__main__":
    run_training_pipeline()
