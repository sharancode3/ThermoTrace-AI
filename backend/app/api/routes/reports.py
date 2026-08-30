import os
import uuid
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.db.models import Report, ThermalEvent
from app.tasks import generate_dossier_pdf

router = APIRouter(prefix="/reports", tags=["Reports"])


class GenerateReportRequest(BaseModel):
    event_id: str
    title: str
    included_sections: List[str]


def verify_session(authorization: str = Header(default=None, alias="Authorization"), x_admin_key: str = Header(default=None, alias="X-Admin-Key")):
    """
    Dummy authentication dependency to ensure route is protected.
    In a real system, this would decode a JWT or verify a session token.
    """
    if not authorization and not x_admin_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return True


@router.post("/generate")
def generate_report(request: GenerateReportRequest, db: Session = Depends(get_db)):
    """
    Initiate async PDF report generation for a thermal event.
    """
    # 1. Resolve event_id to internal ThermalEvent
    event = db.query(ThermalEvent).filter(ThermalEvent.event_id == request.event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event {request.event_id} not found")

    # 2. Create Report record with PENDING status
    report_uuid = str(uuid.uuid4())
    report_public_id = f"RPT-{report_uuid[:8].upper()}"

    new_report = Report(
        id=report_uuid,
        report_id=report_public_id,
        event_id=event.id,
        title=request.title,
        included_sections=request.included_sections,
        storage_path="",  # will be filled by Celery
        download_url="",  # will be filled by Celery
        sha256_hash="",   # will be filled by Celery
        generation_status="PENDING"
    )
    db.add(new_report)
    db.commit()
    
    # 3. Trigger Celery task
    generate_dossier_pdf.delay(report_id=str(report_uuid))
    
    return {
        "status": "PENDING",
        "report_id": report_public_id
    }


@router.get("/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db), auth: bool = Depends(verify_session)):
    """
    Download a generated PDF report. Requires authentication.
    """
    report = db.query(Report).filter(Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        
    if report.generation_status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Report is not ready. Current status: {report.generation_status}"
        )
        
    pdf_path = Path(report.storage_path)
    if not pdf_path.exists() or not pdf_path.is_file():
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="PDF file is missing from storage")
        
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=pdf_path.name,
        headers={
            "Content-Disposition": f'attachment; filename="{pdf_path.name}"'
        }
    )

