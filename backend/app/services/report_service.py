"""Report service for generating ReportViewModel from pipeline-computed data."""
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models import (
    ThermalEvent,
    EventClassification,
    EventAnomaly,
    FacilityBaseline,
    IndustrialFacility,
    MlModel,
)


class ReportService:
    """
    Service for fetching and mapping thermal event data into a flat ReportViewModel.
    
    All values are passed through without computation — the template layer receives
    exact values already computed by the pipeline.
    """

    @staticmethod
    def get_report_view_model(
        session: Session,
        event_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Query thermal_events, event_classifications, event_anomalies, facility_baselines
        for a given event_id and return a flat ReportViewModel dict.
        
        Args:
            session: SQLAlchemy session
            event_id: The event_id (string) to query
            
        Returns:
            Dictionary with keys matching template layer expectations, or None if event not found.
        """
        # Query the thermal event
        event = (
            session.query(ThermalEvent)
            .filter(ThermalEvent.event_id == event_id)
            .first()
        )
        
        if not event:
            return None
        
        # Query event classification (use is_current=True to get latest)
        classification = (
            session.query(EventClassification)
            .filter(
                and_(
                    EventClassification.event_id == event.id,
                    EventClassification.is_current == True,
                )
            )
            .first()
        )
        
        # Query event anomaly
        anomaly = (
            session.query(EventAnomaly)
            .filter(EventAnomaly.event_id == event.id)
            .first()
        )
        
        # Query facility baseline (if facility is associated)
        baseline = None
        facility = None
        
        if event.associated_facility_id:
            facility = (
                session.query(IndustrialFacility)
                .filter(IndustrialFacility.id == event.associated_facility_id)
                .first()
            )
            
            baseline = (
                session.query(FacilityBaseline)
                .filter(FacilityBaseline.facility_id == event.associated_facility_id)
                .order_by(FacilityBaseline.calculated_at.desc())
                .first()
            )
        
        # Query ML model if classification exists
        model = None
        if classification:
            model = (
                session.query(MlModel)
                .filter(MlModel.id == classification.model_id)
                .first()
            )
        
        # Map all data into flat ReportViewModel dictionary
        return ReportService._map_to_report_view_model(
            event=event,
            classification=classification,
            anomaly=anomaly,
            baseline=baseline,
            facility=facility,
            model=model,
        )

    @staticmethod
    def _map_to_report_view_model(
        event: ThermalEvent,
        classification: Optional[EventClassification],
        anomaly: Optional[EventAnomaly],
        baseline: Optional[FacilityBaseline],
        facility: Optional[IndustrialFacility],
        model: Optional[MlModel],
    ) -> Dict[str, Any]:
        """
        Map ORM objects into a flat dictionary structure for template rendering.
        
        No computation occurs here — all values come directly from the pipeline.
        """
        
        # Thermal Event Core Fields
        event_data = {
            # Identity
            "event_id": event.event_id,
            "event_uuid": str(event.id),
            
            # Location
            "latitude": float(event.latitude) if event.latitude else None,
            "longitude": float(event.longitude) if event.longitude else None,
            "bounding_area_ha": event.bounding_area_ha,
            "primary_land_use": event.primary_land_use,
            
            # Temporal
            "first_detected_utc": event.first_detected_utc.isoformat() if event.first_detected_utc else None,
            "latest_detected_utc": event.latest_detected_utc.isoformat() if event.latest_detected_utc else None,
            "observation_count": event.observation_count,
            
            # Thermal Characteristics (from pipeline)
            "peak_frp_mw": event.peak_frp_mw,
            "mean_frp_mw": event.mean_frp_mw,
            "aggregate_frp_mw": event.aggregate_frp_mw,
            "max_brightness_k": event.max_brightness_k,
            
            # Classification (from pipeline)
            "classification": event.classification,
            "classification_confidence": event.classification_confidence,
            
            # Anomaly Tiers (from pipeline)
            "anomaly_tier": event.anomaly_tier,
            "anomaly_z_score": event.anomaly_z_score,
            "persistence_tier": event.persistence_tier,
            
            # Lifecycle
            "lifecycle_status": event.lifecycle_status,
            "is_demo": event.is_demo,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "updated_at": event.updated_at.isoformat() if event.updated_at else None,
        }
        
        # Event Classification Fields
        classification_data = {}
        if classification:
            classification_data = {
                "classification_uuid": str(classification.id),
                "ml_predicted_class": classification.predicted_class,
                "ml_confidence_pct": classification.confidence_pct,
                "ml_class_probabilities": classification.class_probabilities,
                "ml_feature_importances": classification.feature_importances,
                "ml_input_feature_vector": classification.input_feature_vector,
                "ml_classified_at": classification.classified_at.isoformat() if classification.classified_at else None,
            }
        
        # Event Anomaly Fields
        anomaly_data = {}
        if anomaly:
            anomaly_data = {
                "anomaly_uuid": str(anomaly.id),
                "anomaly_observed_frp_mw": anomaly.observed_frp_mw,
                "anomaly_baseline_mean_frp_mw": anomaly.baseline_mean_frp_mw,
                "anomaly_baseline_std_frp_mw": anomaly.baseline_std_frp_mw,
                "anomaly_z_score": anomaly.z_score,
                "anomaly_percentile_rank": anomaly.percentile_rank,
                "anomaly_severity": anomaly.anomaly_severity,
                "anomaly_contributing_factors": anomaly.contributing_factors,
                "anomaly_evaluated_at": anomaly.evaluated_at.isoformat() if anomaly.evaluated_at else None,
            }
        
        # Facility Baseline Fields
        baseline_data = {}
        if baseline:
            baseline_data = {
                "baseline_uuid": str(baseline.id),
                "baseline_window": baseline.baseline_window,
                "baseline_sample_observation_count": baseline.sample_observation_count,
                "baseline_mean_frp_mw": baseline.mean_frp_mw,
                "baseline_std_frp_mw": baseline.std_frp_mw,
                "baseline_median_frp_mw": baseline.median_frp_mw,
                "baseline_q75_frp_mw": baseline.q75_frp_mw,
                "baseline_q95_frp_mw": baseline.q95_frp_mw,
                "baseline_max_recorded_frp_mw": baseline.max_recorded_frp_mw,
                "baseline_is_statistically_sufficient": baseline.is_statistically_sufficient,
                "baseline_calculated_at": baseline.calculated_at.isoformat() if baseline.calculated_at else None,
            }
        
        # Industrial Facility Fields
        facility_data = {}
        if facility:
            facility_data = {
                "facility_uuid": str(facility.id),
                "facility_code": facility.facility_code,
                "facility_name": facility.name,
                "facility_sector_category": facility.sector_category,
                "facility_sub_type": facility.sub_type,
                "facility_operator_name": facility.operator_name,
                "facility_state": facility.state,
                "facility_district": facility.district,
                "facility_latitude": float(facility.latitude) if facility.latitude else None,
                "facility_longitude": float(facility.longitude) if facility.longitude else None,
                "facility_baseline_frp_mean": facility.baseline_frp_mean,
                "facility_baseline_frp_std": facility.baseline_frp_std,
                "facility_baseline_frp_median": facility.baseline_frp_median,
                "facility_historical_event_count": facility.historical_event_count,
                "facility_data_source": facility.data_source,
                "facility_is_active": facility.is_active,
            }
        
        # ML Model Fields
        model_data = {}
        if model:
            model_data = {
                "ml_model_uuid": str(model.id),
                "ml_model_name": model.model_name,
                "ml_model_version": model.version,
                "ml_model_type": model.model_type,
                "ml_feature_schema_hash": model.feature_schema_hash,
                "ml_training_dataset_version": model.training_dataset_version,
                "ml_macro_f1_score": model.macro_f1_score,
                "ml_industrial_precision": model.industrial_precision,
                "ml_is_deployed": model.is_deployed,
            }
        
        # Facility Association Fields
        association_data = {}
        if event.associated_facility_id:
            association_data = {
                "associated_facility_uuid": str(event.associated_facility_id),
                "distance_to_facility_m": event.distance_to_facility_m,
            }
        
        # Merge all data dictionaries
        report_view_model = {
            **event_data,
            **classification_data,
            **anomaly_data,
            **baseline_data,
            **facility_data,
            **model_data,
            **association_data,
        }
        
        return report_view_model

    @staticmethod
    def get_multiple_report_view_models(
        session: Session,
        event_ids: list[str],
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Query multiple events and return a dict of event_id -> ReportViewModel.
        
        Args:
            session: SQLAlchemy session
            event_ids: List of event_id strings to query
            
        Returns:
            Dictionary mapping event_id -> ReportViewModel (or None if not found)
        """
        results = {}
        for event_id in event_ids:
            view_model = ReportService.get_report_view_model(session, event_id)
            results[event_id] = view_model
        return results
