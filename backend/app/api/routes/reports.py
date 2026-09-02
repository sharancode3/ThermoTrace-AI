import os
import re
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import Report, ThermalEvent, IndustrialFacility
from app.services.report_service import ReportService
from app.adapters.pdf_renderer import PDFRenderer

router = APIRouter(prefix="/reports", tags=["Reports"])


def _report_type_filename(classification: Optional[str]) -> str:
    return {
        "IND_FIRE": "Industrial_Fire",
        "IND_FLARE": "Industrial_Flare",
        "IND_ROUTINE": "Industrial_Routine",
        "AGRI_BURN": "Agricultural_Burn",
        "WILDFIRE": "Wildfire",
        "OTHER_UNCERTAIN": "Uncertain_Event",
    }.get((classification or "").upper(), "Thermal_Event")


def _safe_filename_part(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = re.sub(r"\s+", "_", str(value).strip())
    return re.sub(r"[^A-Za-z0-9_-]", "", normalized)[:50]


def _build_report_filename(
    classification: Optional[str],
    location_name: Optional[str] = None,
    event_id: Optional[str] = None,
) -> str:
    location = _safe_filename_part(location_name) or _safe_filename_part(event_id)
    location = location or "Unknown_Location"
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    report_date = now.strftime("%Y-%m-%d")
    report_time = now.strftime("%H-%M")
    return f"ThermoTrace_{_report_type_filename(classification)}_{location}_{report_date}_{report_time}.pdf"


class GenerateReportRequest(BaseModel):
    event_id: str
    title: Optional[str] = None
    included_sections: Optional[List[str]] = None


@router.get("", response_model=List[dict])
def list_reports(db: Session = Depends(get_db)):
    """List all generated thermal intelligence reports."""
    reports = db.query(Report).order_by(Report.generated_at.desc()).all()
    results = []
    for r in reports:
        evt = db.query(ThermalEvent).filter(ThermalEvent.id == r.event_id).first()
        results.append({
            "id": str(r.id),
            "report_id": r.report_id,
            "event_id": evt.event_id if evt else "UNKNOWN",
            "title": r.title,
            "included_sections": r.included_sections or [],
            "download_url": f"/api/v1/reports/{r.report_id}/download",
            "sha256_hash": r.sha256_hash,
            "generation_status": r.generation_status,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            "anomaly_tier": evt.anomaly_tier if evt else "NORMAL",
            "classification": evt.classification if evt else "OTHER",
            "peak_frp_mw": evt.peak_frp_mw if evt else 0.0,
        })
    return results


@router.post("/generate")
def generate_report(request: GenerateReportRequest, db: Session = Depends(get_db)):
    """Generate a PDF dossier synchronously or asynchronously."""
    # 1. Resolve event
    event = db.query(ThermalEvent).filter(ThermalEvent.event_id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event {request.event_id} not found")

    report_uuid = str(uuid.uuid4())
    report_public_id = f"RPT-{report_uuid[:8].upper()}"
    title = request.title or f"Thermal Dossier: {event.event_id} ({event.anomaly_tier})"
    sections = request.included_sections or ["executive_summary", "sensor_telemetry", "baseline_audit"]

    # 2. Render PDF
    output_dir = Path(os.getenv("REPORTS_DIR", "backend/data/reports"))
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"{report_public_id}.pdf"

    try:
        report_vm = ReportService.get_report_view_model(db, event.event_id)
        if not report_vm:
            raise ValueError(f"Could not build report view model for event {event.event_id}")

        saved_path = PDFRenderer.render_and_save(report_vm, pdf_path)
        
        # Calculate SHA-256
        sha256_hash = hashlib.sha256()
        with open(saved_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        file_hash = sha256_hash.hexdigest()

        # 3. Save Report record
        new_report = Report(
            id=report_uuid,
            report_id=report_public_id,
            event_id=event.id,
            title=title,
            included_sections=sections,
            storage_path=str(saved_path),
            download_url=f"/api/v1/reports/{report_public_id}/download",
            sha256_hash=file_hash,
            generation_status="COMPLETED"
        )
        db.add(new_report)
        db.commit()

        return {
            "status": "COMPLETED",
            "report_id": report_public_id,
            "download_url": f"/api/v1/reports/{report_public_id}/download",
            "sha256_hash": file_hash
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(exc)}"
        )


@router.get("/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db)):
    """Download a generated PDF dossier directly."""
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    pdf_path = Path(report.storage_path)
    if not pdf_path.exists() or not pdf_path.is_file():
        # Regenerate if file was cleared
        evt = db.query(ThermalEvent).filter(ThermalEvent.id == report.event_id).first()
        if evt:
            report_vm = ReportService.get_report_view_model(db, evt.event_id)
            if report_vm:
                PDFRenderer.render_and_save(report_vm, pdf_path)

    if not pdf_path.exists() or not pdf_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file could not be retrieved")

    event = db.query(ThermalEvent).filter(ThermalEvent.id == report.event_id).first()
    report_vm = (
        ReportService.get_report_view_model(db, event.event_id)
        if event else {}
    )
    download_filename = _build_report_filename(
        classification=report_vm.get("classification") or (event.classification if event else None),
        location_name=report_vm.get("facility_district") or report_vm.get("facility_state"),
        event_id=report_vm.get("event_id") or (event.event_id if event else None),
    )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=download_filename,
    )


@router.get("/events/{event_id}/download")
def download_event_report(event_id: str, db: Session = Depends(get_db)):
    """Generate and download a PDF dossier for a specific thermal event in one step."""
    event = db.query(ThermalEvent).filter(ThermalEvent.event_id == event_id).first()
    if not event:
        try:
            val_uuid = uuid.UUID(event_id)
            event = db.query(ThermalEvent).filter(ThermalEvent.id == val_uuid).first()
        except (ValueError, TypeError, AttributeError):
            pass
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event {event_id} not found")

    report_vm = ReportService.get_report_view_model(db, event.event_id)
    if not report_vm:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not build report view model")

    output_dir = Path(os.getenv("REPORTS_DIR", "backend/data/reports"))
    output_dir.mkdir(parents=True, exist_ok=True)

    report_public_id = f"RPT-EVT-{event.event_id[:12]}"
    pdf_path = output_dir / f"{report_public_id}.pdf"

    saved_path = PDFRenderer.render_and_save(report_vm, pdf_path)

    # Calculate SHA-256
    sha256_hash = hashlib.sha256()
    with open(saved_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    file_hash = sha256_hash.hexdigest()

    # Update or create Report record
    existing_report = db.query(Report).filter(Report.event_id == event.id).first()
    if not existing_report:
        report_uuid = str(uuid.uuid4())
        new_report = Report(
            id=report_uuid,
            report_id=report_public_id,
            event_id=event.id,
            title=f"Thermal Dossier: {event.event_id} ({event.anomaly_tier})",
            included_sections=["executive_summary", "sensor_telemetry", "baseline_audit"],
            storage_path=str(saved_path),
            download_url=f"/api/v1/reports/{report_public_id}/download",
            sha256_hash=file_hash,
            generation_status="COMPLETED"
        )
        db.add(new_report)
        db.commit()
    else:
        existing_report.storage_path = str(saved_path)
        existing_report.sha256_hash = file_hash
        existing_report.generation_status = "COMPLETED"
        db.commit()

    download_filename = _build_report_filename(
        classification=report_vm.get("classification") or event.classification,
        location_name=report_vm.get("facility_district") or report_vm.get("facility_state"),
        event_id=report_vm.get("event_id") or event.event_id,
    )

    return FileResponse(
        path=saved_path,
        media_type="application/pdf",
        filename=download_filename,
    )


@router.get("/national/download")
def download_national_report(target_date: Optional[str] = None, db: Session = Depends(get_db)):
    """Generate and download authoritative 1-page forensic National Thermal Intelligence Report."""
    from app.api.endpoints import get_national_summary

    summary_data = get_national_summary(target_date=target_date, db=db)
    selected_date = summary_data.get("selected_date") or (target_date if target_date else "ALL")

    output_dir = Path(os.getenv("REPORTS_DIR", "backend/data/reports"))
    output_dir.mkdir(parents=True, exist_ok=True)

    date_suffix = _safe_filename_part(selected_date) or "ALL_DAYS"
    filename = f"National_Analysis_Report_{date_suffix}.pdf"
    pdf_path = output_dir / f"NAT-RPT-{date_suffix}.pdf"

    saved_path = PDFRenderer.render_national_analysis_pdf(summary_data, pdf_path)

    return FileResponse(
        path=saved_path,
        media_type="application/pdf",
        filename=filename,
    )
