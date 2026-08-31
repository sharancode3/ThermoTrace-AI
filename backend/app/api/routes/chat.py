import asyncio
from typing import Any, Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import IndustrialFacility, ThermalEvent
from app.services.chat_service import ChatService, EventRepository, extract_intent

router = APIRouter()


class ChatQueryRequest(BaseModel):
    session_id: Optional[str] = None
    query: str = Field(..., min_length=1)
    selected_event_id: Optional[str] = None


def _build_provenance(filters: Dict[str, Any]) -> str:
    clauses: List[str] = []
    state = filters.get("state")
    if state:
        clauses.append(f"state='{state}'")

    classifications = filters.get("classification") or []
    if isinstance(classifications, str):
        classifications = [classifications]
    if classifications:
        clauses.append(f"classification IN {tuple(classifications)}")

    anomaly_tiers = filters.get("anomaly_tier") or []
    if isinstance(anomaly_tiers, str):
        anomaly_tiers = [anomaly_tiers]
    if anomaly_tiers:
        clauses.append(f"anomaly_tier IN {tuple(anomaly_tiers)}")

    if not clauses:
        return "PostGIS thermal_events table (default active-event window)"
    return "PostGIS thermal_events table (Filter: " + ", ".join(clauses) + ")"


def _facility_name_for_event(event: ThermalEvent, db: Session) -> str:
    if getattr(event, "associated_facility_id", None) is None:
        return "Unknown facility"
    facility = db.query(IndustrialFacility).filter(IndustrialFacility.id == event.associated_facility_id).first()
    return facility.name if facility else "Unknown facility"


def _serialize_grounded_event(event: ThermalEvent, db: Session) -> Dict[str, Any]:
    return {
        "event_id": event.event_id,
        "facility_name": _facility_name_for_event(event, db),
        "latitude": float(event.latitude),
        "longitude": float(event.longitude),
        "peak_frp_mw": float(event.peak_frp_mw or 0.0),
        "anomaly_tier": event.anomaly_tier,
    }


def _serialize_grounded_events(events: Iterable[ThermalEvent], db: Session) -> List[Dict[str, Any]]:
    return [_serialize_grounded_event(event, db) for event in events]


async def _run_chat_with_timeout(service: ChatService, query: str, session_id: Optional[str], selected_event_id: Optional[str] = None) -> Dict[str, Any]:
    return await asyncio.wait_for(asyncio.to_thread(service.ask, query, session_id, selected_event_id), timeout=10)


@router.post("/chat/query", tags=["Chat"])
async def chat_query(payload: ChatQueryRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    filters = extract_intent(payload.query)
    repository = EventRepository(db)
    events = repository.list_events(filters)

    if not events:
        return {
            "data": {
                "session_id": payload.session_id,
                "answer_markdown": "No events matching your criteria were found in the current timeframe.",
                "grounded_events": [],
                "matched_record_count": 0,
                "provenance": _build_provenance(filters),
            }
        }

    service = ChatService(db, repository=repository)

    try:
        result = await _run_chat_with_timeout(service, payload.query, payload.session_id, payload.selected_event_id)
    except asyncio.TimeoutError:
        return {
            "data": {
                "session_id": payload.session_id,
                "answer_markdown": "Analysis unavailable. Showing raw records.",
                "grounded_events": _serialize_grounded_events(events, db),
                "matched_record_count": len(events),
                "provenance": _build_provenance(filters),
            }
        }

    answer = result.get("answer") or "No answer available."
    event_payload = result.get("events") or []
    grounded_events = []
    for item in event_payload:
        grounded_events.append(
            {
                "event_id": item.get("event_id"),
                "facility_name": item.get("facility_name") or "Unknown facility",
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "peak_frp_mw": item.get("peak_frp_mw"),
                "anomaly_tier": item.get("anomaly_tier"),
            }
        )

    return {
        "data": {
            "session_id": payload.session_id,
            "answer_markdown": answer,
            "grounded_events": grounded_events,
            "matched_record_count": len(grounded_events),
            "provenance": _build_provenance(filters),
        }
    }
