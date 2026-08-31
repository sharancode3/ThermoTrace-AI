"""Celery tasks for ThermoTrace-AI."""
from pathlib import Path
from app.celery_config import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="thermotrace.process_thermal_event",
    queue="processing",
)
def process_thermal_event(self, event_id: str):
    """
    Process a thermal event asynchronously.
    
    Args:
        event_id: The ID of the thermal event to process
    """
    try:
        logger.info(f"Processing thermal event: {event_id}")
        # Placeholder for actual event processing logic
        return {"status": "success", "event_id": event_id}
    except Exception as exc:
        logger.error(f"Error processing event {event_id}: {exc}")
        raise exc


@celery_app.task(
    bind=True,
    name="thermotrace.send_notification",
    queue="notifications",
)
def send_notification(self, notification_id: str, user_id: str):
    """
    Send a notification asynchronously.
    
    Args:
        notification_id: The ID of the notification
        user_id: The ID of the user receiving the notification
    """
    try:
        logger.info(f"Sending notification {notification_id} to user {user_id}")
        # Placeholder for actual notification sending logic
        return {"status": "sent", "notification_id": notification_id}
    except Exception as exc:
        logger.error(f"Error sending notification {notification_id}: {exc}")
        raise exc


@celery_app.task(
    bind=True,
    name="thermotrace.generate_report",
    queue="processing",
)
def generate_report(self, report_id: str, filters: dict):
    """
    Generate a thermal analysis report asynchronously.
    
    Args:
        report_id: The ID of the report
        filters: Dictionary of filters for the report
    """
    try:
        logger.info(f"Generating report {report_id} with filters: {filters}")
        # Placeholder for actual report generation logic
        return {"status": "generated", "report_id": report_id}
    except Exception as exc:
        logger.error(f"Error generating report {report_id}: {exc}")
        raise exc


@celery_app.task(
    name="thermotrace.health_check",
    queue="default",
)
def health_check():
    """Periodic health check for the Celery worker."""
    logger.debug("Celery worker health check passed")
    return {"status": "healthy"}


@celery_app.task(
    bind=True,
    name="thermotrace.generate_dossier_pdf",
    queue="processing",
    time_limit=300,  # 5 minutes hard limit
    soft_time_limit=240,  # 4 minutes soft limit
)
def generate_dossier_pdf(self, report_id: str):
    """
    Generate and store PDF dossier for a thermal event asynchronously.

    This task:
    1. Queries the database for the Report and Event data
    2. Renders the dossier template to PDF using PDFRenderer
    3. Stores the PDF to filesystem (/app/data/reports)
    4. Updates the Report record in the database
    5. Logs success/failure

    Args:
        report_id: The UUID of the Report record

    Returns:
        Dictionary with status, report_id, and pdf_path (if successful)
    """
    import hashlib
    try:
        from app.db.database import SessionLocal
        from app.db.models import Report, ThermalEvent
        from app.services.report_service import ReportService
        from app.adapters.pdf_renderer import PDFRenderer

        db = SessionLocal()

        logger.info(f"Starting PDF dossier generation for report: {report_id}")
        
        # Get the report record
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            logger.warning(f"Report not found: {report_id}")
            db.close()
            return {"status": "error", "report_id": report_id, "message": "Report not found"}
            
        event = db.query(ThermalEvent).filter(ThermalEvent.id == report.event_id).first()
        if not event:
            logger.warning(f"Event not found for report: {report_id}")
            report.generation_status = "FAILED"
            db.commit()
            db.close()
            return {"status": "error", "report_id": report_id, "message": "Event not found"}

        # Step 1: Get report view model
        report_vm = ReportService.get_report_view_model(db, event.event_id)

        if not report_vm:
            logger.warning(f"Report view model generation failed for event: {event.event_id}")
            report.generation_status = "FAILED"
            db.commit()
            db.close()
            return {"status": "error", "report_id": report_id, "message": "Report VM generation failed"}

        # Step 2: Render and save PDF
        output_dir = Path("/app/data/reports")
        output_path = output_dir / f"{report.report_id}.pdf"

        saved_path = PDFRenderer.render_and_save(report_vm, output_path)

        file_size = saved_path.stat().st_size
        
        # Calculate SHA256
        sha256_hash = hashlib.sha256()
        with open(saved_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        # Update DB record
        report.storage_path = str(saved_path)
        report.download_url = f"/api/v1/reports/{report.report_id}/download"
        report.sha256_hash = sha256_hash.hexdigest()
        report.generation_status = "COMPLETED"
        db.commit()

        logger.info(
            f"Successfully generated PDF dossier for report {report_id} "
            f"({file_size} bytes) at {saved_path}"
        )

        db.close()

        return {
            "status": "success",
            "report_id": report_id,
            "pdf_path": str(saved_path),
            "file_size_bytes": file_size
        }

    except Exception as exc:
        logger.error(f"Error generating PDF dossier for report {report_id}: {exc}")
        # Attempt to mark as FAILED
        try:
            from app.db.database import SessionLocal
            from app.db.models import Report
            db = SessionLocal()
            report = db.query(Report).filter(Report.id == report_id).first()
            if report:
                report.generation_status = "FAILED"
                db.commit()
            db.close()
        except:
            pass
            
        # Celery will retry based on configuration
        raise exc


