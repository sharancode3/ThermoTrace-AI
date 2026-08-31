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
            "classification": "IND_FLARE",
            "anomaly_tier": "CRITICAL",
            "confidence": 0.92,
            "frp_peak_mw": 250.5,
            "frp_mean_mw": 180.3,
            "frp_aggregate_mw": 5420.8,
            "max_brightness_temp_k": 1250,
            "observation_count": 8,
            "first_detection_utc": "2024-01-15T14:22:30Z",
            "latest_detection_utc": "2024-01-15T14:32:45Z",
            "latitude": 22.35,
            "longitude": 69.85,
            "land_use": "Industrial",
            "area_hectares": 45.2,
            "facility_name": "Reliance Jamnagar Super Refinery",
            "facility_district": "Jamnagar",
            "facility_lat": 22.35,
            "facility_lon": 69.85,
            "distance_to_facility_km": 0.5,
            "baseline_mean_frp_mw": 120.0,
            "baseline_std_dev_frp": 45.0,
            "baseline_median_frp": 110.0,
            "baseline_q95_frp": 210.0,
            "baseline_sample_count": 156,
            "anomaly_observed_frp": 250.5,
            "anomaly_z_score": 2.89,
            "anomaly_percentile": 94.5,
            "anomaly_severity": "CRITICAL",
            "ml_model_name": "ThermoNet_v2.1",
            "ml_model_version": "2.1.0",
            "ml_accuracy": 0.96,
            "feature_importance_1": ("frp_peak", 0.34),
            "feature_importance_2": ("brightness_temp", 0.28),
            "feature_importance_3": ("temporal_pattern", 0.18),
            "lifecycle_status": "ACTIVE",
            "data_quality_score": 0.87,
        }

    @pytest.fixture
    def minimal_report_vm(self):
        """Minimal report with only required fields."""
        return {
            "event_id": "EVT-TEST-001",
            "classification": "IND_ROUTINE",
            "anomaly_tier": "NORMAL",
        }

    def test_render_with_valid_data(self, valid_report_vm):
        """Test PDF rendering with complete valid data produces a valid PDF binary."""
        pdf_bytes = PDFRenderer.render_dossier_to_pdf(valid_report_vm)
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")
        assert len(pdf_bytes) > 500

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
        pdf_bytes = PDFRenderer.render_dossier_to_pdf(minimal_report_vm)
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")
