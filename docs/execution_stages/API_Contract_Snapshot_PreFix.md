# API Contract Snapshot (Pre-Fix Baseline)

This document freezes the exact JSON payload contracts consumed by the frontend and external clients. No existing key name, type, nullability, or value range may be changed. New fields may only be introduced as optional, nullable additive fields.

---

## 1. Single Event Detail Endpoint: `GET /api/v1/events/{id}` or `GET /api/v1/events/event/{event_id}`

```json
{
  "id": "UUID string",
  "event_id": "string (e.g. EVT-2026-XXXXXX)",
  "latitude": 22.4512,
  "longitude": 71.9213,
  "centroid": "SRID=4326;POINT(71.9213 22.4512)",
  "boundary_geom": "SRID=4326;POLYGON(...) or SRID=4326;POINT(...)",
  "first_detected_utc": "ISO-8601 string",
  "latest_detected_utc": "ISO-8601 string",
  "duration_hours": 12.5,
  "observation_count": 4,
  "peak_frp_mw": 142.5,
  "mean_frp_mw": 98.2,
  "aggregate_frp_mw": 392.8,
  "max_brightness_k": 365.2,
  "associated_facility_id": "UUID string or null",
  "distance_to_facility_m": 420.5,
  "primary_land_use": "string (e.g. Petroleum Refinery, Cropland)",
  "classification": "string (IND_FIRE | IND_FLARE | IND_ROUTINE | AGRI_BURN | WILDFIRE | OTHER_UNCERTAIN)",
  "classification_confidence": 0.885,
  "confidence_pct": 88.5,
  "anomaly_tier": "string (NORMAL | ELEVATED | ABNORMAL | CRITICAL)",
  "anomaly_z_score": 2.45,
  "lifecycle_status": "string (ACTIVE | INCREASING | STABLE | DECREASING)",
  "persistence_tier": "string (TRANSIENT | INTERMITTENT | PERSISTENT)",
  "physical_verification": null
}
```

---

## 2. GIS Vector Hotspots Endpoint: `GET /api/v1/gis/events`

```json
[
  {
    "id": "UUID string",
    "event_id": "string",
    "lat": 22.4512,
    "lon": 71.9213,
    "peak_frp": 142.5,
    "classification": "string",
    "anomaly_tier": "string",
    "confidence_pct": 88.5,
    "facility_name": "string or null",
    "first_detected": "ISO-8601 string",
    "latest_detected": "ISO-8601 string"
  }
]
```

---

## 3. National Summary Analytics Endpoint: `GET /api/v1/analytics/national-summary`

```json
{
  "total_events": 1622,
  "total_facilities": 808,
  "mean_frp_mw": 6.57,
  "peak_frp_mw": 104.2,
  "mean_confidence_pct": 88.07,
  "median_confidence_pct": 93.54,
  "classifications_distribution": {
    "AGRI_BURN": 1379,
    "WILDFIRE": 94,
    "IND_FLARE": 81,
    "IND_ROUTINE": 39,
    "OTHER_UNCERTAIN": 21,
    "IND_FIRE": 8
  },
  "anomaly_distribution": {
    "NORMAL": 1507,
    "ABNORMAL": 66,
    "ELEVATED": 29,
    "CRITICAL": 20
  },
  "state_breakdown": [
    {
      "state": "GUJARAT",
      "event_count": 210,
      "percentage_of_national": 12.95,
      "mean_frp": 8.4,
      "peak_frp": 104.2,
      "mean_confidence": 88.1,
      "median_confidence": 92.4,
      "classifications": {}
    }
  ]
}
```

---

## 4. Notifications Endpoint: `GET /api/v1/notifications`

```json
[
  {
    "id": "UUID string",
    "event_id": "UUID string",
    "title": "string",
    "message": "string",
    "severity": "CRITICAL | ABNORMAL",
    "is_read": false,
    "created_at": "ISO-8601 string"
  }
]
```

---

## 5. Additive Field Rule (Phase 8 Specification)
New physical corroboration payload is defined as:
```json
"physical_verification": {
  "inside_industrial_polygon": boolean,
  "facility_distance_m": float,
  "peak_frp_mw": float,
  "verification_note": "string"
}
```
Field must be optional and nullable in all serialization serializers.
