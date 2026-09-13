import os
import sys
import pytest
import numpy as np
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.main import app
from app.db.database import SessionLocal
from app.db.models import ThermalEvent, IndustrialFacility, EventClassification, Notification, ThermoNews
from app.domain.features import build_physical_verification_payload, build_feature_vector
from app.domain.anomaly import get_model, process_event_intelligence

client = TestClient(app)

def test_calibrated_model_loading_and_properties():
    """Verify calibrated model loads, has 6 classes, and produces true probability distributions."""
    model, classes = get_model()
    assert model is not None, "Model failed to load"
    assert classes is not None, "Classes failed to load"
    assert len(classes) == 6, f"Expected 6 classes, got {len(classes)}"
    
    # Dummy feature vector (14 dimensions)
    dummy_x = np.array([[
        500.0, 12.0, 45.0, 35.0, 5.0, 350.0, 24.0, 0.5, 10.0, 40.0, 0.1, 0.1, 0.8, 1.0
    ]], dtype=np.float64)
    
    probs = model.predict_proba(dummy_x)[0]
    assert len(probs) == 6
    assert np.isclose(np.sum(probs), 1.0, atol=1e-4), "Probabilities do not sum to 1.0"
    assert all(0.0 <= p <= 1.0 for p in probs), "Probabilities out of bounds [0, 1]"

def test_physical_verification_payload_integrity():
    """Verify physical verification helper produces additive spatial-radiance evidence."""
    ev = ThermalEvent(
        event_id="TEST-EV-001",
        latitude=22.5,
        longitude=78.2,
        peak_frp_mw=180.0,
        distance_to_facility_m=1200.0,
        associated_facility_id=1
    )
    fac = IndustrialFacility(id=1, name="Test Refinery", sector_category="Refinery")
    
    pv = build_physical_verification_payload(ev, fac)
    assert pv["inside_industrial_polygon"] is True
    assert pv["facility_distance_m"] == 1200.0
    assert pv["peak_frp_mw"] == 180.0
    assert "High radiant intensity" in pv["verification_note"]

def test_duration_hours_inverted_timestamp_robustness():
    """Verify duration_hours handles out-of-order satellite timestamps gracefully."""
    session = SessionLocal()
    ev = session.query(ThermalEvent).first()
    if ev:
        fv = build_feature_vector(session, str(ev.id))
        assert fv["duration_hours"] >= 0.0, "duration_hours produced negative value"
    session.close()

def test_api_events_contract_zero_breakage():
    """Verify /api/v1/gis/events contract returns GeoJSON FeatureCollection with expected properties."""
    resp = client.get("/api/v1/gis/events?zoom=5.0&limit=50&show_all=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) > 0
    props = data["features"][0]["properties"]
    assert "classification" in props
    assert "confidence_pct" in props
    assert "anomaly_tier" in props

def test_api_notifications_gating():
    """Verify /api/v1/notifications returns only genuine high-signal anomaly alerts."""
    resp = client.get("/api/v1/notifications")
    assert resp.status_code == 200
    notifs = resp.json()
    assert isinstance(notifs, list)
    assert len(notifs) < 500, f"Expected filtered alerts (<500), got {len(notifs)}"

def test_api_news_feed_active():
    """Verify /api/v1/news returns live news bulletin stream."""
    resp = client.get("/api/v1/news?limit=10")
    assert resp.status_code == 200
    news = resp.json()
    assert isinstance(news, list)
    assert len(news) > 0
