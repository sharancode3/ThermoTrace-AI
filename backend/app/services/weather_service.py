"""Centralized, evidence-preserving wind lookup for event investigations."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any

import httpx


class WindLookupError(RuntimeError):
    """Raised when a provider cannot return a usable wind observation."""


OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
CURRENT_WINDOW_HOURS = 48


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_historical(timestamp: datetime) -> bool:
    timestamp = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
    return timestamp < datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=CURRENT_WINDOW_HOURS)


def wind_toward_degrees(wind_from_degrees: float) -> float:
    return (float(wind_from_degrees) + 180.0) % 360.0


def compass_direction(degrees: float) -> str:
    points = ("N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW")
    return points[int((float(degrees) % 360 + 11.25) // 22.5) % 16]


def _nearest_hourly(payload: dict[str, Any], requested_at: datetime) -> dict[str, Any]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    speeds = hourly.get("wind_speed_10m") or []
    directions = hourly.get("wind_direction_10m") or []
    gusts = hourly.get("wind_gusts_10m") or []
    temps = hourly.get("temperature_2m") or []
    humidities = hourly.get("relative_humidity_2m") or []
    pressures = hourly.get("surface_pressure") or []

    candidates = []
    for idx, (time_value, speed, direction) in enumerate(zip(times, speeds, directions)):
        if speed is None or direction is None:
            continue
        try:
            candidate_time = _parse_time(time_value).replace(tzinfo=timezone.utc)
            diff = abs((candidate_time - requested_at).total_seconds())
            candidates.append((diff, idx, time_value, float(speed), float(direction)))
        except (TypeError, ValueError):
            continue

    if not candidates:
        raise WindLookupError("Provider response did not contain usable hourly wind values")

    _, idx, time_value, speed, direction = min(candidates, key=lambda item: item[0])

    def safe_val(arr: list[Any], i: int) -> float | None:
        return float(arr[i]) if arr and i < len(arr) and arr[i] is not None else None

    return {
        "time_value": time_value,
        "speed": speed,
        "direction": direction,
        "gusts": safe_val(gusts, idx),
        "temperature": safe_val(temps, idx),
        "humidity": safe_val(humidities, idx),
        "pressure": safe_val(pressures, idx),
    }


def lookup_wind(latitude: float, longitude: float, requested_at: datetime) -> dict[str, Any]:
    """Retrieve a real provider wind & meteorological record nearest the requested event time.

    Historical events use Open-Meteo's archive. Recent events use its forecast
    endpoint and are explicitly returned as forecast/model conditions.
    """
    requested_at = requested_at if requested_at.tzinfo else requested_at.replace(tzinfo=timezone.utc)
    historical = is_historical(requested_at)
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,relative_humidity_2m,surface_pressure",
        "timezone": "UTC",
        "wind_speed_unit": "kmh",
    }
    if historical:
        params.update({"start_date": requested_at.date().isoformat(), "end_date": requested_at.date().isoformat()})
        url = OPEN_METEO_ARCHIVE_URL
        source = "Open-Meteo archive (ERA5 reanalysis)"
        data_kind = "HISTORICAL_REANALYSIS"
    else:
        params.update({"forecast_days": 2, "past_days": 2})
        url = OPEN_METEO_FORECAST_URL
        source = "Open-Meteo forecast model"
        data_kind = "FORECAST_MODEL"

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        nearest = _nearest_hourly(payload, requested_at)
    except (httpx.HTTPError, ValueError, TypeError, WindLookupError) as exc:
        raise WindLookupError(str(exc)) from exc

    speed_kmh = nearest["speed"]
    direction_from = round(nearest["direction"] % 360.0, 1)
    direction_toward = round(wind_toward_degrees(direction_from), 1)
    provider_timestamp = _parse_time(nearest["time_value"]).replace(tzinfo=timezone.utc)
    return {
        "available": True,
        "data_kind": data_kind,
        "source": source,
        "requested_at": requested_at.isoformat(),
        "timestamp": provider_timestamp.isoformat(),
        "stale": abs((provider_timestamp - requested_at).total_seconds()) > 2 * 3600,
        "latitude": latitude,
        "longitude": longitude,
        "speed_kmh": round(speed_kmh, 1),
        "direction_from_degrees": direction_from,
        "direction_from_cardinal": compass_direction(direction_from),
        "direction_toward_degrees": direction_toward,
        "direction_toward_cardinal": compass_direction(direction_toward),
        "gusts_kmh": round(nearest["gusts"], 1) if nearest["gusts"] is not None else None,
        "temperature_c": round(nearest["temperature"], 1) if nearest["temperature"] is not None else None,
        "relative_humidity_pct": round(nearest["humidity"], 1) if nearest["humidity"] is not None else None,
        "surface_pressure_hpa": round(nearest["pressure"], 1) if nearest["pressure"] is not None else None,
    }
