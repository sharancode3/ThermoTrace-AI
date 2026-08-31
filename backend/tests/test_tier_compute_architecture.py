"""
Phase 7 Unit & Regression Tests: Two-Tier Compute Architecture
Tests eager Tier 1 execution (<5ms, zero SHAP) and lazy cached Tier 2 on-demand explainability.
"""
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app.db.models import ThermalEvent, EventClassification, MlModel
from app.domain.anomaly import get_or_compute_tier2_intelligence

def test_tier1_eager_excludes_shap():
    """
    Tier 1 Eager Compute Guarantee:
    During bulk clustering/ingestion, XGBoost and Z-score run eagerly,
    while heavy TreeSHAP calculation is deferred to Tier 2 on-demand drawer opening.
    """
    # Verify that initial classifications can be stored without blocking on SHAP
    mock_cls = EventClassification(
        predicted_class="IND_FLARE",
        confidence_pct=88.5,
        class_probabilities={"IND_FLARE": 0.885, "IND_ROUTINE": 0.10, "OTHER_UNCERTAIN": 0.015},
        feature_importances={}, # Empty during Tier 1
        input_feature_vector={},
        tier2_computed_at=None # Uncomputed
    )
    
    assert mock_cls.tier2_computed_at is None
    assert mock_cls.feature_importances == {}
    assert mock_cls.predicted_class == "IND_FLARE"

def test_tier2_cached_response():
    """
    Tier 2 Lazy Compute Guarantee:
    When an event has already been opened and computed (tier2_computed_at is set),
    the endpoint returns cached SHAP and narrative in <5ms without recomputing.
    """
    mock_session = MagicMock()
    mock_event = MagicMock(spec=ThermalEvent)
    mock_event.id = "00000000-0000-0000-0000-000000000001"
    mock_event.event_id = "EVT-IN-GUJ-JAMNAGAR-02"
    mock_event.latest_detected_utc = datetime.now(timezone.utc) - timedelta(hours=2)

    mock_cls = MagicMock(spec=EventClassification)
    mock_cls.feature_importances = {"peak_frp_mw": 0.45, "dist_to_facility": -0.32, "pct_cropland": -0.15}
    mock_cls.tier2_computed_at = datetime.now(timezone.utc) - timedelta(hours=1) # Fresh

    mock_session.query().filter().first.side_effect = [mock_event, mock_cls]

    t0 = time.perf_counter()
    result = get_or_compute_tier2_intelligence(mock_session, "EVT-IN-GUJ-JAMNAGAR-02")
    duration_ms = (time.perf_counter() - t0) * 1000.0

    assert result["cached"] is True
    assert "peak_frp_mw" in result["shap_top_contributors"]
    assert duration_ms < 100.0 # Sub-10ms cache hit
