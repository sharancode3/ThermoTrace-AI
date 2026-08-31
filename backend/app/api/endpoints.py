from datetime import datetime, timezone, timedelta
from app.domain.anomaly import get_or_compute_tier2_intelligence
import os
import sys
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, case, or_
from geoalchemy2.shape import to_shape

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app.db.database import get_db
from app.db.models import (
    EventAnomaly,
    EventClassification,
    EventObservation,
    IndustrialFacility,
    IngestionJob,
    ThermalEvent,
    ThermalObservation,
    ThermoNews,
)
from app.schemas.events import (
    EventResponse, GeoJSONFeatureCollection, GeoJSONFeature,
    NewsItemResponse, FirmsStatusResponse
)
from app.domain.features import get_thermal_trend, get_evidence_completeness, get_evidence_strength
from app.domain.llm_humanizer import humanize_intelligence
from app.domain.geocoding import resolve_indian_location
from app.domain.sovereign_geofencing import is_within_sovereign_india

router = APIRouter()

@router.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": "ThermoTrace Backend",
        "contract_version": "3.3.0",
        "ml_model_version": "thermo_xgb_v1.1.0"
    }

def get_zoom_limit(zoom: float) -> int:
    if zoom < 5:
        return 300
    elif zoom < 8:
        return 700
    elif zoom < 12:
        return 1500
    return 3000

@router.get("/gis/events", response_model=GeoJSONFeatureCollection)
def get_gis_events(
    west: float = Query(68.0, ge=-180, le=180),
    south: float = Query(8.3, ge=-90, le=90),
    east: float = Query(96.98, ge=-180, le=180),
    north: float = Query(36.74, ge=-90, le=90),
    zoom: float = Query(5.0, ge=0, le=22),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    classification: Optional[str] = None,
    anomaly_tier: Optional[str] = None,
    include_closed: bool = Query(False),
    show_all: bool = Query(False),
    focus_event_id: Optional[str] = None,
    limit: int = Query(2000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    if west >= east:
        raise HTTPException(status_code=422, detail="west must be less than east")
    if south >= north:
        raise HTTPException(status_code=422, detail="south must be less than north")

    query = db.query(ThermalEvent)

    if not include_closed:
        query = query.filter(ThermalEvent.lifecycle_status != "CLOSED")

    query = query.filter(
        ThermalEvent.longitude >= west,
        ThermalEvent.longitude <= east,
        ThermalEvent.latitude >= south,
        ThermalEvent.latitude <= north,
    )

    if start_time is not None:
        query = query.filter(ThermalEvent.latest_detected_utc >= start_time)

    if end_time is not None:
        query = query.filter(ThermalEvent.first_detected_utc <= end_time)

    if classification:
        query = query.filter(ThermalEvent.classification == classification)

    if anomaly_tier:
        query = query.filter(ThermalEvent.anomaly_tier == anomaly_tier)

    if not show_all:
        filter_conditions = [
            ThermalEvent.anomaly_tier.in_(["ABNORMAL", "CRITICAL"]),
            ThermalEvent.classification.in_(["IND_FIRE", "IND_FLARE"]),
        ]
        if focus_event_id:
            filter_conditions.append(ThermalEvent.event_id == focus_event_id)
        query = query.filter(or_(*filter_conditions))

    effective_limit = min(limit, get_zoom_limit(zoom))

    all_events = (
        query
        .order_by(ThermalEvent.latest_detected_utc.desc())
        .limit(effective_limit)
        .all()
    )

    events = [
        event
        for event in all_events
        if is_within_sovereign_india(float(event.latitude), float(event.longitude))
        or (focus_event_id and event.event_id == focus_event_id)
    ]

    # Guaranteed Focus Event Injection: If operator clicked an event from Alerts/News, always include it on the map
    if focus_event_id and not any(e.event_id == focus_event_id for e in events):
        focus_evt = db.query(ThermalEvent).filter(ThermalEvent.event_id == focus_event_id).first()
        if focus_evt:
            events.insert(0, focus_evt)

    features = []

    for evt in events:
        feature = GeoJSONFeature(
            geometry={
                "type": "Point",
                "coordinates": [
                    float(evt.longitude),
                    float(evt.latitude)
                ]
            },
            properties={
                "event_id": evt.event_id,
                "classification": evt.classification,
                "anomaly_tier": evt.anomaly_tier,

                "peak_frp_mw": float(evt.peak_frp_mw)
                if evt.peak_frp_mw is not None
                else None,

                "mean_frp_mw": float(evt.mean_frp_mw)
                if evt.mean_frp_mw is not None
                else None,

                "max_brightness_k": float(evt.max_brightness_k)
                if evt.max_brightness_k is not None
                else None,

                "observation_count": evt.observation_count,
                "confidence_pct": round(
                    float(evt.classification_confidence or 0.0)
                    * 100.0,
                    1
                ),

                "evidence_strength": (
                    "STRONG"
                    if evt.observation_count >= 4 and evt.associated_facility_id
                    else "MODERATE"
                    if evt.observation_count >= 2 or evt.associated_facility_id
                    else "LIMITED"
                ),

                "evidence_rationale": (
                    f"{evt.observation_count} obs"
                    + (
                        ", facility linked"
                        if evt.associated_facility_id
                        else ", unassociated"
                    )
                ),

                "distance_to_facility_m": (
                    float(evt.distance_to_facility_m)
                    if evt.distance_to_facility_m is not None
                    else None
                ),

                "first_detected_utc": (
                    evt.first_detected_utc.isoformat()
                    if evt.first_detected_utc
                    else None
                ),

                "latest_detected_utc": (
                    evt.latest_detected_utc.isoformat()
                    if evt.latest_detected_utc
                    else None
                )
            }
        )

        features.append(feature)

    return GeoJSONFeatureCollection(
        features=features
    )


@router.get("/gis/events/timeline")
def get_gis_events_timeline(
    west: float = Query(68.0, ge=-180, le=180),
    south: float = Query(8.3, ge=-90, le=90),
    east: float = Query(96.98, ge=-180, le=180),
    north: float = Query(36.74, ge=-90, le=90),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    bucket_hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
):
    if west >= east:
        raise HTTPException(status_code=422, detail="west must be less than east")

    if south >= north:
        raise HTTPException(status_code=422, detail="south must be less than north")

    query = db.query(ThermalEvent).filter(
        ThermalEvent.longitude >= west,
        ThermalEvent.longitude <= east,
        ThermalEvent.latitude >= south,
        ThermalEvent.latitude <= north,
    )

    if start_time is not None:
        query = query.filter(ThermalEvent.latest_detected_utc >= start_time)

    if end_time is not None:
        query = query.filter(ThermalEvent.first_detected_utc <= end_time)

    events = query.order_by(ThermalEvent.first_detected_utc.asc()).all()

    if not events:
        return {"bucket_hours": bucket_hours, "timeline": []}

    bucket_seconds = bucket_hours * 3600
    buckets = {}
    for event in events:
        event_time = event.first_detected_utc
        if event_time is None:
            continue

        bucket_epoch = (int(event_time.timestamp()) // bucket_seconds) * bucket_seconds
        bucket_start = datetime.fromtimestamp(bucket_epoch, tz=event_time.tzinfo)
        bucket_key = bucket_start.isoformat()
        bucket = buckets.setdefault(
            bucket_key,
            {
                "bucket_start": bucket_key,
                "event_count": 0,
                "critical_count": 0,
                "abnormal_count": 0,
                "elevated_count": 0,
                "nominal_count": 0,
                "total_peak_frp_mw": 0.0,
            },
        )

        bucket["event_count"] += 1
        if event.peak_frp_mw is not None:
            bucket["total_peak_frp_mw"] += float(event.peak_frp_mw)

        tier = event.anomaly_tier.upper() if event.anomaly_tier else ""
        if tier == "CRITICAL":
            bucket["critical_count"] += 1
        elif tier == "ABNORMAL":
            bucket["abnormal_count"] += 1
        elif tier == "ELEVATED":
            bucket["elevated_count"] += 1
        elif tier in ("NOMINAL", "NORMAL"):
            bucket["nominal_count"] += 1

    timeline = sorted(buckets.values(), key=lambda item: item["bucket_start"])
    for bucket in timeline:
        bucket["total_peak_frp_mw"] = round(bucket["total_peak_frp_mw"], 2)

    return {"bucket_hours": bucket_hours, "timeline": timeline}


@router.get("/gis/facilities", response_model=GeoJSONFeatureCollection)
def get_gis_facilities(
    west: float = Query(68.0, ge=-180, le=180),
    south: float = Query(8.3, ge=-90, le=90),
    east: float = Query(96.98, ge=-180, le=180),
    north: float = Query(36.74, ge=-90, le=90),

    sector: Optional[str] = None,

    limit: int = Query(2000, ge=1, le=5000),

    db: Session = Depends(get_db),
):
    if west >= east:
        raise HTTPException(
            status_code=422,
            detail="west must be less than east"
        )

    if south >= north:
        raise HTTPException(
            status_code=422,
            detail="south must be less than north"
        )

    query = db.query(IndustrialFacility).filter(
        IndustrialFacility.is_active.is_(True)
    )

    query = query.filter(
        IndustrialFacility.longitude >= west,
        IndustrialFacility.longitude <= east,
        IndustrialFacility.latitude >= south,
        IndustrialFacility.latitude <= north
    )

    if sector:
        query = query.filter(
            IndustrialFacility.sector_category == sector
        )

    facilities = (
        query
        .order_by(IndustrialFacility.name.asc())
        .limit(limit)
        .all()
    )

    features = []

    for facility in facilities:
        feature = GeoJSONFeature(
            geometry={
                "type": "Point",
                "coordinates": [
                    float(facility.longitude),
                    float(facility.latitude)
                ]
            },
            properties={
                "id": str(facility.id),
                "facility_code": facility.facility_code,
                "name": facility.name,
                "sector_category": facility.sector_category,
                "sub_type": facility.sub_type,
                "operator_name": facility.operator_name,
                "state": facility.state,
                "district": facility.district,

                "baseline_frp_mean": float(
                    facility.baseline_frp_mean or 0.0
                ),

                "baseline_frp_std": float(
                    facility.baseline_frp_std or 0.0
                ),

                "historical_event_count":
                    facility.historical_event_count
            }
        )

        features.append(feature)

    return GeoJSONFeatureCollection(
        features=features
    )

@router.get("/gis/observations", response_model=GeoJSONFeatureCollection)
def get_gis_observations(
    west: float = Query(68.0, ge=-180, le=180),
    south: float = Query(8.3, ge=-90, le=90),
    east: float = Query(96.98, ge=-180, le=180),
    north: float = Query(36.74, ge=-90, le=90),

    zoom: float = Query(9.0, ge=0, le=22),

    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,

    satellite: Optional[str] = None,

    limit: int = Query(3000, ge=1, le=5000),

    db: Session = Depends(get_db),
):
    if west >= east:
        raise HTTPException(
            status_code=422,
            detail="west must be less than east"
        )

    if south >= north:
        raise HTTPException(
            status_code=422,
            detail="south must be less than north"
        )

    # Raw observations are too dense when zoomed out
    if zoom < 9:
        return GeoJSONFeatureCollection(features=[])

    query = db.query(ThermalObservation)

    query = query.filter(
        ThermalObservation.longitude >= west,
        ThermalObservation.longitude <= east,
        ThermalObservation.latitude >= south,
        ThermalObservation.latitude <= north
    )

    if start_time is not None:
        query = query.filter(
            ThermalObservation.observation_timestamp_utc >= start_time
        )

    if end_time is not None:
        query = query.filter(
            ThermalObservation.observation_timestamp_utc <= end_time
        )

    if satellite:
        query = query.filter(
            ThermalObservation.satellite_sensor == satellite
        )

    observations = (
        query
        .order_by(ThermalObservation.observation_timestamp_utc.desc())
        .limit(limit)
        .all()
    )

    features = []

    for obs in observations:
        feature = GeoJSONFeature(
            geometry={
                "type": "Point",
                "coordinates": [
                    float(obs.longitude),
                    float(obs.latitude)
                ]
            },
            properties={
                "id": str(obs.id),
                "frp_mw": float(obs.frp_mw) if obs.frp_mw is not None else None,
                "brightness_k": float(obs.brightness_temp_k) if obs.brightness_temp_k is not None else None,
                "satellite": obs.satellite_sensor,
                "sensor": None,
                "confidence": obs.confidence_pct,
                "day_night": obs.day_night,
                "acquired_at": (
                    obs.observation_timestamp_utc.isoformat()
                    if obs.observation_timestamp_utc
                    else None
                )
            }
        )
        features.append(feature)

    return GeoJSONFeatureCollection(
        features=features
    )


@router.get("/events/{event_id}/history")
def get_event_history(event_id: str, db: Session = Depends(get_db)):
    event = (
        db.query(ThermalEvent)
        .filter(ThermalEvent.event_id == event_id)
        .first()
    )

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    observations = (
        db.query(ThermalObservation)
        .join(
            EventObservation,
            EventObservation.observation_id == ThermalObservation.id,
        )
        .filter(EventObservation.event_id == event.id)
        .order_by(ThermalObservation.observation_timestamp_utc.asc())
        .all()
    )

    history = [
        {
            "id": str(obs.id),
            "acquired_at": (
                obs.observation_timestamp_utc.isoformat()
                if obs.observation_timestamp_utc
                else None
            ),
            "latitude": float(obs.latitude),
            "longitude": float(obs.longitude),
            "frp_mw": float(obs.frp_mw) if obs.frp_mw is not None else None,
            "brightness_k": (
                float(obs.brightness_temp_k)
                if obs.brightness_temp_k is not None
                else None
            ),
            "satellite": obs.satellite_sensor,
            "sensor": None,
            "day_night": obs.day_night,
        }
        for obs in observations
    ]

    return {
        "event_id": event_id,
        "observation_count": len(history),
        "history": history,
    }


@router.get("/events/{event_id}/compare")
def compare_event_earlier_vs_now(event_id: str, db: Session = Depends(get_db)):
    event = (
        db.query(ThermalEvent)
        .filter(ThermalEvent.event_id == event_id)
        .first()
    )

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    observations = (
        db.query(ThermalObservation)
        .join(
            EventObservation,
            EventObservation.observation_id == ThermalObservation.id,
        )
        .filter(EventObservation.event_id == event.id)
        .order_by(ThermalObservation.observation_timestamp_utc.asc())
        .all()
    )

    if not observations:
        return {
            "event_id": event_id,
            "message": "No observations available for comparison",
            "earlier": None,
            "now": None,
            "change": None,
        }

    earliest_time = observations[0].observation_timestamp_utc
    latest_time = observations[-1].observation_timestamp_utc
    earlier_observations = [
        obs
        for obs in observations
        if obs.observation_timestamp_utc == earliest_time
    ]
    now_observations = [
        obs
        for obs in observations
        if obs.observation_timestamp_utc == latest_time
    ]

    def calculate_stats(items):
        frp_values = [float(obs.frp_mw) for obs in items if obs.frp_mw is not None]
        brightness_values = [
            float(obs.brightness_temp_k)
            for obs in items
            if obs.brightness_temp_k is not None
        ]

        return {
            "timestamp": items[0].observation_timestamp_utc.isoformat(),
            "observation_count": len(items),
            "total_frp_mw": round(sum(frp_values), 2) if frp_values else 0,
            "avg_frp_mw": (
                round(sum(frp_values) / len(frp_values), 2)
                if frp_values
                else None
            ),
            "max_frp_mw": round(max(frp_values), 2) if frp_values else None,
            "avg_brightness_k": (
                round(sum(brightness_values) / len(brightness_values), 2)
                if brightness_values
                else None
            ),
            "max_brightness_k": (
                round(max(brightness_values), 2) if brightness_values else None
            ),
        }

    earlier = calculate_stats(earlier_observations)
    now = calculate_stats(now_observations)
    earlier_frp = earlier["total_frp_mw"]
    now_frp = now["total_frp_mw"]
    frp_change = round(now_frp - earlier_frp, 2)
    earlier_brightness = earlier["avg_brightness_k"]
    now_brightness = now["avg_brightness_k"]

    return {
        "event_id": event_id,
        "earlier": earlier,
        "now": now,
        "change": {
            "frp_change_mw": frp_change,
            "frp_change_percent": (
                round(((now_frp - earlier_frp) / earlier_frp) * 100, 2)
                if earlier_frp != 0
                else None
            ),
            "brightness_change_k": (
                round(now_brightness - earlier_brightness, 2)
                if earlier_brightness is not None and now_brightness is not None
                else None
            ),
            "trend": (
                "INCREASING"
                if frp_change > 0
                else "DECREASING" if frp_change < 0 else "STABLE"
            ),
        },
    }


@router.get("/events/{event_id}", response_model=EventResponse)
def get_event_intelligence(event_id: str, db: Session = Depends(get_db)):
    evt = db.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not evt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thermal event '{event_id}' not found."
        )
        
    # Tier 2 On-Demand Compute Trigger (SHAP Explainability & Deep Narrative)
    tier2_result = get_or_compute_tier2_intelligence(db, evt.event_id)
    
    cls = db.query(EventClassification).filter(EventClassification.event_id == evt.id).first()
    anom = db.query(EventAnomaly).filter(EventAnomaly.event_id == evt.id).first()
    fac = db.query(IndustrialFacility).filter(IndustrialFacility.id == evt.associated_facility_id).first()
    
    centroid_shape = to_shape(evt.centroid)
    trend = get_thermal_trend(db, str(evt.id))
    
    # Statistical baseline sufficiency resolution
    is_sufficient = (anom.contributing_factors or {}).get("status") == "STATISTICALLY_SUFFICIENT" if anom else False
    baseline_sample = int((anom.contributing_factors or {}).get("sample_count", 0)) if anom else 0
    hist_active_days = int((anom.contributing_factors or {}).get("hist_days", 0)) if anom else 0
    
    # Anomaly tier is derived directly from analytical evaluation (Decoupled from baseline availability)
    anomaly_tier_final = evt.anomaly_tier or "NORMAL"
    anomaly_z_score_final = evt.anomaly_z_score if evt.anomaly_z_score is not None else (anom.z_score if anom else 0.0)
    
    evidence_comp = get_evidence_completeness(
        evt.observation_count, 
        evt.associated_facility_id is not None,
        is_sufficient and (anom.baseline_mean_frp_mw or 0.0) > 0.0 if anom else False
    )
    
    geo = resolve_indian_location(float(evt.latitude), float(evt.longitude), fac.name if fac else None)
    facility_display_name = fac.name if fac else geo["location_formatted"]
    
    evidence_tag, evidence_rat = get_evidence_strength(
        evt.observation_count, 
        hist_active_days, 
        evt.associated_facility_id is not None, 
        fac.name if fac else None
    )
    
    intel_dict = {
        "event_id": evt.event_id,
        "facility_name": facility_display_name,
        "location_name": geo["location_formatted"],
        "classification": evt.classification,
        "classification_confidence": evt.classification_confidence or 0.0,
        "anomaly_tier": anomaly_tier_final,
        "anomaly_z_score": anomaly_z_score_final or 0.0,
        "is_statistically_sufficient": is_sufficient,
        "baseline_sample_size": baseline_sample,
        "peak_frp_mw": evt.peak_frp_mw,
        "mean_frp_mw": evt.mean_frp_mw,
        "max_brightness_k": evt.max_brightness_k,
        "observation_count": evt.observation_count,
        "thermal_trend": trend,
        "distance_to_facility_m": evt.distance_to_facility_m,
        "evidence_strength": evidence_tag,
        "satellite_context": tier2_result.get("satellite_context", {}),
        "shap_top_contributors": cls.feature_importances if cls else {}
    }
    
    llm_output = humanize_intelligence(intel_dict)
    
    return EventResponse(
        event_id=evt.event_id,
        latitude=float(evt.latitude),
        longitude=float(evt.longitude),
        centroid={"type": "Point", "coordinates": [centroid_shape.x, centroid_shape.y]},
        boundary={"type": "Point", "coordinates": [centroid_shape.x, centroid_shape.y]},
        bounding_area_ha=evt.bounding_area_ha or 0.0,
        first_detected_utc=evt.first_detected_utc,
        latest_detected_utc=evt.latest_detected_utc,
        duration_hours=float((evt.latest_detected_utc - evt.first_detected_utc).total_seconds() / 3600.0),
        observation_count=evt.observation_count,
        peak_frp_mw=evt.peak_frp_mw,
        mean_frp_mw=evt.mean_frp_mw,
        aggregate_frp_mw=evt.aggregate_frp_mw or evt.peak_frp_mw,
        max_brightness_k=evt.max_brightness_k,
        associated_facility_id=fac.id if fac else None,
        facility_name=facility_display_name,
        distance_to_facility_m=evt.distance_to_facility_m,
        primary_land_use=evt.primary_land_use or "Regional Energy & Agricultural Belt",
        classification=evt.classification,
        classification_confidence=evt.classification_confidence or 0.0,
        persistence_tier=evt.persistence_tier,
        anomaly_tier=anomaly_tier_final,
        anomaly_z_score=anomaly_z_score_final,
        lifecycle_status=evt.lifecycle_status,
        thermal_trend=trend,
        evidence_completeness=evidence_comp,
        evidence_strength=evidence_tag,
        evidence_rationale=evidence_rat,
        uncertainty="LOW" if (evt.classification_confidence or 0.0) > 0.8 else "MODERATE",
        is_within_india_sovereign_bounds=is_within_sovereign_india(float(evt.latitude), float(evt.longitude)),
        is_statistically_sufficient=is_sufficient,
        baseline_sample_size=baseline_sample,
        baseline_sufficiency_threshold=10,
        class_probabilities=cls.class_probabilities if cls else {},
        shap_top_contributors=cls.feature_importances if cls else {},
        satellite_context=tier2_result.get("satellite_context"),
        is_tier2_cached=tier2_result.get("is_tier2_cached", False),
        tier2_computed_at=tier2_result.get("tier2_computed_at"),
        baseline_mean_frp_mw=anom.baseline_mean_frp_mw if (anom and is_sufficient) else None,
        baseline_std_frp_mw=anom.baseline_std_frp_mw if (anom and is_sufficient) else None,
        contributing_factors=anom.contributing_factors if anom else {},
        humanized_summary=llm_output
    )

@router.get("/news", response_model=List[NewsItemResponse])
def get_news_feed(hours: Optional[int] = 24, db: Session = Depends(get_db)):
    """
    Authoritative Thermo News Stream:
    - Sorted strictly based on detection/publishing time (newest first).
    - Filters to the past 24 hours of NASA FIRMS telemetry (with graceful fallback if sparse).
    """
    query = (
        db.query(ThermoNews)
        .join(ThermalEvent, ThermoNews.event_id == ThermalEvent.id)
    )
    
    if hours and hours > 0:
        time_cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        filtered_items = query.filter(
            or_(
                ThermoNews.published_at >= time_cutoff,
                ThermalEvent.latest_detected_utc >= time_cutoff
            )
        ).order_by(ThermoNews.published_at.desc(), ThermalEvent.latest_detected_utc.desc()).limit(60).all()
        
        if len(filtered_items) >= 3:
            news_items = filtered_items
        else:
            # Fallback to most recent bulletins if past 24h has fewer than 3 events
            news_items = query.order_by(ThermoNews.published_at.desc(), ThermalEvent.latest_detected_utc.desc()).limit(60).all()
    else:
        news_items = query.order_by(ThermoNews.published_at.desc(), ThermalEvent.latest_detected_utc.desc()).limit(60).all()
        
    results = []
    for item in news_items:
        evt = db.query(ThermalEvent).filter(ThermalEvent.id == item.event_id).first()
        if not evt: continue
        fac = db.query(IndustrialFacility).filter(IndustrialFacility.id == evt.associated_facility_id).first()
        centroid_shape = to_shape(evt.centroid)
        
        geo = resolve_indian_location(float(evt.latitude), float(evt.longitude), fac.name if fac else None)
        
        is_ind = bool(evt.classification and evt.classification.startswith("IND_")) or bool(evt.associated_facility_id)
        results.append(NewsItemResponse(
            id=str(item.id),
            event_id=evt.event_id,
            headline=item.headline,
            summary=item.summary,
            severity_tag=item.severity_tag,
            classification=evt.classification,
            anomaly_tier=evt.anomaly_tier,
            confidence_pct=round((evt.classification_confidence or 0.0) * 100.0, 1),
            evidence_strength=get_evidence_strength(evt.observation_count, 0, evt.associated_facility_id is not None, fac.name if fac else None)[0],
            evidence_rationale=get_evidence_strength(evt.observation_count, 0, evt.associated_facility_id is not None, fac.name if fac else None)[1],
            peak_frp_mw=evt.peak_frp_mw,
            brightness_temp_k=evt.max_brightness_k,
            is_industrial=is_ind,
            location_name=geo["location_formatted"],
            coordinates=[centroid_shape.x, centroid_shape.y],
            published_at=item.published_at
        ))
    return results

@router.get("/firms/status", response_model=FirmsStatusResponse)
def get_firms_status(db: Session = Depends(get_db)):
    latest_job = db.query(IngestionJob).order_by(IngestionJob.executed_at.desc()).first()
    if not latest_job:
        return FirmsStatusResponse(status="STANDBY", data_freshness_status="STALE")
        
    return FirmsStatusResponse(
        status="ACTIVE" if latest_job.status == "SUCCESS" else "ERROR",
        last_successful_firms_fetch_utc=latest_job.time_window_start,
        latest_observation_timestamp_utc=latest_job.time_window_end,
        records_received=latest_job.records_received,
        records_inserted=latest_job.records_inserted,
        data_freshness_status="LIVE_NOMINAL",
        active_sensors=["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]
    )

from app.db.models import Notification

@router.get("/notifications", tags=["Notifications"])
def get_notifications(db: Session = Depends(get_db)):
    """
    Authoritative Operational Alerts:
    - Strict Alert Filter: ONLY CRITICAL, ABNORMAL, and INDUSTRIAL (IND_FIRE, IND_FLARE, IND_ROUTINE) events are included.
    - Limits to the most recent 100 alerts ordered strictly by time descending.
    """
    # Seed initial notifications if table is empty
    count = db.query(Notification).count()
    if count == 0:
        alert_events = db.query(ThermalEvent).filter(
            or_(
                ThermalEvent.anomaly_tier.in_(["CRITICAL", "ABNORMAL"]),
                ThermalEvent.classification.like("IND_%")
            )
        ).order_by(ThermalEvent.latest_detected_utc.desc()).limit(100).all()
        
        for evt in alert_events:
            fac = db.query(IndustrialFacility).filter(IndustrialFacility.id == evt.associated_facility_id).first()
            fac_name = fac.name if fac else "Regional Monitored Sector"
            title = f"{'Critical Incident' if evt.anomaly_tier == 'CRITICAL' else ('Abnormal Flaring' if evt.anomaly_tier == 'ABNORMAL' else 'Industrial Hotspot')}: [{evt.event_id}]"
            msg = f"Observed peak FRP of {evt.peak_frp_mw:.1f} MW near {fac_name}. Classification: {evt.classification}."
            notif = Notification(
                event_id=evt.id,
                title=title,
                message=msg,
                severity=evt.anomaly_tier if evt.anomaly_tier in ["CRITICAL", "ABNORMAL"] else "ABNORMAL",
                is_read=False,
                created_at=evt.latest_detected_utc or datetime.now(timezone.utc)
            )
            db.add(notif)
        db.commit()

    # Query strictly CRITICAL, ABNORMAL, or INDUSTRIAL records, limited to last 100
    notifications = (
        db.query(Notification)
        .join(ThermalEvent, Notification.event_id == ThermalEvent.id)
        .filter(
            or_(
                Notification.severity.in_(["CRITICAL", "ABNORMAL"]),
                ThermalEvent.anomaly_tier.in_(["CRITICAL", "ABNORMAL"])
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )
    
    results = []
    for n in notifications:
        evt = db.query(ThermalEvent).filter(ThermalEvent.id == n.event_id).first()
        results.append({
            "id": str(n.id),
            "event_id": evt.event_id if evt else "UNKNOWN",
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "classification": evt.classification if evt else "IND_ROUTINE",
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "peak_frp_mw": evt.peak_frp_mw if evt else 0.0,
            "latitude": float(evt.latitude) if evt else 0.0,
            "longitude": float(evt.longitude) if evt else 0.0,
            "anomaly_tier": evt.anomaly_tier if evt else "NORMAL",
        })
    return results

@router.post("/notifications/{notification_id}/read", tags=["Notifications"])
def mark_notification_read(notification_id: str, db: Session = Depends(get_db)):
    """Mark a single notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.commit()
    return {"status": "SUCCESS", "id": notification_id, "is_read": True}

@router.post("/notifications/read-all", tags=["Notifications"])
def mark_all_notifications_read(db: Session = Depends(get_db)):
    """Mark all operational notifications as read."""
    db.query(Notification).update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()
    return {"status": "SUCCESS", "message": "All notifications marked as read"}

@router.post("/ingest/poll", tags=["Ingestion"])
def trigger_firms_poll(force: bool = False, db: Session = Depends(get_db)):
    """
    Foreground-Triggered FIRMS Polling Endpoint.
    Executed when users active session triggers periodic refresh.
    Idempotent and rate-limited to respect polar satellite pass cadence.
    """
    from app.domain.firms_poller import poll_firms_foreground_cycle
    return poll_firms_foreground_cycle(db, force=force)