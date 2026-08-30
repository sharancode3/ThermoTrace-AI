"""PDF rendering adapter for thermal event dossiers using WeasyPrint."""
import io
from pathlib import Path
from typing import Dict, Any, Optional
import logging

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Setup Jinja2 environment for templates
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


class PDFRenderer:
    """
    Renders thermal event dossiers to PDF using WeasyPrint.
    
    This adapter takes a flat ReportViewModel dict and renders it using
    Jinja2 templating followed by WeasyPrint PDF generation.
    """

    TEMPLATE_NAME = "dossier_template.html"

    @staticmethod
    def render_dossier_to_pdf(
        report_view_model: Dict[str, Any],
        filename: Optional[str] = None,
    ) -> bytes:
        """
        Render a thermal event dossier to PDF bytes.

        Args:
            report_view_model: Flat dictionary from ReportService.get_report_view_model()
            filename: Optional filename for logging/debugging

        Returns:
            PDF content as bytes

        Raises:
            ImportError: If WeasyPrint is not installed
            ValueError: If required fields are missing from report_view_model
            Exception: If rendering fails
        """
        try:
            from weasyprint import HTML, CSS
        except ImportError:
            raise ImportError(
                "WeasyPrint is required for PDF rendering. "
                "Install it with: pip install weasyprint"
            )

        # Validate required fields
        required_fields = ["event_id", "classification", "anomaly_tier"]
        for field in required_fields:
            if field not in report_view_model or report_view_model[field] is None:
                raise ValueError(f"Missing required field: {field}")

        try:
            # Render HTML from template
            html_content = PDFRenderer._render_html(report_view_model)

            # Generate PDF from HTML
            pdf_bytes = PDFRenderer._html_to_pdf(html_content)

            logger.info(
                f"Successfully rendered PDF for event {report_view_model.get('event_id')} "
                f"({len(pdf_bytes)} bytes)"
            )

            return pdf_bytes

        except Exception as exc:
            logger.error(
                f"Error rendering PDF for event {report_view_model.get('event_id')}: {exc}"
            )
            raise

    @staticmethod
    def _render_html(report_view_model: Dict[str, Any]) -> str:
        """
        Render HTML from Jinja2 template using report view model data.

        Args:
            report_view_model: Flat dictionary of event data

        Returns:
            Rendered HTML string
        """
        try:
            template = jinja_env.get_template(PDFRenderer.TEMPLATE_NAME)
            html_content = template.render(**report_view_model)
            return html_content
        except Exception as exc:
            logger.error(f"Error rendering HTML template: {exc}")
            raise

    @staticmethod
    def _html_to_pdf(html_content: str) -> bytes:
        """
        Convert HTML string to PDF bytes using WeasyPrint.

        Args:
            html_content: HTML string to render

        Returns:
            PDF content as bytes
        """
        try:
            from weasyprint import HTML

            # Create HTML object from string
            html_doc = HTML(string=html_content, base_url=str(TEMPLATES_DIR))

            # Generate PDF and return as bytes
            pdf_bytes = html_doc.write_pdf()

            return pdf_bytes
        except Exception as exc:
            logger.error(f"Error converting HTML to PDF with WeasyPrint: {exc}")
            raise

    @staticmethod
    def render_and_save(
        report_view_model: Dict[str, Any],
        output_path: Path,
    ) -> Path:
        """
        Render dossier to PDF and save to file.

        Args:
            report_view_model: Flat dictionary from ReportService
            output_path: Path object where PDF should be saved

        Returns:
            Path to saved PDF file

        Raises:
            Exception: If rendering or saving fails
        """
        pdf_bytes = PDFRenderer.render_dossier_to_pdf(report_view_model)

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Write PDF to file
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

        logger.info(f"PDF saved to: {output_path}")
        return output_path

    @staticmethod
    def render_to_file_like(
        report_view_model: Dict[str, Any],
    ) -> io.BytesIO:
        """
        Render dossier to PDF and return as BytesIO object.

        Useful for returning PDF directly from FastAPI response.

        Args:
            report_view_model: Flat dictionary from ReportService

        Returns:
            BytesIO object containing PDF data

        Example:
            from fastapi import APIRouter
            from fastapi.responses import StreamingResponse

            @router.get("/events/{event_id}/dossier")
            def download_dossier(event_id: str, db: Session = Depends(get_db)):
                report_vm = ReportService.get_report_view_model(db, event_id)
                pdf_file = PDFRenderer.render_to_file_like(report_vm)
                return StreamingResponse(
                    pdf_file,
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f"attachment; filename=dossier_{event_id}.pdf"
                    }
                )
        """
        pdf_bytes = PDFRenderer.render_dossier_to_pdf(report_view_model)
        pdf_file = io.BytesIO(pdf_bytes)
        pdf_file.seek(0)
        return pdf_file

    @staticmethod
    def get_template_preview(report_view_model: Dict[str, Any]) -> str:
        """
        Get HTML preview of the dossier without rendering to PDF.

        Useful for debugging or HTML preview endpoints.

        Args:
            report_view_model: Flat dictionary from ReportService

        Returns:
            Rendered HTML string
        """
        return PDFRenderer._render_html(report_view_model)
