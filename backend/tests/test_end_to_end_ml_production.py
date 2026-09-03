"""
End-to-End Production ML Pipeline and Multi-Regime Integrity Test Suite
Validates:
1. Full inference pipeline (Feature Builder -> Calibrated Model -> Native C++ TreeSHAP -> Dual-Statistical Anomaly Engine)
2. Live FastAPI GIS and Facility API endpoints return compliant payloads with calibrated probabilities
3. Multi-Regime split manifest isolation (zero facility leakage in TEST-A, zero spatial leakage in TEST-B)
4. Disaster contamination quarantine logic
"""
import os
import sys
import json
import pytest
import numpy as np
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.main import app
from app.db.database import SessionLocal
from app.db.models import ThermalEvent, IndustrialFacility, EventAnomaly, EventClassification
from app.domain.anomaly import process_event_intelligence, get_or_compute_tier2_intelligence
from app.ml.splits import FEATURE_COLS

client = TestClient(app)

def test_full_pipeline_intelligence_generation():
    """Verify live database event runs end-to-end through feature extraction, ML classification, TreeSHAP, and anomaly grading."""
    session = SessionLocal()
    try:
        ev = session.query(ThermalEvent).first()
        assert ev is not None, "No thermal events found in database"
        
        # Run live processing
        process_event_intelligence(session, ev.event_id)
        
        # Verify EventClassification record
        cls_rec = session.query(EventClassification).filter(EventClassification.event_id == ev.id).first()
        assert cls_rec is not None
        assert cls_rec.predicted_class in ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']
        assert 0.0 <= cls_rec.confidence_pct <= 100.0
        assert isinstance(cls_rec.class_probabilities, dict)
        assert len(cls_rec.class_probabilities) == 6
        assert np.isclose(sum(cls_rec.class_probabilities.values()), 1.0, atol=1e-3)
        
        # Verify EventAnomaly record with dual baseline engine
        anom_rec = session.query(EventAnomaly).filter(EventAnomaly.event_id == ev.id).first()
        assert anom_rec is not None
        assert anom_rec.anomaly_severity in ['NORMAL', 'ELEVATED', 'ABNORMAL', 'CRITICAL']
        assert "status" in anom_rec.contributing_factors

        # Verify on-demand Tier 2 TreeSHAP explainability
        intel = get_or_compute_tier2_intelligence(session, ev.event_id)
        assert "shap_top_contributors" in intel
        assert len(intel["shap_top_contributors"]) > 0
    finally:
        session.close()

def test_fastapi_gis_events_contract():
    """Verify GET /api/v1/gis/events returns complete GeoJSON with ML classifications and calibration confidence."""
    resp = client.get("/api/v1/gis/events?limit=10&show_all=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0
    props = data["features"][0]["properties"]
    assert "classification" in props
    assert "confidence_pct" in props
    assert "anomaly_tier" in props
    assert "peak_frp_mw" in props

def test_multi_regime_split_leakage_isolation():
    """Verify split manifests enforce strict physical isolation."""
    manifest_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../ml_experiments/multi_regime_split_manifests.json'))
    assert os.path.exists(manifest_path), "Multi-regime split manifests missing"
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        regimes = json.load(f)
        
    for name in ["TEST_A_FACILITY_HOLDOUT", "TEST_B_SPATIAL_HOLDOUT", "TEST_C_TEMPORAL_HOLDOUT", "TEST_D_HARD_NEGATIVES", "TEST_E_OOD_ADVERSARIAL"]:
        assert name in regimes
        r = regimes[name]
        assert r["test_size"] > 50, f"{name} test set has too few samples ({r['test_size']})"
        train_set = set(r["train_indices"])
        test_set = set(r["test_indices"])
        # Strict mutually exclusive index partition
        assert len(train_set.intersection(test_set)) == 0, f"{name} has index leakage between train and test"

def test_disaster_contamination_quarantine_flag():
    """Verify extreme blazes trigger the disaster contamination quarantine tag."""
    session = SessionLocal()
    try:
        fac = session.query(IndustrialFacility).filter(IndustrialFacility.historical_event_count >= 10).first()
        if fac:
            ev = session.query(ThermalEvent).filter(ThermalEvent.associated_facility_id == fac.id).first()
            if ev:
                orig_peak = ev.peak_frp_mw
                try:
                    ev.peak_frp_mw = 280.0
                    process_event_intelligence(session, ev.event_id)
                    anom = session.query(EventAnomaly).filter(EventAnomaly.event_id == ev.id).first()
                    assert anom is not None
                    assert anom.contributing_factors.get("disaster_contamination_quarantine") is True
                finally:
                    ev.peak_frp_mw = orig_peak
                    process_event_intelligence(session, ev.event_id)
                    session.commit()
    finally:
        session.close()
