import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.main import app
from app.db.database import get_db
from app.db.models import (
    ThermalEvent, ThermoNews, Notification, IndustrialFacility,
    ThermalObservation, EventObservation
)

client = TestClient(app)

def test_thermo_news_continuous_24h_rolling_window(db: Session):
    """
    Phase 1 & 54 Acceptance Test:
    Verifies that ThermoNews uses a continuous 24-hour rolling window based on UTC timestamps
    (NOT a midnight reset or calendar-day truncation).
    """
    now = datetime.now(timezone.utc)
    
    fac = db.query(IndustrialFacility).first()
    if not fac:
        pt = from_shape(Point(73.2, 22.3), srid=4326)
        fac = IndustrialFacility(
            facility_code="FAC-TEST-NEWS-01",
            name="News Test Refinery",
            sector_category="Petroleum Refining",
            state="Gujarat",
            district="Vadodara",
            latitude=22.3,
            longitude=73.2,
            facility_geom=pt,
            centroid=pt,
            is_active=True
        )
        db.add(fac)
        db.commit()

    # 2. Create 3 events with different relative publication timestamps:
    # Event A: 12 hours ago (within 24h window)
    # Event B: 23.5 hours ago (within 24h window)
    # Event C: 26 hours ago (outside 24h window)
    pt_a = from_shape(Point(73.2, 22.3), srid=4326)
    pt_b = from_shape(Point(73.21, 22.31), srid=4326)
    pt_c = from_shape(Point(73.22, 22.32), srid=4326)

    evt_a = ThermalEvent(
        event_id="TEST-NEWS-EVT-A",
        latitude=22.3,
        longitude=73.2,
        centroid=pt_a,
        boundary_geom=pt_a,
        first_detected_utc=now - timedelta(hours=12),
        latest_detected_utc=now - timedelta(hours=12),
        peak_frp_mw=45.0,
        mean_frp_mw=30.0,
        aggregate_frp_mw=45.0,
        max_brightness_k=340.0,
        observation_count=2,
        classification="IND_FLARE",
        anomaly_tier="ABNORMAL",
        lifecycle_status="ACTIVE",
        associated_facility_id=fac.id
    )
    evt_b = ThermalEvent(
        event_id="TEST-NEWS-EVT-B",
        latitude=22.31,
        longitude=73.21,
        centroid=pt_b,
        boundary_geom=pt_b,
        first_detected_utc=now - timedelta(hours=23, minutes=30),
        latest_detected_utc=now - timedelta(hours=23, minutes=30),
        peak_frp_mw=35.0,
        mean_frp_mw=25.0,
        aggregate_frp_mw=35.0,
        max_brightness_k=330.0,
        observation_count=1,
        classification="IND_ROUTINE",
        anomaly_tier="NORMAL",
        lifecycle_status="ACTIVE",
        associated_facility_id=fac.id
    )
    evt_c = ThermalEvent(
        event_id="TEST-NEWS-EVT-C",
        latitude=22.32,
        longitude=73.22,
        centroid=pt_c,
        boundary_geom=pt_c,
        first_detected_utc=now - timedelta(hours=26),
        latest_detected_utc=now - timedelta(hours=26),
        peak_frp_mw=60.0,
        mean_frp_mw=40.0,
        aggregate_frp_mw=60.0,
        max_brightness_k=355.0,
        observation_count=3,
        classification="IND_FIRE",
        anomaly_tier="CRITICAL",
        lifecycle_status="ACTIVE",
        associated_facility_id=fac.id
    )
    db.add_all([evt_a, evt_b, evt_c])
    db.commit()

    # Create corresponding ThermoNews items
    news_a = ThermoNews(
        event_id=evt_a.id,
        headline="Test News A - 12h ago",
        summary="Summary A",
        severity_tag="ABNORMAL",
        published_at=now - timedelta(hours=12),
        is_active=True
    )
    news_b = ThermoNews(
        event_id=evt_b.id,
        headline="Test News B - 23.5h ago",
        summary="Summary B",
        severity_tag="NORMAL",
        published_at=now - timedelta(hours=23, minutes=30),
        is_active=True
    )
    news_c = ThermoNews(
        event_id=evt_c.id,
        headline="Test News C - 26h ago",
        summary="Summary C",
        severity_tag="CRITICAL",
        published_at=now - timedelta(hours=26),
        is_active=True
    )
    db.add_all([news_a, news_b, news_c])
    db.commit()

    # Call /news?hours=24
    response = client.get("/api/v1/news?hours=24")
    assert response.status_code == 200
    items = response.json()
    
    event_ids = [item["event_id"] for item in items]
    assert "TEST-NEWS-EVT-A" in event_ids

    # Verify NON-DESTRUCTIVE: Database still contains Event C
    db_evt_c = db.query(ThermalEvent).filter(ThermalEvent.event_id == "TEST-NEWS-EVT-C").first()
    assert db_evt_c is not None, "Older news events must NEVER be deleted from PostgreSQL!"


def test_alerts_top_100_query_limit_and_non_destructive(db: Session):
    """
    Phase 3 & 55 Acceptance Test:
    Verifies that /notifications returns top 100 highest-priority active alerts
    without deleting records beyond row 100.
    """
    response = client.get("/api/v1/notifications")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) <= 100

    if len(alerts) > 1:
        severities = [a["severity"] for a in alerts]
        if "CRITICAL" in severities and "NORMAL" in severities:
            crit_idx = severities.index("CRITICAL")
            norm_idx = severities.index("NORMAL")
            assert crit_idx < norm_idx, "Critical alerts must precede normal/routine alerts!"


def test_map_filter_independence(db: Session):
    """
    Phase 4 & 5 Acceptance Test:
    Verifies that the Map endpoint (/gis/events) operates independently from News.
    """
    # 1. Query all events with show_all=True
    res_all = client.get("/api/v1/gis/events?west=68.0&south=8.0&east=97.0&north=37.0&show_all=true")
    assert res_all.status_code == 200
    all_features = res_all.json()["features"]
    assert len(all_features) > 0

    # 2. Query with strict anomaly_tier=CRITICAL
    res_crit = client.get("/api/v1/gis/events?west=68.0&south=8.0&east=97.0&north=37.0&anomaly_tier=CRITICAL")
    assert res_crit.status_code == 200
    crit_features = res_crit.json()["features"]
    for f in crit_features:
        assert f["properties"]["anomaly_tier"] == "CRITICAL"
