import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy.orm import Session
from app.db.models import ThermalEvent, IndustrialFacility, FacilityBaseline

def calculate_facility_baselines(session: Session) -> None:
    """
    CHECKPOINT F: Calculates facility baselines based on historical events.
    For the prototype, we mock this with simple statistics.
    """
    facilities = session.query(IndustrialFacility).all()
    for f in facilities:
        baseline = session.query(FacilityBaseline).filter(FacilityBaseline.facility_id == f.id).first()
        if not baseline:
            baseline = FacilityBaseline(
                facility_id=f.id,
                baseline_window="ROLLING_12M",
                sample_observation_count=10,
                mean_frp_mw=f.baseline_frp_mean,
                std_frp_mw=f.baseline_frp_std,
                median_frp_mw=f.baseline_frp_median,
                q75_frp_mw=f.baseline_frp_mean + (0.67 * f.baseline_frp_std),
                q95_frp_mw=f.baseline_frp_mean + (1.64 * f.baseline_frp_std),
                max_recorded_frp_mw=f.baseline_frp_mean + (3 * f.baseline_frp_std),
                is_statistically_sufficient=True
            )
            session.add(baseline)
    session.commit()

def determine_event_persistence(session: Session, event_id: str) -> None:
    """
    CHECKPOINT F: Determines the persistence tier for an event.
    """
    event = session.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not event:
        return

    duration_hrs = (event.latest_detected_utc - event.first_detected_utc).total_seconds() / 3600.0
    
    if duration_hrs > 72:
        event.persistence_tier = "PERSISTENT"
    elif duration_hrs > 12:
        event.persistence_tier = "PROLONGED"
    else:
        event.persistence_tier = "TRANSIENT"
        
    session.commit()

if __name__ == "__main__":
    from app.db.database import SessionLocal
    session = SessionLocal()
    calculate_facility_baselines(session)
    evt = session.query(ThermalEvent).first()
    if evt:
        determine_event_persistence(session, evt.event_id)
        print(f"CHECKPOINT F: Persistence tier for {evt.event_id}: {evt.persistence_tier}")
    session.close()
