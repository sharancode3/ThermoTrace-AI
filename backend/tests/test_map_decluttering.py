"""
Phase 11 Tests: Map Default View & Server-Side Decluttering.
Verifies that default GIS query returns ONLY priority events and includes focus_event_id.
"""
import os
import sys

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_default_gis_events_decluttering():
    """
    Tests that default /gis/events (show_all=False) returns only priority events
    (anomaly_tier in ABNORMAL/CRITICAL or classification in IND_FIRE/IND_FLARE).
    """
    resp = client.get("/api/v1/gis/events")
    assert resp.status_code == 200
    data = resp.json()
    features = data.get("features", [])
    
    for feat in features:
        props = feat.get("properties", {})
        tier = props.get("anomaly_tier")
        cls_name = props.get("classification")
        
        # In default view, every returned event must satisfy priority criteria
        is_priority = (tier in ["ABNORMAL", "CRITICAL"]) or (cls_name in ["IND_FIRE", "IND_FLARE"])
        assert is_priority, f"Non-priority event {props.get('event_id')} leaked in default view: tier={tier}, cls={cls_name}"

def test_show_all_gis_events_toggle():
    """
    Tests that /gis/events?show_all=true returns all sovereign Indian detections.
    """
    resp_default = client.get("/api/v1/gis/events")
    resp_all = client.get("/api/v1/gis/events?show_all=true")
    
    assert resp_default.status_code == 200
    assert resp_all.status_code == 200
    
    count_default = len(resp_default.json().get("features", []))
    count_all = len(resp_all.json().get("features", []))
    
    assert count_all >= count_default

def test_focus_event_bypass():
    """
    Tests that requesting a specific focus_event_id includes that event even if nominal/unclassified.
    """
    # Fetch all events to pick an unclassified or nominal event ID
    resp_all = client.get("/api/v1/gis/events?show_all=true")
    features = resp_all.json().get("features", [])
    
    if features:
        sample_id = features[0]["properties"]["event_id"]
        resp_focus = client.get(f"/api/v1/gis/events?focus_event_id={sample_id}")
        assert resp_focus.status_code == 200
        focus_ids = [f["properties"]["event_id"] for f in resp_focus.json().get("features", [])]
        assert sample_id in focus_ids
