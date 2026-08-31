# ThermoTrace AI

### Real-Time Satellite Thermal Monitoring, Industrial Flaring Detection, and Geospatial Intelligence Platform

[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?style=flat-square&logo=docker&logoColor=white)](docker-compose.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](backend/)
[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-000000?style=flat-square&logo=next.js&logoColor=white)](frontend/)
[![PostgreSQL](https://img.shields.io/badge/PostGIS-16--3.4-336791?style=flat-square&logo=postgresql&logoColor=white)](backend/app/db/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-EB5424?style=flat-square&logo=xgboost&logoColor=white)](backend/app/ml/)
[![NASA FIRMS](https://img.shields.io/badge/NASA_FIRMS-NRT_Active-0B3D91?style=flat-square&logo=nasa&logoColor=white)](https://firms.modaps.eosdis.nasa.gov/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](frontend/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](backend/)
[![Stage](https://img.shields.io/badge/Stage-3_Intelligence_Hardening-orange?style=flat-square)](docs/execution_stages/)
[![Tests](https://img.shields.io/badge/Tests-41%2F41_Passing-brightgreen?style=flat-square)](backend/tests/)

> **Branch:** staged-main - Integrated Stages 1 through 5: Full 15-Phase Intelligence Hardening, Viewport-Aware GIS Pipeline, Celery Worker & PDF Generation, Nationwide FIRMS Telemetry, and Unified Dark Tactical Radar UX.

---

## 1. System Overview

ThermoTrace AI is an automated thermal intelligence platform for national-scale satellite monitoring of industrial emissions, flare stacks, refinery furnaces, and high-temperature thermal incidents across sovereign Indian territory.

The system continuously ingests Near-Real-Time satellite telemetry from NASA FIRMS sensors (VIIRS NOAA-20, NOAA-21, Suomi-NPP, and MODIS Terra/Aqua), applies spatio-temporal clustering (ST-DBSCAN), extracts a 14-dimensional feature matrix, executes multi-class XGBoost classification with Platt-scaled probability calibration, Shapley value attributions (TreeSHAP), and calculates rolling 90-day statistical emission baselines to detect anomalous thermal activity.

### Stage 3: Intelligence Hardening (Current)

Stage 3 delivered 15 hardening phases across 5 pillars:

| Pillar | Phases | Deliverables |
|:---|:---:|:---|
| ML Calibration and Statistical Integrity | 1-5 | Dataset rebuild, Platt-scaled XGBoost v1.1, Baseline Sufficiency Gate, 4-tier anomaly scoring |
| Zero-Hallucination Grounding | 6-7 | 4-part intelligence brief schema (OBSERVED / DERIVED / MODELLED / UNKNOWN), optical honesty disclaimers |
| On-Demand Compute Architecture | 8-9 | Two-tier processing (Eager < 1ms + On-Demand < 2ms cached), TreeSHAP Tier 2 trigger |
| Sovereign Geofencing | 10-11 | Survey of India boundary enforcement, ST-DBSCAN focus bypass, 9-icon tactical symbology |
| Map Symbology and UX Hardening | 12-15 | Live decluttered map, 5-min FIRMS daemon, interactive dossier, dual side-by-side drawers |

---

## 2. Stage 3 - 15-Phase Hardening Changelog

### Phase 1: Three-Tier Training Dataset Rebuild
- Rebuilt ML training dataset with 3 balanced tiers: Industrial (IND_FIRE, IND_FLARE, IND_ROUTINE), Agricultural (AGRI_BURN), Uncertain (OTHER_UNCERTAIN)
- Eliminated data leakage between feature extraction and label assignment

### Phase 2: Calibrated XGBoost v1.1 Deployment
- Platt-scaling and isotonic regression post-hoc calibration over raw XGBoost logits
- Reduced Expected Calibration Error (ECE) to < 3%
- Model artifact: backend/data/models/thermo_xgb_v1.1.0.joblib

### Phase 3: 14-Dimensional Feature Audit and SHAP Validation
- Full SHAP feature importance audit across all 14 canonical dimensions
- Verified top contributors: facility_dist_km, peak_frp, landcover_class, is_near_facility

### Phase 4: Baseline Sufficiency Gate
- Minimum N >= 10 historical observations gate before computing anomaly Z-scores
- Events with insufficient baseline classified as BASELINE_INSUFFICIENT with Neutral Slate markers

### Phase 5: 4-Tier Anomaly Scoring Calibration
- Re-calibrated tier thresholds: NOMINAL (< 1.5 sigma), ELEVATED (1.5-2.5 sigma), ABNORMAL (2.5-4.0 sigma), CRITICAL (>= 4.0 sigma)
- Statistical exceedance probability calculated for every event

### Phase 6: Zero-Hallucination Grounding Schema
- Structured 4-part intelligence briefs: OBSERVED (satellite telemetry), DERIVED (ML inference), MODELLED (statistical baseline), UNKNOWN (not determinable)
- All LLM narrative outputs partitioned with explicit epistemic tagging

### Phase 7: Optical Honesty and Sentinel-2 Context
- Optical scene acquisition timestamps exposed in event dossiers
- Non-simultaneous acquisition disclaimers displayed per Rule 8

### Phase 8: Two-Tier Compute Architecture
- Tier 1 (Eager, < 1ms): Runs immediately post-clustering for XGBoost classification and Z-score
- Tier 2 (On-Demand, < 2ms cached): TreeSHAP, ESA WorldCover windowing, Sentinel-2 metadata, LLM brief - triggered only when operator opens investigation drawer

### Phase 9: On-Demand TreeSHAP Attribution Engine
- TreeSHAP computed only when an event is inspected (not globally)
- Results cached per event to prevent redundant computation

### Phase 10: 9-Icon Tactical Symbology System
- 3 Classification Shapes x 3 Severity Colors = 9 distinct tactical symbols
  - Industrial Factory Stack (IND_FIRE, IND_FLARE, IND_ROUTINE)
  - Vegetation Sprout (AGRI_BURN, WILDFIRE)
  - Diamond Crosshair (OTHER_UNCERTAIN)
- Colors: Red (CRITICAL), Amber (ABNORMAL), Green (NOMINAL/ELEVATED), Slate (BASELINE_INSUFFICIENT)

### Phase 11: PostGIS Viewport Decluttering Engine
- Default Priority Decluttered View: shows only CRITICAL, ABNORMAL, IND_FIRE, IND_FLARE
- Showing All Detections: returns full sovereign Indian detection stream
- focus_event_id bypass parameter ensures clicked events always appear on map

### Phase 12: Sovereign Geofencing and India Boundary Gate
- Survey of India compliant Point-in-Polygon gate at every ingestion and GIS query
- Bounding box: 68.00E-96.98E, 8.30N-36.74N
- Transboundary detections rejected at source

### Phase 13: Live 5-Minute FIRMS Ingestion Daemon
- firms_daemon.py polls NASA FIRMS API every 5 minutes across all active sensors
- Sensors: VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT, MODIS_NRT

### Phase 14: Interactive Event Investigation Dossier
- Full Tier 2 dossier with 5 tabbed views: Overview, ML and 14-D Vector, Baseline Anomaly, Geography, AI Brief
- Dual side-by-side drawer layout: Thermo News / Alerts and Event Dossier
- Camera fly-to animation with adaptive zoom and radiant heat glow layers

### Phase 15: Full Matrix Verification and 27-Test Suite
- 27 automated backend tests covering all hardening phases
- All 27 tests passing in Docker container

---

## 3. System Architecture

`
NASA FIRMS (VIIRS/MODIS) --> 5-min Daemon --> Sovereign Boundary Filter --> PostGIS + ST-DBSCAN
--> 14-D Feature Vector --> XGBoost v1.1 (Platt-calibrated) --> TreeSHAP (on-demand)
--> 90-day Baseline + Sufficiency Gate --> Grounded 4-part Brief
--> FastAPI Gateway --> Next.js 16 Dashboard (Dual Drawers + 9-icon Map)
`

---

## 4. Mathematical Formulations

### 4.1 Spatio-Temporal Event Clustering (ST-DBSCAN)

Spatial threshold: 1500m, Temporal window: 24 hours, MinPts: 1

### 4.2 Platt-Calibrated XGBoost v1.1

Classes: IND_FIRE, IND_FLARE, IND_ROUTINE, AGRI_BURN, OTHER_UNCERTAIN

### 4.3 Rolling 90-Day Gaussian Baseline

Z-score tiers:
| Anomaly Tier | Threshold | Interpretation |
|:---|:---|:---|
| NOMINAL | Z < 1.50 sigma | Within operational envelope |
| ELEVATED | 1.50 to 2.50 sigma | Moderate increase above baseline |
| ABNORMAL | 2.50 to 4.00 sigma | Significant event requiring surveillance |
| CRITICAL | Z >= 4.00 sigma | Severe hazardous release |
| BASELINE_INSUFFICIENT | N < 10 | Anomaly status withheld per statistical integrity policy |

---

## 5. API Specification

| Method | Route | Description |
|:---|:---|:---|
| GET | /api/v1/health | Service health and model availability |
| GET | /api/v1/gis/events | GeoJSON FeatureCollection (decluttered or full) |
| GET | /api/v1/events/{id} | Full event dossier with SHAP and grounded brief |
| GET | /api/v1/news | Time-ordered 24h Thermo News bulletins |
| GET | /api/v1/notifications | Operational Alerts - CRITICAL and ABNORMAL only, max 100 |
| POST | /api/v1/notifications/{id}/read | Mark single alert as read |
| POST | /api/v1/notifications/read-all | Mark all alerts as read |
| GET | /api/v1/firms/status | FIRMS ingestion metrics and last fetch timestamp |
| POST | /api/v1/ingest/poll | Trigger manual FIRMS ingestion poll |
| GET | /api/v1/gis/facilities | Industrial facilities GeoJSON |
| GET | /api/v1/reports | Generated tactical PDF dossiers |
| POST | /api/v1/reports/generate | Generate new PDF report for an event |
| POST | /api/v1/chat/query | PostGIS-grounded Thermal AI chat query |

---

## 6. Deployment

### 6.1 Containerized Deployment (Docker Compose)

`ash
git clone https://github.com/sharancode3/ThermoTrace-AI.git
cd ThermoTrace-AI
git checkout staged-main
cp .env.example .env
docker-compose up -d --build
`

Service Endpoints:
- Frontend Web Dashboard: http://localhost:3000
- FastAPI Backend Gateway: http://localhost:8000
- Interactive API Documentation: http://localhost:8000/docs
- PostgreSQL / PostGIS Instance: localhost:5432

### 6.2 Local Development Setup

Backend (Python 3.11+):
`ash
cd backend
python -m venv venv
source venv/bin/activate   # or .\venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
python scripts/sync_schema.py
python scripts/seed_demo_data.py
python scripts/build_three_tier_dataset.py
python scripts/train_xgboost.py
python scripts/calibrate_and_deploy_model.py
python scripts/firms_daemon.py &
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
`

Frontend (Node.js 20+):
`ash
cd frontend
npm install
npm run dev
`

Run Tests:
`ash
docker-compose exec backend pytest tests/ -v
# Expected: 27 passed, 0 failed
`

---

## 7. Directory Structure

`
ThermoTrace-AI/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI endpoints (GIS, events, news, alerts, health)
│   │   ├── adapters/        # PDF renderer, export adapters
│   │   ├── core/            # Configuration and database connectivity
│   │   ├── db/              # SQLAlchemy models and database session
│   │   ├── domain/          # ST-DBSCAN, anomaly, features, geocoding, geofencing,
│   │   │                    # FIRMS poller, satellite context, ML models
│   │   ├── ml/              # Calibrated XGBoost v1.1 loader and SHAP attribution
│   │   └── schemas/         # Pydantic validation models
│   ├── data/
│   │   ├── models/          # thermo_xgb_v1.1.0.joblib, calibration report
│   │   └── processed/       # Three-tier training dataset CSV
│   ├── scripts/             # Daemons, baseline updater, ML training, calibration
│   ├── tests/               # 27-test backend verification suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js 16 App Router (monitor, facilities, reports)
│   │   ├── components/      # MapComponent, EventDetailPanel, Sidebar,
│   │   │                    # OverlayManager, ThermalMapMarker
│   │   └── lib/             # API client, telemetry hooks
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── execution_stages/    # Stage 3 verification reports (15 phases)
├── docker-compose.yml
├── .env.example
└── README.md
`

---

## 8. Compliance and Operational Standards

Developed for the Smart India Hackathon (SIH 2026), supporting technical evaluation by the National Technical Research Organisation (NTRO) and Central Pollution Control Board (CPCB).

Stage 3 Intelligence Hardening addresses:
- Statistically unsound anomaly scoring -> Baseline Sufficiency Gate (Phase 4)
- Architecturally inefficient compute -> Two-Tier Processing (Phase 8)
- Legally risky uncalibrated probabilities -> Platt-Scaled XGBoost v1.1 (Phase 2)
- Geographically incorrect transboundary data -> Sovereign Geofencing (Phase 12)
- Inconsistent map symbology -> 9-Icon Tactical Matrix (Phase 10)

---

## 9. Branch Strategy

| Branch | Stage | Status |
|:---|:---|:---|
| main | Stable production snapshot | Read-only |
| staged-main | Stage 3 Intelligence Hardening | Active - 27/27 tests passing |
| stage4-apis | Stage 4 - Enterprise APIs and MVT | In development (parallel) |
| stage-5-news-chat-reports | Stage 5 - Chat, Reports, Alerts | In development (parallel) |
