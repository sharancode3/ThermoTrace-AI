import json
import os

from fastapi import APIRouter
from starlette.responses import StreamingResponse
from redis import Redis

router = APIRouter()

SUPPORTED_EVENT_TYPES = {
    "NEWS_PUBLISHED",
    "NOTIFICATION_CREATED",
    "EVENT_SEVERITY_CHANGED",
}


def _build_minimal_payload(raw_event: dict) -> dict:
    payload = {
        "type": raw_event.get("type"),
    }

    for key in ("event_id", "news_id", "notification_id", "id"):
        if key in raw_event and raw_event[key] is not None:
            payload[key] = raw_event[key]

    if "from_tier" in raw_event or "to_tier" in raw_event:
        payload["from_tier"] = raw_event.get("from_tier")
        payload["to_tier"] = raw_event.get("to_tier")

    return payload


@router.get("/stream/news", tags=["Stream"])
async def stream_news():
    """Subscribe to the thermo:events channel and emit minimal SSE events."""
    redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_HOST") or "redis://localhost:6379/0"

    def event_generator():
        client = Redis.from_url(redis_url, decode_responses=True)
        pubsub = client.pubsub()

        try:
            pubsub.subscribe("thermo:events")
            for message in pubsub.listen():
                if message.get("type") != "message":
                    continue

                raw_data = message.get("data")
                if raw_data is None:
                    continue

                try:
                    payload = json.loads(raw_data)
                except (TypeError, ValueError):
                    payload = {"raw": raw_data}

                event_type = payload.get("type")
                if event_type not in SUPPORTED_EVENT_TYPES:
                    continue

                minimal_payload = _build_minimal_payload(payload)
                yield f"event: {event_type}\ndata: {json.dumps(minimal_payload)}\n\n"
        except Exception as exc:  # pragma: no cover - runtime fallback for missing Redis
            yield f"event: ERROR\ndata: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            try:
                pubsub.close()
            except Exception:
                pass
            try:
                client.close()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
