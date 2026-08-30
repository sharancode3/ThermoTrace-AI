import os
import sys
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, case
from geoalchemy2.shape import to_shape

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app.db.database import get_db
from app.db.models import ThermalEvent, EventClassification, EventAnomaly, IndustrialFacility, IngestionJob, ThermoNews
from app.schemas.events import (
    EventResponse, GeoJSONFeatureCollection, GeoJSONFeature,
    NewsItemResponse, FirmsStatusResponse
)
from app.domain.features import get_thermal_trend, get_evidence_completeness
from app.domain.llm_humanizer import humanize_intelligence
from app.domain.geocoding import resolve_indian_location

router = APIRouter()

@router.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "ThermoTrace Backend",
        "contract_version": "3.3.0"
    }

@router.get("/gis/events", response_model=GeoJSONFeatureCollection)
def get_gis_events(db: Session = Depends(get_db)):
    events = db.query(ThermalEvent).filter(ThermalEvent.lifecycle_status != 'CLOSED').all()
    features = []
    
    for evt in events:
        centroid_shape = to_shape(evt.centroid)
        
        feature = GeoJSONFeature(
            geometry={
                "type": "Point",
                "coordinates": [centroid_shape.x, centroid_shape.y]
            },
            properties={
                "event_id": evt.event_id,
                "classification": evt.classification,
                "anomaly_tier": evt.anomaly_tier,
                "peak_frp_mw": evt.peak_frp_mw,
                "max_brightness_k": evt.max_brightness_k,
                "observation_count": evt.observation_count,
                "confidence_pct": round((evt.classification_confidence or 0.0) * 100.0, 1),
                "distance_to_facility_m": evt.distance_to_facility_m,
                "first_detected_utc": evt.first_detected_utc.isoformat() if evt.first_detected_utc else None,
                "latest_detected_utc": evt.latest_detected_utc.isoformat() if evt.latest_detected_utc else None
            }
        )
        features.append(feature)
        
    return GeoJSONFeatureCollection(features=features)

@router.get("/events/{event_id}", response_model=EventResponse)
def get_event_intelligence(event_id: str, db: Session = Depends(get_db)):
    evt = db.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not evt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thermal event '{event_id}' not found."
        )
        
    cls = db.query(EventClassification).filter(EventClassification.event_id == evt.id).first()
    anom = db.query(EventAnomaly).filter(EventAnomaly.event_id == evt.id).first()
    fac = db.query(IndustrialFacility).filter(IndustrialFacility.id == evt.associated_facility_id).first()
    
    centroid_shape = to_shape(evt.centroid)
    trend = get_thermal_trend(db, str(evt.id))
    evidence_comp = get_evidence_completeness(
        evt.observation_count, 
        evt.associated_facility_id is not None,
        (anom.baseline_mean_frp_mw or 0.0) > 0.0 if anom else False
    )
    
    geo = resolve_indian_location(float(evt.latitude), float(evt.longitude), fac.name if fac else None)
    facility_display_name = fac.name if fac else geo["location_formatted"]
    
    intel_dict = {
        "event_id": evt.event_id,
        "facility_name": facility_display_name,
        "location_name": geo["location_formatted"],
        "classification": evt.classification,
        "classification_confidence": evt.classification_confidence or 0.0,
        "anomaly_tier": evt.anomaly_tier,
        "anomaly_z_score": evt.anomaly_z_score or 0.0,
        "peak_frp_mw": evt.peak_frp_mw,
        "mean_frp_mw": evt.mean_frp_mw,
        "observation_count": evt.observation_count,
        "thermal_trend": trend,
        "distance_to_facility_m": evt.distance_to_facility_m
    }
    
    llm_output = humanize_intelligence(intel_dict)
    
    return EventResponse(
        event_id=evt.event_id,
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
        anomaly_tier=evt.anomaly_tier,
        anomaly_z_score=evt.anomaly_z_score or 0.0,
        lifecycle_status=evt.lifecycle_status,
        thermal_trend=trend,
        evidence_completeness=evidence_comp,
        uncertainty="LOW" if (evt.classification_confidence or 0.0) > 0.8 else "MODERATE",
        class_probabilities=cls.class_probabilities if cls else {},
        shap_top_contributors=cls.feature_importances if cls else {},
        baseline_mean_frp_mw=anom.baseline_mean_frp_mw if anom else None,
        baseline_std_frp_mw=anom.baseline_std_frp_mw if anom else None,
        contributing_factors=anom.contributing_factors if anom else {},
        humanized_summary=llm_output
    )

@router.get("/news", response_model=List[NewsItemResponse])
def get_news_feed(db: Session = Depends(get_db)):
    severity_order = case(
        (ThermoNews.severity_tag == 'CRITICAL', 1),
        (ThermoNews.severity_tag == 'ABNORMAL', 2),
        (ThermoNews.severity_tag == 'ALERT', 3),
        (ThermoNews.severity_tag == 'AGRI', 4),
        (ThermoNews.severity_tag == 'ROUTINE', 5),
        else_=6
    )
    
    news_items = db.query(ThermoNews)\
        .join(ThermalEvent, ThermoNews.event_id == ThermalEvent.id)\
        .order_by(severity_order, ThermalEvent.peak_frp_mw.desc(), ThermoNews.published_at.desc())\
        .limit(40).all()
        
    results = []
    for item in news_items:
        evt = db.query(ThermalEvent).filter(ThermalEvent.id == item.event_id).first()
        if not evt: continue
        fac = db.query(IndustrialFacility).filter(IndustrialFacility.id == evt.associated_facility_id).first()
        centroid_shape = to_shape(evt.centroid)
        
        geo = resolve_indian_location(float(evt.latitude), float(evt.longitude), fac.name if fac else None)
        
        results.append(NewsItemResponse(
            id=str(item.id),
            event_id=evt.event_id,
            headline=item.headline,
            summary=item.summary,
            severity_tag=item.severity_tag,
            classification=evt.classification,
            anomaly_tier=evt.anomaly_tier,
            confidence_pct=round((evt.classification_confidence or 0.0) * 100.0, 1),
            peak_frp_mw=evt.peak_frp_mw,
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
