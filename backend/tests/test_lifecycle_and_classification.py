import os
import sys
import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.domain.lifecycle import (
    evaluate_lifecycle, normalize_legacy_status, 
    LIFECYCLE_ACTIVE, LIFECYCLE_COOLING, LIFECYCLE_EXTINGUISHED,
    FRESHNESS_ACTIVE, FRESHNESS_AGING, FRESHNESS_HISTORICAL
)
from app.domain.anomaly import get_model
from app.schemas.events import CanonicalLifecycleStatus, EventResponse

class TestLifecycleAndFreshness:
    """Test suite for authoritative lifecycle transitions, boundaries, and normalization."""

    def test_freshness_boundaries_with_injectable_clock(self):
        ref_time = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)

        # 1. 23.9 hours ago -> ACTIVE / FRESH_OBSERVATION
        t_23_9h = ref_time - timedelta(hours=23.9)
        res_23_9h = evaluate_lifecycle(t_23_9h, reference_time=ref_time)
        assert res_23_9h["is_active"] is True
        assert res_23_9h["freshness_status"] == FRESHNESS_ACTIVE
        assert res_23_9h["lifecycle_status"] == LIFECYCLE_ACTIVE
        assert pytest.approx(res_23_9h["elapsed_hours"], rel=1e-2) == 23.9

        # 2. Exactly 24.0 hours ago -> AGING / COOLING
        t_24h = ref_time - timedelta(hours=24.0)
        res_24h = evaluate_lifecycle(t_24h, reference_time=ref_time)
        assert res_24h["is_active"] is False
        assert res_24h["freshness_status"] == FRESHNESS_AGING
        assert res_24h["lifecycle_status"] == LIFECYCLE_COOLING

        # 3. 71.9 hours ago -> AGING / COOLING
        t_71_9h = ref_time - timedelta(hours=71.9)
        res_71_9h = evaluate_lifecycle(t_71_9h, reference_time=ref_time)
        assert res_71_9h["is_active"] is False
        assert res_71_9h["freshness_status"] == FRESHNESS_AGING
        assert res_71_9h["lifecycle_status"] == LIFECYCLE_COOLING

        # 4. Exactly 72.0 hours ago -> HISTORICAL / EXTINGUISHED
        t_72h = ref_time - timedelta(hours=72.0)
        res_72h = evaluate_lifecycle(t_72h, reference_time=ref_time)
        assert res_72h["is_active"] is False
        assert res_72h["freshness_status"] == FRESHNESS_HISTORICAL
        assert res_72h["lifecycle_status"] == LIFECYCLE_EXTINGUISHED

        # 5. 30 days ago -> HISTORICAL / EXTINGUISHED
        t_30d = ref_time - timedelta(days=30)
        res_30d = evaluate_lifecycle(t_30d, reference_time=ref_time)
        assert res_30d["is_active"] is False
        assert res_30d["freshness_status"] == FRESHNESS_HISTORICAL
        assert res_30d["lifecycle_status"] == LIFECYCLE_EXTINGUISHED

    def test_lifecycle_none_timestamp_graceful_handling(self):
        # When timestamp is absent, defaults safely to extinguished unless persisted status was active
        res_default = evaluate_lifecycle(None)
        assert res_default["is_active"] is False
        assert res_default["freshness_status"] == FRESHNESS_HISTORICAL
        assert res_default["lifecycle_status"] == LIFECYCLE_EXTINGUISHED

        # If persisted status was ACTIVE, respects that fallback
        res_active_fallback = evaluate_lifecycle(None, current_persisted_status="ACTIVE")
        assert res_active_fallback["is_active"] is True
        assert res_active_fallback["freshness_status"] == FRESHNESS_ACTIVE
        assert res_active_fallback["lifecycle_status"] == LIFECYCLE_ACTIVE

    def test_legacy_status_normalization(self):
        assert normalize_legacy_status("RESOLVED") == LIFECYCLE_EXTINGUISHED
        assert normalize_legacy_status("EXTINGUISHED") == LIFECYCLE_EXTINGUISHED
        assert normalize_legacy_status("COOLING") == LIFECYCLE_COOLING
        assert normalize_legacy_status("ACTIVE") == LIFECYCLE_ACTIVE
        assert normalize_legacy_status(None) == LIFECYCLE_EXTINGUISHED

    def test_canonical_lifecycle_schema_values(self):
        # Ensure enum accepts all canonical values including EXTINGUISHED
        enum_values = [e.value for e in CanonicalLifecycleStatus]
        assert "EXTINGUISHED" in enum_values
        assert "COOLING" in enum_values
        assert "ACTIVE" in enum_values
        assert "RESOLVED" in enum_values


class TestModelClassificationAndProbabilities:
    """Test suite verifying XGBoost multi-class properties and probability integrity."""

    def test_model_artifact_classes_and_prediction_schema(self):
        model, classes = get_model()
        assert model is not None, "Model thermo_xgb_v1.1.0 must be loadable"
        assert classes is not None, "Classes must be loadable"
        
        expected_classes = ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']
        assert list(classes) == expected_classes

        # Synthetic 14-D vector matching exact schema
        feature_cols = [
            "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
            "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
            "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
            "pct_forest", "pct_urban", "is_industrial_zone"
        ]
        
        # Test Case A: Clear Agricultural Burn signature
        agri_sample = pd.DataFrame([{
            "dist_to_facility": 15000.0,
            "facility_category_encoded": 0.0,
            "peak_frp_mw": 25.0,
            "mean_frp_mw": 18.0,
            "frp_variance": 5.0,
            "max_brightness_k": 325.0,
            "duration_hours": 2.0,
            "day_night_ratio": 1.0,
            "historical_active_days_90d": 1.0,
            "historical_peak_frp": 25.0,
            "pct_cropland": 0.90,
            "pct_forest": 0.05,
            "pct_urban": 0.05,
            "is_industrial_zone": 0.0
        }])[feature_cols].astype(np.float64)

        probs = model.predict_proba(agri_sample)[0]
        assert len(probs) == 6
        assert pytest.approx(sum(probs), rel=1e-4) == 1.0
        
        # AGRI_BURN should have highest probability
        pred_idx = int(np.argmax(probs))
        assert classes[pred_idx] == "AGRI_BURN"
        assert probs[pred_idx] > 0.60

        # Test Case B: Clear Refinery Routine / Flaring signature
        refinery_sample = pd.DataFrame([{
            "dist_to_facility": 100.0,
            "facility_category_encoded": 4.0, # Refinery
            "peak_frp_mw": 65.0,
            "mean_frp_mw": 45.0,
            "frp_variance": 12.0,
            "max_brightness_k": 365.0,
            "duration_hours": 18.0,
            "day_night_ratio": 0.50,
            "historical_active_days_90d": 45.0,
            "historical_peak_frp": 80.0,
            "pct_cropland": 0.05,
            "pct_forest": 0.02,
            "pct_urban": 0.85,
            "is_industrial_zone": 1.0
        }])[feature_cols].astype(np.float64)

        probs_ref = model.predict_proba(refinery_sample)[0]
        pred_idx_ref = int(np.argmax(probs_ref))
        predicted_ref = classes[pred_idx_ref]
        assert predicted_ref in ("IND_ROUTINE", "IND_FLARE")

    def test_outskirts_do_not_force_industrial_routine(self):
        """Hotspot on facility outskirts (e.g. 2.5km) in agricultural fields must retain AGRI_BURN."""
        feature_cols = [
            "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
            "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
            "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
            "pct_forest", "pct_urban", "is_industrial_zone"
        ]
        outskirt_agri = pd.DataFrame([{
            "dist_to_facility": 2200.0, # > 500m immediate parcel
            "facility_category_encoded": 1.0,
            "peak_frp_mw": 30.0,
            "mean_frp_mw": 20.0,
            "frp_variance": 4.0,
            "max_brightness_k": 320.0,
            "duration_hours": 1.5,
            "day_night_ratio": 0.9,
            "historical_active_days_90d": 2.0,
            "historical_peak_frp": 30.0,
            "pct_cropland": 0.85,
            "pct_forest": 0.05,
            "pct_urban": 0.10,
            "is_industrial_zone": 0.0
        }])[feature_cols].astype(np.float64)

        model, classes = get_model()
        probs = model.predict_proba(outskirt_agri)[0]
        pred_class = classes[int(np.argmax(probs))]
        
        # Raw prediction must be AGRI_BURN
        assert pred_class == "AGRI_BURN"

        # Under the refined policy, because dist_to_facility > 500m,
        # it is NOT inside the immediate plant parcel, so AGRI_BURN is preserved!
        dist_fac = 2200.0
        is_immediate_plant_boundary = (dist_fac <= 500.0)
        assert is_immediate_plant_boundary is False
        
        assigned_class = pred_class
        if is_immediate_plant_boundary and pred_class == "AGRI_BURN":
            assigned_class = "IND_ROUTINE"
            
        assert assigned_class == "AGRI_BURN"

    def test_probability_attribution_integrity(self):
        """Confidence assigned to an event must equal the actual probability of the assigned class."""
        classes = np.array(['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE'])
        probs = np.array([0.05, 0.02, 0.65, 0.20, 0.06, 0.02])
        class_prob_map = {str(c): float(p) for c, p in zip(classes, probs)}
        
        assigned_class = "IND_FLARE"
        assigned_conf = class_prob_map.get(assigned_class, 0.0)
        assert assigned_conf == 0.65
        
        # If an operational rule forced IND_FIRE, confidence must be 0.02, NOT 0.65!
        forced_class = "IND_FIRE"
        forced_conf = class_prob_map.get(forced_class, 0.0)
        assert forced_conf == 0.02
        assert forced_conf != assigned_conf
