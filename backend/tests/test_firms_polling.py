"""
Phase 8 Tests: NASA FIRMS Foreground Cadence & Dynamic Gap Recovery
"""
import os
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app.domain.firms_poller import calculate_dynamic_day_range, compute_dedup_key, poll_firms_foreground_cycle

def test_dynamic_day_range_recovery():
    """
    Tests that when an app has been closed for 3 days,
    calculate_dynamic_day_range requests 4-5 days to recover missing passes.
    """
    mock_session = MagicMock()
    # Mock latest observation timestamp as 3 days ago
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    mock_session.query().scalar.return_value = three_days_ago
    
    day_range = calculate_dynamic_day_range(mock_session)
    assert day_range == 4 or day_range == 5
    assert day_range <= 5 # NASA FIRMS maximum area limit

def test_dedup_key_idempotence():
    """
    Tests that repeated fetches of the same observation produce identical SHA-256 hashes.
    """
    lat, lon = 22.45671, 70.12349
    acq_date = "2026-08-30"
    acq_time = "1430"
    sensor = "VIIRS_SNPP_NRT"
    
    h1 = compute_dedup_key(lat, lon, acq_date, acq_time, sensor)
    h2 = compute_dedup_key(lat, lon, acq_date, acq_time, sensor)
    assert h1 == h2
    assert len(h1) == 64
