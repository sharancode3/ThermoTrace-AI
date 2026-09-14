import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_event_wind_recent_event_returns_valid_contract():
    res = client.get("/api/v1/events/EVT-2026-098D64/wind")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert data["target_type"] == "EVENT"
    assert data["target_id"] == "EVT-2026-098D64"
    assert "speed_kmh" in data
    assert "direction_from_degrees" in data
    assert "direction_toward_degrees" in data
    assert "temperature_c" in data
    assert "surface_pressure_hpa" in data
    assert "relative_humidity_pct" in data
    assert "precipitation_mm" in data


def test_event_wind_historical_event_id_format():
    res = client.get("/api/v1/events/EVT-IN-20260904-23838457-0459/wind")
    assert res.status_code == 200
    data = res.json()
    assert data["target_type"] == "EVENT"
    assert data["target_id"] == "EVT-IN-20260904-23838457-0459"


def test_facility_wind_returns_ambient_contract():
    fac_res = client.get("/api/v1/facilities?page_size=1")
    assert fac_res.status_code == 200
    data = fac_res.json()
    facilities = data.get("items") or data.get("facilities") or []
    if facilities:
        fac_id = facilities[0]["id"]
        res = client.get(f"/api/v1/facilities/{fac_id}/wind")
        assert res.status_code == 200
        data = res.json()
        assert data["target_type"] == "FACILITY"
        assert data["target_id"] == str(fac_id)
        assert "ambient_context_notice" in data
        assert "speed_kmh" in data
        assert "direction_toward_degrees" in data


def test_event_wind_coordinate_fallback():
    # If event is missing from DB, passing coords should succeed gracefully
    res = client.get("/api/v1/events/EVT-NONEXISTENT/wind?latitude=21.5&longitude=83.5")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert data["latitude"] == 21.5
    assert data["longitude"] == 83.5


def test_missing_event_without_coords_returns_404():
    res = client.get("/api/v1/events/EVT-DEFINITELY-MISSING-9999999/wind")
    assert res.status_code == 404
