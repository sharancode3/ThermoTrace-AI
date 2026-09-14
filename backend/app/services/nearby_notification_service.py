import json
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Notification, PushSubscription, ThermalEvent, User
from app.domain.geocoding import resolve_indian_location
from app.services.notification_service import DEFAULT_CHANNEL, get_redis_client

RADIUS_METERS = {"ABNORMAL": 10_000, "CRITICAL": 25_000}
# Sub-metre numerical tolerance preserves an inclusive policy boundary after
# WGS84 projection/serialization; it is far below the tested 100 m exclusion.
BOUNDARY_TOLERANCE_METERS = 1


def _preference_allows(user: User, tier: str) -> bool:
    preferences = user.notification_preferences or {}
    return bool(preferences.get(f"notify_{tier.lower()}", True))


def _build_web_push_payload(notification: Notification, event: ThermalEvent,
                            distance_m: Optional[float], location_name: Optional[str]) -> dict:
    tier = (event.anomaly_tier or "").upper()
    severity_label = "Critical" if tier == "CRITICAL" else "Abnormal"
    distance_label = None
    if distance_m is not None and distance_m >= 0:
        distance_label = f"{distance_m / 1000:.1f} km Away"
    title = f"{severity_label} Thermal Event"
    if distance_label:
        title = f"{title} • {distance_label}"

    details: list[str] = []
    clean_location = location_name.strip() if location_name and location_name.strip() else None
    peak_frp = float(event.peak_frp_mw) if event.peak_frp_mw is not None else None
    if clean_location:
        details.append(clean_location)
    if peak_frp is not None and peak_frp > 0:
        details.append(f"{peak_frp:g} MW FRP")
    if not clean_location and peak_frp is not None and peak_frp > 0:
        details.append("Near your alert location")

    summary = " • ".join(details) if details else "Detected near your alert location."
    action = "investigate" if tier == "CRITICAL" else "review"
    return {
        "title": title,
        "body": f"{summary}\nOpen ThermoTrace AI to {action}.",
        "eventId": event.event_id,
        "url": f"/monitor?eventId={event.event_id}",
        "notificationId": str(notification.id),
    }


def _send_web_push(session: Session, user: User, notification: Notification,
                   event: ThermalEvent, distance_m: float, location_name: Optional[str]) -> None:
    if not (os.getenv("VAPID_PRIVATE_KEY") and os.getenv("VAPID_PUBLIC_KEY")):
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        return
    payload = json.dumps(_build_web_push_payload(notification, event, distance_m, location_name))
    claims = {"sub": os.getenv("VAPID_SUBJECT", "mailto:admin@thermotrace.gov.in")}
    key_val = os.environ["VAPID_PRIVATE_KEY"]
    if os.path.isfile(key_val):
        resolved_key = key_val
    elif os.path.isfile(os.path.join(os.path.dirname(__file__), "..", "..", key_val)):
        resolved_key = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", key_val))
    else:
        resolved_key = key_val

    for subscription in session.query(PushSubscription).filter_by(user_id=user.id, is_active=True).all():
        try:
            webpush(
                subscription_info={"endpoint": subscription.endpoint,
                                   "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                data=payload,
                vapid_private_key=resolved_key,
                vapid_claims=claims,
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                subscription.is_active = False


def create_nearby_notifications(session: Session, event: ThermalEvent, redis_client=None) -> list[Notification]:
    tier = (event.anomaly_tier or "").upper()
    radius_m = RADIUS_METERS.get(tier)
    if not radius_m:
        return []
    matches = session.execute(text("""
        SELECT u.id, ST_Distance(u.alert_location::geography, e.centroid::geography) AS distance_m
        FROM users u
        JOIN thermal_events e ON e.id = :event_id
        WHERE u.nearby_alerts_enabled IS TRUE
          AND u.alert_location IS NOT NULL
          AND ST_DWithin(u.alert_location::geography, e.centroid::geography, :radius_m)
    """), {"event_id": event.id, "radius_m": radius_m + BOUNDARY_TOLERANCE_METERS}).all()
    created: list[Notification] = []
    geo = resolve_indian_location(float(event.latitude), float(event.longitude), None, session=session)
    location_name = (geo.get("district") or geo.get("location_formatted")) if geo else None
    for user_id, distance_m in matches:
        user = session.get(User, user_id)
        if user is None or not _preference_allows(user, tier):
            continue
        notification_type = f"NEARBY_{tier}"
        exists = session.query(Notification.id).filter_by(
            user_id=user.id, event_id=event.id, notification_type=notification_type
        ).first()
        if exists:
            continue
        distance_km = float(distance_m) / 1000
        title = "Critical Thermal Event Nearby" if tier == "CRITICAL" else "Abnormal Thermal Activity Nearby"
        notification = Notification(
            user_id=user.id, event_id=event.id, notification_type=notification_type,
            title=title,
            message=f"{tier.title()} thermal activity detected {distance_km:.1f} km from your alert location.",
            severity=tier, is_read=False,
        )
        session.add(notification)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            continue
        payload = {"type": "NOTIFICATION_CREATED", "user_id": str(user.id),
                   "event_id": event.event_id, "notification_id": str(notification.id),
                   "notification_type": notification_type}
        client = get_redis_client() if redis_client is None else redis_client
        if client:
            client.publish(DEFAULT_CHANNEL, json.dumps(payload))
        _send_web_push(session, user, notification, event, float(distance_m), location_name)
        created.append(notification)
    session.commit()
    return created
