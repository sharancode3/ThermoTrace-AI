"""
Phase 9 Regression Tests: Sovereign India Geofencing & Transboundary Isolation.
Root-causes and verifies exact rejection/acceptance of Phase 0 reproduced defect coordinates.
"""
import os
import sys

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app.domain.sovereign_geofencing import is_within_sovereign_india
from app.domain.geocoding import resolve_indian_location

def test_firozpur_pakistan_border_rejection():
    """
    Defect 1 Reproduction:
    Point on Pakistan side of Radcliffe Line (Kasur/Lahore: 31.12N, 74.38E).
    Must evaluate is_within_sovereign_india == False and NEVER be labeled 'Firozpur, Punjab'.
    """
    pak_lat, pak_lon = 31.1200, 74.3800
    assert is_within_sovereign_india(pak_lat, pak_lon) is False
    
    loc = resolve_indian_location(pak_lat, pak_lon)
    assert loc.get("is_sovereign_india") is False
    assert "Firozpur" not in loc.get("location_formatted", "")
    assert "Punjab" not in loc.get("state", "")
    assert loc.get("state") == "Non-Sovereign / Transboundary"

def test_firozpur_indian_territory_acceptance():
    """
    Legitimate Indian agricultural observation in Firozpur, Punjab (30.9237N, 74.6138E).
    Must evaluate is_within_sovereign_india == True and be accurately labeled 'Firozpur, Punjab'.
    """
    ind_lat, ind_lon = 30.9237, 74.6138
    assert is_within_sovereign_india(ind_lat, ind_lon) is True
    
    loc = resolve_indian_location(ind_lat, ind_lon)
    assert loc.get("district") == "Firozpur"
    assert loc.get("state") == "Punjab"
    assert "Firozpur" in loc.get("location_formatted")

def test_thoothukudi_sri_lanka_strait_rejection():
    """
    Defect 2 Reproduction:
    Point in Gulf of Mannar / Sri Lanka coastal territory (8.98N, 79.90E).
    Must evaluate is_within_sovereign_india == False and NEVER be labeled 'Thoothukudi, Tamil Nadu'.
    """
    sl_lat, sl_lon = 8.9800, 79.9000
    assert is_within_sovereign_india(sl_lat, sl_lon) is False
    
    loc = resolve_indian_location(sl_lat, sl_lon)
    assert loc.get("is_sovereign_india") is False
    assert "Thoothukudi" not in loc.get("location_formatted", "")
    assert "Tamil Nadu" not in loc.get("state", "")
    assert loc.get("state") == "Non-Sovereign / Transboundary"

def test_thoothukudi_indian_territory_acceptance():
    """
    Legitimate Indian industrial observation in Thoothukudi, Tamil Nadu (8.7642N, 78.1348E).
    Must evaluate is_within_sovereign_india == True and be accurately labeled 'Thoothukudi, Tamil Nadu'.
    """
    ind_lat, ind_lon = 8.7642, 78.1348
    assert is_within_sovereign_india(ind_lat, ind_lon) is True
    
    loc = resolve_indian_location(ind_lat, ind_lon)
    assert loc.get("district") == "Thoothukudi"
    assert loc.get("state") == "Tamil Nadu"
