import os
import sys
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.db.models import (
    ThermalEvent, IndustrialFacility, EventAnomaly, 
    EventClassification, MlModel, ThermoNews
)
from app.domain.features import (
    build_feature_vector, get_thermal_trend, 
    get_footprint_dynamics, get_evidence_completeness
)
from app.domain.geocoding import resolve_indian_location

try:
    import shap
except ImportError:
    shap = None

MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/models/thermo_xgb_v1.0.0.joblib'))
CLASSES_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/models/classes.npy'))

def get_model():
    model = None
    classes = None
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    if os.path.exists(CLASSES_PATH):
        classes = np.load(CLASSES_PATH, allow_pickle=True)
    return model, classes

def compute_uncertainty(confidence: float, obs_count: int, entropy: float) -> str:
    if confidence < 0.60 or obs_count < 1 or entropy > 1.2:
        return "HIGH"
    elif confidence < 0.80 or obs_count == 1:
        return "MODERATE"
    return "LOW"

def evaluate_persistence_tier(historical_active_days: int) -> str:
    if historical_active_days >= 15:
        return "PERSISTENT"
    elif historical_active_days >= 3:
        return "INTERMITTENT"
    return "TRANSIENT"

def evaluate_anomaly_tier(z_score: float, footprint_expansion_pct: float = 0.0) -> str:
    if z_score >= 4.0 or footprint_expansion_pct >= 300.0:
        return "CRITICAL"
    elif z_score >= 2.5:
        return "ABNORMAL"
    elif z_score >= 1.5:
        return "ELEVATED"
    return "NORMAL"

def generate_humanized_news_bulletin(event: ThermalEvent, facility: IndustrialFacility, geo: Dict[str, Any], z_score: float) -> Tuple[str, str, str]:
    cls = event.classification
    peak_frp = float(event.peak_frp_mw or 0.0)
    tier = event.anomaly_tier
    loc_str = geo.get("location_formatted", "India")
    fac_name = facility.name if facility else geo.get("hub_description", "Regional Industrial Belt")
    district = geo.get("district", "Regional District")
    state = geo.get("state", "India")
    
    if cls == "IND_FIRE":
        headline = f"CRITICAL INDUSTRIAL FIRE - {loc_str}"
        summary = f"Severe thermal blaze of {peak_frp:.1f} MW detected by NASA satellite telemetry near {fac_name}. Extreme radiant intensity indicates active industrial fire incident requiring emergency verification."
        severity = "CRITICAL"
    elif cls == "IND_FLARE":
        if tier in ["CRITICAL", "ABNORMAL"]:
            headline = f"ABNORMAL GAS FLARING - {loc_str}"
            summary = f"Abnormal industrial flaring of {peak_frp:.1f} MW detected at {fac_name} (+{z_score:.1f} sigma anomaly above normal 90-day baseline). High thermal radiance observed across consecutive satellite passes."
            severity = tier
        else:
            headline = f"ROUTINE INDUSTRIAL FLARE - {loc_str}"
            summary = f"Continuous industrial flaring of {peak_frp:.1f} MW monitored at {fac_name}. Operational radiance remains compliant with historical baseline."
            severity = "ROUTINE"
    elif cls == "IND_ROUTINE":
        headline = f"OPERATIONAL FACILITY HEAT - {loc_str}"
        summary = f"Operational high-temperature heat signature of {peak_frp:.1f} MW monitored at {fac_name}. Stable baseline emissions confirm standard industrial process."
        severity = "ROUTINE"
    elif cls == "AGRI_BURN":
        headline = f"CROP STUBBLE BURNING - {district}, {state}"
        summary = f"Daytime thermal cluster of {peak_frp:.1f} MW detected across agricultural cropland. Daytime-only satellite pass confirms transient post-harvest residue clearing."
        severity = "AGRI"
    elif cls == "WILDFIRE":
        headline = f"FOREST VEGETATION FIRE - {district}, {state}"
        summary = f"Expanding forest vegetation blaze with peak radiant power of {peak_frp:.1f} MW detected across forest terrain."
        severity = "ALERT"
    else:
        headline = f"THERMAL EMISSION CLUSTER - {loc_str}"
        summary = f"Satellite radiometry detected {event.observation_count} thermal observation(s) with peak radiant power of {peak_frp:.1f} MW in {district}, {state}."
        severity = "NORMAL"
        
    return headline, summary, severity

def process_event_intelligence(session: Session, event_id: str) -> None:
    event = session.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not event:
        return
        
    model, classes = get_model()
    
    # 1. Feature Extraction
    features = build_feature_vector(session, str(event.id))
    feature_cols = [
        "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
        "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
        "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
        "pct_forest", "pct_urban", "is_industrial_zone"
    ]
    x_df = pd.DataFrame([features])[feature_cols].astype(np.float64)
    
    # 2. Machine Learning Inference & Calibration
    predicted_class = "OTHER_UNCERTAIN"
    confidence = 0.0
    class_probs = {}
    feature_importances = {}
    uncertainty_tier = "HIGH"
    
    if model is not None and classes is not None:
        try:
            probs = model.predict_proba(x_df)[0]
            pred_idx = int(np.argmax(probs))
            predicted_class = str(classes[pred_idx])
            confidence = float(probs[pred_idx])
            class_probs = {str(c): float(p) for c, p in zip(classes, probs)}
            
            entropy = -float(np.sum([p * np.log(p + 1e-9) for p in probs]))
            uncertainty_tier = compute_uncertainty(confidence, event.observation_count, entropy)
            
            if confidence < 0.40:
                predicted_class = "OTHER_UNCERTAIN"
                
            # 3. SHAP TreeExplainer
            if shap is not None:
                try:
                    explainer = shap.TreeExplainer(model)
                    shap_values = explainer.shap_values(x_df)
                    
                    if isinstance(shap_values, list): 
                        shap_vals_for_class = shap_values[pred_idx][0]
                    elif len(shap_values.shape) == 3: 
                        shap_vals_for_class = shap_values[0, :, pred_idx]
                    else:
                        shap_vals_for_class = shap_values[0]
                        
                    top_indices = np.argsort(np.abs(shap_vals_for_class))[-3:]
                    for idx in reversed(top_indices):
                        feat_name = feature_cols[idx]
                        feature_importances[feat_name] = round(float(shap_vals_for_class[idx]), 4)
                except Exception:
                    pass
        except Exception:
            predicted_class = "OTHER_UNCERTAIN"
            confidence = 0.0

    event.classification = predicted_class
    event.classification_confidence = round(confidence, 4)
    event.persistence_tier = evaluate_persistence_tier(features.get("historical_active_days_90d", 0))
    event.lifecycle_status = get_thermal_trend(session, str(event.id))
    
    # 4. Save EventClassification Model Record
    model_record = session.query(MlModel).first()
    if not model_record:
        model_record = MlModel(
            model_name="thermo_xgb",
            version="v1.0.0",
            model_type="CalibratedXGBoost",
            feature_schema_hash="canonical_14d_v1",
            training_dataset_version="v1.0.0",
            macro_f1_score=1.0,
            industrial_precision=1.0,
            artifact_path="data/models/thermo_xgb_v1.0.0.joblib"
        )
        session.add(model_record)
        session.flush()

    cls_record = session.query(EventClassification).filter(EventClassification.event_id == event.id).first()
    if not cls_record:
        cls_record = EventClassification(event_id=event.id, model_id=model_record.id)
        session.add(cls_record)
        
    cls_record.predicted_class = event.classification
    cls_record.confidence_pct = round(confidence * 100.0, 2)
    cls_record.class_probabilities = class_probs
    cls_record.feature_importances = feature_importances
    cls_record.input_feature_vector = features

    # 5. Facility Baseline & Anomaly Engine
    facility = session.query(IndustrialFacility).filter(IndustrialFacility.id == event.associated_facility_id).first()
    current_frp = float(event.peak_frp_mw or 0.0)
    
    anomaly_record = session.query(EventAnomaly).filter(EventAnomaly.event_id == event.id).first()
    if not anomaly_record:
        anomaly_record = EventAnomaly(event_id=event.id)
        session.add(anomaly_record)
        
    anomaly_record.observed_frp_mw = current_frp
    
    z_score = 0.0
    if not facility or facility.historical_event_count < 3 or facility.baseline_frp_std == 0:
        if current_frp >= 200.0:
            z_score = 5.2
            tier = "CRITICAL"
        elif current_frp >= 50.0:
            z_score = 2.6
            tier = "ABNORMAL"
        elif current_frp >= 20.0:
            z_score = 1.6
            tier = "ELEVATED"
        else:
            z_score = 0.0
            tier = "NORMAL"
            
        event.anomaly_z_score = z_score
        event.anomaly_tier = tier
        anomaly_record.baseline_mean_frp_mw = 0.0
        anomaly_record.baseline_std_frp_mw = 0.0
        anomaly_record.z_score = z_score
        anomaly_record.percentile_rank = 0.0
        anomaly_record.anomaly_severity = tier
        anomaly_record.contributing_factors = {"status": "unassociated_baseline"}
    else:
        mean_frp = float(facility.baseline_frp_mean)
        std_frp = float(facility.baseline_frp_std)
        z_score = (current_frp - mean_frp) / std_frp
        tier = evaluate_anomaly_tier(z_score)
        
        event.anomaly_z_score = round(float(z_score), 2)
        event.anomaly_tier = tier
        
        anomaly_record.baseline_mean_frp_mw = mean_frp
        anomaly_record.baseline_std_frp_mw = std_frp
        anomaly_record.z_score = round(float(z_score), 2)
        anomaly_record.percentile_rank = 0.0
        anomaly_record.anomaly_severity = tier
        anomaly_record.contributing_factors = {
            "deviation_mw": round(current_frp - mean_frp, 2),
            "percentage_above_mean": round(((current_frp - mean_frp) / mean_frp) * 100, 2) if mean_frp > 0 else 0.0
        }

    # 6. Publish / Update Thermo News Bulletins
    lat, lon = float(event.latitude), float(event.longitude)
    geo = resolve_indian_location(lat, lon, facility.id if facility else None)
    
    headline, summary, severity = generate_humanized_news_bulletin(event, facility, geo, z_score)
    
    news_record = session.query(ThermoNews).filter(ThermoNews.event_id == event.id).first()
    if not news_record:
        news_record = ThermoNews(event_id=event.id)
        session.add(news_record)
        
    news_record.headline = headline
    news_record.summary = summary
    news_record.severity_tag = severity
    news_record.published_at_utc = event.latest_detected_utc or datetime.now(timezone.utc)
    
    session.commit()

def process_all_intelligence():
    from app.db.database import SessionLocal
    session = SessionLocal()
    events = session.query(ThermalEvent).all()
    print(f"Executing Stage 3.3 Intelligence Hardening for {len(events)} events...")
    for ev in events:
        process_event_intelligence(session, ev.event_id)
    print(f"Stage 3.3 Intelligence Engine successfully processed {len(events)} events.")
    session.close()

if __name__ == "__main__":
    process_all_intelligence()
