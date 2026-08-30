"""Tests for PDF dossier rendering system."""
import io
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.adapters.pdf_renderer import PDFRenderer


class TestPDFRenderer:
    """Test cases for PDFRenderer adapter."""

    @pytest.fixture
    def valid_report_vm(self):
        """Valid report view model with all required fields."""
        return {
            "event_id": "EVT-20240115-001",
            "classification": "industrial_emission",
            "anomaly_tier": "elevated",
            "confidence": 0.92,
            "frp_peak_mw": 250.5,
            "frp_mean_mw": 180.3,
            "frp_aggregate_mw": 5420.8,
            "max_brightness_temp_k": 1250,
            "observation_count": 8,
            "first_detection_utc": "2024-01-15T14:22:30Z",
            "latest_detection_utc": "2024-01-15T14:32:45Z",
            "latitude": 34.567,
            "longitude": -118.234,
            "land_use": "industrial",
            "area_hectares": 45.2,
            "facility_name": "Industrial Plant ABC",
            "facility_district": "South Bay",
            "facility_lat": 34.568,
            "facility_lon": -118.235,
            "distance_to_facility_km": 0.5,
            "baseline_mean_frp_mw": 120.0,
            "baseline_std_dev_frp": 45.0,
            "baseline_median_frp": 110.0,
            "baseline_q95_frp": 210.0,
            "baseline_sample_count": 156,
            "anomaly_observed_frp": 250.5,
            "anomaly_z_score": 2.89,
            "anomaly_percentile": 94.5,
            "anomaly_severity": "critical",
            "ml_model_name": "ThermoNet_v2.1",
            "ml_model_version": "2.1.0",
            "ml_accuracy": 0.96,
            "feature_importance_1": ("frp_peak", 0.34),
            "feature_importance_2": ("brightness_temp", 0.28),
            "feature_importance_3": ("temporal_pattern", 0.18),
            "lifecycle_status": "active_monitoring",
            "data_quality_score": 0.87,
        }

    @pytest.fixture
    def minimal_report_vm(self):
        """Minimal report with only required fields."""
        return {
            "event_id": "EVT-TEST-001",
            "classification": "possible_burn",
            "anomaly_tier": "normal",
        }

    def test_render_with_valid_data(self, valid_report_vm):
        """Test PDF rendering with complete valid data."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"PDF_BYTES_HERE"
                mock_html.return_value = mock_html_instance

                pdf_bytes = PDFRenderer.render_dossier_to_pdf(valid_report_vm)

                assert isinstance(pdf_bytes, bytes)
                assert pdf_bytes == b"PDF_BYTES_HERE"
                mock_template.assert_called_once_with("dossier_template.html")
                mock_t.render.assert_called_once()

    def test_render_missing_event_id(self, valid_report_vm):
        """Test error handling when event_id is missing."""
        del valid_report_vm["event_id"]

        with pytest.raises(ValueError, match="Missing required field: event_id"):
            PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_render_missing_classification(self, valid_report_vm):
        """Test error handling when classification is missing."""
        del valid_report_vm["classification"]

        with pytest.raises(ValueError, match="Missing required field: classification"):
            PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_render_missing_anomaly_tier(self, valid_report_vm):
        """Test error handling when anomaly_tier is missing."""
        del valid_report_vm["anomaly_tier"]

        with pytest.raises(ValueError, match="Missing required field: anomaly_tier"):
            PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_render_null_required_field(self, valid_report_vm):
        """Test error handling when required field is None."""
        valid_report_vm["classification"] = None

        with pytest.raises(ValueError, match="Missing required field: classification"):
            PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_render_with_minimal_data(self, minimal_report_vm):
        """Test PDF rendering with only required fields."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Minimal Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"PDF_MINIMAL"
                mock_html.return_value = mock_html_instance

                pdf_bytes = PDFRenderer.render_dossier_to_pdf(minimal_report_vm)

                assert isinstance(pdf_bytes, bytes)
                assert pdf_bytes == b"PDF_MINIMAL"

    def test_render_html(self, valid_report_vm):
        """Test HTML rendering without PDF conversion."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            expected_html = "<html><body>Rendered Template</body></html>"
            mock_t.render.return_value = expected_html
            mock_template.return_value = mock_t

            html_content = PDFRenderer._render_html(valid_report_vm)

            assert html_content == expected_html
            assert isinstance(html_content, str)

    def test_html_to_pdf(self):
        """Test HTML to PDF conversion."""
        html_content = "<html><body>Test Content</body></html>"

        with patch("app.adapters.pdf_renderer.HTML") as mock_html:
            mock_html_instance = MagicMock()
            mock_html_instance.write_pdf.return_value = b"PDF_OUTPUT"
            mock_html.return_value = mock_html_instance

            pdf_bytes = PDFRenderer._html_to_pdf(html_content)

            assert pdf_bytes == b"PDF_OUTPUT"
            mock_html.assert_called_once()

    def test_render_to_file_like(self, valid_report_vm):
        """Test rendering to BytesIO object."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"PDF_DATA_HERE"
                mock_html.return_value = mock_html_instance

                pdf_file = PDFRenderer.render_to_file_like(valid_report_vm)

                assert isinstance(pdf_file, io.BytesIO)
                assert pdf_file.tell() == 0  # Seek position should be 0
                assert pdf_file.read() == b"PDF_DATA_HERE"

    def test_render_and_save(self, valid_report_vm, tmp_path):
        """Test rendering and saving to file."""
        output_path = tmp_path / "reports" / "test_report.pdf"

        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"PDF_FILE_CONTENT"
                mock_html.return_value = mock_html_instance

                saved_path = PDFRenderer.render_and_save(valid_report_vm, output_path)

                assert saved_path == output_path
                assert output_path.exists()
                assert output_path.read_bytes() == b"PDF_FILE_CONTENT"
                # Check that parent directories were created
                assert output_path.parent.exists()

    def test_render_and_save_creates_directory(self, valid_report_vm, tmp_path):
        """Test that render_and_save creates output directory if needed."""
        output_path = tmp_path / "nonexistent" / "deeply" / "nested" / "report.pdf"

        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"CONTENT"
                mock_html.return_value = mock_html_instance

                saved_path = PDFRenderer.render_and_save(valid_report_vm, output_path)

                assert saved_path.exists()
                assert saved_path.parent.exists()

    def test_get_template_preview(self, valid_report_vm):
        """Test HTML preview without PDF generation."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            expected_html = "<html><body>Preview HTML</body></html>"
            mock_t.render.return_value = expected_html
            mock_template.return_value = mock_t

            html_preview = PDFRenderer.get_template_preview(valid_report_vm)

            assert html_preview == expected_html
            # Verify render was called with correct data
            mock_t.render.assert_called_once()

    def test_template_receives_all_data(self, valid_report_vm):
        """Test that all report data is passed to template."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"PDF"
                mock_html.return_value = mock_html_instance

                PDFRenderer.render_dossier_to_pdf(valid_report_vm)

                # Verify template was called with all data as kwargs
                call_kwargs = mock_t.render.call_args[1]
                for key, value in valid_report_vm.items():
                    assert key in call_kwargs
                    assert call_kwargs[key] == value

    def test_weasyprint_import_error(self, valid_report_vm):
        """Test handling of missing WeasyPrint dependency."""
        with patch.dict("sys.modules", {"weasyprint": None}):
            with pytest.raises(ImportError, match="WeasyPrint is required"):
                PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_template_not_found_error(self, valid_report_vm):
        """Test handling of missing template file."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            from jinja2 import TemplateNotFound

            mock_template.side_effect = TemplateNotFound("dossier_template.html")

            with pytest.raises(TemplateNotFound):
                PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_rendering_exception_handling(self, valid_report_vm):
        """Test exception handling during rendering."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.side_effect = RuntimeError("Template rendering failed")
            mock_template.return_value = mock_t

            with pytest.raises(RuntimeError, match="Template rendering failed"):
                PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_pdf_generation_exception_handling(self, valid_report_vm):
        """Test exception handling during PDF generation."""
        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html.side_effect = RuntimeError("PDF generation failed")

                with pytest.raises(RuntimeError, match="PDF generation failed"):
                    PDFRenderer.render_dossier_to_pdf(valid_report_vm)

    def test_batch_rendering_scenario(self, valid_report_vm):
        """Test rendering multiple reports (batch scenario)."""
        reports = [valid_report_vm, valid_report_vm.copy(), valid_report_vm.copy()]
        reports[1]["event_id"] = "EVT-002"
        reports[2]["event_id"] = "EVT-003"

        with patch("app.adapters.pdf_renderer.jinja_env.get_template") as mock_template:
            mock_t = MagicMock()
            mock_t.render.return_value = "<html><body>Test</body></html>"
            mock_template.return_value = mock_t

            with patch("app.adapters.pdf_renderer.HTML") as mock_html:
                mock_html_instance = MagicMock()
                mock_html_instance.write_pdf.return_value = b"PDF_DATA"
                mock_html.return_value = mock_html_instance

                results = []
                for report in reports:
                    pdf = PDFRenderer.render_dossier_to_pdf(report)
                    results.append(pdf)

                assert len(results) == 3
                assert all(r == b"PDF_DATA" for r in results)
