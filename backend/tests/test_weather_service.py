from datetime import datetime, timezone

from app.services.weather_service import compass_direction, is_historical, wind_toward_degrees


def test_wind_direction_keeps_meteorological_from_and_operational_toward_distinct():
    assert compass_direction(247) == "WSW"
    assert wind_toward_degrees(247) == 67.0
    assert compass_direction(wind_toward_degrees(247)) == "ENE"


def test_historical_threshold_distinguishes_old_observations():
    assert is_historical(datetime(2020, 1, 1, tzinfo=timezone.utc)) is True
