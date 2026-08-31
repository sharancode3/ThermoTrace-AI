"""
Phase 13 Tests: Grounding Schema Extension & Zero-Hallucination Verification.
Verifies strict partition into OBSERVED, DERIVED, MODELLED, and UNKNOWN with explicit uncertainty grounding.
"""
import os
import sys

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app.domain.llm_humanizer import generate_deterministic_fallback

def test_grounding_schema_partition_and_uncertainty():
    """
    Tests that the brief strictly partitions facts and explicitly grounds uncertainties:
    - Optical scene timing delta (e.g. 48h prior)
    - BASELINE_INSUFFICIENT sample counts
    """
    intel_insufficient = {
        "event_id": "EVT-IN-TEST-01",
        "facility_name": "Jamnagar Refinery",
        "classification": "IND_FLARE",
        "classification_confidence": 0.78,
        "anomaly_tier": "BASELINE_INSUFFICIENT",
        "is_statistically_sufficient": False,
        "baseline_sample_size": 3,
        "peak_frp_mw": 45.0,
        "mean_frp_mw": 38.0,
        "max_brightness_k": 340.0,
        "observation_count": 2,
        "evidence_strength": "MODERATE",
        "satellite_context": {
            "analysis_buffer_radius_km": 1.95,
            "primary_land_cover": "Industrial / Built-up Infrastructure",
            "land_cover_breakdown": {"urban_pct": 75, "cropland_pct": 15, "forest_pct": 10},
            "optical_scene": {
                "time_delta_from_detection_hours": 48.0
            }
        },
        "shap_top_contributors": {"frp_variance": 1.25, "peak_frp_mw": -0.8}
    }
    
    brief = generate_deterministic_fallback(intel_insufficient)
    
    # 1. OBSERVED contains raw sensor values
    assert "OBSERVED:" in brief["what_happened"]
    assert "45.0 MW" in brief["what_happened"]
    assert "340.0 K" in brief["what_happened"]
    
    # 2. DERIVED contains WorldCover percentages and insufficient baseline withholding
    assert "DERIVED:" in brief["why_it_matters"]
    assert "statistically insufficient (3 of 10" in brief["why_it_matters"]
    assert "1.95km buffer" in brief["why_it_matters"]
    assert "Industrial / Built-up" in brief["why_it_matters"]
    
    # 3. MODELLED contains calibrated classification and TreeSHAP
    assert "MODELLED:" in brief["model_assessment"]
    assert "Industrial Gas Flaring" in brief["model_assessment"]
    assert "78.0% calibrated probability" in brief["model_assessment"]
    assert "frp_variance: +1.25" in brief["model_assessment"]
    
    # 4. UNKNOWN explicitly states optical timing delta and baseline gap
    assert "UNKNOWN:" in brief["uncertainty_and_gaps"]
    assert "48.0h prior to detection" in brief["uncertainty_and_gaps"]
    assert "sample size (3/10)" in brief["uncertainty_and_gaps"]
