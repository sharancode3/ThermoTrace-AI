import json
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import Notification, ThermalEvent

try:
    from redis import Redis
except ImportError:  # pragma: no cover
    Redis = None


DEFAULT_CHANNEL = "thermo:events"


def get_redis_client():
    if Redis is None:
        return None

    redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_HOST") or "redis://localhost:6379/0"
    return Redis.from_url(redis_url, decode_responses=True)


def create_critical_event_notification(
    session: Session,
    event: ThermalEvent,
    previous_anomaly_tier: Optional[str] = None,
    redis_client=None,
) -> Optional[Notification]:
    """
    Create a critical notification for IND_FLARE events only when the event transitions
    into CRITICAL from a non-CRITICAL state.
    """
    if event is None:
        return None

    current_tier = getattr(event, "anomaly_tier", None)
    current_classification = getattr(event, "classification", None)
    if current_tier != "CRITICAL" or current_classification != "IND_FLARE":
        return None

    prior_tier = previous_anomaly_tier
    if prior_tier is None:
        prior_tier = getattr(event, "_previous_anomaly_tier", None)

    if prior_tier == "CRITICAL":
        return None

    existing = (
        session.query(Notification)
        .filter(
            Notification.event_id == event.id,
            Notification.notification_type == "IND_FLARE_CRITICAL",
        )
        .first()
    )
    if existing is not None:
        return None

    notification = Notification(
        event_id=event.id,
        notification_type="IND_FLARE_CRITICAL",
        severity="CRITICAL",
        message=(
            f"Critical industrial flaring detected for event {event.event_id}. "
            f"Immediate verification is recommended."
        ),
        is_read=False,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)

    payload = {
        "type": "NOTIFICATION_CREATED",
        "event_id": event.event_id,
        "notification_id": str(notification.id),
        "notification_type": notification.notification_type,
        "severity": notification.severity,
        "message": notification.message,
    }

    client = redis_client or get_redis_client()
    if client is not None:
        client.publish(DEFAULT_CHANNEL, json.dumps(payload))

    return notification
