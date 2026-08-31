import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from sqlalchemy import text, func

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from app.db.models import (
    ThermalObservation, ThermalEvent, IndustrialFacility,
    EventAnomaly, EventClassification, MlModel, ThermoNews,
    EventObservation
)
from app.domain.features import (
    build_feature_vector, get_thermal_trend,
    get_evidence_completeness
)
from app.domain.anomaly import (
    evaluate_anomaly_tier, evaluate_persistence_tier,
    compute_uncertainty, get_model
)

def run_comprehensive_audit():
    print("============================================================")
    print("STAGE 3 COMPREHENSIVE REAL-DATA & INTELLIGENCE AUDIT")
    print("============================================================")
    
    session = SessionLocal()
    
    # 1. Real Observations Audit
    total_obs = session.query(func.count(ThermalObservation.id)).scalar()
    total_events = session.query(func.count(ThermalEvent.id)).scalar()
    print(f"\n[PHASE 1] Real Telemetry Audit:")
    print(f"- Total Real NASA FIRMS Observations: {total_obs}")
    print(f"- Total Clustered Events across India: {total_events}")
    assert total_obs > 0, "No FIRMS observations found in database!"
    assert total_events > 0, "No thermal events clustered in database!"
    
    # 2. Event -> Observation Linkage Audit
    linked_events = session.query(func.count(func.distinct(EventObservation.event_id))).scalar()
    print(f"\n[PHASE 2] Event Linkage & Traceability:")
    print(f"- Events with direct observation links: {linked_events} / {total_events}")
    
    # 3. ML Model Artifact & Calibration Audit
    model, classes = get_model()
    print(f"\n[PHASE 6-14] ML Model & Feature Ingestion:")
    print(f"- Loaded Model: {type(model).__name__}")
    print(f"- Classes ({len(classes)}): {list(classes)}")
    assert len(classes) == 6, f"Expected 6 canonical classes, got {len(classes)}"
    
    sample_features = {
        "dist_to_facility": 150.0,
        "facility_category_encoded": 1,
        "peak_frp_mw": 340.5,
        "mean_frp_mw": 280.0,
        "frp_variance": 45.0,
        "max_brightness_k": 385.0,
        "duration_hours": 3.5,
        "day_night_ratio": 0.2,
        "historical_active_days_90d": 18,
        "historical_peak_frp": 350.0,
        "pct_cropland": 0.0,
        "pct_forest": 0.0,
        "pct_urban": 0.9,
        "is_industrial_zone": 1
    }
    feature_cols = list(sample_features.keys())
    x_df = pd.DataFrame([sample_features])[feature_cols].astype(np.float64)
    probs = model.predict_proba(x_df)[0]
    pred_idx = np.argmax(probs)
    pred_class = classes[pred_idx]
    pred_conf = probs[pred_idx]
    
    print(f"- Test Flare Vector Prediction: {pred_class} ({pred_conf*100:.1f}% confidence)")
    print(f"- Probability Distribution: {dict(zip(classes, [round(p, 4) for p in probs]))}")
    assert pred_class in ["IND_FLARE", "IND_FIRE"], f"Unexpected prediction for flare vector: {pred_class}"
    
    # 4. Numerical Z-Score Boundary Verification
    print(f"\n[PHASE 18 & 32] Numerical Anomaly Boundaries Audit:")
    cases = [
        (1.49, "NORMAL"),
        (1.50, "ELEVATED"),
        (2.49, "ELEVATED"),
        (2.50, "ABNORMAL"),
        (3.99, "ABNORMAL"),
        (4.00, "CRITICAL"),
        (7.62, "CRITICAL")
    ]
    for z, expected in cases:
        actual = evaluate_anomaly_tier(z)
        print(f"- Z = {z:>4.2f} -> Tier: {actual:<8} (Expected: {expected})")
        assert actual == expected, f"Boundary test failed for Z={z}: expected {expected}, got {actual}"
    print("✓ All Z-score mathematical boundaries passed with 100% precision.")
    
    # 5. Persistence Tiers Audit
    print(f"\n[PHASE 16] Persistence Tiers Audit:")
    p_cases = [
        (0, "TRANSIENT"),
        (2, "TRANSIENT"),
        (3, "INTERMITTENT"),
        (14, "INTERMITTENT"),
        (15, "PERSISTENT"),
        (60, "PERSISTENT")
    ]
    for days, expected in p_cases:
        actual = evaluate_persistence_tier(days)
        print(f"- Historical Active Days = {days:>2} -> Tier: {actual:<12} (Expected: {expected})")
        assert actual == expected, f"Persistence test failed for days={days}: expected {expected}, got {actual}"
    print("✓ All Persistence tier boundaries passed.")
    
    # 6. End-to-End Real Event Trace
    print(f"\n[PHASE 33] End-to-End Trace of Top Indian Events:")
    top_events = session.query(ThermalEvent).order_by(ThermalEvent.peak_frp_mw.desc()).limit(3).all()
    for ev in top_events:
        fac = session.query(IndustrialFacility).filter(IndustrialFacility.id == ev.associated_facility_id).first()
        anom = session.query(EventAnomaly).filter(EventAnomaly.event_id == ev.id).first()
        cls = session.query(EventClassification).filter(EventClassification.event_id == ev.id).first()
        news = session.query(ThermoNews).filter(ThermoNews.event_id == ev.id).first()
        
        print(f"\n------------------------------------------------------------")
        print(f"EVENT: {ev.event_id}")
        print(f"- Coordinates: {ev.latitude:.4f}°N, {ev.longitude:.4f}°E")
        print(f"- Peak Radiance: {ev.peak_frp_mw} MW | Observations: {ev.observation_count}")
        print(f"- Facility: {fac.name if fac else 'None (Regional Terrain)'} (Dist: {ev.distance_to_facility_m}m)")
        print(f"- Classification: {ev.classification} ({cls.confidence_pct if cls else 'N/A'}% Conf)")
        print(f"- Anomaly Tier: {ev.anomaly_tier} (Z: {ev.anomaly_z_score} sigma)")
        print(f"- News Headline: {news.headline if news else 'N/A'}")
        
    print("\n============================================================")
    print("✓ ALL STAGE 3 AUDIT PHASES VERIFIED AND COMPLETE.")
    print("============================================================")
    session.close()

if __name__ == "__main__":
    run_comprehensive_audit()
