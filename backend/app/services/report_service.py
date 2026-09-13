"""Report service for generating ReportViewModel from pipeline-computed data."""
import logging
from typing import Optional, Dict, Any
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, cast, func
from geoalchemy2 import Geography

from app.db.models import (
    ThermalEvent,
    ThermalObservation,
    EventObservation,
    EventClassification,
    EventAnomaly,
    FacilityBaseline,
    IndustrialFacility,
    MlModel,
)
from app.services.report_profile import (
    choose_report_sections,
    determine_report_profile,
)

logger = logging.getLogger(__name__)


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
        
        # Build a report-only view model; no pipeline data is modified.
        report_data = ReportService._map_to_report_view_model(
            event=event,
            classification=classification,
            anomaly=anomaly,
            baseline=baseline,
            facility=facility,
            model=model,
        )

        observations = ReportService._get_event_observations(session, event)
        try:
            nearby_result = ReportService._find_nearby_facilities_expanding(
                session=session,
                event=event,
                limit=5,
            )
            report_data["nearby_facilities"] = nearby_result["facilities"]
            report_data["facility_search_radius_km"] = nearby_result["search_radius_km"]
        except Exception:
            logger.warning(
                "Nearby facility intelligence unavailable for event %s",
                event.event_id,
                exc_info=True,
            )
            report_data["nearby_facilities"] = []
            report_data["facility_search_radius_km"] = None
        report_data["nearby_events"] = ReportService._get_nearby_events(
            session=session,
            event=event,
            radius_m=75000,
            limit=5,
        )
        historical_events, history_basis = ReportService._get_historical_events(
            session=session,
            event=event,
            days=90,
            radius_m=2000,
        )
        report_data.update(
            ReportService._build_history_context(event, historical_events)
        )
        report_data.update(history_basis)
        report_data.update(ReportService._build_event_evolution(observations))
        report_data.update(ReportService._build_evidence_quality(report_data))

        # Profile selection affects report presentation only; it never changes ML data.
        report_profile = determine_report_profile(report_data)
        report_data["report_profile"] = report_profile
        report_data["report_sections"] = choose_report_sections(
            report_profile,
            report_data,
        )

        return report_data

    @staticmethod
    def _get_event_observations(
        session: Session,
        event: ThermalEvent,
    ) -> list[ThermalObservation]:
        """Return the selected event'''s linked observations in time order with PostGIS spatial fallback."""
        obs = (
            session.query(ThermalObservation)
            .join(
                EventObservation,
                EventObservation.observation_id == ThermalObservation.id,
            )
            .filter(EventObservation.event_id == event.id)
            .order_by(ThermalObservation.observation_timestamp_utc.asc())
            .all()
        )
        if not obs and event.longitude is not None and event.latitude is not None:
            try:
                event_geog = cast(
                    func.ST_SetSRID(
                        func.ST_MakePoint(float(event.longitude), float(event.latitude)),
                        4326,
                    ),
                    Geography,
                )
                obs_geog = cast(ThermalObservation.geom, Geography)
                obs = (
                    session.query(ThermalObservation)
                    .filter(func.ST_DWithin(obs_geog, event_geog, 35000))
                    .order_by(func.ST_Distance(obs_geog, event_geog).asc())
                    .limit(10)
                    .all()
                )
            except Exception:
                logger.warning("Spatial observation fallback query failed for %s", event.event_id, exc_info=True)
        return obs

    @staticmethod
    def _get_nearby_events(
        session: Session,
        event: ThermalEvent,
        radius_m: int = 75000,
        limit: int = 5,
    ) -> list[Dict[str, Any]]:
        """Return concurrent active thermal events nearest to this event within radius."""
        if event.longitude is None or event.latitude is None:
            return []
        try:
            from sqlalchemy import Float as SaFloat
            event_geog = cast(
                func.ST_SetSRID(
                    func.ST_MakePoint(float(event.longitude), float(event.latitude)),
                    4326,
                ),
                Geography,
            )
            evt_geog = cast(
                func.ST_SetSRID(
                    func.ST_MakePoint(cast(ThermalEvent.longitude, SaFloat), cast(ThermalEvent.latitude, SaFloat)),
                    4326,
                ),
                Geography,
            )
            distance_m = func.ST_Distance(evt_geog, event_geog).label("distance_m")
            rows = (
                session.query(ThermalEvent, distance_m)
                .filter(ThermalEvent.id != event.id)
                .filter(func.ST_DWithin(evt_geog, event_geog, radius_m))
                .order_by(distance_m.asc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "event_id": item.event_id,
                    "classification": item.classification,
                    "anomaly_tier": item.anomaly_tier,
                    "peak_frp_mw": float(item.peak_frp_mw or 0.0),
                    "distance_km": round(float(dist) / 1000.0, 1),
                    "latitude": float(item.latitude),
                    "longitude": float(item.longitude),
                    "latest_detected_utc": item.latest_detected_utc.strftime("%Y-%m-%d %H:%M") if item.latest_detected_utc else "N/A",
                }
                for item, dist in rows
            ]
        except Exception:
            logger.warning("Nearby events query failed for %s", event.event_id, exc_info=True)
            return []

    @staticmethod
    def _get_nearby_facilities(
        session: Session,
        event: ThermalEvent,
        radius_m: int = 100000,
        limit: int = 5,
    ) -> list[Dict[str, Any]]:
        """Return active facilities nearest to the event centroid within a fixed radius."""
        event_geog = cast(
            func.ST_SetSRID(
                func.ST_MakePoint(float(event.longitude), float(event.latitude)),
                4326,
            ),
            Geography,
        )
        facility_geog = cast(IndustrialFacility.centroid, Geography)
        distance_m = func.ST_Distance(facility_geog, event_geog).label("distance_m")
        rows = (
            session.query(IndustrialFacility, distance_m)
            .filter(IndustrialFacility.is_active.is_(True))
            .filter(func.ST_DWithin(facility_geog, event_geog, radius_m))
            .order_by(distance_m.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "facility_id": str(facility.id),
                "name": facility.name,
                "sector": facility.sector_category,
                "sub_type": facility.sub_type,
                "operator": facility.operator_name,
                "state": facility.state,
                "district": facility.district,
                "latitude": float(facility.latitude) if facility.latitude is not None else None,
                "longitude": float(facility.longitude) if facility.longitude is not None else None,
                "distance_m": round(float(distance), 1),
                "historical_event_count": facility.historical_event_count,
                "baseline_frp_mean": facility.baseline_frp_mean,
            }
            for facility, distance in rows
        ]

    @staticmethod
    def _find_nearby_facilities_expanding(
        session: Session,
        event: ThermalEvent,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """Find the nearest useful facility context without defaulting to a huge radius."""
        for radius_m in (25000, 50000, 100000, 200000):
            facilities = ReportService._get_nearby_facilities(
                session=session,
                event=event,
                radius_m=radius_m,
                limit=limit,
            )
            if facilities:
                return {
                    "facilities": facilities,
                    "search_radius_km": radius_m / 1000,
                }
        return {"facilities": [], "search_radius_km": 200}

    @staticmethod
    def _get_historical_events(
        session: Session,
        event: ThermalEvent,
        days: int = 90,
        radius_m: int = 2000,
    ) -> tuple[list[ThermalEvent], Dict[str, Any]]:
        """Find comparable prior events and describe the applied comparison basis."""
        since = event.first_detected_utc - timedelta(days=days)
        query = session.query(ThermalEvent).filter(
            ThermalEvent.id != event.id,
            ThermalEvent.first_detected_utc >= since,
            ThermalEvent.first_detected_utc < event.first_detected_utc,
        )

        if event.associated_facility_id:
            query = query.filter(
                ThermalEvent.associated_facility_id == event.associated_facility_id
            )
            comparison_basis = {
                "history_scope": "SAME_FACILITY",
                "history_window_days": days,
                "history_radius_m": None,
            }
        else:
            query = query.filter(
                func.ST_DWithin(
                    cast(ThermalEvent.centroid, Geography),
                    cast(
                        func.ST_SetSRID(
                            func.ST_MakePoint(
                                float(event.longitude),
                                float(event.latitude),
                            ),
                            4326,
                        ),
                        Geography,
                    ),
                    radius_m,
                )
            )
            comparison_basis = {
                "history_scope": "NEARBY_LOCATION",
                "history_window_days": days,
                "history_radius_m": radius_m,
            }

        return (
            query.order_by(ThermalEvent.first_detected_utc.asc()).all(),
            comparison_basis,
        )

    @staticmethod
    def _build_history_context(
        event: ThermalEvent,
        historical_events: list[ThermalEvent],
    ) -> Dict[str, Any]:
        """Summarize previous local or same-facility events for the report."""
        now = event.first_detected_utc
        events_7d = [
            item
            for item in historical_events
            if item.first_detected_utc >= now - timedelta(days=7)
        ]
        events_30d = [
            item
            for item in historical_events
            if item.first_detected_utc >= now - timedelta(days=30)
        ]
        peak_frps = [
            float(item.peak_frp_mw)
            for item in historical_events
            if item.peak_frp_mw is not None
        ]
        classification_counts: Dict[str, int] = {}
        anomaly_counts: Dict[str, int] = {}
        for item in historical_events:
            classification = item.classification or "UNKNOWN"
            anomaly_tier = item.anomaly_tier or "NORMAL"
            classification_counts[classification] = (
                classification_counts.get(classification, 0) + 1
            )
            anomaly_counts[anomaly_tier] = anomaly_counts.get(anomaly_tier, 0) + 1
        durations = [
            (item.latest_detected_utc - item.first_detected_utc).total_seconds()
            / 3600.0
            for item in historical_events
            if item.first_detected_utc and item.latest_detected_utc
        ]
        previous_event = historical_events[-1] if historical_events else None
        days_since_previous_event = None
        if previous_event:
            days_since_previous_event = round(
                (event.first_detected_utc - previous_event.latest_detected_utc)
                .total_seconds()
                / 86400.0,
                2,
            )

        ordered_peak_frps = sorted(peak_frps)
        peak_count = len(ordered_peak_frps)
        if peak_count % 2:
            median_peak_frp = ordered_peak_frps[peak_count // 2]
        elif peak_count:
            median_peak_frp = (
                ordered_peak_frps[peak_count // 2 - 1]
                + ordered_peak_frps[peak_count // 2]
            ) / 2
        else:
            median_peak_frp = None

        current_peak = (
            float(event.peak_frp_mw) if event.peak_frp_mw is not None else None
        )
        current_vs_history_percentile = None
        if current_peak is not None and peak_frps:
            current_vs_history_percentile = round(
                (sum(value <= current_peak for value in peak_frps) / len(peak_frps)) * 100,
                1,
            )
        current_vs_median_ratio = None
        if current_peak is not None and median_peak_frp not in (None, 0):
            current_vs_median_ratio = round(current_peak / median_peak_frp, 2)

        recurrence_intervals = []
        for previous, current in zip(historical_events, historical_events[1:]):
            delta_days = (
                current.first_detected_utc - previous.first_detected_utc
            ).total_seconds() / 86400.0
            if delta_days >= 0:
                recurrence_intervals.append(delta_days)
        mean_recurrence_days = (
            round(sum(recurrence_intervals) / len(recurrence_intervals), 2)
            if recurrence_intervals else None
        )

        return {
            "history_event_count_7d": len(events_7d),
            "history_event_count_30d": len(events_30d),
            "history_event_count_90d": len(historical_events),
            "history_mean_peak_frp_mw": (
                round(sum(peak_frps) / peak_count, 2) if peak_count else None
            ),
            "history_median_peak_frp_mw": (
                round(median_peak_frp, 2) if median_peak_frp is not None else None
            ),
            "history_max_peak_frp_mw": (
                round(max(peak_frps), 2) if peak_count else None
            ),
            "history_mean_duration_hours": (
                round(sum(durations) / len(durations), 2) if durations else None
            ),
            "current_vs_history_percentile": current_vs_history_percentile,
            "current_vs_historical_median_ratio": current_vs_median_ratio,
            "history_mean_recurrence_days": mean_recurrence_days,
            "history_classification_counts": classification_counts,
            "history_anomaly_counts": anomaly_counts,
            "days_since_previous_event": days_since_previous_event,
            "historical_events": [
                {
                    "event_id": item.event_id,
                    "first_detected_utc": (
                        item.first_detected_utc.isoformat()
                        if item.first_detected_utc
                        else None
                    ),
                    "latest_detected_utc": (
                        item.latest_detected_utc.isoformat()
                        if item.latest_detected_utc
                        else None
                    ),
                    "peak_frp_mw": item.peak_frp_mw,
                    "mean_frp_mw": item.mean_frp_mw,
                    "classification": item.classification,
                    "anomaly_tier": item.anomaly_tier,
                }
                for item in historical_events
            ],
        }

    @staticmethod
    def _build_evidence_quality(report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Rate available evidence coverage; this is not a model-accuracy score."""
        score = 0
        reasons = []
        observation_count = int(report_data.get("observation_count") or 0)
        history_count = int(report_data.get("history_event_count_90d") or 0)
        has_facility = bool(
            report_data.get("associated_facility_uuid")
            or report_data.get("facility_uuid")
        )
        baseline_ok = bool(report_data.get("baseline_is_statistically_sufficient"))
        confidence = report_data.get("classification_confidence")
        if confidence is None:
            confidence = report_data.get("ml_confidence_pct")
            confidence = (float(confidence) / 100) if confidence is not None else 0
        confidence = float(confidence or 0)

        if observation_count >= 5:
            score += 2
            reasons.append("Multiple satellite observations available")
        elif observation_count >= 2:
            score += 1
            reasons.append("Limited multi-observation coverage")
        else:
            reasons.append("Single-observation event")

        if history_count >= 5:
            score += 2
            reasons.append("Strong historical comparison sample")
        elif history_count >= 1:
            score += 1
            reasons.append("Limited historical comparison sample")
        else:
            reasons.append("No comparable historical events found")

        if has_facility:
            score += 1
            reasons.append("Verified facility association available")
        if baseline_ok:
            score += 1
            reasons.append("Statistically sufficient baseline available")

        if confidence >= 0.80:
            score += 2
            reasons.append("High model classification confidence")
        elif confidence >= 0.60:
            score += 1
            reasons.append("Moderate model classification confidence")
        else:
            reasons.append("Low model classification confidence")

        level = "HIGH" if score >= 7 else "MODERATE" if score >= 4 else "LIMITED"
        return {
            "evidence_quality_score": score,
            "evidence_quality_level": level,
            "evidence_quality_reasons": reasons,
        }

    @staticmethod
    def _build_event_evolution(
        observations: list[ThermalObservation],
    ) -> Dict[str, Any]:
        """Build observation history and grouped earlier-versus-now metrics."""
        if not observations:
            return {
                "event_observation_history": [],
                "day_observation_count": 0,
                "night_observation_count": 0,
                "night_ratio": None,
                "earlier_vs_now": None,
            }

        history = []
        day_count = 0
        night_count = 0
        for observation in observations:
            if observation.day_night == "N":
                night_count += 1
            elif observation.day_night == "D":
                day_count += 1

            history.append(
                {
                    "observation_id": str(observation.id),
                    "timestamp": (
                        observation.observation_timestamp_utc.isoformat()
                        if observation.observation_timestamp_utc
                        else None
                    ),
                    "frp_mw": observation.frp_mw,
                    "brightness_k": observation.brightness_temp_k,
                    "satellite_sensor": observation.satellite_sensor,
                    "confidence_level": observation.confidence_level,
                    "confidence_pct": observation.confidence_pct,
                    "day_night": observation.day_night,
                    "latitude": float(observation.latitude),
                    "longitude": float(observation.longitude),
                }
            )

        earliest_time = observations[0].observation_timestamp_utc
        latest_time = observations[-1].observation_timestamp_utc
        earlier_observations = [
            item
            for item in observations
            if item.observation_timestamp_utc == earliest_time
        ]
        now_observations = [
            item for item in observations if item.observation_timestamp_utc == latest_time
        ]

        def summarize(items: list[ThermalObservation]) -> Dict[str, Any]:
            frp_values = [float(item.frp_mw) for item in items if item.frp_mw is not None]
            brightness_values = [
                float(item.brightness_temp_k)
                for item in items
                if item.brightness_temp_k is not None
            ]
            return {
                "timestamp": items[0].observation_timestamp_utc.isoformat(),
                "observation_count": len(items),
                "total_frp_mw": round(sum(frp_values), 2) if frp_values else None,
                "max_frp_mw": round(max(frp_values), 2) if frp_values else None,
                "avg_brightness_k": (
                    round(sum(brightness_values) / len(brightness_values), 2)
                    if brightness_values
                    else None
                ),
            }

        earlier = summarize(earlier_observations)
        now = summarize(now_observations)
        earlier_total_frp = earlier["total_frp_mw"]
        now_total_frp = now["total_frp_mw"]
        if earlier_total_frp and now_total_frp is not None:
            frp_change_percent = round(
                ((now_total_frp - earlier_total_frp) / earlier_total_frp) * 100,
                2,
            )
        else:
            frp_change_percent = None

        if frp_change_percent is None:
            trend = "UNKNOWN"
        elif frp_change_percent > 5:
            trend = "INCREASING"
        elif frp_change_percent < -5:
            trend = "DECREASING"
        else:
            trend = "STABLE"

        total_day_night_observations = day_count + night_count
        return {
            "event_observation_history": history,
            "day_observation_count": day_count,
            "night_observation_count": night_count,
            "night_ratio": (
                round(night_count / total_day_night_observations, 3)
                if total_day_night_observations
                else None
            ),
            "earlier_vs_now": {
                "earlier": earlier,
                "now": now,
                "frp_change_percent": frp_change_percent,
                "trend": trend,
            },
        }

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
