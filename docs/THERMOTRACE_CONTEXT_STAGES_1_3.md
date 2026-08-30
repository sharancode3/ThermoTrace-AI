# ThermoTrace AI: Complete Technical Context & System Handover (Stages 1–3)

**Document Version:** 3.0.0  
**Target Audience:** Antigravity AI Agents, Lead Engineers, Defense/Compliance System Integrators  
**Repository Remote:** `https://github.com/sharancode3/ThermoTrace-AI.git`  
**Active Branch:** `main`  
**Operational Status:** Stage 1, Stage 2, and Stage 3 Fully Implemented, Verified, and Pushed.

---

## 1. Executive Summary & Platform Identity

* **Platform Name:** ThermoTrace AI (Thermo Intelligence)
* **Institutional Context:** Developed for the Smart India Hackathon (SIH 2026) under operational guidelines from the National Technical Research Organisation (NTRO) and Central Pollution Control Board (CPCB).
* **Core Problem Solved:** Space-borne thermal sensors (VIIRS/MODIS) detect thousands of daily raw heat pixels across India. Manual inspection cannot distinguish whether a high-heat signature is a hazardous oil refinery gas flare, routine steel mill blast furnace, agricultural stubble fire, or forest wildfire.
* **Core Solution:** An automated end-to-end pipeline that continuously polls real-time satellite data, clusters observations across space and time (ST-DBSCAN), runs a 14-dimensional calibrated XGBoost machine learning classifier with TreeSHAP explainability, computes 90-day statistical emission baselines, and presents live actionable tactical dossiers on a high-resolution, locked Google Maps interface.

---

## 2. Immutable Architectural Policies (Rules That Must Never Be Broken)

When continuing development or modifying this codebase, the following rules are strictly enforced:

1. **Locked Google Maps Engine:** Google Maps (`GOOGLE_ROADMAP` and `GOOGLE_HYBRID` satellite) is permanently locked as the base map in `frontend/src/components/MapComponent.tsx`. Never revert to CartoDB or placeholder tile layers. Google Maps provides deep zoom down to individual furnace stacks and flare tips with zero API key watermarks.
2. **Sovereign India Geo-Fencing:** All data ingestion and clustering strictly enforces the sovereign Indian bounding box (`8.30°N–36.74°N`, `68.00°E–96.98°E`). Sri Lanka, Pakistan, Bangladesh, and oceanic noise are actively filtered out at the domain level (`geocoding.py` and `live_firms_ingestion.py`).
3. **No Mock or Dummy Intelligence:** All intelligence values in the UI (FRP, Brightness Temp, XGBoost class probabilities, SHAP values, and Gaussian Z-scores) must be derived from genuine FIRMS satellite records and trained ML models. No hardcoded or dummy events are permitted in production tables.
4. **Grounded LLM Intelligence Schema:** Any intelligence summary must strictly follow the four-part schema: `OBSERVED`, `DERIVED`, `MODELLED`, and `UNKNOWN` to eliminate hallucinations.
5. **Clean Vector UI:** Zero Unicode emojis in production components. Use Lucide React vector SVG icons.

---

## 3. Detailed Stage-by-Stage Implementation History

### Stage 1: Ingestion, Database Architecture & Spatio-Temporal Clustering
* **NASA FIRMS Live Ingestion Daemon (`backend/scripts/live_firms_ingestion.py`):**
  * Periodically streams active fire observations from VIIRS Suomi-NPP (375m), VIIRS NOAA-20 (375m), VIIRS NOAA-21 (375m), and MODIS (1km).
  * Enforces composite key deduplication: `hash(latitude, longitude, acq_date, acq_time, satellite)`.
  * Filters out non-India landmass points using ray-casting polygon checks.
* **Geospatial Database Layer (`backend/app/db/`):**
  * PostgreSQL 16 + PostGIS 3.4.
  * Tables: `thermal_observations`, `thermal_events`, `event_observations`, `industrial_facilities`, `event_classifications`, `event_anomalies`, `thermo_news`.
  * Spatial `GIST` indices on `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`.
* **3,000+ Industrial Facility Registry (`data/raw/facilities/`):**
  * Ingested from Global Energy Monitor (GEM), Petroleum Planning & Analysis Cell (PPAC), and World Resources Institute (WRI India).
  * Covers refineries, gas plants, steel mills, cement factories, chemical complexes, and coal mines.
* **ST-DBSCAN Event Aggregator (`backend/app/domain/clustering.py`):**
  * Spatial radius ($\epsilon_s$): `1500 meters`.
  * Temporal window ($\epsilon_t$): `24 hours`.
  * Aggregates raw single-pixel passes into persistent physical thermal clusters.

---

### Stage 2: 14-D Feature Engineering, Calibrated XGBoost & Baseline Anomaly Engine
* **Canonical 14-Dimensional Feature Matrix (`backend/app/domain/features.py`):**
  Every cluster is converted into a 14-D vector:
  1. `peak_frp`: Maximum Fire Radiative Power ($MW$).
  2. `mean_frp`: Mean radiative output across observations ($MW$).
  3. `frp_variance`: Variance in FRP (flaring instability vs steady furnace heat).
  4. `max_brightness_temp`: Peak 4-micron brightness temperature ($K$).
  5. `detection_count`: Total satellite observations in cluster.
  6. `pass_count`: Count of distinct satellite orbital overpasses.
  7. `duration_hours`: Lifespan of the thermal event ($t_{\max} - t_{\min}$).
  8. `night_ratio`: Fraction of nighttime observations ($|C_{	ext{night}}| / |C|$).
  9. `footprint_area_km2`: Spatial convex hull surface area ($km^2$).
  10. `facility_dist_km`: Distance to nearest registered industrial facility ($km$).
  11. `is_near_facility`: Binary indicator ($	ext{distance} < 2.5	ext{ km}$).
  12. `facility_type_code`: One-hot encoded facility sector (Refinery, Steel, Cement, Power, Chemical, Mine).
  13. `landcover_class`: ESA WorldCover 10m land classification (Built-up, Cropland, Forest, etc.).
  14. `frp_density`: Radiative intensity per unit ground area ($	ext{Peak FRP} / (	ext{Area} + \epsilon)$).
* **Supervised Multi-Class XGBoost Model (`backend/app/ml/model.py`):**
  * Artifacts: `backend/data/models/thermo_xgb_v1.0.0.joblib` and `classes.npy`.
  * Classes: `Industrial Flare`, `Industrial Fire`, `Routine Industrial Heat`, `Wildfire / Agricultural`, `Urban Non-Industrial`.
  * Output: Primary verdict (`INDUSTRIAL` vs `NON-INDUSTRIAL`) + detailed category + calibrated posterior confidence percentage.
* **Explainable AI via TreeSHAP (`backend/app/ml/model.py`):**
  * Real-time Shapley value computation decomposing each prediction into additive feature weights ($f(\mathbf{x}) = \phi_0 + \sum_{i=1}^{14}\phi_i$).
  * Returns top 4 positive and negative feature drivers per event.
* **Rolling 90-Day Gaussian Baseline Engine (`backend/app/domain/anomaly.py`):**
  * Computes facility-level and sector-level historical statistics ($\mu_{90}, \sigma_{90}$).
  * Computes statistical $Z$-score: $Z = (	ext{Peak FRP} - \mu_{90}) / \sigma_{90}$.
  * Computes Cumulative Exceedance Probability: $\Phi(Z) 	imes 100\%$.
  * Tiers:
    * `NOMINAL`: $Z < 1.50\sigma$
    * `ELEVATED`: $1.50\sigma \le Z < 2.50\sigma$
    * `ABNORMAL`: $2.50\sigma \le Z < 4.00\sigma$
    * `CRITICAL`: $Z \ge 4.00\sigma$
* **Grounded LLM Synthesizer (`backend/app/domain/llm_humanizer.py`):**
  * Generates plain-English tactical alert briefs adhering strictly to `OBSERVED`, `DERIVED`, `MODELLED`, and `UNKNOWN`.

---

### Stage 3: Tactical Web Command Dashboard & Map Engine Fixes
* **Locked Google Maps Interface (`frontend/src/components/MapComponent.tsx`):**
  * MapLibre GL instance rendering Google Roadmap (`lyrs=m`) and Google Satellite Hybrid (`lyrs=y`).
  * Supports deep zoom up to level 22 with zero API keys or watermarks.
  * Adaptive radiant thermal energy layers:
    1. Outer Gaussian Heat Haze (soft luminous glow scaled to FRP).
    2. Mid Dispersion Thermal Core (intense orange-red halo).
    3. White-Hot Centroid Marker with animated radar pulse rings.
* **Expanded Tactical Dossier Grid (`frontend/src/components/EventDetailPanel.tsx`):**
  * Expandable `1080px` 3-column tactical analysis workspace:
    * **Column 1 (Radiometry):** Peak FRP, Mean FRP, Brightness Temp ($K$), Satellite Pass Count, Duration, Thermal Trend, and Plain-English Alert Banner.
    * **Column 2 (Feature Vector & SHAP):** 14-D feature matrix table with additive SHAP relative impact bars.
    * **Column 3 (Baseline Intelligence):** SVG Gaussian bell curve with $\mu \pm \sigma$ markers, exceedance percentage, and facility proximity cards.
    * **Full-Width Bottom:** Grounded 4-part intelligence brief (`OBSERVED`, `DERIVED`, `MODELLED`, `UNKNOWN`).
  * Replaced native horizontal scrollbars with segmented pill buttons.
  * 100% vector SVG icons (Lucide React) replacing Unicode emojis.
* **Real-Time Thermal Newsfeed (`frontend/src/components/Sidebar.tsx` & `/monitor`):**
  * Instant telemetry search, event filtering by anomaly tier (Critical, Elevated, Nominal), and category filters.

---

## 4. API Endpoints Reference

The FastAPI backend runs on `http://localhost:8000`:

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/v1/health` | Service health status, database connection, and model availability |
| `GET` | `/api/v1/gis/events` | GeoJSON FeatureCollection of all sovereign Indian thermal clusters |
| `GET` | `/api/v1/events/{id}` | Comprehensive event dossier including 14-D features, SHAP values, and baseline statistics |
| `GET` | `/api/v1/news` | Real-time classified thermal incident newsfeed |
| `GET` | `/api/v1/firms/status` | Current FIRMS ingestion metrics and timestamp of latest satellite overpass |

---

## 5. How to Run & Verify the System Locally

### Step 1: Backend Setup & Ingestion
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run Live Ingestion & ML Pipeline
python scripts/sync_schema.py
python scripts/live_firms_ingestion.py

# Start FastAPI Gateway
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 2: Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

### Step 3: Accessing the Dashboard
* **Frontend Web Dashboard:** `http://localhost:3000` (or `http://localhost:3000/monitor`)
* **Swagger API Documentation:** `http://localhost:8000/docs`
* **Health Check:** `http://localhost:8000/api/v1/health`

---

## 6. Next Steps & Stage 4 / Stage 5 Roadmap

If you are beginning Stage 4 or Stage 5, here is the intended milestone trajectory:

1. **Stage 4: Automated Dispatch & Alerting System:**
   * Automated webhook / email / SMS dispatch when an industrial event hits `CRITICAL` anomaly tier ($Z \ge 4.00\sigma$) or `Industrial Flare / Incident` classification.
   * Automated PDF tactical intelligence dossier exporter with satellite crop embeds and SHAP attribution plots.
2. **Stage 5: Predictive Analytics & Multi-Satellite Thermal Calibration:**
   * Time-series emission forecasting using autoregressive models (Prophet / LSTM).
   * Cross-calibration between VIIRS Day/Night Band (DNB) radiance ($nW \cdot cm^{-2} \cdot sr^{-1}$) and shortwave infrared (SWIR).
