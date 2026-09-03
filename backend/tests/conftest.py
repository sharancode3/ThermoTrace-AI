"""
Pytest configuration and root path resolution for ThermoTrace backend test suite.
"""
import os
import sys
import pytest

# Ensure root paths are in sys.path
os.environ["ENABLE_FIRMS_POLLING"] = "false"
sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.db.database import SessionLocal
from app.db.models import (
    ThermalEvent, IndustrialFacility, EventClassification, 
    EventAnomaly, FacilityBaseline, EventObservation, MlModel
)

def _clean_test_db(session):
    try:
        session.query(EventObservation).filter(
            EventObservation.event_id.in_(
                session.query(ThermalEvent.id).filter(ThermalEvent.event_id.like("TEST-%"))
            )
        ).delete(synchronize_session=False)
        session.query(EventClassification).filter(
            EventClassification.event_id.in_(
                session.query(ThermalEvent.id).filter(ThermalEvent.event_id.like("TEST-%"))
            )
        ).delete(synchronize_session=False)
        session.query(EventAnomaly).filter(
            EventAnomaly.event_id.in_(
                session.query(ThermalEvent.id).filter(ThermalEvent.event_id.like("TEST-%"))
            )
        ).delete(synchronize_session=False)
        session.query(FacilityBaseline).filter(
            FacilityBaseline.facility_id.in_(
                session.query(IndustrialFacility.id).filter(IndustrialFacility.facility_code.like("FAC-00%"))
            )
        ).delete(synchronize_session=False)
        session.query(ThermalEvent).filter(ThermalEvent.event_id.like("TEST-%")).delete(synchronize_session=False)
        session.query(IndustrialFacility).filter(IndustrialFacility.facility_code.like("FAC-00%")).delete(synchronize_session=False)
        session.query(MlModel).filter(MlModel.version == "1.0.0").delete(synchronize_session=False)
        session.commit()
    except Exception:
        session.rollback()

@pytest.fixture
def db():
    session = SessionLocal()
    _clean_test_db(session)
    try:
        yield session
    finally:
        _clean_test_db(session)
        session.close()
