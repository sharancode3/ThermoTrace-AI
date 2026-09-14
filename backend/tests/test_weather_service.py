from datetime import datetime, timezone, timedelta

from app.services.weather_service import (
    compass_direction,
    is_historical,
    wind_toward_degrees,
    _nearest_hourly,
    lookup_wind,
    _WEATHER_CACHE,
)


def test_wind_direction_keeps_meteorological_from_and_operational_toward_distinct():
    assert compass_direction(247) == "WSW"
    assert wind_toward_degrees(247) == 67.0
    assert compass_direction(wind_toward_degrees(247)) == "ENE"


def test_wind_cardinal_points_and_degree_conversions():
    # Test cardinal boundary cases
    assert wind_toward_degrees(0) == 180.0
    assert compass_direction(0) == "N"
    assert compass_direction(wind_toward_degrees(0)) == "S"

    assert wind_toward_degrees(90) == 270.0
    assert compass_direction(90) == "E"
    assert compass_direction(wind_toward_degrees(90)) == "W"

    assert wind_toward_degrees(180) == 0.0
    assert compass_direction(180) == "S"
    assert compass_direction(wind_toward_degrees(180)) == "N"

    assert wind_toward_degrees(270) == 90.0
    assert compass_direction(270) == "W"
    assert compass_direction(wind_toward_degrees(270)) == "E"

    assert wind_toward_degrees(359) == 179.0
    assert compass_direction(359) == "N"


def test_historical_threshold_distinguishes_old_observations():
    assert is_historical(datetime(2020, 1, 1, tzinfo=timezone.utc)) is True
    # Recent (within 48 hours) is NOT historical
    assert is_historical(datetime.now(timezone.utc) - timedelta(hours=6)) is False


def test_nearest_hourly_selection():
    payload = {
        "hourly": {
            "time": ["2026-09-14T06:00", "2026-09-14T07:00", "2026-09-14T08:00"],
            "wind_speed_10m": [5.0, 8.6, 12.0],
            "wind_direction_10m": [300.0, 319.0, 330.0],
            "wind_gusts_10m": [15.0, 23.8, 28.0],
            "temperature_2m": [30.0, 32.0, 33.5],
            "relative_humidity_2m": [55.0, 51.0, 48.0],
            "surface_pressure": [982.0, 981.1, 980.5],
            "precipitation": [0.0, 0.2, 0.0],
        }
    }
    target_time = datetime(2026, 9, 14, 7, 12, tzinfo=timezone.utc)
    nearest = _nearest_hourly(payload, target_time)
    assert nearest["time_value"] == "2026-09-14T07:00"
    assert nearest["speed"] == 8.6
    assert nearest["direction"] == 319.0
    assert nearest["gusts"] == 23.8
    assert nearest["temperature"] == 32.0
    assert nearest["humidity"] == 51.0
    assert nearest["pressure"] == 981.1
    assert nearest["precipitation"] == 0.2


def test_cache_separation_by_coordinate_and_hour():
    _WEATHER_CACHE.clear()
    now = datetime.now(timezone.utc)
    res1 = lookup_wind(16.69091, 78.93422, now, target_type="EVENT", target_id="EVT-1")
    assert res1["available"] is True
    assert res1["target_id"] == "EVT-1"
    assert "precipitation_mm" in res1
    assert "surface_pressure_units" in res1

    # Same coordinate and hour should hit cache with new target_id
    res2 = lookup_wind(16.69091, 78.93422, now, target_type="FACILITY", target_id="FAC-1")
    assert res2["target_type"] == "FACILITY"
    assert res2["target_id"] == "FAC-1"
    assert res2["speed_kmh"] == res1["speed_kmh"]
