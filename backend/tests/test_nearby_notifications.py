import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.db.models import Notification, ThermalEvent, User
from app.services.nearby_notification_service import _build_web_push_payload, create_nearby_notifications


def projected_point(db, distance_m: float):
    row = db.execute(text("""
        SELECT ST_Y(point::geometry), ST_X(point::geometry)
        FROM (SELECT ST_Project(ST_SetSRID(ST_Point(0, 0), 4326)::geography, :distance, radians(90)) point) q
    """), {"distance": distance_m}).one()
    return float(row[0]), float(row[1])


def make_user(db):
    user = User(id=uuid.uuid4(), email=f"nearby-{uuid.uuid4()}@test.local", hashed_password="test",
                full_name="Nearby Test", nearby_alerts_enabled=True,
                alert_latitude=0, alert_longitude=0,
                alert_location="SRID=4326;POINT(0 0)",
                notification_preferences={"notify_critical": True, "notify_abnormal": True})
    db.add(user); db.commit()
    return user


def make_event(db, tier: str, distance_m: float):
    lat, lon = projected_point(db, distance_m)
    event = ThermalEvent(
        event_id=f"TEST-NEAR-{uuid.uuid4().hex[:12]}", centroid=f"SRID=4326;POINT({lon} {lat})",
        boundary_geom=f"SRID=4326;POINT({lon} {lat})", latitude=lat, longitude=lon,
        first_detected_utc=datetime.now(timezone.utc), latest_detected_utc=datetime.now(timezone.utc),
        observation_count=1, peak_frp_mw=20, mean_frp_mw=15, aggregate_frp_mw=20,
        max_brightness_k=330, classification="OTHER_UNCERTAIN", anomaly_tier=tier,
        lifecycle_status="ACTIVE",
    )
    db.add(event); db.commit()
    return event


@pytest.mark.parametrize("tier,distance,expected", [
    ("ABNORMAL", 9900, 1), ("ABNORMAL", 10000, 1), ("ABNORMAL", 10100, 0),
    ("CRITICAL", 24900, 1), ("CRITICAL", 25000, 1), ("CRITICAL", 25100, 0),
    ("NORMAL", 1000, 0), ("ELEVATED", 1000, 0),
])
def test_nearby_radius_boundaries_and_tier_eligibility(db, tier, distance, expected):
    user = make_user(db); event = make_event(db, tier, distance)
    try:
        created = create_nearby_notifications(db, event, redis_client=False)
        assert len(created) == expected
    finally:
        db.query(Notification).filter(Notification.user_id == user.id).delete()
        db.delete(event); db.delete(user); db.commit()


def test_nearby_notification_is_deduplicated(db):
    user = make_user(db); event = make_event(db, "CRITICAL", 5000)
    try:
        assert len(create_nearby_notifications(db, event, redis_client=False)) == 1
        assert len(create_nearby_notifications(db, event, redis_client=False)) == 0
        assert db.query(Notification).filter_by(user_id=user.id, event_id=event.id).count() == 1
    finally:
        db.query(Notification).filter(Notification.user_id == user.id).delete()
        db.delete(event); db.delete(user); db.commit()


def test_24_hour_visibility_contract(db):
    user = make_user(db); event = make_event(db, "CRITICAL", 5000)
    try:
        created = create_nearby_notifications(db, event, redis_client=False)[0]
        created.created_at = datetime.now(timezone.utc) - timedelta(hours=24, seconds=1)
        db.commit()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        assert db.query(Notification).filter(Notification.user_id == user.id, Notification.created_at >= cutoff).count() == 0
    finally:
        db.query(Notification).filter(Notification.user_id == user.id).delete()
        db.delete(event); db.delete(user); db.commit()


@pytest.mark.parametrize("tier,distance_m,location,frp,expected_title,expected_body", [
    ("CRITICAL", 4000, "Bengaluru Urban", 125, "Critical Thermal Event • 4.0 km Away",
     "Bengaluru Urban • 125 MW FRP\nOpen ThermoTrace AI to investigate."),
    ("ABNORMAL", 7200, "Mysuru", 68, "Abnormal Thermal Event • 7.2 km Away",
     "Mysuru • 68 MW FRP\nOpen ThermoTrace AI to review."),
    ("CRITICAL", 3000, "Bengaluru Urban", None, "Critical Thermal Event • 3.0 km Away",
     "Bengaluru Urban\nOpen ThermoTrace AI to investigate."),
    ("CRITICAL", 3000, None, 125, "Critical Thermal Event • 3.0 km Away",
     "125 MW FRP • Near your alert location\nOpen ThermoTrace AI to investigate."),
    ("CRITICAL", 3000, None, None, "Critical Thermal Event • 3.0 km Away",
     "Detected near your alert location.\nOpen ThermoTrace AI to investigate."),
])
def test_web_push_copy_frontloads_operational_details(
    tier, distance_m, location, frp, expected_title, expected_body
):
    notification_id = uuid.uuid4()
    notification = Notification(id=notification_id)
    event = ThermalEvent(event_id="TEST-PUSH-COPY", anomaly_tier=tier, peak_frp_mw=frp)

    payload = _build_web_push_payload(notification, event, distance_m, location)

    assert payload["title"] == expected_title
    assert payload["body"] == expected_body
    assert payload["eventId"] == "TEST-PUSH-COPY"
    assert payload["url"] == "/monitor?eventId=TEST-PUSH-COPY"
    assert payload["notificationId"] == str(notification_id)
    assert all(value not in payload["body"] for value in ("undefined", "null", "NaN", "0 MW"))
