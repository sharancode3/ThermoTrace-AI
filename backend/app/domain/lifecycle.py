"""
Authoritative Lifecycle & Freshness Domain Policy for ThermoTrace AI
Unifies temporal freshness evaluation, status normalization, and operational active-state derivation.
Provides an injectable reference time for deterministic testing.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Standard Temporal Freshness Windows (Seconds)
ACTIVE_THRESHOLD_SECONDS = 24 * 3600       # 24 Hours (< 24h = Active / Fresh detection)
COOLING_THRESHOLD_SECONDS = 72 * 3600      # 72 Hours (24h to 72h = Aging / Cooling)
# Beyond 72 Hours: Aged / Historical / Extinguished (no fresh satellite pass)

LIFECYCLE_ACTIVE = "ACTIVE"
LIFECYCLE_COOLING = "COOLING"
LIFECYCLE_EXTINGUISHED = "EXTINGUISHED"

FRESHNESS_ACTIVE = "FRESH_OBSERVATION"
FRESHNESS_AGING = "AGING_UNCONFIRMED"
FRESHNESS_HISTORICAL = "HISTORICAL_UNCONFIRMED"

def normalize_legacy_status(status_str: Optional[str]) -> str:
    """
    Normalizes mixed-case and legacy lifecycle status strings to canonical uppercase enum.
    Recognizes:
      - 'active', 'ACTIVE', 'open' -> 'ACTIVE'
      - 'cooling', 'COOLING' -> 'COOLING'
      - 'resolved', 'RESOLVED', 'extinguished', 'EXTINGUISHED', 'closed', 'CLOSED' -> 'EXTINGUISHED'
    Unknown or empty strings default safely to 'EXTINGUISHED' if unverified.
    """
    if not status_str:
        return "EXTINGUISHED"
    
    clean = str(status_str).strip().upper()
    if clean in ("ACTIVE", "OPEN", "CURRENT"):
        return "ACTIVE"
    elif clean in ("COOLING", "AGING"):
        return "COOLING"
    elif clean in ("RESOLVED", "EXTINGUISHED", "CLOSED", "HISTORICAL"):
        return "EXTINGUISHED"
    
    return clean

def evaluate_lifecycle(
    latest_detected_utc: Optional[datetime],
    reference_time: Optional[datetime] = None,
    current_persisted_status: Optional[str] = None
) -> Dict[str, Any]:
    """
    Authoritative lifecycle and freshness evaluator.
    
    Args:
        latest_detected_utc: Timestamp of the latest satellite detection.
        reference_time: Evaluation anchor time (defaults to datetime.now(timezone.utc)). Injectable for tests.
        current_persisted_status: Existing stored status for backward-compatible fallback if timestamp is absent.
        
    Returns:
        Dict with:
          - lifecycle_status: Canonical DB enum ('ACTIVE', 'COOLING', 'EXTINGUISHED')
          - freshness_status: Operational code ('FRESH_OBSERVATION', 'AGING_UNCONFIRMED', 'HISTORICAL_UNCONFIRMED')
          - is_active: Boolean flag indicating if detection occurred within the active operational window (<24h)
          - freshness_label: Human-readable label for UI dossiers and tooltips
          - elapsed_hours: Floating point hours since latest detection
    """
    ref_utc = reference_time or datetime.now(timezone.utc)
    if ref_utc.tzinfo is None:
        ref_utc = ref_utc.replace(tzinfo=timezone.utc)

    if latest_detected_utc is None:
        # Fallback to normalized persisted status if no timestamp exists
        norm = normalize_legacy_status(current_persisted_status)
        is_act = (norm == "ACTIVE")
        return {
            "lifecycle_status": norm,
            "freshness_status": "FRESH_OBSERVATION" if is_act else "HISTORICAL_UNCONFIRMED",
            "is_active": is_act,
            "freshness_label": "Active (< 24h)" if is_act else "Historical (> 72h)",
            "elapsed_hours": 0.0 if is_act else 999.0
        }

    dt = latest_detected_utc if latest_detected_utc.tzinfo else latest_detected_utc.replace(tzinfo=timezone.utc)
    elapsed_seconds = (ref_utc - dt).total_seconds()
    
    # Handle clock skew or future timestamps defensively
    if elapsed_seconds < 0:
        elapsed_seconds = 0.0

    elapsed_hours = round(elapsed_seconds / 3600.0, 2)

    if elapsed_seconds < ACTIVE_THRESHOLD_SECONDS:
        return {
            "lifecycle_status": "ACTIVE",
            "freshness_status": "FRESH_OBSERVATION",
            "is_active": True,
            "freshness_label": "Active (< 24h)",
            "elapsed_hours": elapsed_hours
        }
    elif elapsed_seconds < COOLING_THRESHOLD_SECONDS:
        return {
            "lifecycle_status": "COOLING",
            "freshness_status": "AGING_UNCONFIRMED",
            "is_active": False,
            "freshness_label": "Aging / No recent pass (24–72h)",
            "elapsed_hours": elapsed_hours
        }
    else:
        return {
            "lifecycle_status": "EXTINGUISHED",
            "freshness_status": "HISTORICAL_UNCONFIRMED",
            "is_active": False,
            "freshness_label": "Historical / Unconfirmed (> 72h)",
            "elapsed_hours": elapsed_hours
        }
