from datetime import datetime, timezone, timedelta
from app.domain.anomaly import get_or_compute_tier2_intelligence
import os
import sys
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, case, or_
from geoalchemy2.shape import to_shape

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app.db.database import get_db
from app.db.models import ThermalEvent, EventClassification, EventAnomaly, IndustrialFacility, IngestionJob, ThermoNews
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

@router.get("/gis/events", response_model=GeoJSONFeatureCollection)
def get_gis_events(
    show_all: bool = False,
    focus_event_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Phase 11 PostGIS Viewport Query & Decluttering Engine:
    - Default (show_all=False): Returns ONLY priority events (anomaly_tier in ABNORMAL/CRITICAL or classification in IND_FIRE/IND_FLARE).
    - If focus_event_id is requested (e.g. from Thermo News card click), it is always included regardless of default filter.
    - Full Feed (show_all=True): Returns all sovereign Indian detections.
    """
    query = db.query(ThermalEvent).filter(ThermalEvent.lifecycle_status != 'CLOSED')
    
    if not show_all:
        filter_conditions = [
            ThermalEvent.anomaly_tier.in_(["ABNORMAL", "CRITICAL"]),
            ThermalEvent.classification.in_(["IND_FIRE", "IND_FLARE"])
        ]
        if focus_event_id:
            filter_conditions.append(ThermalEvent.event_id == focus_event_id)
        query = query.filter(or_(*filter_conditions))
        
    all_events = query.all()
    # Sovereign Point-in-Polygon First Gate (always retain focus_event_id if explicitly requested by operator)
    events = [
        e for e in all_events 
        if is_within_sovereign_india(float(e.latitude), float(e.longitude)) or (focus_event_id and e.event_id == focus_event_id)
    ]
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
                "evidence_strength": "STRONG" if evt.observation_count >= 4 and evt.associated_facility_id else "MODERATE" if evt.observation_count >= 2 or evt.associated_facility_id else "LIMITED",
                "evidence_rationale": f"{evt.observation_count} obs" + (f", facility linked" if evt.associated_facility_id else ", unassociated"),
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
    
    # Enforce Phase 6 rule: if insufficient, anomaly_tier is BASELINE_INSUFFICIENT and z_score is None
    anomaly_tier_final = "BASELINE_INSUFFICIENT" if not is_sufficient else evt.anomaly_tier
    anomaly_z_score_final = None if not is_sufficient else (evt.anomaly_z_score or 0.0)
    
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
from datetime import datetime

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
