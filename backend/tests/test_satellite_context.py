"""
Phase 12 Tests: On-Demand Satellite Context & Optical Verification.
Verifies heat-aware radius scaling, ESA WorldCover land-cover breakdown, and Sentinel-2 honesty timestamps.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app.domain.satellite_context import compute_heat_aware_radius_km, extract_satellite_context

def test_heat_aware_radius_scaling():
    """
    Tests heat-aware radius scaling:
    - Low intensity (10 MW): ~1.6 km
    - Medium intensity (78 MW Jamnagar flare): 2.28 km
    - Major anomaly (350 MW): clamped at 5.0 km
    """
    r_low = compute_heat_aware_radius_km(10.0)
    assert 1.5 <= r_low <= 1.7
    
    r_jamnagar = compute_heat_aware_radius_km(78.0)
    assert r_jamnagar == 2.28
    
    r_max = compute_heat_aware_radius_km(450.0)
    assert r_max == 5.0

def test_sentinel2_honesty_timestamp_and_metadata():
    """
    Tests that Sentinel-2 optical metadata includes explicit acquisition timestamps,
    cloud cover percentage, and non-simultaneous honesty disclaimer.
    """
    event_time = datetime(2026, 8, 30, 14, 30, 0, tzinfo=timezone.utc)
    features = {"pct_cropland": 0.65, "pct_urban": 0.20, "pct_forest": 0.10}
    
    ctx = extract_satellite_context(
        lat=22.4707,
        lon=70.0577,
        peak_frp_mw=78.0,
        first_detected_utc=event_time,
        features=features
    )
    
    assert ctx["analysis_buffer_radius_km"] == 2.28
    assert "cropland_pct" in ctx["land_cover_breakdown"]
    
    optical = ctx["optical_scene"]
    assert "Sentinel-2" in optical["satellite_sensor"]
    assert "acquisition_timestamp_utc" in optical
    assert optical["cloud_cover_pct"] <= 5.0
    assert "honesty_disclaimer" in optical
    assert "prior to thermal detection" in optical["honesty_disclaimer"]
