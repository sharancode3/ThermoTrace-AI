"""Presentation-only profile and section selection for adaptive reports."""

from typing import Any, Dict, List


def determine_report_profile(report_data: Dict[str, Any]) -> str:
    """Select report presentation from the authoritative event classification only."""
    classification = (
        report_data.get("classification")
        or report_data.get("ml_predicted_class")
        or "OTHER_UNCERTAIN"
    ).upper()
    class_to_profile = {
        "IND_FIRE": "INDUSTRIAL",
        "IND_FLARE": "INDUSTRIAL",
        "IND_ROUTINE": "INDUSTRIAL",
        "AGRI_BURN": "AGRICULTURAL",
        "WILDFIRE": "WILDLAND",
        "OTHER_UNCERTAIN": "GENERAL",
    }
    return class_to_profile.get(classification, "GENERAL")


def choose_report_sections(profile: str, report_data: Dict[str, Any]) -> List[str]:
    """Choose sections from the classification-derived profile and available evidence."""
    sections = [
        "executive_summary",
        "current_event_metrics",
        "location_context",
        "classification_evidence",
    ]
    history_count = int(report_data.get("history_event_count_90d") or 0)
    observation_count = int(report_data.get("observation_count") or 0)

    if profile == "INDUSTRIAL":
        sections.append("industrial_context")
        if history_count > 0:
            sections.append("historical_pattern")
    elif profile == "AGRICULTURAL":
        sections.append("agricultural_context")
        if history_count > 0:
            sections.append("recurrence_analysis")
    elif profile == "WILDLAND":
        sections.append("wildland_context")
        if observation_count >= 3:
            sections.append("event_evolution")
    else:
        sections.append("general_context")

    if observation_count >= 2:
        sections.append("earlier_vs_now")
    sections.extend(["source_evidence", "recommended_follow_up"])
    return sections
