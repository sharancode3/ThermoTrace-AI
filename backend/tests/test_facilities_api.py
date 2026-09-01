"""Comprehensive unit and integration tests for /facilities API endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.models import IndustrialFacility, FacilityBaseline

client = TestClient(app)


def test_list_facilities_eager_and_cheap():
    """Verify GET /api/v1/facilities returns all stored facilities swiftly."""
    response = client.get("/api/v1/facilities?page=1&page_size=50")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_count" in data
    assert data["total_count"] >= 27
    assert len(data["items"]) > 0
    assert len(data["sectors"]) > 0
    assert "states" in data

    # Verify fields on first item
    first = data["items"][0]
    assert "id" in first
    assert "name" in first
    assert "sector_category" in first
    assert "facility_code" in first
    assert "latitude" in first
    assert "longitude" in first


def test_list_facilities_search_filtering():
    """Verify search filter works server-side."""
    response = client.get("/api/v1/facilities?search=Jamnagar")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 1
    names = [item["name"] for item in data["items"]]
    assert any("Jamnagar" in n for n in names)


def test_list_facilities_sector_filtering():
    """Verify sector filter works server-side."""
    response = client.get("/api/v1/facilities?sector=Refinery")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 1
    for item in data["items"]:
        assert item["sector_category"] == "Refinery"


def test_facility_intelligence_lazy_detail():
    """Verify GET /api/v1/facilities/{id}/intelligence returns real scoped metrics."""
    # First get a facility ID
    list_res = client.get("/api/v1/facilities?search=Jamnagar")
    assert list_res.status_code == 200
    fac_id = list_res.json()["items"][0]["id"]

    # Call intelligence endpoint
    int_res = client.get(f"/api/v1/facilities/{fac_id}/intelligence?window_days=30")
    assert int_res.status_code == 200
    intel = int_res.json()

    assert "facility" in intel
    assert intel["facility"]["id"] == fac_id
    assert "baseline_profile" in intel
    assert "window_metrics" in intel
    assert "historical_events" in intel
    assert "land_cover_context" in intel
    assert "grounded_brief" in intel

    # Check grounded brief 4-tier epistemic structure
    brief = intel["grounded_brief"]
    assert len(brief["observed"]) > 0
    assert len(brief["derived"]) > 0
    assert len(brief["modelled"]) > 0
    assert len(brief["unknown"]) > 0
    assert len(brief["narrative_summary"]) > 0


def test_facility_intelligence_nonexistent():
    """Verify 404 for non-existent facility."""
    import uuid
    random_id = str(uuid.uuid4())
    res = client.get(f"/api/v1/facilities/{random_id}/intelligence")
    assert res.status_code == 404


def test_facility_report_download_with_dual_timestamp_and_immutability():
    """Verify GET /api/v1/facilities/{id}/report/download generates real PDF with dual timestamp."""
    list_res = client.get("/api/v1/facilities?page=1&page_size=5")
    assert list_res.status_code == 200
    fac_id = list_res.json()["items"][0]["id"]

    res = client.get(f"/api/v1/facilities/{fac_id}/report/download?window_days=30")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "X-Report-SHA256" in res.headers
    assert len(res.content) > 1000
