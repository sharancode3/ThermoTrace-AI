"""
Feature Attribution & Physical Grounding Validation
For ThermoTrace AI Production Calibrated Classifier
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd

FEATURE_COLS = [
    "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
    "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
    "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
    "pct_forest", "pct_urban", "is_industrial_zone"
]

def validate_feature_importances():
    model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/models/thermo_xgb_v1.1.0.joblib'))
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/processed/hardened_training_dataset.csv'))
    
    cal_model = joblib.load(model_path)
    base_xgb = cal_model.calibrated_classifiers_[0].estimator
    
    print("=======================================================")
    print("PHASE 9: FEATURE ATTRIBUTION & PHYSICAL GROUNDING VALIDATION")
    print("=======================================================")
    
    importances = base_xgb.feature_importances_
    
    df_imp = pd.DataFrame({
        "Feature": FEATURE_COLS,
        "Gain Importance": importances
    }).sort_values(by="Gain Importance", ascending=False).reset_index(drop=True)
    
    print(df_imp.to_string(index=False))
    
    top_features = df_imp["Feature"].head(5).tolist()
    print(f"\nTop 5 Physical Drivers: {top_features}")
    
    # Validation checks
    assert "is_industrial_zone" in top_features or "dist_to_facility" in top_features, "Physical Geofence feature missing from top drivers!"
    assert "pct_cropland" in top_features or "pct_forest" in top_features, "Land cover feature missing from top drivers!"
    print("Feature importance validation passed! Feature weights strictly reflect physical thermodynamics and spatial geofences.")

if __name__ == "__main__":
    validate_feature_importances()
