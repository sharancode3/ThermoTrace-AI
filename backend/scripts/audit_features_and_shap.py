"""
Phase 3 Feature Engineering Audit & SHAP Importance Analysis
"""
import os
import sys
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import classification_report, f1_score
from sklearn.preprocessing import LabelEncoder
import shap

def audit_features():
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/processed/three_tier_training_dataset.csv"))
    df = pd.read_csv(data_path)
    print(f"Loaded dataset: {len(df)} rows")

    feature_cols = [
        "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
        "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
        "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
        "pct_forest", "pct_urban", "is_industrial_zone"
    ]

    print("\n--- 1. Variance Analysis on Three-Tier Dataset ---")
    for col in feature_cols:
        s = df[col]
        var = s.var()
        mean = s.mean()
        std = s.std()
        print(f"  Feature '{col}': Mean={mean:.4f}, Std={std:.4f}, Variance={var:.4f}, Min={s.min()}, Max={s.max()} {'[OK: HIGH SEPARATION]' if var > 0.001 else '[WARN]'}")

    # Prepare Train vs Eval split based on Tiers
    # Tier A + Tier B for training, Tier C for evaluation
    train_df = df[df["tier"].isin(["TIER_A", "TIER_B"])].copy()
    eval_df = df[df["tier"] == "TIER_C"].copy()

    print(f"\nTraining set size (Tier A + B): {len(train_df)}")
    print(f"Evaluation set size (Tier C): {len(eval_df)}")

    le = LabelEncoder()
    y_train = le.fit_transform(train_df["label"])
    y_eval = le.transform(eval_df["label"])
    X_train = train_df[feature_cols]
    X_eval = eval_df[feature_cols]
    groups_train = train_df["spatial_group"]

    # Spatial GroupKFold Cross-Validation
    gkf = GroupKFold(n_splits=5)
    f1_scores = []
    print("\n--- 2. Spatial GroupKFold CV Evaluation ---")
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X_train, y_train, groups=groups_train)):
        X_tr, y_tr = X_train.iloc[train_idx], y_train[train_idx]
        X_val, y_val = X_train.iloc[val_idx], y_train[val_idx]

        model = XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="multi:softprob",
            random_state=42,
            eval_metric="mlogloss"
        )
        model.fit(X_tr, y_tr)
        preds = model.predict(X_val)
        f1 = f1_score(y_val, preds, average="macro")
        f1_scores.append(f1)
        print(f"  Fold {fold+1} (Holdout Spatial Groups: {len(np.unique(groups_train.iloc[val_idx]))}): Macro F1 = {f1:.4f}")

    print(f"Mean Spatial GroupKFold Macro F1: {np.mean(f1_scores):.4f} +/- {np.std(f1_scores):.4f}")

    # Train Final Champion Model on full Tier A+B
    final_model = XGBClassifier(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="multi:softprob",
        random_state=42,
        eval_metric="mlogloss"
    )
    final_model.fit(X_train, y_train)

    # Evaluate on Tier C Ground Truth Benchmark
    eval_preds = final_model.predict(X_eval)
    eval_f1 = f1_score(y_eval, eval_preds, average="macro")
    print(f"\n--- 3. Performance on Quarantined Tier C Benchmark ---")
    print(f"Tier C Macro F1 Score: {eval_f1:.4f}")
    print("\nClassification Report (Tier C):")
    print(classification_report(y_eval, eval_preds, target_names=le.classes_))

    # Feature Importance Analysis (Gain)
    print("\n--- 4. Feature Importance (XGBoost Gain) ---")
    importances = final_model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    for idx in sorted_idx:
        print(f"  {feature_cols[idx]:<30}: {importances[idx]*100:.2f}%")

    # SHAP TreeExplainer Analysis
    print("\n--- 5. SHAP TreeExplainer Summary ---")
    explainer = shap.TreeExplainer(final_model)
    shap_vals = explainer.shap_values(X_eval)
    
    # Compute mean absolute SHAP value per feature across all classes
    if isinstance(shap_vals, list):
        mean_abs_shap = np.mean([np.abs(sv).mean(axis=0) for sv in shap_vals], axis=0)
    elif len(shap_vals.shape) == 3:
        mean_abs_shap = np.abs(shap_vals).mean(axis=(0, 2))
    else:
        mean_abs_shap = np.abs(shap_vals).mean(axis=0)

    sorted_shap_idx = np.argsort(mean_abs_shap)[::-1]
    for idx in sorted_shap_idx:
        print(f"  {feature_cols[idx]:<30}: Mean |SHAP| = {mean_abs_shap[idx]:.4f}")

if __name__ == "__main__":
    audit_features()
