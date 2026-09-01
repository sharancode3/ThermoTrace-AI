from app.services.report_profile import (
    choose_report_sections,
    determine_report_profile,
)


def test_industrial_class_without_facility_remains_industrial():
    report_data = {
        "classification": "IND_FIRE",
        "primary_land_use": "UNKNOWN",
    }

    profile = determine_report_profile(report_data)

    assert profile == "INDUSTRIAL"
    sections = choose_report_sections(profile, report_data)
    assert "industrial_context" in sections
    assert "agricultural_context" not in sections


def test_land_use_never_overrides_industrial_classification():
    report_data = {
        "classification": "IND_FIRE",
        "primary_land_use": "Agricultural Cropland",
    }

    assert determine_report_profile(report_data) == "INDUSTRIAL"


def test_wildfire_profile_ignores_agricultural_land_cover():
    report_data = {
        "classification": "WILDFIRE",
        "primary_land_use": "Agricultural Cropland",
        "observation_count": 3,
    }

    profile = determine_report_profile(report_data)
    sections = choose_report_sections(profile, report_data)

    assert profile == "WILDLAND"
    assert "wildland_context" in sections
    assert "agricultural_context" not in sections
    assert "event_evolution" in sections


def test_limited_agricultural_history_enables_recurrence_analysis():
    sections = choose_report_sections(
        "AGRICULTURAL",
        {"history_event_count_90d": 2},
    )

    assert "recurrence_analysis" in sections
    assert "historical_pattern" not in sections
