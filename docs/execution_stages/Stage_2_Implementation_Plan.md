# Stage 2 Implementation Plan: Real Data Foundation & FIRMS Pipeline

This plan details the implementation of Stage 2: converting the Stage 1 foundation into a real-data foundation by ingesting NASA FIRMS telemetry, actual industrial facilities, and organizing ESA WorldCover TIFFs.

> [!WARNING]
> **No GitHub Pushes:** In accordance with your strict instructions, no code will be pushed to GitHub during this stage. All work will remain strictly local.

> [!IMPORTANT]
> **Strict Boundaries:** We will only implement data ingestion, validation, normalization, and deduplication. No ML models, no ST-DBSCAN clustering, and no UI redesigns will occur during this stage.

## User Review Required

Please review the open questions below regarding the actual source datasets before approving this plan.

## Open Questions

> [!IMPORTANT]
> 1. **Missing Data Files:** I scanned the workspace for `.csv` and `.tif` files, but did not find any actual industrial facility datasets or ESA WorldCover TIFFs. Would you like me to write the ingestion scripts assuming you will drop the files into `data/raw/` later, or do you have a script/link for me to download them automatically during implementation?
> 2. **FIRMS Key:** I will add `FIRMS_MAP_KEY=` to `.env.example`. When testing the FIRMS client, should I skip the actual API call if you haven't provided the key in `.env` yet, or will you add your real key so I can run the end-to-end test?
> 3. **Interval Discrepancy:** The Workflow document specifies a 15-minute polling interval for FIRMS, but the Data/ML doc specifies 30 minutes. I will default to **15 minutes** in the configuration unless you specify otherwise.

## Proposed Changes

---

### 1. Data Directory Organization & Metadata Manifests

We will establish a clean, strict data hierarchy and manifest tracking system.

#### [NEW] `data/raw/firms/`
#### [NEW] `data/raw/facilities/` (with WRI, GEM, PPAC, OSM subfolders)
#### [NEW] `data/raw/landcover/`
#### [NEW] `data/manifests/`
#### [NEW] `backend/scripts/init_data_dirs.py`
A script to cleanly initialize these directories without polluting the repository.

---

### 2. Facility Data Pipeline

We will build the ingestion pipeline to parse CSVs for facilities, convert them to `industrial_facilities` models, and insert them with provenance.

#### [NEW] `backend/scripts/ingest_facilities.py`
- Discovers CSVs in `data/raw/facilities/`.
- Normalizes columns to map to `name`, `sector_category`, `facility_code`.
- Extracts `Latitude` and `Longitude` to create PostGIS `POINT` or `MULTIPOLYGON` strings.
- Inserts into PostgreSQL using SQLAlchemy, saving original attributes into `metadata_json` to preserve provenance.
- Generates a data quality report upon completion.

---

### 3. WorldCover Data Preparation

We will organize the TIFF files and build a discovery mechanism.

#### [NEW] `backend/scripts/prepare_worldcover.py`
- Uses `rasterio` to inspect TIFF files in `data/raw/landcover/`.
- Extracts CRS, bounds, and resolution without loading the entire raster into memory.
- Writes metadata to `data/manifests/worldcover_manifest.json` so the later spatial engine can instantly discover which tile to open for a given coordinate.

---

### 4. NASA FIRMS API Client & Ingestion

We will create the backend service to communicate with NASA FIRMS and a worker script to run the ingestion batch.

#### [NEW] `backend/app/services/firms_client.py`
- HTTP client using `httpx`.
- Reads `FIRMS_MAP_KEY` from environment.
- Queries India Bounding Box (Lon: 68-97, Lat: 6-36).
- Handles HTTP 429 and 5xx errors with exponential backoff.

#### [NEW] `backend/scripts/ingest_firms.py`
- Calls `firms_client.py`.
- Parses returned CSV.
- Computes `dedup_key` using SHA256 as contractually defined.
- Batch inserts rows into `thermal_observations` using `ON CONFLICT DO NOTHING`.
- Logs statistics to stdout (fetched, valid, duplicated, inserted).
- Can be triggered manually or via cron/Celery (configured for 15 minutes).

#### [MODIFY] `backend/tests/test_api.py`
- Add integration tests for FIRMS deduplication logic (mocking the HTTP response).

## Verification Plan

### Automated Tests
- Run `pytest` to verify FIRMS row normalization and `dedup_key` logic.
- Run deduplication verification: ingest the same FIRMS mock payload twice and assert that observation count does not increase on the second run.

### Manual Verification
- Run `python backend/scripts/ingest_facilities.py` and query the DB to verify PostGIS Points are valid.
- Run `python backend/scripts/ingest_firms.py` (if the MAP_KEY is provided) to verify real India telemetry successfully lands in `thermal_observations`.
- Verify the frontend MapLibre canvas successfully pulls the real data (or facility data) from the existing API endpoints.
