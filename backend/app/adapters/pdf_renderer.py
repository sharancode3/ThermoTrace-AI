"""ReportLab renderer for adaptive thermal intelligence dossiers."""
import io
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class PDFRenderer:
    """Render profile-aware thermal event dossiers without changing source data."""

    @staticmethod
    def _safe_get(data: Dict[str, Any], key: str, default: Any = None) -> Any:
        """Read an optional view-model value without treating falsey values as missing."""
        value = data.get(key)
        return default if value is None else value

    @staticmethod
    def _safe_text(value: Any, fallback: str = "Not available") -> str:
        if value is None:
            return fallback
        text = str(value).strip()
        return text or fallback

    @staticmethod
    def _safe_number(value: Any, decimals: int = 2, suffix: str = "") -> str:
        try:
            return f"{float(value):.{decimals}f}{suffix}"
        except (TypeError, ValueError):
            return "Not available"

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _format_number(value: Any, decimals: int = 2, suffix: str = "") -> str:
        if value is None:
            return "Not available"
        try:
            return f"{float(value):.{decimals}f}{suffix}"
        except (TypeError, ValueError):
            return "Not available"

    @staticmethod
    def _format_pct(value: Any) -> str:
        if value is None:
            return "Not available"
        try:
            return f"{float(value):.1f}%"
        except (TypeError, ValueError):
            return "Not available"

    @staticmethod
    def _severity_color(tier: Any, colors: Any) -> Any:
        mapping = {
            "NORMAL": colors.HexColor("#15803D"),
            "NOMINAL": colors.HexColor("#15803D"),
            "ELEVATED": colors.HexColor("#D97706"),
            "ABNORMAL": colors.HexColor("#EA580C"),
            "CRITICAL": colors.HexColor("#DC2626"),
        }
        return mapping.get((tier or "NORMAL").upper(), colors.HexColor("#475569"))

    @staticmethod
    def _append_section(
        story: list,
        heading: str,
        heading_style: Any,
        content_flowables: Any,
        spacing_before: int = 10,
        spacing_after: int = 14,
    ) -> None:
        """Keep a small/medium report section with its heading when possible."""
        from reportlab.platypus import KeepTogether, Paragraph, Spacer

        section = []
        if spacing_before:
            section.append(Spacer(1, spacing_before))
        section.append(Paragraph(heading, heading_style))
        section.append(Spacer(1, 6))
        if not isinstance(content_flowables, list):
            content_flowables = [content_flowables]
        section.extend(content_flowables)
        story.append(KeepTogether(section))
        if spacing_after:
            story.append(Spacer(1, spacing_after))

    @staticmethod
    def _draw_page_chrome(canvas: Any, doc: Any, event_id: str, generated_at: str) -> None:
        """Draw the persistent report identity and pagination outside the story."""
        from reportlab.lib.colors import HexColor

        canvas.saveState()
        width, height = doc.pagesize
        navy, grey, light = HexColor("#0F172A"), HexColor("#64748B"), HexColor("#CBD5E1")
        canvas.setStrokeColor(light)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, height - 28, width - doc.rightMargin, height - 28)
        canvas.setFillColor(navy)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.drawString(doc.leftMargin, height - 21, "THERMOTRACE AI")
        canvas.setFillColor(grey)
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(width - doc.rightMargin, height - 21, f"{event_id}  •  {generated_at[:19]}")
        canvas.setStrokeColor(light)
        canvas.line(doc.leftMargin, 28, width - doc.rightMargin, 28)
        canvas.setFillColor(grey)
        canvas.drawString(doc.leftMargin, 18, "ThermoTrace AI Intelligence Report")
        canvas.drawRightString(width - doc.rightMargin, 18, f"Page {doc.page}")
        canvas.restoreState()

    @staticmethod
    def _build_line_chart(
        values: list,
        labels: Optional[list] = None,
        width: int = 500,
        height: int = 220,
        y_title: str = "Value",
    ) -> Any:
        """Create a compact line chart when at least three numeric values exist."""
        if not values or len(values) < 3:
            return None

        try:
            numeric_values = [float(value) for value in values]
        except (TypeError, ValueError):
            return None

        from reportlab.graphics.charts.linecharts import HorizontalLineChart
        from reportlab.graphics.shapes import Drawing, Rect, String
        from reportlab.lib.colors import HexColor

        navy = HexColor("#0F172A")
        orange = HexColor("#F25C05")
        muted = HexColor("#64748B")
        light = HexColor("#F8FAFC")
        border = HexColor("#CBD5E1")
        drawing = Drawing(width, height)
        drawing.add(Rect(18, 18, width - 36, height - 36, rx=4, ry=4, fillColor=light, strokeColor=border, strokeWidth=0.7))
        chart = HorizontalLineChart()
        chart.x = 62
        chart.y = 50
        chart.height = height - 95
        chart.width = width - 100
        chart.data = [numeric_values]
        chart.lines[0].strokeColor = orange
        chart.lines[0].strokeWidth = 2.5
        chart.valueAxis.strokeColor = navy
        chart.categoryAxis.strokeColor = navy
        chart.valueAxis.valueMin = 0
        max_value = max(numeric_values) or 1
        chart.valueAxis.valueMax = max_value * 1.15
        chart.valueAxis.valueStep = max(max_value / 5, 1)
        chart.categoryAxis.categoryNames = labels or [str(index + 1) for index in range(len(numeric_values))]
        chart.categoryAxis.labels.fontSize = 7
        chart.valueAxis.labels.fontSize = 7
        chart.categoryAxis.labels.fontName = "Helvetica"
        chart.valueAxis.labels.fontName = "Helvetica"
        chart.categoryAxis.labels.fillColor = muted
        chart.valueAxis.labels.fillColor = muted
        drawing.add(String(62, height - 28, y_title, fontName="Helvetica-Bold", fontSize=7.5, fillColor=navy))
        drawing.add(chart)
        return drawing

    @staticmethod
    def _build_bar_chart(
        labels: list,
        values: list,
        width: int = 500,
        height: int = 220,
        y_title: str = "Number of Observations",
    ) -> Any:
        """Create a compact bar chart when labels and numeric values align."""
        if not values or not labels or len(values) != len(labels):
            return None

        try:
            numeric_values = [float(value) for value in values]
        except (TypeError, ValueError):
            return None

        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.shapes import Drawing, Rect, String
        from reportlab.lib.colors import HexColor

        navy = HexColor("#0F172A")
        orange = HexColor("#F25C05")
        muted = HexColor("#64748B")
        light = HexColor("#F8FAFC")
        border = HexColor("#CBD5E1")
        drawing = Drawing(width, height)
        drawing.add(Rect(18, 18, width - 36, height - 36, rx=4, ry=4, fillColor=light, strokeColor=border, strokeWidth=0.7))
        chart = VerticalBarChart()
        chart.x = 62
        chart.y = 48
        chart.height = height - 92
        chart.width = width - 100
        is_day_night = labels == ["Day", "Night"]
        chart.data = [[numeric_values[0], 0], [0, numeric_values[1]]] if is_day_night else [numeric_values]
        chart.categoryAxis.categoryNames = [str(label) for label in labels]
        chart.categoryAxis.labels.fontSize = 7
        chart.valueAxis.labels.fontSize = 7
        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueMax = max(max(numeric_values) * 1.2, 1)
        chart.valueAxis.strokeColor = navy
        chart.categoryAxis.strokeColor = navy
        chart.categoryAxis.labels.fillColor = muted
        chart.valueAxis.labels.fillColor = muted
        if is_day_night:
            chart.bars[0].fillColor = orange
            chart.bars[0].strokeColor = orange
            chart.bars[1].fillColor = navy
            chart.bars[1].strokeColor = navy
        else:
            chart.bars[0].fillColor = orange
            chart.bars[0].strokeColor = orange
        if is_day_night and hasattr(chart, "barLabels"):
            chart.barLabels.nudge = 6
            chart.barLabels.fontName = "Helvetica-Bold"
            chart.barLabels.fontSize = 8
            chart.barLabels.fillColor = navy
            chart.barLabelFormat = "%d"
        drawing.add(String(62, height - 28, y_title, fontName="Helvetica-Bold", fontSize=7.5, fillColor=navy))
        drawing.add(chart)
        return drawing

    @staticmethod
    def _build_chart_insight_box(text: str, doc: Any) -> Any:
        """Build a small, consistent explanation card for an optional chart."""
        from reportlab.lib.colors import HexColor
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import Paragraph, Table, TableStyle

        style = ParagraphStyle(
            "ChartInsight", fontName="Helvetica", fontSize=7.5, leading=9,
            textColor=HexColor("#0F172A"),
        )
        box = Table([[Paragraph(text, style)]], colWidths=[doc.width * 0.92])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#FFF3E8")),
            ("BOX", (0, 0), (-1, -1), 0.6, HexColor("#F25C05")),
            ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return box

    @staticmethod
    def _chart_dimensions(point_count: int) -> tuple[int, int]:
        if point_count <= 5:
            return 500, 175
        if point_count <= 12:
            return 500, 190
        return 500, 210

    @staticmethod
    def _append_chart_section(
        story: list,
        heading: str,
        chart: Any,
        insight_box: Optional[Any] = None,
        heading_style: Optional[Any] = None,
        description: Optional[str] = None,
        description_style: Optional[Any] = None,
        spacing_before: int = 8,
        spacing_after: int = 10,
    ) -> None:
        """Append a chart without forcing the entire visual block onto one page."""
        if not chart:
            return
        from reportlab.platypus import Paragraph, Spacer

        if spacing_before:
            story.append(Spacer(1, spacing_before))
        if heading_style is not None:
            heading_style.keepWithNext = True
        story.append(Paragraph(heading, heading_style))
        if description and description_style is not None:
            description_style.keepWithNext = True
            story.append(Paragraph(description, description_style))
        story.extend([Spacer(1, 4), chart])
        if insight_box is not None:
            story.extend([Spacer(1, 5), insight_box])
        if spacing_after:
            story.append(Spacer(1, spacing_after))

    @staticmethod
    def _select_report_charts(report_view_model: Dict[str, Any]) -> list:
        """Select no more than three charts supported by report evidence."""
        charts = []
        observations = (report_view_model.get("event_observation_history") or [])[-50:]
        historical_events = (report_view_model.get("historical_events") or [])[-20:]

        def numeric_values(items: list, field: str) -> list:
            values = []
            for item in items:
                if not isinstance(item, dict) or item.get(field) is None:
                    continue
                try:
                    values.append(float(item[field]))
                except (TypeError, ValueError):
                    continue
            return values

        frp_points = [
            item for item in observations
            if isinstance(item, dict) and item.get("frp_mw") is not None
            and PDFRenderer._safe_number(item.get("frp_mw")) != "Not available"
        ]
        frp_values = numeric_values(frp_points, "frp_mw")
        historical_frp = numeric_values(historical_events, "peak_frp_mw")

        def short_time_label(timestamp: Any) -> str:
            if not timestamp:
                return ""
            try:
                return datetime.fromisoformat(str(timestamp).replace("Z", "+00:00")).strftime("%d %b\n%H:%M")
            except (TypeError, ValueError):
                return ""

        frp_labels = [short_time_label(item.get("timestamp")) for item in frp_points]
        if len(frp_labels) > 8:
            step = max(len(frp_labels) // 6, 1)
            frp_labels = [
                label if index in (0, len(frp_labels) - 1) or index % step == 0 else ""
                for index, label in enumerate(frp_labels)
            ]

        if len(frp_values) >= 3:
            try:
                chart_width, chart_height = PDFRenderer._chart_dimensions(len(frp_values))
                chart = PDFRenderer._build_line_chart(frp_values, labels=frp_labels, width=chart_width, height=chart_height, y_title="FRP (MW)")
            except Exception:
                logger.warning("Current-event chart unavailable", exc_info=True)
                chart = None
            if chart:
                evolution = report_view_model.get("earlier_vs_now") or {}
                trend = str(evolution.get("trend", "UNKNOWN")).title()
                change = evolution.get("frp_change_percent")
                insight = (
                    f"<b>Trend:</b> {trend} ({PDFRenderer._safe_float(change):+.1f}% from first to latest observation window)."
                    if change is not None else f"<b>Trend:</b> {trend}."
                )
                charts.append((
                    "FRP Evolution", chart, insight,
                    "Shows how the event's Fire Radiative Power (FRP) changes across successive satellite observations. FRP, measured in megawatts (MW), indicates the intensity of detected thermal activity.",
                ))

        if len(historical_frp) >= 3:
            try:
                chart_width, chart_height = PDFRenderer._chart_dimensions(len(historical_frp))
                chart = PDFRenderer._build_line_chart(
                    historical_frp,
                    width=chart_width,
                    height=chart_height,
                    y_title="Peak FRP (MW)",
                )
            except Exception:
                logger.warning("Historical chart unavailable", exc_info=True)
                chart = None
            if chart:
                charts.append(("Historical Peak FRP", chart, None, "Shows peak Fire Radiative Power across comparable prior thermal events."))

        count_7d = int(PDFRenderer._safe_float(report_view_model.get("history_event_count_7d")))
        count_30d = int(PDFRenderer._safe_float(report_view_model.get("history_event_count_30d")))
        count_90d = int(PDFRenderer._safe_float(report_view_model.get("history_event_count_90d")))
        if count_90d >= 3:
            try:
                chart = PDFRenderer._build_bar_chart(
                    ["Last 7d", "8-30d", "31-90d"],
                    [
                        count_7d,
                        max(count_30d - count_7d, 0),
                        max(count_90d - count_30d, 0),
                    ],
                    width=500,
                    height=175,
                    y_title="Event Count",
                )
            except Exception:
                logger.warning("Recurrence chart unavailable", exc_info=True)
                chart = None
            if chart:
                charts.append(("Thermal Event Recurrence", chart, None, "Shows the distribution of comparable thermal events across the selected historical window."))

        day_count = int(PDFRenderer._safe_float(report_view_model.get("day_observation_count")))
        night_count = int(PDFRenderer._safe_float(report_view_model.get("night_observation_count")))
        if day_count + night_count >= 4:
            try:
                chart = PDFRenderer._build_bar_chart(
                    ["Day", "Night"],
                    [day_count, night_count],
                    width=500,
                    height=160,
                    y_title="Number of Observations",
                )
            except Exception:
                logger.warning("Day/night chart unavailable", exc_info=True)
                chart = None
            if chart:
                total = day_count + night_count
                day_pct = (day_count / total) * 100
                night_pct = (night_count / total) * 100
                if day_count > night_count:
                    insight = f"<b>Daytime-dominant observations:</b> {day_count} of {total} satellite observations ({day_pct:.0f}%) occurred during daytime."
                elif night_count > day_count:
                    insight = f"<b>Nighttime-dominant observations:</b> {night_count} of {total} satellite observations ({night_pct:.0f}%) occurred during nighttime."
                else:
                    insight = f"<b>Balanced observation timing:</b> {day_count} daytime and {night_count} nighttime observations were recorded."
                charts.append((
                    "Satellite Observations by Time of Day", chart, insight,
                    "Shows how many satellite observations of this thermal event were recorded during daytime versus nighttime passes. This describes observation timing, not necessarily when the thermal source was active.",
                ))

        return charts[:3]

    @staticmethod
    def _build_profile_insights(report_view_model: Dict[str, Any]) -> list:
        """Return evidence-grounded observations tailored to the report profile."""
        profile = report_view_model.get("report_profile") or "GENERAL"
        classification = report_view_model.get("classification") or "UNKNOWN"
        confidence_pct = report_view_model.get("ml_confidence_pct")
        if confidence_pct is None:
            confidence_pct = PDFRenderer._safe_float(
                report_view_model.get("classification_confidence")
            ) * 100
        confidence_pct = PDFRenderer._safe_float(confidence_pct)
        land_use = report_view_model.get("primary_land_use") or report_view_model.get("land_use") or "unknown land cover"
        peak_frp = PDFRenderer._safe_float(report_view_model.get("peak_frp_mw") or report_view_model.get("frp_peak_mw"))
        history_90d = int(PDFRenderer._safe_float(report_view_model.get("history_event_count_90d")))
        night_ratio = report_view_model.get("night_ratio")
        earlier_vs_now = report_view_model.get("earlier_vs_now") or {}
        trend = earlier_vs_now.get("trend") or "UNKNOWN"
        change_pct = earlier_vs_now.get("frp_change_percent")
        has_facility = bool(report_view_model.get("associated_facility_uuid") or report_view_model.get("facility_uuid"))
        insights = []

        if profile == "INDUSTRIAL":
            facility = report_view_model.get("facility_name") or "the linked industrial facility"
            sector = report_view_model.get("facility_sector_category") or "industrial"
            insights.append(f"The thermal event is associated with {facility}, classified under the {sector} sector.")
            if history_90d >= 3:
                insights.append(f"The facility/location recorded {history_90d} related thermal events during the previous 90 days, indicating recurrent activity.")
            baseline = report_view_model.get("anomaly_baseline_mean_frp_mw") or report_view_model.get("baseline_mean_frp_mw")
            baseline_value = PDFRenderer._safe_float(baseline)
            if baseline_value > 0:
                ratio = peak_frp / baseline_value
                if ratio >= 2:
                    insights.append(f"Current peak FRP is {ratio:.1f}× the available historical baseline, indicating substantially elevated thermal output.")
                elif ratio >= 1.2:
                    insights.append(f"Current thermal output is moderately above the historical baseline ({ratio:.1f}×).")
                else:
                    insights.append("Current peak FRP remains broadly consistent with historical facility thermal behavior.")
            if night_ratio is not None and PDFRenderer._safe_float(night_ratio) >= 0.6:
                insights.append(f"{PDFRenderer._safe_float(night_ratio) * 100:.0f}% of observations occurred at night, suggesting persistent or continuous thermal activity.")
        elif profile == "AGRICULTURAL":
            insights.append(f"The event occurs over {land_use}, so this assessment emphasizes burn recurrence, timing, and short-term thermal evolution rather than industrial facility behavior.")
            insights.append(
                f"{history_90d} related thermal event(s) were identified in the previous 90 days."
                if history_90d else "No related thermal events were identified within the previous 90-day comparison window."
            )
            if night_ratio is not None:
                if PDFRenderer._safe_float(night_ratio) < 0.25:
                    insights.append("Observed activity is predominantly daytime, consistent with a short-duration surface burn pattern.")
                elif PDFRenderer._safe_float(night_ratio) > 0.6:
                    insights.append("A large share of observations occurred at night; prolonged persistence should be reviewed before assuming routine agricultural burning.")
            if change_pct is not None:
                change = PDFRenderer._safe_float(change_pct)
                if change >= 50:
                    insights.append(f"FRP increased by {change:.1f}% during the observed event window, indicating rapid strengthening.")
                elif change <= -50:
                    insights.append(f"FRP decreased by {abs(change):.1f}% during the observed event window, suggesting rapid decay.")
        elif profile == "WILDLAND":
            insights.append(f"The event is located over {land_use}; persistence, FRP evolution, and repeated satellite observations are more operationally relevant than facility context.")
            observations = int(PDFRenderer._safe_float(report_view_model.get("observation_count")))
            if observations >= 5:
                insights.append(f"The event was observed {observations} times, indicating sustained thermal persistence across multiple detections.")
            if trend == "INCREASING":
                insights.append("Thermal output is increasing across the observation window, suggesting active intensification.")
            elif trend == "DECREASING":
                insights.append("Thermal output is decreasing across the observation window, suggesting weakening activity.")
        elif profile == "URBAN":
            insights.append(f"The event occurs within {land_use}; interpretation should consider dense built-up infrastructure, non-industrial heat sources, and nearby anthropogenic activity.")
            if not has_facility:
                insights.append("No verified industrial facility is linked to the event, so an industrial source should not be assumed from classification alone.")
        elif profile == "INDUSTRIAL_UNVERIFIED":
            insights.extend([
                f"The ML classifier predicts {classification} with {confidence_pct:.1f}% confidence, but no verified industrial facility association is available.",
                f"Mapped land use is {land_use}; this should be considered when interpreting the industrial classification.",
                "This is an unverified industrial assessment rather than confirmation of an industrial source.",
            ])
        else:
            insights.append(f"The event is classified as {classification} with {confidence_pct:.1f}% confidence.")
            if history_90d:
                insights.append(f"{history_90d} related event(s) were identified in the previous 90 days.")
        percentile = report_view_model.get("current_vs_history_percentile")
        median_ratio = report_view_model.get("current_vs_historical_median_ratio")
        if percentile is not None:
            insights.append(
                f"Current peak FRP exceeds {PDFRenderer._safe_float(percentile):.0f}% of prior events in the selected historical comparison."
            )
        if median_ratio is not None and PDFRenderer._safe_float(median_ratio) >= 1.5:
            insights.append(
                f"Current peak FRP is {PDFRenderer._safe_float(median_ratio):.1f}× the historical median."
            )
        return insights[:5]

    @staticmethod
    def _build_follow_up_actions(report_view_model: Dict[str, Any]) -> list:
        """Return profile-specific verification steps, not operational directives."""
        profile = report_view_model.get("report_profile") or "GENERAL"
        actions_by_profile = {
            "INDUSTRIAL": ["Compare current FRP against the recent facility operating baseline.", "Review repeated activity across recent satellite passes.", "Verify whether activity is consistent with known facility operations."],
            "AGRICULTURAL": ["Check whether similar burns recur at the same location.", "Review persistence across the next available satellite pass.", "Compare event timing against recent agricultural burn activity nearby."],
            "WILDLAND": ["Monitor FRP progression across subsequent satellite detections.", "Review nearby thermal detections for possible spatial expansion.", "Check persistence through day/night observation cycles."],
            "URBAN": ["Check nearby infrastructure and known anthropogenic heat sources.", "Verify whether the event aligns with a registered industrial or utility site.", "Review repeated detections before assigning source attribution."],
            "INDUSTRIAL_UNVERIFIED": ["Verify nearby facility records before confirming industrial origin.", "Inspect land cover and high-resolution imagery around the event centroid.", "Monitor subsequent detections for persistence consistent with industrial activity."],
        }
        return actions_by_profile.get(profile, ["Review subsequent satellite observations.", "Compare with recent nearby thermal events.", "Verify source context before operational interpretation."])

    @staticmethod
    def _build_source_evidence(report_view_model: Dict[str, Any]) -> list:
        """Return class-specific source-attribution evidence labels for the dashboard."""
        classification = str(
            report_view_model.get("classification")
            or report_view_model.get("ml_predicted_class")
            or "OTHER_UNCERTAIN"
        ).upper()
        confidence = report_view_model.get("ml_confidence_pct")
        if confidence is None:
            confidence = PDFRenderer._safe_float(report_view_model.get("classification_confidence")) * 100
        confidence = PDFRenderer._safe_float(confidence)
        labels = [classification, f"{confidence:.1f}% CONFIDENCE"]
        if classification in {"IND_FIRE", "IND_FLARE", "IND_ROUTINE"}:
            labels.append("VERIFIED FACILITY MATCH" if report_view_model.get("associated_facility_uuid") or report_view_model.get("facility_uuid") else "FACILITY NOT VERIFIED")
        elif classification == "WILDFIRE":
            labels.append("WILDFIRE SOURCE ASSESSMENT")
        elif classification == "AGRI_BURN":
            labels.append("AGRICULTURAL BURN ASSESSMENT")
        elif classification == "OTHER_UNCERTAIN":
            labels.append("SOURCE NOT CONFIRMED")
        else:
            labels.append("SOURCE ATTRIBUTION UNRESOLVED")
        return labels

    @staticmethod
    def render_dossier_to_pdf(
        report_view_model: Dict[str, Any],
        filename: Optional[str] = None,
    ) -> bytes:
        required_fields = ("event_id", "classification", "anomaly_tier", "latitude", "longitude")
        missing_required = [
            field for field in required_fields if report_view_model.get(field) is None
        ]
        if missing_required:
            raise ValueError(
                "Missing required report fields: " + ", ".join(missing_required)
            )

        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.platypus import (
            HRFlowable,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        def value(*names: str, default: Any = None) -> Any:
            for name in names:
                candidate = report_view_model.get(name)
                if candidate is not None:
                    return candidate
            return default

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=28,
            leftMargin=28,
            topMargin=42,
            bottomMargin=40,
        )
        styles = getSampleStyleSheet()
        primary_color = colors.HexColor("#0F172A")
        accent_orange = colors.HexColor("#EA580C")
        subtext_color = colors.HexColor("#475569")
        bg_light = colors.HexColor("#F8FAFC")
        border_color = colors.HexColor("#CBD5E1")
        severity_color = PDFRenderer._severity_color(
            report_view_model.get("anomaly_tier"), colors
        )

        title_style = ParagraphStyle(
            "DocTitle", parent=styles["Heading1"], fontName="Helvetica-Bold",
            fontSize=18, leading=22, textColor=primary_color, spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            "DocSubtitle", parent=styles["Normal"], fontName="Helvetica",
            fontSize=9, leading=12, textColor=subtext_color, spaceAfter=12,
        )
        h2_style = ParagraphStyle(
            "H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
            fontSize=13, leading=15, textColor=primary_color, spaceBefore=0,
            spaceAfter=0,
        )
        h3_style = ParagraphStyle(
            "H3", parent=styles["Heading3"], fontName="Helvetica-Bold",
            fontSize=9.5, leading=12, textColor=colors.HexColor("#334155"),
            spaceBefore=4, spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "Body", parent=styles["Normal"], fontName="Helvetica", fontSize=8.7,
            leading=12.2, textColor=colors.HexColor("#334155"), spaceAfter=4,
        )
        chart_description_style = ParagraphStyle(
            "ChartDescription", parent=body_style, fontName="Helvetica",
            fontSize=7.5, leading=10, textColor=colors.HexColor("#64748B"),
            spaceAfter=6,
        )
        summary_style = ParagraphStyle(
            "Summary", parent=body_style, fontSize=9.2, leading=13,
        )
        badge_style = ParagraphStyle(
            "Badge", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=9, leading=11, textColor=colors.white,
        )

        event_id = value("event_id", default="UNKNOWN-EVENT")
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        anomaly_tier = value("anomaly_tier", default="NORMAL")
        classification = value("classification", default="OTHER_UNCERTAIN")
        report_profile = value("report_profile", default="GENERAL")
        report_sections = set(value("report_sections", default=[]))
        profile_titles = {
            "INDUSTRIAL": "INDUSTRIAL THERMAL INTELLIGENCE REPORT",
            "INDUSTRIAL_UNVERIFIED": "UNVERIFIED INDUSTRIAL THERMAL ASSESSMENT",
            "AGRICULTURAL": "AGRICULTURAL THERMAL ACTIVITY REPORT",
            "WILDLAND": "WILDLAND THERMAL EVENT REPORT",
            "URBAN": "URBAN THERMAL ANOMALY REPORT",
            "GENERAL": "THERMAL INTELLIGENCE REPORT",
        }
        profile_title = profile_titles.get(
            report_profile,
            "THERMAL INTELLIGENCE REPORT",
        )
        profile_section_titles = {
            "INDUSTRIAL": {"history": "Historical Facility Thermal Activity", "context": "Industrial Facility Context"},
            "AGRICULTURAL": {"history": "Local Burn Recurrence", "context": "Land-Cover & Agricultural Context"},
            "WILDLAND": {"history": "Historical Nearby Thermal Activity", "context": "Wildland Context"},
            "URBAN": {"history": "Historical Urban Thermal Activity", "context": "Urban Context"},
            "GENERAL": {"history": "Historical Thermal Activity", "context": "Location & Context"},
        }
        section_titles = profile_section_titles.get(
            report_profile, profile_section_titles["GENERAL"]
        )
        peak_frp = PDFRenderer._safe_float(value("peak_frp_mw", "frp_peak_mw"))
        mean_frp = PDFRenderer._safe_float(value("mean_frp_mw", "frp_mean_mw"))
        max_bright = PDFRenderer._safe_float(
            value("max_brightness_k", "max_brightness_temp_k")
        )
        lat = PDFRenderer._safe_float(value("latitude"))
        lon = PDFRenderer._safe_float(value("longitude"))
        obs_count = value("observation_count", default=1)
        first_det = value("first_detected_utc", "first_detection_utc", default="Not available")
        latest_det = value("latest_detected_utc", "latest_detection_utc", default="Not available")
        land_use = value("primary_land_use", "land_use", default="Unknown")
        facility_name = value("facility_name")
        has_facility = bool(value("associated_facility_uuid", "facility_uuid"))
        history_90d = int(PDFRenderer._safe_float(value("history_event_count_90d", default=0)))
        earlier_vs_now = value("earlier_vs_now", default={}) or {}
        trend = earlier_vs_now.get("trend", "UNKNOWN")
        confidence_pct = value("ml_confidence_pct")
        if confidence_pct is None:
            confidence_pct = PDFRenderer._safe_float(
                value("classification_confidence", "confidence")
            ) * 100
        confidence_pct = PDFRenderer._safe_float(confidence_pct)

        section_counter = {"value": 1}

        def numbered_heading(title: str) -> str:
            current = section_counter["value"]
            section_counter["value"] += 1
            return f"{current}. {title}"

        def styled_table(rows: list, widths: list, header: bool = True) -> Table:
            table = Table(
                rows,
                colWidths=widths,
                repeatRows=1 if header else 0,
                splitByRow=1,
            )
            style = [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.8),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.35, border_color),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
            if header:
                style.extend([
                    ("BACKGROUND", (0, 0), (-1, 0), primary_color),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, bg_light]),
                ])
            table.setStyle(TableStyle(style))
            return table

        def context_table(rows: list) -> Table:
            table = styled_table(rows, [doc.width * 0.41, doc.width * 0.59], header=False)
            table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, 0), (0, -1), bg_light),
            ]))
            return table

        story = []
        header_data = [
            [
                Paragraph(
                    "<b>THERMOTRACE AI</b><br/>"
                    f"<font size='10'>{profile_title}</font>",
                    title_style,
                ),
                Paragraph(f"<b>SEVERITY:</b> {anomaly_tier}", badge_style),
            ],
            [
                Paragraph(
                    "National Technical Research Organisation (NTRO) &#8226; "
                    f"Generated: {generated_at}",
                    subtitle_style,
                ),
                Paragraph(f"EVENT REF: <b>{event_id}</b>", body_style),
            ],
        ]
        header_table = Table(header_data, colWidths=[400, 140])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("BACKGROUND", (1, 0), (1, 0), severity_color),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.extend([
            header_table,
            HRFlowable(width="100%", thickness=1.5, color=accent_orange,
                       spaceBefore=4, spaceAfter=12),
        ])

        summary_parts = [
            f"Thermal event <b>{event_id}</b> is classified as <b>{classification}</b> with ",
            f"<b>{confidence_pct:.1f}% confidence</b> and anomaly severity <b>{anomaly_tier}</b>.",
            f"Peak radiative output reached <b>{peak_frp:.2f} MW</b> across ",
            f"<b>{obs_count}</b> satellite observation(s).",
        ]
        if facility_name:
            summary_parts.append(f"The event is associated with <b>{facility_name}</b>.")
        else:
            summary_parts.append(
                "No verified industrial facility is directly associated with the event; "
                f"mapped land use is <b>{land_use}</b>."
            )
        if history_90d:
            summary_parts.append(
                f"The location recorded <b>{history_90d}</b> related thermal event(s) "
                "during the previous 90 days."
            )
        if trend != "UNKNOWN":
            summary_parts.append(f"Within-event thermal evolution is <b>{trend.lower()}</b>.")
        summary_table = Table([[Paragraph(" ".join(summary_parts), summary_style)]], [doc.width])
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg_light),
            ("BOX", (0, 0), (-1, -1), 0.75, border_color),
            ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        kpi_data = [[
            Paragraph(f"<b>{peak_frp:.1f}</b><br/><font size='7'>MW Peak FRP</font>", body_style),
            Paragraph(f"<b>{obs_count}</b><br/><font size='7'>Observations</font>", body_style),
            Paragraph(f"<b>{confidence_pct:.1f}%</b><br/><font size='7'>Model Confidence</font>", body_style),
            Paragraph(f"<b>{anomaly_tier}</b><br/><font size='7'>Anomaly Tier</font>", body_style),
        ]]
        kpi_table = Table(kpi_data, colWidths=[doc.width / 4] * 4)
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.75, border_color),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ]))
        PDFRenderer._append_section(
            story,
            numbered_heading("Executive Summary & Assessment"),
            h2_style,
            [summary_table, Spacer(1, 10), kpi_table],
        )

        baseline_mean = value("anomaly_baseline_mean_frp_mw", "baseline_mean_frp_mw")
        baseline_median = value("baseline_median_frp_mw", "baseline_median_frp")
        baseline_mean_number = PDFRenderer._safe_float(baseline_mean, default=0.0)
        peak_ratio = peak_frp / baseline_mean_number if baseline_mean_number else None
        has_sufficient_baseline = bool(value("baseline_is_statistically_sufficient"))
        telemetry_data = [
            ["Metric", "Current", "Historical Context", "Assessment"],
            ["Peak FRP", f"{peak_frp:.2f} MW",
             f"{baseline_mean_number:.2f} MW mean" if has_sufficient_baseline else "Baseline unavailable",
             f"{peak_ratio:.1f}x baseline" if has_sufficient_baseline and peak_ratio is not None else anomaly_tier],
            ["Mean FRP", f"{mean_frp:.2f} MW",
             PDFRenderer._format_number(baseline_median, 2, " MW median") if has_sufficient_baseline and baseline_median is not None else "",
             anomaly_tier],
            ["Max Brightness", f"{max_bright:.1f} K", "Satellite observed", "Measured"],
            ["Observations", str(obs_count),
             f"{history_90d} events / 90d" if history_90d else "No prior events",
             value("persistence_tier", default="No persistence assessment")],
        ]
        why_reasons = []
        if peak_ratio is not None and peak_ratio >= 2:
            why_reasons.append(f"Peak FRP is {peak_ratio:.1f}× the available baseline.")
        change_pct = earlier_vs_now.get("frp_change_percent")
        if change_pct is not None and abs(PDFRenderer._safe_float(change_pct)) >= 25:
            direction = "increased" if PDFRenderer._safe_float(change_pct) > 0 else "decreased"
            why_reasons.append(f"Thermal output {direction} by {abs(PDFRenderer._safe_float(change_pct)):.1f}% during the observed event window.")
        if history_90d >= 3:
            why_reasons.append(f"{history_90d} related events were identified in the prior 90 days.")
        if anomaly_tier.upper() in {"ABNORMAL", "CRITICAL"} and why_reasons:
            why_box = Table([[Paragraph("<b>Why this matters</b><br/>" + "<br/>".join(f"• {reason}" for reason in why_reasons[:3]), body_style)]], [doc.width])
            why_box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
                ("BOX", (0, 0), (-1, -1), 0.8, severity_color),
                ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]))
            story.extend([why_box, Spacer(1, 10)])

        PDFRenderer._append_section(
            story,
            numbered_heading("Verified Satellite Radiometric Metrics"),
            h2_style,
            styled_table(telemetry_data, [145, 125, 150, 120]),
        )

        degree = "\N{DEGREE SIGN}"
        location_rows = [["Coordinates", f"{lat:.5f}{degree}N, {lon:.5f}{degree}E"],
                         ["Primary Land Use", str(land_use)]]
        if has_facility:
            distance = value("distance_to_facility_m")
            location_rows.extend([
                ["Facility", str(value("facility_name", default="Not available"))],
                ["Sector", str(value("facility_sector_category", default="Not available"))],
                ["Facility Type", str(value("facility_sub_type", default="Not available"))],
                ["Operator", str(value("facility_operator_name", default="Not available"))],
                ["State / District", f"{value('facility_state', default='-') or '-'} / {value('facility_district', default='-') or '-'}"],
            ])
            if distance is not None:
                location_rows.append(
                    ["Distance to Facility", f"{PDFRenderer._safe_float(distance) / 1000:.2f} km"]
                )
        else:
            location_rows.append(["Verified Facility Match", "None"])
        location_table = Table(location_rows, colWidths=[doc.width / 3, doc.width * 2 / 3])
        location_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 0), (0, -1), bg_light),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        PDFRenderer._append_section(
            story,
            numbered_heading(section_titles["context"]),
            h2_style,
            location_table,
        )

        nearby_facilities = value("nearby_facilities", default=[]) or []
        facility_search_radius_km = value("facility_search_radius_km")
        radius_text = (
            f"{PDFRenderer._safe_float(facility_search_radius_km):.0f} km"
            if facility_search_radius_km is not None else "the configured search radius"
        )
        nearby_content = [
            Paragraph(
                f"Registered industrial facilities identified within a {radius_text} search radius, "
                "ordered by distance from the thermal-event centroid.",
                body_style,
            ),
            Spacer(1, 6),
        ]
        if nearby_facilities:
            nearby_rows = [["Facility", "Sector / Type", "Distance"]]
            for facility in nearby_facilities[:5]:
                if not isinstance(facility, dict):
                    continue
                distance_m = facility.get("distance_m")
                distance_text = (
                    f"{PDFRenderer._safe_float(distance_m) / 1000:.1f} km"
                    if distance_m is not None else "Not available"
                )
                sector = PDFRenderer._safe_text(facility.get("sector"), "Unknown")
                subtype = PDFRenderer._safe_text(facility.get("sub_type"), "")
                nearby_rows.append([
                    PDFRenderer._safe_text(facility.get("name"), "Unnamed facility"),
                    f"{sector} / {subtype}" if subtype else sector,
                    distance_text,
                ])
            if len(nearby_rows) > 1:
                nearby_content.append(styled_table(
                    nearby_rows,
                    [doc.width * 0.45, doc.width * 0.37, doc.width * 0.18],
                ))
        else:
            nearby_content.append(Paragraph(
                f"No registered active industrial facilities were identified within the {radius_text} search radius.",
                body_style,
            ))
        nearby_content.append(Spacer(1, 5))
        nearby_content.append(Paragraph(
            "<b>Context note:</b> Proximity indicates geographic context only and does not confirm the source of the thermal event.",
            body_style,
        ))
        PDFRenderer._append_section(
            story,
            numbered_heading("Nearby Industrial Facilities"),
            h2_style,
            nearby_content,
        )

        if report_profile == "INDUSTRIAL" and has_facility:
            facility_rows = [
                ["Facility", value("facility_name", default="Unknown")],
                ["Sector", value("facility_sector_category", default="Unknown")],
                ["Type", value("facility_sub_type", default="Unknown")],
                ["Operator", value("facility_operator_name", default="Unknown")],
            ]
            historical_count = value("facility_historical_event_count")
            if historical_count is not None:
                facility_rows.append(["Recorded historical events", str(historical_count)])
            PDFRenderer._append_section(
                story, numbered_heading("Facility Comparison Context"), h2_style,
                context_table(facility_rows),
            )
        elif report_profile == "AGRICULTURAL":
            agricultural_rows = [
                ["Land cover", str(land_use)],
                ["Events in prior 30 days", str(value("history_event_count_30d", default=0) or 0)],
                ["Events in prior 90 days", str(history_90d)],
                ["Night observation ratio", f"{PDFRenderer._safe_float(value('night_ratio')) * 100:.1f}%" if value("night_ratio") is not None else "Insufficient evidence"],
            ]
            PDFRenderer._append_section(
                story, numbered_heading("Agricultural Burn Context"), h2_style,
                context_table(agricultural_rows),
            )
        elif report_profile == "WILDLAND":
            persistence_rows = [
                ["Observation count", str(obs_count)],
                ["Persistence tier", value("persistence_tier", default="Unknown")],
                ["Current FRP trend", str(trend)],
                ["Peak FRP", f"{peak_frp:.2f} MW"],
            ]
            PDFRenderer._append_section(
                story, numbered_heading("Thermal Persistence & Evolution"), h2_style,
                context_table(persistence_rows),
            )

        history_scope = value("history_scope")
        history_window = value("history_window_days")
        history_radius = value("history_radius_m")
        if history_scope == "SAME_FACILITY":
            comparison_text = (
                f"Historical comparison uses prior events associated with the same verified "
                f"facility during the previous {history_window} days."
            )
        elif history_scope == "NEARBY_LOCATION" and history_radius is not None:
            comparison_text = (
                f"Historical comparison uses prior thermal events within "
                f"{PDFRenderer._safe_float(history_radius) / 1000:.1f} km of the current "
                f"event during the previous {history_window} days."
            )
        else:
            comparison_text = "Historical comparison basis is not available."

        if history_90d > 0:
            history_rows = [
                ["Historical Measure", "Value"],
                ["Events in previous 7 days", str(value("history_event_count_7d", default=0))],
                ["Events in previous 30 days", str(value("history_event_count_30d", default=0))],
                ["Events in previous 90 days", str(history_90d)],
            ]
            mean_history = value("history_mean_peak_frp_mw")
            median_history = value("history_median_peak_frp_mw")
            maximum_history = value("history_max_peak_frp_mw")
            if mean_history is not None:
                history_rows.append(["Historical mean Peak FRP", PDFRenderer._format_number(mean_history, 2, " MW")])
            if median_history is not None:
                history_rows.append(["Historical median Peak FRP", PDFRenderer._format_number(median_history, 2, " MW")])
            if maximum_history is not None:
                history_rows.append(["Historical maximum Peak FRP", PDFRenderer._format_number(maximum_history, 2, " MW")])
            percentile = value("current_vs_history_percentile")
            median_ratio = value("current_vs_historical_median_ratio")
            recurrence_days = value("history_mean_recurrence_days")
            if percentile is not None:
                history_rows.append(["Current Peak FRP percentile", f"{PDFRenderer._safe_float(percentile):.1f}%"])
            if median_ratio is not None:
                history_rows.append(["Current vs historical median", f"{PDFRenderer._safe_float(median_ratio):.2f}x"])
            if recurrence_days is not None:
                history_rows.append(["Mean recurrence interval", f"{PDFRenderer._safe_float(recurrence_days):.2f} days"])
            pattern_parts = []
            classification_counts = value("history_classification_counts", default={}) or {}
            anomaly_counts = value("history_anomaly_counts", default={}) or {}
            if classification_counts:
                pattern_parts.append(
                    "<b>Prior classifications:</b> " + ", ".join(
                        f"{label} ({count})" for label, count in sorted(classification_counts.items())
                    )
                )
            if anomaly_counts:
                pattern_parts.append(
                    "<b>Prior anomaly tiers:</b> " + ", ".join(
                        f"{tier} ({count})" for tier, count in sorted(anomaly_counts.items())
                    )
                )
            PDFRenderer._append_section(
                story,
                numbered_heading(section_titles["history"]),
                h2_style,
                [
                    Paragraph(comparison_text, body_style),
                    Spacer(1, 5),
                    styled_table(history_rows, [doc.width / 2, doc.width / 2]),
                    *([Spacer(1, 5), Paragraph("<br/>".join(pattern_parts), body_style)] if pattern_parts else []),
                ],
            )
        else:
            PDFRenderer._append_section(
                story,
                numbered_heading(section_titles["history"]),
                h2_style,
                Paragraph(
                    f"{comparison_text} No comparable prior events were identified in the "
                    "selected historical window.",
                    body_style,
                ),
            )

        if "earlier_vs_now" in report_sections and earlier_vs_now:
            earlier = earlier_vs_now.get("earlier") or {}
            current = earlier_vs_now.get("now") or {}
            comparison_data = [
                ["Metric", "Earlier", "Now"],
                ["Timestamp", str(earlier.get("timestamp", "Not available"))[:19], str(current.get("timestamp", "Not available"))[:19]],
                ["Observation Count", earlier.get("observation_count", "Not available"), current.get("observation_count", "Not available")],
                ["Total FRP", PDFRenderer._format_number(earlier.get("total_frp_mw"), 2, " MW"), PDFRenderer._format_number(current.get("total_frp_mw"), 2, " MW")],
                ["Max FRP", PDFRenderer._format_number(earlier.get("max_frp_mw"), 2, " MW"), PDFRenderer._format_number(current.get("max_frp_mw"), 2, " MW")],
            ]
            change_pct = earlier_vs_now.get("frp_change_percent")
            trend_text = f"<b>Thermal trend:</b> {trend}."
            if change_pct is not None:
                trend_text += f" Total FRP changed by <b>{PDFRenderer._safe_float(change_pct):+.1f}%</b> between the first and latest satellite observation windows."
            PDFRenderer._append_section(
                story,
                numbered_heading("Earlier vs Now"),
                h2_style,
                [
                    styled_table(comparison_data, [doc.width * 0.30, doc.width * 0.35, doc.width * 0.35]),
                    Spacer(1, 5),
                    Paragraph(trend_text, body_style),
                ],
            )

        if "uncertainty_analysis" in report_sections:
            PDFRenderer._append_section(
                story,
                numbered_heading("Assessment Uncertainty"),
                h2_style,
                Paragraph(
                    f"The current classifier confidence is <b>{confidence_pct:.1f}%</b>. "
                    "This event should be interpreted with caution. Classification represents "
                    "a modelled assessment rather than direct confirmation of the physical source.",
                    body_style,
                ),
            )

        report_charts = PDFRenderer._select_report_charts(report_view_model)
        if report_charts:
            PDFRenderer._append_section(
                story,
                numbered_heading("Thermal Analytics"),
                h2_style,
                [],
            )
            for chart_title, chart, chart_insight, chart_description in report_charts:
                insight_box = (
                    PDFRenderer._build_chart_insight_box(chart_insight, doc)
                    if chart_insight else None
                )
                PDFRenderer._append_chart_section(
                    story, chart_title, chart, insight_box, h3_style,
                    chart_description, chart_description_style,
                )

        assessment_cards = [[
            Paragraph("<font size='7' color='#64748B'>THERMAL TREND</font><br/><b>" + str(trend).title() + "</b>", body_style),
            Paragraph("<font size='7' color='#64748B'>FACILITY MATCH</font><br/><b>" + ("Verified" if has_facility else "No Match") + "</b>", body_style),
            Paragraph("<font size='7' color='#64748B'>BASELINE</font><br/><b>" + ("Available" if has_sufficient_baseline else "Limited") + "</b>", body_style),
        ]]
        assessment_table = Table(assessment_cards, colWidths=[doc.width / 3] * 3)
        assessment_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg_light), ("BOX", (0, 0), (-1, -1), 0.6, border_color),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        profile_insights = PDFRenderer._build_profile_insights(report_view_model)
        confidence_label, confidence_color = (
            ("HIGH", "#15803D") if confidence_pct >= 80 else
            ("MODERATE", "#D97706") if confidence_pct >= 60 else
            ("LOW", "#DC2626")
        )
        context_html = "<br/>".join(f"&#8226; {item}" for item in profile_insights[:3]) or "No additional context available."
        context_panel = Table([[
            Paragraph("<b>Context Intelligence</b><br/><br/>" + context_html, body_style),
            Paragraph("<b>Interpretation Confidence</b><br/><br/><font size='18' color='" + confidence_color + "'><b>" + f"{confidence_pct:.1f}%" + "</b></font><br/><b>" + confidence_label + "</b>", body_style),
        ]], colWidths=[doc.width * 0.68, doc.width * 0.32])
        context_panel.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), bg_light), ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#FFF7ED")),
            ("BOX", (0, 0), (-1, -1), 0.7, border_color), ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        PDFRenderer._append_section(
            story, numbered_heading("Assessment Dashboard"), h2_style,
            [assessment_table, Spacer(1, 8), context_panel],
        )

        evidence_labels = PDFRenderer._build_source_evidence(report_view_model)
        if evidence_labels:
            chip_style = ParagraphStyle("EvidenceChip", parent=body_style, fontSize=7, alignment=1, textColor=primary_color)
            evidence_table = Table([[Paragraph(f"<b>{label}</b>", chip_style) for label in evidence_labels]], colWidths=[doc.width / len(evidence_labels)] * len(evidence_labels))
            evidence_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF3E8")), ("BOX", (0, 0), (-1, -1), 0.7, accent_orange),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, accent_orange), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            PDFRenderer._append_section(story, numbered_heading("Source Attribution Evidence"), h2_style, evidence_table)

        follow_up_actions = PDFRenderer._build_follow_up_actions(report_view_model)
        if follow_up_actions:
            action_rows = [[Paragraph(f"<font size='13' color='#F25C05'><b>{index:02d}</b></font>", body_style), Paragraph(action, body_style)] for index, action in enumerate(follow_up_actions, 1)]
            action_table = Table(action_rows, colWidths=[45, doc.width - 45], splitByRow=1)
            action_table.setStyle(TableStyle([
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, border_color), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]))
            PDFRenderer._append_section(story, numbered_heading("Recommended Follow-Up"), h2_style, action_table)

        try:
            doc.build(
                story,
                onFirstPage=lambda canvas, document: PDFRenderer._draw_page_chrome(
                    canvas, document, event_id, generated_at
                ),
                onLaterPages=lambda canvas, document: PDFRenderer._draw_page_chrome(
                    canvas, document, event_id, generated_at
                ),
            )
        except Exception:
            logger.exception("PDF rendering failed for event %s", event_id)
            raise
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    @staticmethod
    def render_and_save(report_view_model: Dict[str, Any], output_path: Path) -> Path:
        pdf_bytes = PDFRenderer.render_dossier_to_pdf(report_view_model)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as output_file:
            output_file.write(pdf_bytes)
        logger.info("PDF saved to %s", output_path)
        return output_path
