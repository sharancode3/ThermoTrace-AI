from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.adapters.llm_client import LLMProvider, create_llm_provider
from app.db.models import IndustrialFacility, ThermalEvent


class EventRepository:
    """Small repository wrapper that keeps query logic in the data layer."""

    def __init__(self, session: Session):
        self.session = session

    def list_events(self, filters: Optional[Dict[str, Any]] = None) -> List[ThermalEvent]:
        filters = filters or {}
        query = self.session.query(ThermalEvent).filter(ThermalEvent.lifecycle_status != "CLOSED")

        state = filters.get("state")
        if state:
            state_value = state.strip()
            if state_value:
                query = query.join(
                    IndustrialFacility,
                    IndustrialFacility.id == ThermalEvent.associated_facility_id,
                    isouter=True,
                ).filter(
                    or_(
                        IndustrialFacility.state.ilike(state_value),
                        ThermalEvent.primary_land_use.ilike(state_value),
                    )
                )

        classification_values = filters.get("classification") or []
        if isinstance(classification_values, str):
            classification_values = [classification_values]
        if classification_values:
            query = query.filter(ThermalEvent.classification.in_(classification_values))

        anomaly_values = filters.get("anomaly_tier") or []
        if isinstance(anomaly_values, str):
            anomaly_values = [anomaly_values]
        if anomaly_values:
            query = query.filter(ThermalEvent.anomaly_tier.in_(anomaly_values))

        return query.order_by(ThermalEvent.latest_detected_utc.desc()).limit(25).all()


def _normalize_state_name(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    cleaned = raw.strip()
    return cleaned or None


def _extract_state(query: str) -> Optional[str]:
    state_names = {
        "gujarat": "Gujarat",
        "maharashtra": "Maharashtra",
        "tamil nadu": "Tamil Nadu",
        "karnataka": "Karnataka",
        "delhi": "Delhi",
        "uttar pradesh": "Uttar Pradesh",
        "punjab": "Punjab",
        "haryana": "Haryana",
        "bihar": "Bihar",
        "west bengal": "West Bengal",
        "odisha": "Odisha",
        "andhra pradesh": "Andhra Pradesh",
        "telangana": "Telangana",
        "rajasthan": "Rajasthan",
        "madhya pradesh": "Madhya Pradesh",
    }

    lowered = query.lower()
    for token, canonical in state_names.items():
        if token in lowered:
            return canonical

    state_match = re.search(r"\b(?:in|near|from|around)\s+([A-Z][A-Za-z\s]+)\b", query)
    if state_match:
        return state_match.group(1).strip()

    return None


def _extract_classifications(query: str) -> List[str]:
    lower = query.lower()
    mapping = {
        "industrial flare": "IND_FLARE",
        "flare": "IND_FLARE",
        "industrial fire": "IND_FIRE",
        "fire": "IND_FIRE",
        "routine": "IND_ROUTINE",
        "routine heat": "IND_ROUTINE",
        "agri burn": "AGRI_BURN",
        "agriculture burn": "AGRI_BURN",
        "wildfire": "WILDFIRE",
        "vegetation fire": "WILDFIRE",
        "uncertain": "OTHER_UNCERTAIN",
    }

    found: List[str] = []
    for phrase, value in mapping.items():
        if phrase in lower:
            found.append(value)

    if lower.startswith("show") and not found:
        for phrase, value in mapping.items():
            if value in lower:
                found.append(value)

    return list(dict.fromkeys(found))


def _extract_anomaly_tiers(query: str) -> List[str]:
    lower = query.lower()
    mapping = {
        "critical": "CRITICAL",
        "abnormal": "ABNORMAL",
        "elevated": "ELEVATED",
        "normal": "NORMAL",
    }
    found = [value for phrase, value in mapping.items() if phrase in lower]
    return list(dict.fromkeys(found))


def extract_intent(query: str) -> Dict[str, Any]:
    """Extract a safe JSON filter from unstructured natural language."""
    normalized = (query or "").strip()
    intent: Dict[str, Any] = {}

    state = _normalize_state_name(_extract_state(normalized))
    if state:
        intent["state"] = state

    classifications = _extract_classifications(normalized)
    if classifications:
        intent["classification"] = classifications

    anomaly_tiers = _extract_anomaly_tiers(normalized)
    if anomaly_tiers:
        intent["anomaly_tier"] = anomaly_tiers

    if not intent:
        intent["classification"] = ["IND_FLARE", "IND_FIRE", "AGRI_BURN", "WILDFIRE"]

    return intent


def _serialize_event(event: ThermalEvent) -> Dict[str, Any]:
    return {
        "event_id": event.event_id,
        "classification": event.classification,
        "anomaly_tier": event.anomaly_tier,
        "peak_frp_mw": float(event.peak_frp_mw or 0.0),
        "mean_frp_mw": float(event.mean_frp_mw or 0.0),
        "observation_count": int(event.observation_count or 0),
        "latitude": float(event.latitude),
        "longitude": float(event.longitude),
        "first_detected_utc": event.first_detected_utc.isoformat() if event.first_detected_utc else None,
        "latest_detected_utc": event.latest_detected_utc.isoformat() if event.latest_detected_utc else None,
        "facility_name": getattr(event, "associated_facility_name", None),
    }


def _build_verified_data(events: Sequence[ThermalEvent]) -> str:
    entries = []
    for event in events:
        facility_name = "Unknown facility"
        facility = event.associated_facility if hasattr(event, "associated_facility") else None
        if facility is not None:
            facility_name = facility.name

        entries.append(
            (
                f"[Event ID: {event.event_id} | Class: {event.classification} | "
                f"Anomaly: {event.anomaly_tier} | Peak FRP: {float(event.peak_frp_mw or 0.0):.2f} MW | "
                f"Facility: {facility_name} | Lat: {float(event.latitude):.5f} | Lon: {float(event.longitude):.5f}]"
            )
        )
    return "\n".join(entries)


def _scrub_event_mentions(answer: str, allowed_event_ids: Iterable[str]) -> str:
    allowed = set(allowed_event_ids)
    matches = set(re.findall(r"\bEVT[-A-Z0-9_]+\b", answer, flags=re.IGNORECASE))
    if not matches:
        return answer

    for match in sorted(matches, key=len, reverse=True):
        canonical = match.upper()
        if canonical not in allowed:
            answer = re.sub(rf"\b{re.escape(match)}\b", "[redacted]", answer, flags=re.IGNORECASE)
    return answer


class ChatService:
    def __init__(
        self,
        session: Session,
        provider: Optional[LLMProvider] = None,
        repository: Optional[EventRepository] = None,
    ) -> None:
        self.session = session
        self.repository = repository or EventRepository(session)
        self.provider = provider or create_llm_provider()

    def ask(self, query: str, session_id: Optional[str] = None, selected_event_id: Optional[str] = None) -> Dict[str, Any]:
        filters = extract_intent(query)
        events = self.repository.list_events(filters)

        active_event_context = ""
        active_event = None
        if selected_event_id:
            active_event = self.session.query(ThermalEvent).filter(
                ThermalEvent.event_id == str(selected_event_id)
            ).first()
            if not active_event:
                try:
                    import uuid as _uuid
                    val_uuid = _uuid.UUID(str(selected_event_id))
                    active_event = self.session.query(ThermalEvent).filter(ThermalEvent.id == val_uuid).first()
                except (ValueError, TypeError, AttributeError):
                    pass
            if active_event:
                if active_event not in events:
                    events.insert(0, active_event)
                fac_name = "Regional Industrial Belt"
                fac_state = "India"
                if getattr(active_event, "associated_facility_id", None):
                    fac = self.session.query(IndustrialFacility).filter(IndustrialFacility.id == active_event.associated_facility_id).first()
                    if fac:
                        fac_name = fac.name
                        fac_state = fac.state or "India"
                active_event_context = (
                    f"\n<ACTIVE_SELECTED_EVENT>\n"
                    f"[Targeted Event ID: {active_event.event_id} | Classification: {active_event.classification} | "
                    f"Anomaly Severity: {active_event.anomaly_tier} | Peak FRP: {float(active_event.peak_frp_mw or 0.0):.2f} MW | "
                    f"Mean FRP: {float(active_event.mean_frp_mw or 0.0):.2f} MW | Passes: {active_event.observation_count or 1} | "
                    f"Facility: {fac_name} ({fac_state}) | Coordinates: {float(active_event.latitude):.4f}°N, {float(active_event.longitude):.4f}°E]\n"
                    f"</ACTIVE_SELECTED_EVENT>\n"
                )

        if not events:
            return {
                "answer": "No events matching your criteria were found in the current timeframe.",
                "events": [],
                "map_targets": [],
            }

        provider_input = {
            "state": filters.get("state"),
            "classification": filters.get("classification", []),
            "anomaly_tier": filters.get("anomaly_tier", []),
        }

        verified_data = _build_verified_data(events)
        system_prompt = (
            "You are Thermo Intelligence (NTRO Sovereign Thermal Assistant). "
            "Use ONLY the verified data below to answer. "
            "Do not guess, do not invent event IDs, and do not write SQL. "
            "Answer as a concise tactical summary grounded strictly in the DATA block. "
            "If an active targeted event is provided, prioritize it in your answer. "
            "If a question is about an event, cite only event IDs shown in the DATA block.\n\n"
            f"{active_event_context}"
            "<VERIFIED_DATA>\n"
            f"{verified_data}\n"
            "</VERIFIED_DATA>"
        )
        user_prompt = (
            f"User query: {query}\n\n"
            f"Structured intent: {json.dumps(provider_input, separators=(',', ':'))}"
        )

        try:
            llm_answer = self.provider.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1,
                max_tokens=512,
            )
        except Exception:
            if active_event:
                llm_answer = (
                    f"**Tactical Event Intelligence for {active_event.event_id}:**\n"
                    f"- **Classification:** `{active_event.classification}` ({active_event.anomaly_tier} severity)\n"
                    f"- **Thermal Intensity:** Peak FRP of **{float(active_event.peak_frp_mw or 0.0):.1f} MW** (Mean: {float(active_event.mean_frp_mw or 0.0):.1f} MW) across {active_event.observation_count or 1} satellite pass(es).\n"
                    f"- **Facility / Location:** {fac_name} at coordinates `{float(active_event.latitude):.4f}°N, {float(active_event.longitude):.4f}°E`.\n"
                    f"- **Operational Context:** Verified sovereign thermal detection active under PostGIS geofencing."
                )
            else:
                llm_answer = "Analysis unavailable. Showing raw records from PostGIS."

        allowed_event_ids = [event.event_id for event in events]
        answer = _scrub_event_mentions(llm_answer, allowed_event_ids)

        return {
            "answer": answer,
            "events": [_serialize_event(event) for event in events],
            "map_targets": [
                {"event_id": event.event_id, "lat": float(event.latitude), "lon": float(event.longitude)}
                for event in events
            ],
        }


__all__ = ["ChatService", "EventRepository", "extract_intent"]
