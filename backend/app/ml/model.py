"""
ML Inference Gateway for ThermoTrace AI
Routes classification requests directly through the calibrated champion model
and persists verified intelligence records in PostgreSQL.
Eliminates early prototype mock fallbacks.
"""
import os
import sys
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from app.domain.anomaly import process_event_intelligence, get_or_compute_tier2_intelligence
from app.db.models import ThermalEvent, EventClassification

def classify_event(session: Session, event_id: str, features: Optional[Dict[str, Any]] = None) -> None:
    """
    Authoritative event classification entrypoint.
    Executes full calibrated XGBoost pipeline with 14-D contextual features and TreeSHAP explainability.
    """
    process_event_intelligence(session, event_id)

def get_event_ml_intelligence(session: Session, event_id: str) -> Dict[str, Any]:
    """
    Retrieves calibrated classification, softmax probabilities, and local TreeSHAP drivers.
    """
    return get_or_compute_tier2_intelligence(session, event_id)

if __name__ == "__main__":
    from app.db.database import SessionLocal
    session = SessionLocal()
    evt = session.query(ThermalEvent).first()
    if evt:
        classify_event(session, evt.event_id)
        intel = get_event_ml_intelligence(session, evt.event_id)
        print(f"Verified Model Pipeline executed for {evt.event_id}:")
        print(f"  Classification: {evt.classification} ({evt.classification_confidence*100:.1f}%)")
        print(f"  TreeSHAP Drivers: {intel.get('shap_top_contributors')}")
    session.close()
