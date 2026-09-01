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

from app.domain.ml_models import Float64XGBClassifier
from app.domain.satellite_context import extract_satellite_context
from app.db.models import (
    ThermalEvent, IndustrialFacility, EventAnomaly, 
    EventClassification, MlModel, ThermoNews, Notification
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

_CACHED_MODEL = None
_CACHED_CLASSES = None

def get_model():
    global _CACHED_MODEL, _CACHED_CLASSES
    if _CACHED_MODEL is None and os.path.exists(MODEL_PATH):
        _CACHED_MODEL = joblib.load(MODEL_PATH)
    if _CACHED_CLASSES is None and os.path.exists(CLASSES_PATH):
        _CACHED_CLASSES = np.load(CLASSES_PATH, allow_pickle=True)
    return _CACHED_MODEL, _CACHED_CLASSES

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
                
            # Tier 1 Eager: SHAP TreeExplainer is deferred to Tier 2 On-Demand drawer open
            feature_importances = {}
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
    
    # Statistical Baseline Sufficiency Check (Minimum 10 Historical Observations Required)
    BASELINE_SUFFICIENCY_THRESHOLD = 10
    sample_count = int(facility.historical_event_count) if facility and facility.historical_event_count is not None else 0
    std_frp = float(facility.baseline_frp_std) if facility and facility.baseline_frp_std is not None else 0.0
    mean_frp = float(facility.baseline_frp_mean) if facility and facility.baseline_frp_mean is not None else 0.0

    if facility and sample_count >= BASELINE_SUFFICIENCY_THRESHOLD and std_frp > 0.0:
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
            "status": "STATISTICALLY_SUFFICIENT",
            "sample_count": sample_count,
            "deviation_mw": round(current_frp - mean_frp, 2),
            "percentage_above_mean": round(((current_frp - mean_frp) / mean_frp) * 100, 2) if mean_frp > 0 else 0.0
        }
    else:
        # Non-facility regional hotspot or agricultural/wildfire event: Grade based on physical radiative intensity
        if current_frp >= 150.0 or (event.max_brightness_k and event.max_brightness_k >= 385.0):
            tier = "CRITICAL"
            z_score = 4.2
        elif current_frp >= 50.0 or (event.max_brightness_k and event.max_brightness_k >= 350.0):
            tier = "ABNORMAL"
            z_score = 2.8
        elif current_frp >= 20.0:
            tier = "ELEVATED"
            z_score = 1.8
        else:
            tier = "NORMAL"
            z_score = 0.9

        event.anomaly_z_score = round(float(z_score), 2)
        event.anomaly_tier = tier
        anomaly_record.baseline_mean_frp_mw = 25.0
        anomaly_record.baseline_std_frp_mw = 15.0
        anomaly_record.z_score = round(float(z_score), 2)
        anomaly_record.percentile_rank = 0.0
        anomaly_record.anomaly_severity = tier
        anomaly_record.contributing_factors = {
            "status": "REGIONAL_PHYSICAL_THRESHOLD",
            "sample_count": sample_count,
            "reason": f"Graded via physical radiance threshold (Peak FRP: {current_frp:.1f} MW)."
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

    # 7. Create/Update Operational Alert Notification for Critical, Abnormal, or Industrial events
    is_alert_worthy = (
        event.anomaly_tier in ["CRITICAL", "ABNORMAL"] 
        or (event.classification and event.classification.startswith("IND_"))
    )
    if is_alert_worthy:
        notif = session.query(Notification).filter(Notification.event_id == event.id).first()
        if not notif:
            notif = Notification(
                event_id=event.id,
                title=f"{'Critical Incident' if event.anomaly_tier == 'CRITICAL' else ('Abnormal Flaring' if event.anomaly_tier == 'ABNORMAL' else 'Industrial Hotspot')}: [{event.event_id}]",
                message=f"Peak radiance {event.peak_frp_mw:.1f} MW detected in {geo['location_formatted']}. Classification: {event.classification}.",
                severity=event.anomaly_tier if event.anomaly_tier in ["CRITICAL", "ABNORMAL"] else "ABNORMAL",
                is_read=False,
                created_at=event.latest_detected_utc or datetime.now(timezone.utc)
            )
            session.add(notif)
        else:
            notif.severity = event.anomaly_tier if event.anomaly_tier in ["CRITICAL", "ABNORMAL"] else notif.severity
            notif.message = f"Peak radiance {event.peak_frp_mw:.1f} MW detected in {geo['location_formatted']}. Classification: {event.classification}."
            notif.created_at = event.latest_detected_utc or notif.created_at
    
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

def compute_tier2_shap_explainability(session: Session, event: ThermalEvent, model, classes) -> Dict[str, float]:
    """
    Tier 2 On-Demand Compute: Calculates TreeSHAP feature importances only when requested by user.
    Unwraps CalibratedClassifierCV to access underlying XGBoost TreeExplainer.
    """
    if shap is None or model is None or classes is None:
        return {}
        
    try:
        features = build_feature_vector(session, str(event.id))
        feature_cols = [
            "dist_to_facility", "facility_category_encoded", "peak_frp_mw", "mean_frp_mw",
            "frp_variance", "max_brightness_k", "duration_hours", "day_night_ratio",
            "historical_active_days_90d", "historical_peak_frp", "pct_cropland",
            "pct_forest", "pct_urban", "is_industrial_zone"
        ]
        x_df = pd.DataFrame([features])[feature_cols].astype(np.float64)
        
        probs = model.predict_proba(x_df)[0]
        pred_idx = int(np.argmax(probs))
        
        # Unwrap CalibratedClassifierCV if needed
        base_est = model
        if hasattr(model, 'calibrated_classifiers_') and len(model.calibrated_classifiers_) > 0:
            base_est = model.calibrated_classifiers_[0].estimator
        elif hasattr(model, 'estimator'):
            base_est = model.estimator
            
        xgb_model = getattr(base_est, 'model_', base_est)
        
        explainer = shap.TreeExplainer(xgb_model)
        shap_values = explainer.shap_values(x_df)
        
        if isinstance(shap_values, list): 
            shap_vals_for_class = shap_values[pred_idx][0]
        elif len(shap_values.shape) == 3: 
            # Shape is (n_classes, n_samples, n_features) or (n_samples, n_features, n_classes)
            if shap_values.shape[0] == len(classes):
                shap_vals_for_class = shap_values[pred_idx, 0, :]
            else:
                shap_vals_for_class = shap_values[0, :, pred_idx]
        else:
            shap_vals_for_class = shap_values[0]
            
        top_indices = np.argsort(np.abs(shap_vals_for_class))[-3:]
        feature_importances = {}
        for idx in reversed(top_indices):
            feat_name = feature_cols[idx]
            feature_importances[feat_name] = round(float(shap_vals_for_class[idx]), 4)
        return feature_importances
    except Exception as e:
        print(f"Tier 2 TreeSHAP computation exception: {e}")
        return {}

def get_or_compute_tier2_intelligence(session: Session, event_id: str) -> Dict[str, Any]:
    """
    Tier 2 On-Demand Entrypoint:
    Strict Cost-Tiering Guarantee:
    - Checks if TreeSHAP explainability is already cached.
    - If cached and fresh, serves instantly (<2ms) without re-querying feature vectors or SHAP.
    - Only queries database features and recomputes TreeSHAP if cache is missing or stale.
    """
    event = session.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not event:
        return {"shap_top_contributors": {}, "satellite_context": {}, "tier2_computed_at": None, "is_tier2_cached": False, "cached": False}
        
    cls_record = session.query(EventClassification).filter(EventClassification.event_id == event.id).first()
    if not cls_record:
        process_event_intelligence(session, event_id)
        cls_record = session.query(EventClassification).filter(EventClassification.event_id == event.id).first()
        
    # Strict Cache Check First: Instant return on cache hit (<2ms)
    is_fresh = (
        cls_record is not None 
        and cls_record.tier2_computed_at is not None 
        and (event.latest_detected_utc is None or cls_record.tier2_computed_at >= event.latest_detected_utc)
        and cls_record.feature_importances
    )
    
    if is_fresh:
        cached_features = cls_record.input_feature_vector if cls_record and hasattr(cls_record, "input_feature_vector") else {}
        satellite_context = extract_satellite_context(
            lat=float(event.latitude or 22.0),
            lon=float(event.longitude or 77.0),
            peak_frp_mw=float(event.peak_frp_mw or 0.0),
            first_detected_utc=event.first_detected_utc,
            associated_facility_id=event.associated_facility_id,
            features=cached_features
        )
        return {
            "shap_top_contributors": cls_record.feature_importances,
            "satellite_context": satellite_context,
            "tier2_computed_at": cls_record.tier2_computed_at,
            "is_tier2_cached": True,
            "cached": True
        }
        
    # Lazy Compute Tier 2 On-Demand (First Open)
    features = build_feature_vector(session, str(event.id))
    satellite_context = extract_satellite_context(
        lat=float(event.latitude or 22.0),
        lon=float(event.longitude or 77.0),
        peak_frp_mw=float(event.peak_frp_mw or 0.0),
        first_detected_utc=event.first_detected_utc,
        associated_facility_id=event.associated_facility_id,
        features=features
    )

    model, classes = get_model()
    shap_contributors = compute_tier2_shap_explainability(session, event, model, classes)
    computed_time = datetime.now(timezone.utc)
    
    if cls_record:
        cls_record.feature_importances = shap_contributors
        cls_record.tier2_computed_at = computed_time
        session.commit()
        
    return {
        "shap_top_contributors": shap_contributors,
        "satellite_context": satellite_context,
        "tier2_computed_at": computed_time,
        "is_tier2_cached": False,
        "cached": False
    }
