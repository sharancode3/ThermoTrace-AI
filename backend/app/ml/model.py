import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from typing import Dict, Any
from sqlalchemy.orm import Session
from app.db.models import ThermalEvent, EventClassification, MlModel
import uuid

def classify_event(session: Session, event_id: str, features: Dict[str, Any]) -> None:
    """
    CHECKPOINT E: XGBoost Inference (Mocked for prototype)
    Takes the feature vector, runs 'inference', and saves to event_classifications.
    """
    # Simple rule-based mock for the prototype ML Model
    predicted_class = "OTHER_UNCERTAIN"
    conf = 0.5
    
    if features.get("is_industrial_zone", 0) == 1 or features.get("dist_to_facility", -1) != -1.0:
        if features.get("duration_hours", 0) > 24:
            predicted_class = "IND_FLARE"
            conf = 0.95
        else:
            predicted_class = "IND_FIRE"
            conf = 0.85
    elif features.get("bounding_area_ha", 0) > 50.0:
        predicted_class = "WILDFIRE"
        conf = 0.88
    else:
        predicted_class = "AGRI_BURN"
        conf = 0.75

    probs = {
        "IND_FIRE": 0.0, "IND_FLARE": 0.0, "IND_ROUTINE": 0.0,
        "AGRI_BURN": 0.0, "WILDFIRE": 0.0, "OTHER_UNCERTAIN": 0.0
    }
    probs[predicted_class] = conf

    # Ensure model exists in DB
    model = session.query(MlModel).filter(MlModel.version == "thermo_xgb_v1.0.0").first()
    if not model:
        model = MlModel(
            model_name="Thermo XGBoost V1",
            version="thermo_xgb_v1.0.0",
            model_type="XGBoost",
            feature_schema_hash="mock_hash",
            training_dataset_version="v1_mock",
            macro_f1_score=0.92,
            industrial_precision=0.95,
            artifact_path="backend/data/models/thermo_xgb_v1.0.0.joblib",
            is_deployed=True
        )
        session.add(model)
        session.flush()

    event = session.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not event:
        return

    # Update event classification fields
    event.classification = predicted_class
    event.classification_confidence = conf

    # Insert classification history
    cls_hist = EventClassification(
        event_id=event.id,
        model_id=model.id,
        predicted_class=predicted_class,
        confidence_pct=conf * 100.0,
        class_probabilities=probs,
        feature_importances={"mock_feature": 1.0},
        input_feature_vector=features,
        is_current=True
    )
    session.add(cls_hist)
    session.commit()

if __name__ == "__main__":
    from app.db.database import SessionLocal
    from app.domain.features import build_feature_vector
    session = SessionLocal()
    evt = session.query(ThermalEvent).first()
    if evt:
        vec = build_feature_vector(session, evt.event_id)
        classify_event(session, evt.event_id, vec)
        print(f"CHECKPOINT E: Classified {evt.event_id} as {evt.classification}")
    session.close()
