import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import case, func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Notification, PushSubscription, ThermalEvent, User
from app.services.nearby_notification_service import create_nearby_notifications

router = APIRouter(prefix="/notifications/nearby", tags=["Nearby Notifications"])


class PreferencesUpdate(BaseModel):
    enabled: bool
    notify_critical: bool = True
    notify_abnormal: bool = True


class LocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PushSubscriptionBody(BaseModel):
    endpoint: str
    keys: dict[str, str]


def current_user(x_thermotrace_user_id: str = Header(...), db: Session = Depends(get_db)) -> User:
    try:
        user_id = uuid.UUID(x_thermotrace_user_id)
    except ValueError as exc:
        raise HTTPException(400, "Invalid device user identifier") from exc
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=f"device-{user_id}@local.thermotrace",
                    hashed_password="DEVICE_SCOPED_NO_LOGIN", full_name="ThermoTrace Operator",
                    notification_preferences={"notify_critical": True, "notify_abnormal": True, "push_enabled": False})
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            # Preferences and notification-list requests start together in the
            # browser; another request may have created this device user first.
            db.rollback()
            user = db.get(User, user_id)
            if user is None:
                raise
    return user


import math

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    theta = math.atan2(y, x)
    return (math.degrees(theta) + 360) % 360

def bearing_to_cardinal(bearing: float) -> str:
    cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(bearing / 22.5) % 16
    return cardinals[idx]

def serialize_notification(db: Session, notification: Notification) -> dict:
    event = db.get(ThermalEvent, notification.event_id)
    distance_m = None
    user = db.get(User, notification.user_id)
    bearing_cardinal = None
    bearing_deg = None
    if event and user and user.alert_location is not None:
        distance_m = db.execute(text("""
            SELECT ST_Distance(u.alert_location::geography, e.centroid::geography)
            FROM users u JOIN thermal_events e ON e.id = :event_id
            WHERE u.id = :user_id
        """), {"event_id": event.id, "user_id": user.id}).scalar()
        if user.alert_latitude is not None and user.alert_longitude is not None and event.latitude is not None and event.longitude is not None:
            deg = calculate_bearing(float(user.alert_latitude), float(user.alert_longitude), float(event.latitude), float(event.longitude))
            bearing_deg = round(deg, 1)
            bearing_cardinal = bearing_to_cardinal(deg)
    return {
        "id": str(notification.id), "event_id": event.event_id if event else None,
        "notification_type": notification.notification_type, "title": notification.title,
        "message": notification.message, "severity": notification.severity,
        "classification": event.classification if event else None,
        "peak_frp_mw": float(event.peak_frp_mw) if event and event.peak_frp_mw is not None else None,
        "latitude": float(event.latitude) if event else None, "longitude": float(event.longitude) if event else None,
        "distance_km": round(float(distance_m) / 1000, 1) if distance_m is not None else None,
        "bearing_cardinal": bearing_cardinal,
        "bearing_deg": bearing_deg,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


@router.get("")
def list_nearby(user: User = Depends(current_user), db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    severity = case((Notification.severity == "CRITICAL", 1), else_=2)
    rows = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.notification_type.in_(["NEARBY_CRITICAL", "NEARBY_ABNORMAL"]),
        Notification.created_at >= cutoff,
    ).order_by(severity, Notification.created_at.desc()).all()
    return [serialize_notification(db, row) for row in rows]


@router.get("/preferences")
def get_preferences(user: User = Depends(current_user)):
    prefs = user.notification_preferences or {}
    return {"enabled": user.nearby_alerts_enabled,
            "notify_critical": prefs.get("notify_critical", True),
            "notify_abnormal": prefs.get("notify_abnormal", True),
            "has_alert_location": user.alert_location is not None,
            "location_updated_at": user.alert_location_updated_at,
            "vapid_public_key": __import__("os").getenv("VAPID_PUBLIC_KEY")}


@router.put("/preferences")
def update_preferences(body: PreferencesUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    prefs = dict(user.notification_preferences or {})
    prefs.update({"notify_critical": body.notify_critical, "notify_abnormal": body.notify_abnormal})
    user.notification_preferences = prefs
    user.nearby_alerts_enabled = body.enabled
    db.commit()
    return get_preferences(user)


@router.put("/location")
def update_location(body: LocationUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.alert_latitude, user.alert_longitude = body.latitude, body.longitude
    user.alert_location = f"SRID=4326;POINT({body.longitude} {body.latitude})"
    user.alert_location_updated_at = datetime.now(timezone.utc)
    user.nearby_alerts_enabled = True
    db.commit()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    for event in db.query(ThermalEvent).filter(ThermalEvent.latest_detected_utc >= cutoff,
                                               ThermalEvent.anomaly_tier.in_(["ABNORMAL", "CRITICAL"])).all():
        create_nearby_notifications(db, event)
    return get_preferences(user)


@router.post("/{notification_id}/read")
def mark_read(notification_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.query(Notification).filter_by(id=notification_id, user_id=user.id).first()
    if row is None:
        raise HTTPException(404, "Nearby notification not found")
    row.is_read, row.read_at = True, datetime.now(timezone.utc)
    db.commit()
    return {"id": str(row.id), "is_read": True}


@router.post("/read-all")
def mark_all_read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    count = db.query(Notification).filter(Notification.user_id == user.id,
        Notification.notification_type.like("NEARBY_%"), Notification.created_at >= cutoff,
        Notification.is_read.is_(False)).update({"is_read": True, "read_at": datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return {"updated": count}


@router.post("/push-subscriptions")
def subscribe_push(body: PushSubscriptionBody, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.keys.get("p256dh") or not body.keys.get("auth"):
        raise HTTPException(422, "Push subscription keys are required")
    row = db.query(PushSubscription).filter_by(endpoint=body.endpoint).first() or PushSubscription(endpoint=body.endpoint)
    row.user_id, row.p256dh, row.auth = user.id, body.keys["p256dh"], body.keys["auth"]
    row.user_agent, row.is_active = request.headers.get("user-agent"), True
    db.add(row); db.commit()
    return {"status": "subscribed"}


@router.delete("/push-subscriptions")
def unsubscribe_push(body: PushSubscriptionBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(PushSubscription).filter_by(user_id=user.id, endpoint=body.endpoint).update({"is_active": False})
    db.commit()
    return {"status": "unsubscribed"}
