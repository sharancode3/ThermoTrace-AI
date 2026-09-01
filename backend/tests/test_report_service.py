"""Unit tests for ReportService."""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from sqlalchemy.orm import Session

import pytest

from app.db.models import (
    ThermalEvent,
    EventClassification,
    EventAnomaly,
    FacilityBaseline,
    IndustrialFacility,
    MlModel,
)
from app.services.report_service import ReportService


def test_history_context_adds_comparative_statistics_and_patterns():
    current = SimpleNamespace(
        first_detected_utc=datetime(2024, 4, 1, tzinfo=timezone.utc),
        latest_detected_utc=datetime(2024, 4, 1, 1, tzinfo=timezone.utc),
        peak_frp_mw=30.0,
    )
    historical_events = [
        SimpleNamespace(
            event_id="TEST-HISTORY-1", first_detected_utc=datetime(2024, 3, 1, tzinfo=timezone.utc),
            latest_detected_utc=datetime(2024, 3, 1, 1, tzinfo=timezone.utc), peak_frp_mw=10.0,
            mean_frp_mw=8.0, classification="IND_ROUTINE", anomaly_tier="NORMAL",
        ),
        SimpleNamespace(
            event_id="TEST-HISTORY-2", first_detected_utc=datetime(2024, 3, 11, tzinfo=timezone.utc),
            latest_detected_utc=datetime(2024, 3, 11, 1, tzinfo=timezone.utc), peak_frp_mw=20.0,
            mean_frp_mw=15.0, classification="IND_FIRE", anomaly_tier="ABNORMAL",
        ),
    ]

    context = ReportService._build_history_context(current, historical_events)

    assert context["current_vs_history_percentile"] == 100.0
    assert context["current_vs_historical_median_ratio"] == 2.0
    assert context["history_mean_recurrence_days"] == 10.0
    assert context["history_classification_counts"] == {"IND_ROUTINE": 1, "IND_FIRE": 1}
    assert context["history_anomaly_counts"] == {"NORMAL": 1, "ABNORMAL": 1}


def test_evidence_quality_rates_coverage_not_model_accuracy():
    high = ReportService._build_evidence_quality({
        "observation_count": 5,
        "history_event_count_90d": 5,
        "associated_facility_uuid": "facility-1",
        "baseline_is_statistically_sufficient": True,
        "classification_confidence": 0.92,
    })
    limited = ReportService._build_evidence_quality({
        "observation_count": 1,
        "history_event_count_90d": 0,
        "classification_confidence": 0.5,
    })

    assert high["evidence_quality_score"] == 8
    assert high["evidence_quality_level"] == "HIGH"
    assert limited["evidence_quality_score"] == 0
    assert limited["evidence_quality_level"] == "LIMITED"
    assert "Single-observation event" in limited["evidence_quality_reasons"]


@pytest.fixture
def facility(db: Session):
    """Create a test facility."""
    facility = IndustrialFacility(
        facility_code="FAC-001",
        name="Test Refinery",
        sector_category="Petroleum Refining",
        sub_type="Crude Oil Refinery",
        operator_name="Test Operator",
        state="West Bengal",
        district="Kolkata",
        facility_geom="SRID=4326;MULTIPOLYGON(((88.35 22.56, 88.37 22.56, 88.37 22.58, 88.35 22.58, 88.35 22.56)))",
        centroid="SRID=4326;POINT(88.3639 22.5726)",
        latitude=22.5726,
        longitude=88.3639,
        baseline_frp_mean=150.0,
        baseline_frp_std=45.0,
        baseline_frp_median=140.0,
        historical_event_count=15,
    )
    db.add(facility)
    db.commit()
    db.refresh(facility)
    return facility


@pytest.fixture
def ml_model(db: Session):
    """Create a test ML model."""
    model = MlModel(
        model_name="thermo_xgb",
        version="1.0.0",
        model_type="XGBoost",
        feature_schema_hash="abc123def456",
        training_dataset_version="v2024.08",
        macro_f1_score=0.92,
        industrial_precision=0.95,
        artifact_path="/models/thermo_xgb_v1.0.0.pkl",
        is_deployed=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@pytest.fixture
def thermal_event(db: Session, facility: IndustrialFacility):
    """Create a test thermal event."""
    event = ThermalEvent(
        event_id="TEST-EVT-0001",
        centroid="SRID=4326;POINT(88.3639 22.5726)",
        boundary_geom="POLYGON((88.35 22.56, 88.37 22.56, 88.37 22.59, 88.35 22.59, 88.35 22.56))",
        latitude=22.5726,
        longitude=88.3639,
        bounding_area_ha=125.5,
        first_detected_utc=datetime(2024, 8, 30, 10, 30, 0, tzinfo=timezone.utc),
        latest_detected_utc=datetime(2024, 8, 30, 11, 45, 0, tzinfo=timezone.utc),
        observation_count=12,
        peak_frp_mw=450.2,
        mean_frp_mw=320.1,
        aggregate_frp_mw=3841.2,
        max_brightness_k=1200.5,
        associated_facility_id=facility.id,
        distance_to_facility_m=250.5,
        primary_land_use="Industrial",
        classification="IND_FLARE",
        classification_confidence=0.92,
        persistence_tier="PERSISTENT",
        anomaly_tier="CRITICAL",
        anomaly_z_score=3.45,
        lifecycle_status="ACTIVE",
        is_demo=False,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@pytest.fixture
def event_classification(db: Session, thermal_event: ThermalEvent, ml_model: MlModel):
    """Create a test event classification."""
    classification = EventClassification(
        event_id=thermal_event.id,
        model_id=ml_model.id,
        predicted_class="IND_FLARE",
        confidence_pct=92.0,
        class_probabilities={
            "IND_FLARE": 0.92,
            "BIOMASS_BURN": 0.05,
            "OTHER_UNCERTAIN": 0.03,
        },
        feature_importances={
            "frp_deviation_from_baseline": 0.35,
            "brightness_temp_delta": 0.28,
            "facility_proximity": 0.22,
            "persistence_factor": 0.15,
        },
        input_feature_vector={
            "observed_frp": 450.2,
            "baseline_mean_frp": 150.0,
            "brightness_k": 1200.5,
            "distance_to_facility": 250.5,
        },
        is_current=True,
    )
    db.add(classification)
    db.commit()
    db.refresh(classification)
    return classification


@pytest.fixture
def event_anomaly(db: Session, thermal_event: ThermalEvent):
    """Create a test event anomaly."""
    anomaly = EventAnomaly(
        event_id=thermal_event.id,
        observed_frp_mw=450.2,
        baseline_mean_frp_mw=150.0,
        baseline_std_frp_mw=45.0,
        z_score=3.45,
        percentile_rank=98.5,
        anomaly_severity="CRITICAL",
        contributing_factors={
            "observed_exceeds_mean": True,
            "z_score_exceeds_3sig": True,
            "percentile_rank_high": True,
        },
    )
    db.add(anomaly)
    db.commit()
    db.refresh(anomaly)
    return anomaly


@pytest.fixture
def facility_baseline(db: Session, facility: IndustrialFacility):
    """Create a test facility baseline."""
    baseline = FacilityBaseline(
        facility_id=facility.id,
        baseline_window="ROLLING_12M",
        sample_observation_count=1250,
        mean_frp_mw=150.0,
        std_frp_mw=45.0,
        median_frp_mw=140.0,
        q75_frp_mw=180.0,
        q95_frp_mw=250.0,
        max_recorded_frp_mw=320.0,
        is_statistically_sufficient=True,
    )
    db.add(baseline)
    db.commit()
    db.refresh(baseline)
    return baseline


def test_get_report_view_model_complete(
    db: Session,
    thermal_event: ThermalEvent,
    event_classification: EventClassification,
    event_anomaly: EventAnomaly,
    facility_baseline: FacilityBaseline,
):
    """Test report view model with all related records."""
    report_vm = ReportService.get_report_view_model(db, "TEST-EVT-0001")
    
    assert report_vm is not None
    
    # Verify event fields
    assert report_vm["event_id"] == "TEST-EVT-0001"
    assert report_vm["latitude"] == 22.5726
    assert report_vm["longitude"] == 88.3639
    assert report_vm["peak_frp_mw"] == 450.2
    assert report_vm["classification"] == "IND_FLARE"
    assert report_vm["anomaly_tier"] == "CRITICAL"
    
    # Verify classification fields
    assert report_vm["ml_predicted_class"] == "IND_FLARE"
    assert report_vm["ml_confidence_pct"] == 92.0
    assert report_vm["ml_model_name"] == "thermo_xgb"
    
    # Verify anomaly fields
    assert report_vm["anomaly_z_score"] == 3.45
    assert report_vm["anomaly_severity"] == "CRITICAL"
    assert report_vm["anomaly_percentile_rank"] == 98.5
    
    # Verify baseline fields
    assert report_vm["baseline_mean_frp_mw"] == 150.0
    assert report_vm["baseline_std_frp_mw"] == 45.0
    assert report_vm["baseline_q95_frp_mw"] == 250.0
    
    # Verify facility fields
    assert report_vm["facility_name"] == "Test Refinery"
    assert report_vm["facility_sector_category"] == "Petroleum Refining"
    
    # Verify association
    assert report_vm["distance_to_facility_m"] == 250.5


def test_get_report_view_model_event_not_found(db: Session):
    """Test report view model when event doesn't exist."""
    report_vm = ReportService.get_report_view_model(db, "NONEXISTENT-EVT")
    assert report_vm is None


def test_get_report_view_model_missing_classification(
    db: Session,
    thermal_event: ThermalEvent,
):
    """Test report view model with missing classification."""
    report_vm = ReportService.get_report_view_model(db, "TEST-EVT-0001")
    
    assert report_vm is not None
    assert report_vm["event_id"] == "TEST-EVT-0001"
    
    # Classification fields should be None
    assert report_vm.get("ml_predicted_class") is None
    assert report_vm.get("ml_confidence_pct") is None


def test_get_report_view_model_no_facility(db: Session):
    """Test report view model when event has no associated facility."""
    event = ThermalEvent(
        event_id="TEST-EVT-NO-FAC",
        centroid="SRID=4326;POINT(88.3639 22.5726)",
        boundary_geom="POLYGON((88.35 22.56, 88.37 22.56, 88.37 22.59, 88.35 22.59, 88.35 22.56))",
        latitude=22.5726,
        longitude=88.3639,
        bounding_area_ha=100.0,
        first_detected_utc=datetime(2024, 8, 30, 10, 30, 0, tzinfo=timezone.utc),
        latest_detected_utc=datetime(2024, 8, 30, 11, 45, 0, tzinfo=timezone.utc),
        observation_count=5,
        peak_frp_mw=300.0,
        mean_frp_mw=250.0,
        aggregate_frp_mw=1250.0,
        max_brightness_k=1100.0,
        primary_land_use="Forest",
        classification="OTHER_UNCERTAIN",
        classification_confidence=0.45,
        persistence_tier="TRANSIENT",
        anomaly_tier="NORMAL",
        anomaly_z_score=0.5,
    )
    db.add(event)
    db.commit()
    
    report_vm = ReportService.get_report_view_model(db, "TEST-EVT-NO-FAC")
    
    assert report_vm is not None
    assert report_vm["event_id"] == "TEST-EVT-NO-FAC"
    
    # Facility fields should be None
    assert report_vm.get("facility_name") is None
    assert report_vm.get("distance_to_facility_m") is None


def test_get_multiple_report_view_models(
    db: Session,
    thermal_event: ThermalEvent,
    event_classification: EventClassification,
):
    """Test batch query for multiple events."""
    event_ids = ["TEST-EVT-0001", "NONEXISTENT", "TEST-EVT-0002"]
    results = ReportService.get_multiple_report_view_models(db, event_ids)
    
    assert len(results) == 3
    assert results["TEST-EVT-0001"] is not None
    assert results["NONEXISTENT"] is None
    assert results["TEST-EVT-0002"] is None


def test_report_view_model_flat_structure(
    db: Session,
    thermal_event: ThermalEvent,
    event_classification: EventClassification,
    event_anomaly: EventAnomaly,
    facility_baseline: FacilityBaseline,
):
    """Test that report view model is truly flat (no nested objects)."""
    report_vm = ReportService.get_report_view_model(db, "TEST-EVT-0001")
    
    assert report_vm is not None
    
    # All top-level keys should be strings
    for key in report_vm.keys():
        assert isinstance(key, str)
    
    # JSON-ifiable (no circular references)
    import json
    json_str = json.dumps(report_vm, default=str)
    assert json_str is not None


def test_report_view_model_iso8601_dates(
    db: Session,
    thermal_event: ThermalEvent,
):
    """Test that datetime values are ISO-8601 formatted strings."""
    report_vm = ReportService.get_report_view_model(db, "TEST-EVT-0001")
    
    assert report_vm is not None
    
    # Check date fields are ISO-8601 strings
    assert isinstance(report_vm["first_detected_utc"], str)
    assert isinstance(report_vm["latest_detected_utc"], str)
    assert "T" in report_vm["first_detected_utc"]  # ISO-8601 contains T
