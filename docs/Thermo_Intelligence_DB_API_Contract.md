# Database Schema & REST API Contract

# Thermo Intelligence: Industrial Fire & Persistent Thermal Source Detection Platform

**Document Version:** 1.0.0  
**Project Identifier:** SIH-2026-PS26162 (National Technical Research Organisation — NTRO)  
**Product Specification:** [Thermo_Intelligence_PRD.md](file:///c:/SHARAN%20PROJECTS/SiH%202026-THERMOSCAN%20AI/docs/Thermo_Intelligence_PRD.md)  
**Technical Architecture:** [Thermo_Intelligence_TRD.md](file:///c:/SHARAN%20PROJECTS/SiH%202026-THERMOSCAN%20AI/docs/Thermo_Intelligence_TRD.md)  
**Operational Workflow:** [Thermo_Intelligence_Workflow.md](file:///c:/SHARAN%20PROJECTS/SiH%202026-THERMOSCAN%20AI/docs/Thermo_Intelligence_Workflow.md)  
**Storage Reference:** [Thermo_Intelligence_Database_Storage.md](file:///c:/SHARAN%20PROJECTS/SiH%202026-THERMOSCAN%20AI/docs/Thermo_Intelligence_Database_Storage.md)  
**UI/UX Reference:** [Thermo_Intelligence_UIUX.md](file:///c:/SHARAN%20PROJECTS/SiH%202026-THERMOSCAN%20AI/docs/Thermo_Intelligence_UIUX.md)  
**Status:** Authoritative Development Contract (Frozen)  
**Last Updated:** August 2026  

---

## 1. Contract Purpose & Binding Rules

This document constitutes the **immutable development contract** across all system layers: PostgreSQL/PostGIS Database, FastAPI Backend, Machine Learning Pipeline, MapLibre GIS, React/Next.js Frontend, Thermo News, Alert Dispatcher, Grounded RAG Chatbot, and Tactical Reporting Engine.

### 1.1 Non-Negotiable Engineering Directives
1. **Zero Ad-Hoc Naming:** No frontend component, backend endpoint, database query, or ML training script may introduce arbitrary field names, casing styles, or unregistered status codes.
2. **Casing Standard:**
   - **Database (PostGIS):** `snake_case` for all table names, column names, and constraint identifiers.
   - **REST API (JSON):** `snake_case` strictly across all request bodies, query parameters, and response envelopes.
   - **Enums & Controlled Values:** `UPPER_SNAKE_CASE` (e.g., `IND_FIRE`, `CRITICAL`, `TRANSIENT`).
3. **Primary Identifier Strategy:**
   - Database internal keys: **UUIDv4** (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`).
   - Human-readable public identifiers: Structured Prefixed Strings (e.g., `EVT-IN-GUJ-202608-0042`, `FAC-REF-JAMNAGAR`, `RPT-20260829-0042`).
4. **Coordinate & Temporal Standards:**
   - Coordinates: Planar Longitude & Latitude in **WGS 84 (`EPSG:4326`)** `[longitude, latitude]`.
   - Timestamps: **UTC ISO 8601** formatted as `YYYY-MM-DDTHH:MM:SSZ` (e.g., `2026-08-29T10:30:00Z`).

---

## 2. Authoritative Data Ownership Matrix

```
+----------------------------------------------------------------------------------------------------------------+
|                                           DATA OWNERSHIP & MUTABILITY MATRIX                                   |
+----------------------+--------------------------+-----------------------+--------------------------------------+
| Data Domain          | Authoritative Owner      | Primary Ingestion     | Mutability & Lifecycle Rules         |
+----------------------+--------------------------+-----------------------+--------------------------------------+
| **Raw Telemetry**    | Ingestion Engine         | NASA FIRMS API        | **100% Immutable** (Append-Only)     |
| **Facility Registry**| Spatial Data Pipeline    | OSM / GEM / Govt GIS  | Periodic Upsert / Versioned Master   |
| **Thermal Events**   | ST-DBSCAN Clusterer      | Derived Spatial Logic | Mutable (Active → Cooling → Resolved)|
| **ML Classification**| XGBoost Model (`v1.0.0`) | Inference Pipeline    | Versioned per Model Run              |
| **Baseline Anomaly** | Anomaly Evaluation Engine| Statistical Z-Score   | Recalculated upon New Observation    |
| **Thermo News Feed** | News Dispatcher Service  | Triggered on Anomaly  | Mutable Headline & Metrics           |
| **Notifications**    | Alert Dispatcher Service | Escalation Engine     | Mutable Delivery / Read State        |
| **Tactical Reports** | Report Generator         | Event Snapshot + LLM  | **100% Immutable** PDF Snapshot      |
+----------------------+--------------------------+-----------------------+--------------------------------------+
```

---

## 3. Controlled Vocabularies & Canonical Enums

### CANONICAL SYSTEM ENUMERATIONS

| Enum Name | Canonical Values | Exact Meaning & Criteria |
|:---|:---|:---|
| **Classification** | `IND_FIRE` | Industrial Accidental Fire / Explosion |
| | `IND_FLARE` | Industrial Persistent Flare / Gas Venting |
| | `IND_ROUTINE` | Routine High-Temp Industrial Plant (Steel/Cement)|
| | `AGRI_BURN` | Agricultural Stubble / Crop Residue Burning |
| | `WILDFIRE` | Wildfire / Forest & Vegetation Blaze |
| | `OTHER_UNCERTAIN` | Ambiguous / Cloud Edge / Unverified |
| **Anomaly Tier** | `NORMAL` | `Z < 1.5` (Routine operational flaring) |
| | `ELEVATED` | `1.5 <= Z < 2.5` (Process venting / surge) |
| | `ABNORMAL` | `2.5 <= Z < 4.0` (Significant flare deviation) |
| | `CRITICAL` | `Z >= 4.0` or Footprint Expansion `>300\%` |
| **Persistence Tier** | `TRANSIENT` | Active `< 24h`, 0 prior hits past 90 days |
| | `INTERMITTENT` | Recurring `3–14 days/year` (Batch kilns) |
| | `PERSISTENT` | `>15 active days/month` over `>6m` |
| **Lifecycle Status** | `ACTIVE` | Hotspots detected within trailing 12 hours |
| | `COOLING` | No detections in 12h–36h; residual heat decay |
| | `RESOLVED` | No detections `>36h`; thermal signature 0 |
| **News Severity** | `CRITICAL` | Requires immediate disaster/defense response |
| | `ALERT` | High-priority abnormal industrial flaring |
| | `NOTICE` | General notification / Seasonal stubble update |
| | `PERSISTENCE_UPDATE`| Milestone persistence confirmation |
| **Facility Sector** | `REFINERY` | Petroleum & Crude Oil Refining Complex |
| | `PETROCHEMICAL` | Downstream Chemicals, Polymers, Aromatics |
| | `POWER_THERMAL` | Coal / Gas Fired Thermal Power Stations |
| | `STEEL_SMELTER` | Blast Furnaces, Electric Arc Furnaces |
| | `MINING_COAL` | Open-Cast & Underground Coal Mines |
| | `LNG_TERMINAL` | Regasification & Liquefied Gas Storage |
| | `CEMENT_KILN` | Clinker Production & Rotary Kilns |
| | `OTHER_INDUSTRIAL`| Fertilizer, Heavy Engineering, Slag Dumps |

---

## 4. Complete PostGIS Database Schema Specification

```sql
-- ============================================================================
-- AUTHORITATIVE POSTGIS SCHEMA DDL
-- Target: PostgreSQL 16 + PostGIS 3.4 + pgvector
-- Spatial Reference System: WGS 84 (EPSG:4326)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ----------------------------------------------------------------------------
-- 1. Raw Thermal Observations Table (Immutable)
-- ----------------------------------------------------------------------------
CREATE TABLE thermal_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dedup_key VARCHAR(64) UNIQUE NOT NULL, -- SHA-256(lat, lon, acq_date, acq_time, sensor)
    geom GEOMETRY(Point, 4326) NOT NULL,
    latitude NUMERIC(8, 5) NOT NULL CHECK (latitude BETWEEN -90.0 AND 90.0),
    longitude NUMERIC(8, 5) NOT NULL CHECK (longitude BETWEEN -180.0 AND 180.0),
    brightness_temp_k REAL NOT NULL CHECK (brightness_temp_k BETWEEN 200.0 AND 600.0),
    brightness_temp_alt_k REAL CHECK (brightness_temp_alt_k BETWEEN 200.0 AND 600.0),
    frp_mw REAL NOT NULL CHECK (frp_mw >= 0.0),
    acq_date DATE NOT NULL,
    acq_time_utc TIME NOT NULL,
    observation_timestamp_utc TIMESTAMPTZ NOT NULL,
    ingestion_timestamp_utc TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    satellite_sensor VARCHAR(32) NOT NULL, -- VIIRS_NOAA20, VIIRS_SNPP, MODIS_TERRA, MODIS_AQUA
    confidence_level VARCHAR(16),          -- low, nominal, high
    confidence_pct SMALLINT CHECK (confidence_pct BETWEEN 0 AND 100),
    day_night CHAR(1) NOT NULL CHECK (day_night IN ('D', 'N')),
    source_product VARCHAR(32) DEFAULT 'FIRMS_NRT' NOT NULL,
    scan_angle REAL,
    track_pixel_size REAL,
    raw_metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX idx_obs_geom ON thermal_observations USING GIST(geom);
CREATE INDEX idx_obs_temporal ON thermal_observations(observation_timestamp_utc DESC);
CREATE INDEX idx_obs_sensor_date ON thermal_observations(satellite_sensor, acq_date);

-- ----------------------------------------------------------------------------
-- 2. Industrial Infrastructure Master Registry
-- ----------------------------------------------------------------------------
CREATE TABLE industrial_facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_code VARCHAR(32) UNIQUE NOT NULL, -- e.g. FAC-REF-JAMNAGAR
    name VARCHAR(255) NOT NULL,
    sector_category VARCHAR(32) NOT NULL,      -- Canonical Facility Sector Enum
    sub_type VARCHAR(64),
    operator_name VARCHAR(255),
    state VARCHAR(64) NOT NULL,
    district VARCHAR(64),
    facility_geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326) NOT NULL,
    latitude NUMERIC(8, 5) NOT NULL,
    longitude NUMERIC(8, 5) NOT NULL,
    baseline_frp_mean REAL DEFAULT 0.0 NOT NULL,
    baseline_frp_std REAL DEFAULT 1.0 NOT NULL,
    baseline_frp_median REAL DEFAULT 0.0 NOT NULL,
    historical_event_count INT DEFAULT 0 NOT NULL,
    data_source VARCHAR(64) DEFAULT 'OSM_GEM_V1' NOT NULL,
    source_external_id VARCHAR(128),
    metadata_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_fac_geom ON industrial_facilities USING GIST(facility_geom);
CREATE INDEX idx_fac_centroid ON industrial_facilities USING GIST(centroid);
CREATE INDEX idx_fac_sector_state ON industrial_facilities(sector_category, state);

-- ----------------------------------------------------------------------------
-- 3. Clustered Thermal Events Table (Master Intelligence Entity)
-- ----------------------------------------------------------------------------
CREATE TABLE thermal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(32) UNIQUE NOT NULL, -- e.g. EVT-IN-GUJ-202608-0042
    centroid GEOMETRY(Point, 4326) NOT NULL,
    boundary_geom GEOMETRY(Geometry, 4326) NOT NULL,
    latitude NUMERIC(8, 5) NOT NULL,
    longitude NUMERIC(8, 5) NOT NULL,
    bounding_area_ha REAL DEFAULT 0.0 NOT NULL,
    first_detected_utc TIMESTAMPTZ NOT NULL,
    latest_detected_utc TIMESTAMPTZ NOT NULL,
    duration_hours REAL GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (latest_detected_utc - first_detected_utc)) / 3600.0
    ) STORED,
    observation_count INT DEFAULT 1 NOT NULL,
    peak_frp_mw REAL NOT NULL,
    mean_frp_mw REAL NOT NULL,
    aggregate_frp_mw REAL NOT NULL,
    max_brightness_k REAL NOT NULL,
    associated_facility_id UUID REFERENCES industrial_facilities(id) ON DELETE SET NULL,
    distance_to_facility_m REAL DEFAULT NULL,
    primary_land_use VARCHAR(64) DEFAULT 'Unknown' NOT NULL,
    classification VARCHAR(32) DEFAULT 'OTHER_UNCERTAIN' NOT NULL,
    classification_confidence REAL DEFAULT 0.0 NOT NULL,
    persistence_tier VARCHAR(32) DEFAULT 'TRANSIENT' NOT NULL,
    anomaly_tier VARCHAR(32) DEFAULT 'NORMAL' NOT NULL,
    anomaly_z_score REAL DEFAULT 0.0 NOT NULL,
    lifecycle_status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
    is_demo BOOLEAN DEFAULT FALSE NOT NULL,
    embedding VECTOR(384), -- pgvector for semantic RAG search
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_evt_centroid ON thermal_events USING GIST(centroid);
CREATE INDEX idx_evt_boundary ON thermal_events USING GIST(boundary_geom);
CREATE INDEX idx_evt_temporal ON thermal_events(latest_detected_utc DESC);
CREATE INDEX idx_evt_class_anomaly ON thermal_events(classification, anomaly_tier);
CREATE INDEX idx_evt_lifecycle ON thermal_events(lifecycle_status);
CREATE INDEX idx_evt_embedding ON thermal_events USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 4. Event-Observation Membership Junction Table (Traceability)
-- ----------------------------------------------------------------------------
CREATE TABLE event_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    observation_id UUID NOT NULL REFERENCES thermal_observations(id) ON DELETE RESTRICT,
    attached_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_event_obs UNIQUE(event_id, observation_id)
);

CREATE INDEX idx_link_event ON event_observations(event_id);
CREATE INDEX idx_link_observation ON event_observations(observation_id);

-- ----------------------------------------------------------------------------
-- 5. Machine Learning Models & Version Registry
-- ----------------------------------------------------------------------------
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(64) NOT NULL,
    version VARCHAR(32) UNIQUE NOT NULL, -- e.g. thermo_xgb_v1.0.0
    model_type VARCHAR(32) NOT NULL,     -- XGBoost, LightGBM, Random_Forest
    feature_schema_hash VARCHAR(64) NOT NULL,
    training_dataset_version VARCHAR(64) NOT NULL,
    macro_f1_score REAL NOT NULL,
    industrial_precision REAL NOT NULL,
    artifact_path VARCHAR(255) NOT NULL,
    is_deployed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 6. Event ML Classification History Table
-- ----------------------------------------------------------------------------
CREATE TABLE event_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE RESTRICT,
    predicted_class VARCHAR(32) NOT NULL,
    confidence_pct REAL NOT NULL CHECK (confidence_pct BETWEEN 0.0 AND 100.0),
    class_probabilities JSONB NOT NULL, -- {"IND_FIRE": 0.942, "IND_FLARE": 0.038, ...}
    feature_importances JSONB NOT NULL, -- {"dist_ind_m": 0.38, "frp_surge": 0.31, ...}
    input_feature_vector JSONB NOT NULL,
    is_current BOOLEAN DEFAULT TRUE NOT NULL,
    classified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_class_event ON event_classifications(event_id);

-- ----------------------------------------------------------------------------
-- 7. Facility Historical Baselines Table
-- ----------------------------------------------------------------------------
CREATE TABLE facility_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES industrial_facilities(id) ON DELETE CASCADE,
    baseline_window VARCHAR(32) DEFAULT 'ROLLING_12M' NOT NULL,
    sample_observation_count INT NOT NULL,
    mean_frp_mw REAL NOT NULL,
    std_frp_mw REAL NOT NULL,
    median_frp_mw REAL NOT NULL,
    q75_frp_mw REAL NOT NULL,
    q95_frp_mw REAL NOT NULL,
    max_recorded_frp_mw REAL NOT NULL,
    is_statistically_sufficient BOOLEAN DEFAULT TRUE NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_baseline_facility ON facility_baselines(facility_id);

-- ----------------------------------------------------------------------------
-- 8. Event Anomaly Evaluations Table
-- ----------------------------------------------------------------------------
CREATE TABLE event_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID UNIQUE NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    observed_frp_mw REAL NOT NULL,
    baseline_mean_frp_mw REAL NOT NULL,
    baseline_std_frp_mw REAL NOT NULL,
    z_score REAL NOT NULL,
    percentile_rank REAL NOT NULL,
    anomaly_severity VARCHAR(32) NOT NULL, -- Canonical Anomaly Tier Enum
    contributing_factors JSONB NOT NULL,   -- {"frp_surge": true, "area_expansion": false}
    evaluated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 9. Thermo News Feed Bulletins Table
-- ----------------------------------------------------------------------------
CREATE TABLE thermo_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID UNIQUE NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    headline VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    severity_tag VARCHAR(32) NOT NULL, -- Canonical News Severity Enum
    published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_news_published ON thermo_news(published_at DESC);

-- ----------------------------------------------------------------------------
-- 10. Users & Analyst Registry Table
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'ANALYST' NOT NULL, -- ANALYST, SUPERVISOR, ADMIN
    notification_preferences JSONB DEFAULT '{"critical_only": true, "push_enabled": true}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 11. User Notifications Table
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL, -- Canonical Anomaly Tier Enum
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- 12. Tactical Intelligence Reports Table
-- ----------------------------------------------------------------------------
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(64) UNIQUE NOT NULL, -- e.g. RPT-20260829-0042
    event_id UUID NOT NULL REFERENCES thermal_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    included_sections JSONB NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    download_url VARCHAR(512) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    generation_status VARCHAR(32) DEFAULT 'COMPLETED' NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 13. Conversational RAG Audit Log Table
-- ----------------------------------------------------------------------------
CREATE TABLE chat_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    raw_query TEXT NOT NULL,
    extracted_parameters JSONB NOT NULL,
    retrieved_event_ids JSONB NOT NULL,
    response_text TEXT NOT NULL,
    latency_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 14. FIRMS Ingestion State & Job Audit Table
-- ----------------------------------------------------------------------------
CREATE TABLE ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_feed VARCHAR(32) NOT NULL,
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end TIMESTAMPTZ NOT NULL,
    records_received INT DEFAULT 0 NOT NULL,
    records_inserted INT DEFAULT 0 NOT NULL,
    records_duplicated INT DEFAULT 0 NOT NULL,
    status VARCHAR(32) NOT NULL, -- SUCCESS, FAILED, RETRYING
    error_message TEXT,
    execution_duration_ms INT NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ingestion_executed ON ingestion_jobs(executed_at DESC);
```

---

## 5. REST API Standards & Envelope Conventions

### 5.1 Standard Response Envelopes

#### 1. Successful Entity Response
```json
{
  "data": {
    "event_id": "EVT-IN-GUJ-202608-0042",
    "classification": "IND_FIRE",
    "confidence": 0.942
  }
}
```

#### 2. Successful Paginated Collection Response
```json
{
  "data": [
    { "event_id": "EVT-IN-GUJ-202608-0042" },
    { "event_id": "EVT-IN-ODI-202608-0012" }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total_records": 142,
    "total_pages": 6,
    "has_next": true,
    "has_prev": false
  }
}
```

#### 3. Standard Error Response
```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Thermal event with identifier EVT-IN-GUJ-9999 was not found.",
    "details": { "event_id": "EVT-IN-GUJ-9999" },
    "timestamp": "2026-08-29T10:30:00Z"
  }
}
```

### 5.2 Canonical Error Codes & HTTP Status Codes

```
+----------------------------------------------------------------------------------------------------+
|                                      CANONICAL ERROR CODE TAXONOMY                                 |
+---------------------+-------------------+----------------------------------------------------------+
| HTTP Status Code    | Error Code        | Condition & Trigger Scenario                             |
+---------------------+-------------------+----------------------------------------------------------+
| `400 Bad Request`   | `INVALID_PARAM`   | Malformed bounding box string or invalid coordinate value|
| `401 Unauthorized`  | `AUTH_REQUIRED`   | Missing or expired Bearer JWT access token               |
| `403 Forbidden`     | `ROLE_FORBIDDEN`  | Analyst attempting administrative trigger actions        |
| `404 Not Found`     | `EVENT_NOT_FOUND` | Specified `event_id` or `facility_code` does not exist   |
| `409 Conflict`      | `ALREADY_EXISTS`  | Duplicate report ID or resource creation conflict        |
| `422 Unprocessable` | `SCHEMA_VALIDATION`| Missing required payload body fields                     |
| `429 Too Many Req`  | `RATE_LIMITED`    | Ingestion trigger or query rate limit exceeded           |
| `500 Server Error`  | `INTERNAL_ERROR`  | Uncaught backend exception or PostGIS connection failure |
| `503 Unavailable`   | `FIRMS_UNAVAILABLE`| Upstream NASA FIRMS API unreachable; using cached feed   |
+---------------------+-------------------+----------------------------------------------------------+
```

---

## 6. Complete REST API Endpoint Specifications

### 6.1 Thermal Events Endpoints

#### `GET /api/v1/events`
List and filter thermal events across the country with cursor or page pagination.

- **Query Parameters:**
  - `page` (int, default: 1)
  - `page_size` (int, default: 25, max: 100)
  - `classification` (string, optional: `IND_FIRE,IND_FLARE,IND_ROUTINE,AGRI_BURN,WILDFIRE,OTHER_UNCERTAIN`)
  - `anomaly_tier` (string, optional: `NORMAL,ELEVATED,ABNORMAL,CRITICAL`)
  - `persistence_tier` (string, optional: `TRANSIENT,INTERMITTENT,PERSISTENT`)
  - `state` (string, optional: e.g. `Gujarat`, `Odisha`, `Punjab`)
  - `facility_code` (string, optional: e.g. `FAC-REF-JAMNAGAR`)
  - `min_frp` (float, optional: minimum peak FRP in MW)
  - `from_time` (ISO timestamp, optional)
  - `to_time` (ISO timestamp, optional)
  - `sort` (string, default: `-latest_detected_utc`, options: `-peak_frp_mw`, `+peak_frp_mw`, `-duration_hours`)

- **Example Response (200 OK):**
```json
{
  "data": [
    {
      "event_id": "EVT-IN-GUJ-202608-0042",
      "latitude": 22.47120,
      "longitude": 70.06310,
      "bounding_area_ha": 14.2,
      "first_detected_utc": "2026-08-28T22:15:00Z",
      "latest_detected_utc": "2026-08-29T02:18:00Z",
      "duration_hours": 4.05,
      "observation_count": 8,
      "peak_frp_mw": 450.0,
      "mean_frp_mw": 182.4,
      "max_brightness_k": 482.5,
      "classification": "IND_FIRE",
      "classification_confidence": 0.942,
      "persistence_tier": "PERSISTENT",
      "anomaly_tier": "CRITICAL",
      "anomaly_z_score": 5.82,
      "lifecycle_status": "ACTIVE",
      "associated_facility": {
        "facility_code": "FAC-REF-JAMNAGAR",
        "name": "Reliance Jamnagar Refinery Complex",
        "sector_category": "REFINERY"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total_records": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

---

#### `GET /api/v1/events/{event_id}`
Retrieve the full 360° investigation payload for a single thermal event.

- **Path Parameters:** `event_id` (string, required: e.g. `EVT-IN-GUJ-202608-0042`)
- **Example Response (200 OK):**
```json
{
  "data": {
    "event_id": "EVT-IN-GUJ-202608-0042",
    "centroid": { "type": "Point", "coordinates": [70.06310, 22.47120] },
    "boundary_geojson": {
      "type": "Polygon",
      "coordinates": [[[70.061, 22.469], [70.065, 22.469], [70.065, 22.473], [70.061, 22.473], [70.061, 22.469]]]
    },
    "bounding_area_ha": 14.2,
    "telemetry": {
      "first_detected_utc": "2026-08-28T22:15:00Z",
      "latest_detected_utc": "2026-08-29T02:18:00Z",
      "duration_hours": 4.05,
      "observation_count": 8,
      "peak_frp_mw": 450.0,
      "mean_frp_mw": 182.4,
      "aggregate_frp_mw": 1459.2,
      "max_brightness_k": 482.5
    },
    "classification": {
      "primary_class": "IND_FIRE",
      "confidence_pct": 94.2,
      "model_version": "thermo_xgb_v1.0.0",
      "probabilities": {
        "IND_FIRE": 0.942,
        "IND_FLARE": 0.038,
        "IND_ROUTINE": 0.012,
        "AGRI_BURN": 0.004,
        "WILDFIRE": 0.002,
        "OTHER_UNCERTAIN": 0.002
      },
      "feature_importances": {
        "in_facility": 0.38,
        "frp_z_score": 0.31,
        "duration_hours": 0.18,
        "night_ratio": 0.13
      }
    },
    "baseline_anomaly": {
      "anomaly_severity": "CRITICAL",
      "observed_frp_mw": 450.0,
      "facility_baseline_mean_frp": 42.0,
      "facility_baseline_std_frp": 12.0,
      "z_score": 5.82,
      "percentile_rank": 99.8,
      "contributing_factors": {
        "frp_surge": true,
        "expansion_rate_pct": 320.0
      }
    },
    "geographic_context": {
      "primary_land_use": "INDUSTRIAL_BUILT_UP",
      "land_use_breakdown_pct": { "INDUSTRIAL": 84.0, "URBAN": 12.0, "BARREN": 4.0 },
      "associated_facility": {
        "facility_code": "FAC-REF-JAMNAGAR",
        "name": "Reliance Jamnagar Refinery Complex",
        "sector_category": "REFINERY",
        "operator_name": "Reliance Industries Ltd",
        "state": "Gujarat",
        "district": "Jamnagar",
        "distance_to_centroid_m": 45.0
      },
      "vulnerability_buffers": {
        "nearest_settlement_km": 1.8,
        "critical_fuel_tanks_m": 320.0
      }
    },
    "lifecycle_status": "ACTIVE"
  }
}
```

---

#### `GET /api/v1/events/{event_id}/observations`
Retrieve all raw underlying satellite sensor hits associated with a specific event.

- **Path Parameters:** `event_id` (string, required)
- **Example Response (200 OK):**
```json
{
  "data": [
    {
      "observation_id": "8f3b207a-4a6c-4890-a2bc-81d3682910fa",
      "latitude": 22.47120,
      "longitude": 70.06310,
      "brightness_temp_k": 482.5,
      "brightness_temp_alt_k": 298.2,
      "frp_mw": 450.0,
      "observation_timestamp_utc": "2026-08-29T02:18:00Z",
      "satellite_sensor": "VIIRS_NOAA20",
      "confidence_level": "high",
      "day_night": "N"
    }
  ]
}
```

---

#### `GET /api/v1/events/{event_id}/history`
Retrieve chronological multi-pass sensor history for the "Earlier vs. Now" comparison slider.

- **Path Parameters:** `event_id` (string, required)
- **Example Response (200 OK):**
```json
{
  "data": {
    "event_id": "EVT-IN-GUJ-202608-0042",
    "passes": [
      {
        "pass_index": 1,
        "timestamp_utc": "2026-08-28T22:15:00Z",
        "satellite_sensor": "VIIRS_SNPP",
        "peak_frp_mw": 48.0,
        "bounding_area_ha": 1.2,
        "footprint_geojson": { "type": "Point", "coordinates": [70.0630, 22.4710] }
      },
      {
        "pass_index": 2,
        "timestamp_utc": "2026-08-29T02:18:00Z",
        "satellite_sensor": "VIIRS_NOAA20",
        "peak_frp_mw": 450.0,
        "bounding_area_ha": 14.2,
        "footprint_geojson": { "type": "Polygon", "coordinates": [...] }
      }
    ],
    "deltas": {
      "frp_delta_mw": 402.0,
      "frp_growth_pct": 837.5,
      "area_growth_pct": 1083.3
    }
  }
}
```

---

### 6.2 GIS & Cartography Endpoints

#### `GET /api/v1/gis/events`
Viewport-culled spatial bounding box query returning GeoJSON for high-performance MapLibre rendering.

- **Query Parameters:**
  - `bbox` (string, required: `min_lon,min_lat,max_lon,max_lat` e.g. `68.0,20.0,75.0,25.0`)
  - `zoom` (int, required: current MapLibre zoom level 1–18)
  - `time_window` (string, default: `24h`, options: `6h`, `24h`, `7d`, `30d`, `all`)
  - `severity` (string, optional: `CRITICAL,ABNORMAL,ELEVATED,NORMAL`)
  - `classification` (string, optional: `IND_FIRE,IND_FLARE,...`)

- **Example Response (200 OK - GeoJSON FeatureCollection):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "EVT-IN-GUJ-202608-0042",
      "geometry": {
        "type": "Point",
        "coordinates": [70.06310, 22.47120]
      },
      "properties": {
        "event_id": "EVT-IN-GUJ-202608-0042",
        "peak_frp_mw": 450.0,
        "classification": "IND_FIRE",
        "confidence": 0.94,
        "anomaly_tier": "CRITICAL",
        "persistence_tier": "PERSISTENT",
        "observation_count": 8,
        "duration_hours": 4.05,
        "facility_name": "Reliance Jamnagar Refinery Complex",
        "latest_detected_utc": "2026-08-29T02:18:00Z"
      }
    }
  ]
}
```

---

#### `GET /api/v1/gis/facilities`
Fetch industrial facility boundaries and metadata intersecting the current map viewport.

- **Query Parameters:**
  - `bbox` (string, required: `min_lon,min_lat,max_lon,max_lat`)
  - `sector` (string, optional: `REFINERY,POWER_THERMAL,STEEL_SMELTER,MINING_COAL`)

- **Example Response (200 OK - GeoJSON FeatureCollection):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "FAC-REF-JAMNAGAR",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [...]
      },
      "properties": {
        "facility_code": "FAC-REF-JAMNAGAR",
        "name": "Reliance Jamnagar Refinery Complex",
        "sector_category": "REFINERY",
        "operator_name": "Reliance Industries Ltd",
        "baseline_frp_mean": 42.0,
        "baseline_frp_std": 12.0
      }
    }
  ]
}
```

---

### 6.3 Industrial Facilities Master Endpoints

#### `GET /api/v1/facilities`
Search and list facilities across India.
- **Query Parameters:** `page`, `page_size`, `q` (search name), `state`, `sector_category`.

#### `GET /api/v1/facilities/{facility_code}`
Retrieve complete facility dossier, baseline metrics, and associated historical thermal events.

#### `GET /api/v1/facilities/{facility_code}/baseline`
Retrieve historical baseline distributions (`Q_25, Q_50, Q_75, μ, σ`) and 30-day thermal calendar.

---

### 6.4 Thermo News Feed Endpoints

#### `GET /api/v1/news`
List active tactical news bulletins sorted chronologically.

- **Query Parameters:** `limit` (default: 20), `severity` (`CRITICAL,ALERT,NOTICE,PERSISTENCE_UPDATE`).
- **Example Response (200 OK):**
```json
{
  "data": [
    {
      "news_id": "3b290a12-88ec-4819-b789-20f182c091ad",
      "event_id": "EVT-IN-GUJ-202608-0042",
      "headline": "CRITICAL: Major Thermal Surge (+5.8σ) at Jamnagar Petrochemical Complex, Gujarat",
      "summary": "VIIRS NOAA-20 detected a 450 MW thermal flare surge exceeding historical facility baseline by 10x. Rapid footprint expansion (+320%) observed.",
      "severity_tag": "CRITICAL",
      "published_at": "2026-08-29T02:22:00Z",
      "location": {
        "latitude": 22.47120,
        "longitude": 70.06310,
        "state": "Gujarat",
        "facility_name": "Reliance Jamnagar Refinery Complex"
      }
    }
  ]
}
```

---

#### `GET /api/v1/stream/news`
Server-Sent Events (SSE) stream broadcasting newly published or escalated news bulletins in real time.
- **Protocol:** `text/event-stream`
- **Payload Event:** `event: news_publish\ndata: { ... }\n\n`

---

### 6.5 Smart Notifications Endpoints

#### `GET /api/v1/notifications`
Fetch unread/read in-app alerts for the current session.

#### `PATCH /api/v1/notifications/{id}/read`
Mark an individual notification as read.

#### `POST /api/v1/notifications/read-all`
Mark all active session notifications as read.

---

### 6.6 Universal Search Endpoint

#### `GET /api/v1/search`
Unified search omnibox supporting facility names, administrative regions, event IDs, and coordinates.

- **Query Parameters:** `q` (string, required: e.g. `Jamnagar` or `EVT-IN-GUJ` or `22.47, 70.06`)
- **Example Response (200 OK):**
```json
{
  "data": {
    "query": "Jamnagar",
    "results": [
      {
        "type": "FACILITY",
        "title": "Reliance Jamnagar Refinery Complex",
        "subtitle": "Petroleum Refinery — Jamnagar, Gujarat",
        "target_id": "FAC-REF-JAMNAGAR",
        "coordinates": [70.06310, 22.47120]
      },
      {
        "type": "EVENT",
        "title": "EVT-IN-GUJ-202608-0042 (CRITICAL)",
        "subtitle": "450 MW Fire Surge — Jamnagar Complex",
        "target_id": "EVT-IN-GUJ-202608-0042",
        "coordinates": [70.06310, 22.47120]
      }
    ]
  }
}
```

---

### 6.7 Grounded Conversational AI (RAG Chat) Endpoints

#### `POST /api/v1/chat/query`
Natural language query execution strictly grounded against PostGIS database records.

- **Request Body:**
```json
{
  "session_id": "sess_98a72b01",
  "query": "Show me all abnormal industrial flares in Gujarat over the past 24 hours."
}
```

- **Example Response (200 OK):**
```json
{
  "data": {
    "session_id": "sess_98a72b01",
    "answer_markdown": "Found **1 critical anomaly** matching your criteria in Gujarat over the past 24 hours:\n\n1. **[EVT-IN-GUJ-202608-0042](event://EVT-IN-GUJ-202608-0042)**: Reliance Jamnagar Refinery Complex recorded a peak FRP of **450.0 MW** (+5.82σ above normal baseline). Active since 22:15 UTC.",
    "grounded_events": [
      {
        "event_id": "EVT-IN-GUJ-202608-0042",
        "facility_name": "Reliance Jamnagar Refinery Complex",
        "latitude": 22.47120,
        "longitude": 70.06310,
        "peak_frp_mw": 450.0,
        "anomaly_tier": "CRITICAL"
      }
    ],
    "matched_record_count": 1,
    "provenance": "PostGIS thermal_events table (Filter: state='Gujarat', anomaly_tier IN ('ABNORMAL','CRITICAL'), window='24h')"
  }
}
```

---

### 6.8 Tactical Intelligence Report Endpoints

#### `POST /api/v1/reports/generate`
Compile and export a publication-grade A4 PDF tactical incident dossier.

- **Request Body:**
```json
{
  "event_id": "EVT-IN-GUJ-202608-0042",
  "title": "Tactical Incident Assessment: Jamnagar Refinery Thermal Surge",
  "included_sections": [
    "EXECUTIVE_SUMMARY",
    "TELEMETRY_BREAKDOWN",
    "HISTORICAL_BASELINE",
    "GEOGRAPHIC_CONTEXT",
    "TIMELINE_DELTA",
    "SATELLITE_EVIDENCE"
  ]
}
```

- **Example Response (201 Created):**
```json
{
  "data": {
    "report_id": "RPT-20260829-0042",
    "event_id": "EVT-IN-GUJ-202608-0042",
    "title": "Tactical Incident Assessment: Jamnagar Refinery Thermal Surge",
    "download_url": "/api/v1/reports/download/RPT-20260829-0042.pdf",
    "sha256_checksum": "9f83a02...bc712",
    "generated_at": "2026-08-29T02:30:00Z",
    "status": "COMPLETED"
  }
}
```

#### `GET /api/v1/reports/download/{report_id}.pdf`
Download the compiled PDF file artifact.

---

### 6.9 System Health & Ingestion Endpoints

#### `GET /api/v1/health`
System operational status, database connectivity, and satellite ingestion freshness.

- **Example Response (200 OK):**
```json
{
  "status": "HEALTHY",
  "database": "CONNECTED_POSTGIS_16",
  "redis": "CONNECTED_REDIS_7",
  "ml_model_version": "thermo_xgb_v1.0.0",
  "latest_ingestion_utc": "2026-08-29T02:18:00Z",
  "active_events_count": 142,
  "critical_anomalies_count": 4
}
```

#### `POST /api/v1/admin/ingest/trigger`
Protected administrative trigger to force an incremental NASA FIRMS satellite ingest or replay demo data.
- **Headers:** `X-Admin-Key: <ADMIN_SECRET_KEY>`
- **Request Body:** `{ "sensor": "VIIRS_NOAA20", "hours_back": 6, "is_demo": false }`

---

## 7. Machine Learning & Backend Feature Interface Contract

```
+----------------------------------------------------------------------------------------------------+
|                                    14-DIMENSIONAL ML FEATURE VECTOR                                |
+---------------------+---------------+--------------------------------------------------------------+
| Feature Key         | Type          | Definition & Engineering Source                              |
+---------------------+---------------+--------------------------------------------------------------+
| `dist_ind_m`        | `float32`     | Distance to nearest OSM industrial boundary in meters        |
| `in_facility`       | `int32 (0/1)` | 1 if centroid is strictly inside an industrial polygon       |
| `facility_type_enc` | `int32 (0..7)`| One-hot integer encoding of sector category                  |
| `peak_frp_mw`       | `float32`     | Maximum single-pixel Fire Radiative Power (MW)               |
| `frp_density`       | `float32`     | Total FRP / Bounding Area in Ha (`MW/Ha`)      |
| `max_tb_k`          | `float32`     | Maximum channel 21/I-4 brightness temperature (K)            |
| `delta_tb_k`        | `float32`     | Max brightness temp minus background channel 31/I-5 temp (K) |
| `duration_h`        | `float32`     | Total elapsed hours between first and latest detection       |
| `night_ratio`       | `float32`     | Fraction of observations captured during night passes (`0..1`)|
| `obs_count`         | `int32`       | Total number of satellite sensor hits in cluster             |
| `hist_30d_hits`     | `int32`       | Number of historical detections within 500m past 30 days     |
| `hist_365d_freq`    | `int32`       | Number of active thermal days at site past 365 days          |
| `lc_crop_pct`       | `float32`     | Percentage of cluster area intersecting Cropland mask (`0..1`)|
| `lc_forest_pct`     | `float32`     | Percentage of cluster area intersecting Forest mask (`0..1`) |
+---------------------+---------------+--------------------------------------------------------------+
```

### 7.1 XGBoost Prediction Object Output Contract
```python
# Direct Output Schema returned by ML Model (.joblib)
{
    "primary_class": "IND_FIRE",
    "confidence_pct": 94.2,
    "class_probabilities": {
        "IND_FIRE": 0.942,
        "IND_FLARE": 0.038,
        "IND_ROUTINE": 0.012,
        "AGRI_BURN": 0.004,
        "WILDFIRE": 0.002,
        "OTHER_UNCERTAIN": 0.002
    },
    "feature_importances": {
        "in_facility": 0.38,
        "frp_z_score": 0.31,
        "duration_h": 0.18,
        "night_ratio": 0.13
    }
}
```

---

## 8. Complete System Integration & Acceptance Matrix

```
+----------------------------------------------------------------------------------------------------------------+
|                                      FULL-STACK COMPONENT INTEGRATION MATRIX                                   |
+---------------------+-----------------------------+---------------------------+--------------------------------+
| Product Feature     | PostGIS Entity Sources      | REST API Endpoint         | Primary Frontend Consumer UI   |
+---------------------+-----------------------------+---------------------------+--------------------------------+
| **GIS Map Canvas**  | `thermal_events`            | `GET /api/v1/gis/events`  | MapLibre GL JS WebGL Layer     |
| **Facility Overlay**| `industrial_facilities`     | `GET /api/v1/gis/facils`  | MapLibre Polygon Layer         |
| **Investigation**   | `events` + `class` + `anom` | `GET /api/v1/events/{id}` | 4-Tab Slide-Out Drawer         |
| **Earlier vs Now**  | `event_observations`        | `GET /api/v1/events/...`  | Multi-Pass Timeline Scrubber   |
| **Thermo News**     | `thermo_news`               | `GET /api/v1/news` (SSE)  | Live News Stream & Ticker      |
| **Notifications**   | `notifications`             | `GET /api/v1/notifs`      | Top Toast Banner & Drawer      |
| **Universal Search**| `facilities`, `events`      | `GET /api/v1/search`      | Top Omnibox Autocomplete       |
| **AI RAG Assistant**| `events` + `pgvector`       | `POST /api/v1/chat/query` | Analytical Terminal Drawer     |
| **Tactical Report** | `reports` + `events` (S3)   | `POST /api/v1/reports/...`| Print Preview & PDF Modal      |
+---------------------+-----------------------------+---------------------------+--------------------------------+
```

---

## 9. Contract Sign-Off & Approvals

| Role | Name / Identifier | Decision | Date |
| :--- | :--- | :--- | :--- |
| **Principal Solutions Architect** | Lead Backend Engineer | Approved | August 2026 |
| **Lead Frontend & GIS Architect** | Principal UI/UX Engineer | Approved | August 2026 |
| **Machine Learning Infrastructure Lead** | ML Platform Engineer | Approved | August 2026 |

---
*End of Database Schema & REST API Contract Document. This document serves as the frozen, authoritative contract for all subsequent software implementation.*
