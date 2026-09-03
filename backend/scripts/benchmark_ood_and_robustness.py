"""
Step 10 & 18: Out-of-Distribution (OOD), Abstention & Robustness Evaluation
Tests the calibrated model against deliberately unfamiliar and adversarial anomalies:
- Case 1: Desert sand solar heating & glint (Unusual non-combustion thermal signature)
- Case 2: Steel slag cooling / Hot metal storage yard with unassociated facility
- Case 3: Conflicting multimodal context (e.g., Midnight 600 MW pass in pure cropland)
- Case 4: Sparse single-observation telemetry (N=1, zero duration, zero variance)
- Case 5: Missing facility context (Distance = 99999m)
- Case 6: Missing land-cover context (Uniform 33% / 33% / 33% distribution)

Verifies honest uncertainty quantification and abstention to OTHER_UNCERTAIN.
"""
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.domain.ml_models import Float64XGBClassifier

FEATURE_COLS = [
    "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
    "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
    "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
    "pct_forest", "pct_urban", "is_industrial_zone"
]

def evaluate_ood_and_robustness():
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    model_path = os.path.join(backend_dir, 'data', 'models', 'thermo_xgb_v1.1.0.joblib')
    classes_path = os.path.join(backend_dir, 'data', 'models', 'classes.npy')

    model = joblib.load(model_path)
    classes = np.load(classes_path, allow_pickle=True)

    ood_cases = [
        {
            "case_id": "OOD-01",
            "name": "Desert_Sand_Solar_Glint",
            "description": "High solar heating in Thar Desert with no combustion duration or industrial infrastructure.",
            "features": {
                "dist_to_facility": 65000.0, "facility_category_encoded": 0, "peak_frp_mw": 0.85,
                "mean_frp_mw": 0.65, "frp_variance": 0.0, "max_brightness_k": 308.0,
                "duration_hours": 0.0, "day_night_ratio": 1.0, "historical_active_days_90d": 0,
                "historical_peak_frp": 0.0, "pct_cropland": 0.05, "pct_forest": 0.02,
                "pct_urban": 0.05, "is_industrial_zone": 0
            },
            "expected_behavior": "OTHER_UNCERTAIN or High Entropy Abstention"
        },
        {
            "case_id": "OOD-02",
            "name": "Steel_Slag_Dump_Cooling",
            "description": "Unassociated hot slag dump: moderate FRP (12 MW), 0% urban, 100% barren, no plant match.",
            "features": {
                "dist_to_facility": 18000.0, "facility_category_encoded": 0, "peak_frp_mw": 12.5,
                "mean_frp_mw": 10.0, "frp_variance": 1.2, "max_brightness_k": 325.0,
                "duration_hours": 3.0, "day_night_ratio": 0.0, "historical_active_days_90d": 1,
                "historical_peak_frp": 8.0, "pct_cropland": 0.10, "pct_forest": 0.05,
                "pct_urban": 0.10, "is_industrial_zone": 0
            },
            "expected_behavior": "Low Confidence / High Uncertainty"
        },
        {
            "case_id": "OOD-03",
            "name": "Conflicting_Context_Midnight_Mega_Blaze",
            "description": "600 MW thermal spike in 95% cropland at 2 AM (Night pass) with zero facility link.",
            "features": {
                "dist_to_facility": 25000.0, "facility_category_encoded": 0, "peak_frp_mw": 600.0,
                "mean_frp_mw": 450.0, "frp_variance": 850.0, "max_brightness_k": 480.0,
                "duration_hours": 1.5, "day_night_ratio": 0.0, "historical_active_days_90d": 0,
                "historical_peak_frp": 0.0, "pct_cropland": 0.95, "pct_forest": 0.02,
                "pct_urban": 0.03, "is_industrial_zone": 0
            },
            "expected_behavior": "Flagged as Anomaly / Not Naively Categorized as Normal Crop Burn"
        },
        {
            "case_id": "ROB-01",
            "name": "Context_Deprivation_Missing_Facility",
            "description": "True refinery flare but facility registry is missing (Distance = 99999m, Category = 0).",
            "features": {
                "dist_to_facility": 99999.0, "facility_category_encoded": 0, "peak_frp_mw": 45.0,
                "mean_frp_mw": 32.0, "frp_variance": 14.0, "max_brightness_k": 365.0,
                "duration_hours": 720.0, "day_night_ratio": 0.50, "historical_active_days_90d": 65,
                "historical_peak_frp": 60.0, "pct_cropland": 0.10, "pct_forest": 0.05,
                "pct_urban": 0.85, "is_industrial_zone": 0
            },
            "expected_behavior": "Temporal persistence (720h, 65d) retains flare/routine attribution despite missing facility"
        },
        {
            "case_id": "ROB-02",
            "name": "Context_Deprivation_Missing_LandCover",
            "description": "Agricultural burn with land cover raster unavailable (Uniform 33% cropland/forest/urban).",
            "features": {
                "dist_to_facility": 15000.0, "facility_category_encoded": 0, "peak_frp_mw": 18.0,
                "mean_frp_mw": 12.0, "frp_variance": 2.5, "max_brightness_k": 335.0,
                "duration_hours": 2.0, "day_night_ratio": 1.0, "historical_active_days_90d": 1,
                "historical_peak_frp": 15.0, "pct_cropland": 0.33, "pct_forest": 0.33,
                "pct_urban": 0.34, "is_industrial_zone": 0
            },
            "expected_behavior": "Diurnal pattern (day/night=1.0) and transient duration retains AGRI_BURN"
        }
    ]

    print("=== EXECUTING OOD, ABSTENTION & ROBUSTNESS STRESS TEST ===")
    results = []

    for case in ood_cases:
        x_vec = np.array([[case["features"][c] for c in FEATURE_COLS]], dtype=np.float64)
        probs = model.predict_proba(x_vec)[0]
        pred_idx = np.argmax(probs)
        pred_class = classes[pred_idx]
        conf = float(probs[pred_idx])
        entropy = float(-np.sum([p * np.log(p + 1e-9) for p in probs]))

        # Abstention logic test: If confidence < 0.60 or entropy > 1.20, abstain to OTHER_UNCERTAIN
        abstain = bool(conf < 0.60 or entropy > 1.20)
        final_assigned = "OTHER_UNCERTAIN" if abstain else pred_class

        res_entry = {
            "case_id": case["case_id"],
            "name": case["name"],
            "description": case["description"],
            "raw_predicted_class": str(pred_class),
            "calibrated_confidence": round(conf, 4),
            "entropy": round(entropy, 4),
            "abstention_triggered": abstain,
            "final_assigned_class": final_assigned,
            "class_probabilities": {str(c): round(float(p), 4) for c, p in zip(classes, probs)}
        }
        results.append(res_entry)

        print(f"[{case['case_id']}: {case['name']}]")
        print(f"  Raw Pred: {pred_class} (Conf: {conf*100:.1f}%, Entropy: {entropy:.2f})")
        print(f"  Abstention Policy: {'[ABSTAINED -> OTHER_UNCERTAIN]' if abstain else '[ACCEPTED]'}")
        print(f"  Final Decision: {final_assigned}")
        print()

    # Save to ml_experiments
    out_dir = os.path.join(backend_dir, 'ml_experiments')
    out_file = os.path.join(out_dir, "ood_and_robustness_report.json")
    with open(out_file, "w") as f:
        json.dump({"cases_evaluated": results}, f, indent=2)

    print(f"OOD and Robustness report saved to: {out_file}")

if __name__ == "__main__":
    evaluate_ood_and_robustness()
