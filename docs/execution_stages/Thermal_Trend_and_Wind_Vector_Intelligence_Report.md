# Thermal Trend and Wind Vector Intelligence

## Scope

This document records the thermal change-rate and selected-event wind-context extension. It preserves the existing monitor, MapLibre map, URL-driven event selection, and API-client architecture.

## Brightness Temperature Change Rate

- `GET /api/v1/events/{event_id}/history` now includes `thermal_trend`.
- Calculations use only observations linked to the selected event, ordered by `observation_timestamp_utc`.
- The latest valid consecutive-observation interval is calculated as:

  `brightness_temperature_change_rate = (current_brightness_k - previous_brightness_k) / elapsed_hours`

- The displayed unit is `K/hour`.
- Non-positive timestamp intervals are excluded; values are never divided by zero.
- Trend classification is `RISING`, `FALLING`, or `STABLE`. The stable rate band is configurable with `BRIGHTNESS_TEMPERATURE_STABLE_RATE_K_PER_HOUR` and defaults to `0.5 K/hour`.
- When a valid consecutive interval is unavailable, the UI shows an explicit unavailable/insufficient-observations state rather than fabricating a trend.
- The investigation panel labels the measurement **Brightness Temperature** and describes the chart as observation-based discrete satellite sampling, not continuous ground-temperature telemetry.

## Wind Conditions API

- `GET /api/v1/events/{event_id}/wind` is the centralized wind endpoint.
- It uses the selected event's backend-held latitude, longitude, and latest observation timestamp.
- `backend/app/services/weather_service.py` calls real Open-Meteo provider endpoints only:
  - historical events: Open-Meteo archive / ERA5 reanalysis;
  - recent events: Open-Meteo forecast-model data.
- Provider failures return an unavailable state; no hard-coded or generated wind values are used.
- Returned values include speed in km/h, direction-from degrees/cardinal, direction-toward degrees/cardinal, source, timestamp, data kind, and a stale flag where the closest provider time differs by more than two hours from the requested event time.

## Wind Direction Semantics

Meteorological wind direction is always the direction **from** which wind originates. The application separately presents the operational direction **toward** which the airflow proceeds.

Example: `247° from WSW` is shown as `WSW → ENE`, with a toward bearing of `67°`.

## Interface and Map Behavior

- The active Event Investigation overview includes thermal-trend and wind-conditions cards.
- The wind card provides a text equivalent: “Wind from WSW toward ENE at 14.2 km/h.”
- A Show/Hide on Map control governs the selected-event-only wind vector.
- The existing MapLibre map renders a compact directional corridor using three localized arrows and an event-adjacent information badge.
- The overlay is removed when the event closes or changes, and it is not a toxic plume, dispersion, exposure, evacuation, or fire-spread model.

## Verification

- `python -m py_compile app/services/weather_service.py app/api/endpoints.py` passed.
- Direction-semantic check passed: `247° from WSW` maps to `67° toward ENE`.
- `git diff --check` passed.
- A focused unit test was added in `backend/tests/test_weather_service.py`.

## Local Verification Limitations

- The local frontend dependencies were unavailable, so ESLint/browser testing could not run.
- `pytest` was unavailable in the local shell.
- Backend-wide compilation remains blocked by a pre-existing syntax error in `backend/app/domain/firms_poller.py`; the changed backend modules compile successfully.
