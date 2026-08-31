import pytest
import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
try:
    from scripts.ingest_firms import compute_dedup_key
except ImportError:
    from backend.scripts.ingest_firms import compute_dedup_key

def test_compute_dedup_key_consistency():
    """Test that the same input always yields the same SHA256 deduplication key."""
    lat = 23.456789
    lon = 85.123456
    acq_date = "2026-08-30"
    acq_time = "12:34:00"
    sensor = "VIIRS_SNPP_NRT"
    
    key1 = compute_dedup_key(lat, lon, acq_date, acq_time, sensor)
    key2 = compute_dedup_key(lat, lon, acq_date, acq_time, sensor)
    
    assert key1 == key2
    
def test_compute_dedup_key_rounding():
    """Test that coordinates are correctly rounded to 4 decimal places."""
    lat1 = 23.456711
    lon1 = 85.123411
    
    lat2 = 23.456749
    lon2 = 85.123449
    
    # Both should round down to 23.4567 and 85.1234
    key1 = compute_dedup_key(lat1, lon1, "2026-08-30", "12:34:00", "MODIS_NRT")
    key2 = compute_dedup_key(lat2, lon2, "2026-08-30", "12:34:00", "MODIS_NRT")
    
    assert key1 == key2

def test_compute_dedup_key_sensitivity():
    """Test that changing sensor or time changes the hash."""
    base = compute_dedup_key(23.4567, 85.1234, "2026-08-30", "12:34:00", "MODIS_NRT")
    diff_time = compute_dedup_key(23.4567, 85.1234, "2026-08-30", "12:35:00", "MODIS_NRT")
    diff_sensor = compute_dedup_key(23.4567, 85.1234, "2026-08-30", "12:34:00", "VIIRS_SNPP_NRT")
    
    assert base != diff_time
    assert base != diff_sensor
