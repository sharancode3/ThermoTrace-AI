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
[![Stage](https://img.shields.io/badge/Stage-Post--Stage--5_Hardening-brightgreen?style=flat-square)](docs/execution_stages/)
[![Tests](https://img.shields.io/badge/Tests-43%2F43_Passing-brightgreen?style=flat-square)](backend/tests/)

> **Branch:** `staged-main` — Complete Post-Stage-5 System Debug, Integration, ML Quality & UX Hardening (Phases 0–100 Verified).

---

## 1. System Overview

ThermoTrace AI is an automated thermal intelligence platform developed for national-scale satellite monitoring of industrial emissions, flare stacks, refinery furnaces, and high-temperature thermal incidents across sovereign Indian territory (SIH 2026 Problem Statement 162 — NTRO).

The system continuously ingests Near-Real-Time satellite telemetry from NASA FIRMS sensors (VIIRS NOAA-20, NOAA-21, Suomi-NPP, and MODIS Terra/Aqua), applies spatio-temporal clustering (ST-DBSCAN), extracts a canonical 14-dimensional feature vector, executes multi-class XGBoost classification with Platt-scaled probability calibration, calculates TreeSHAP Shapley value attributions on-demand, and computes rolling 90-day statistical emission baselines to detect anomalous thermal activity.

---

## 2. Key Architecture & Post-Stage-5 Hardening Highlights

### A. Dynamic Map Camera Offset & Marker Visibility
- Dynamic viewport calculation: `offset: [-180, 0]` for desktop and `[0, -80]` for mobile ensures active markers are never hidden under the 450px–930px sliding drawers.
- Guaranteed marker visibility layer (`displayFeatures`) synthesizes selected markers on the radar even if filtered out by active criteria.

### B. Multi-Criteria Filter Engine
- Unified composite query logic ($	ext{BBox} \land \Delta t \land \mathcal{S} \land \mathcal{C} \land 	ext{Priority}$) supporting 6h, 24h, 7d, 30d, and All timeframes.
- Distinct modal states for Loading, Empty, and Error — no false "No Thermal Events Found" screens.

### C. Decoupled Baseline & Classification Semantics
- Source classification (`IND_*`, `AGRI_BURN`, `WILDFIRE`) operates independently from 90-day facility baseline availability.
- Open-air hotspots without facility baselines are evaluated using physical radiative thresholds ($FRP \ge 150	ext{ MW} ightarrow 	ext{Critical}$, $FRP \ge 50	ext{ MW} ightarrow 	ext{Abnormal}$), preserving vivid 9-Icon tactical symbology without defaulting to neutral slate.

### D. Grounded Contextual RAG Chat
- Local LLM chat endpoint `/api/v1/chat/query` receives `selected_event_id` and automatically injects `<ACTIVE_SELECTED_EVENT>` and `<VERIFIED_DATA>` blocks into the prompt.
- Zero-hallucination sanitization ensures ungrounded identifiers or numbers are automatically redacted.

### E. Root-Level Theming Engine
- Zero-FOUC inline `<head>` script in `RootLayout` reading `localStorage.getItem('thermo_theme')` with Tailwind v4 `@custom-variant dark`.

---

## 3. 9-Icon Tactical Symbology Matrix

| Base Shape (Source Identity) | Nominal / Normal (🟢 Green) | Elevated (🟡 Gold) | Abnormal (🟠 Amber) | Critical (🔴 Red) | Insufficient Baseline (⚪ Slate) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Industrial (`IND_*`)** | Green Factory Stack | Gold Factory Stack | Amber Factory Stack | Pulsing Red Factory Stack | Slate Factory Stack |
| **Vegetation (`AGRI_*`, `WILD*`)** | Green Sprout Leaf | Gold Sprout Leaf | Amber Sprout Leaf | Pulsing Red Sprout Leaf | Slate Sprout Leaf |
| **Uncertain (`OTHER_UNCERTAIN`)** | Green Diamond | Gold Diamond | Amber Diamond | Pulsing Red Diamond | Slate Crosshair Diamond |

---

## 4. API Specification

| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/v1/health` | Service health, model version, and contract status |
| `GET` | `/api/v1/gis/events` | GeoJSON FeatureCollection with viewport bounding box & composite filters |
| `GET` | `/api/v1/events/{id}` | Full event dossier with 14-D features, TreeSHAP, and baseline diagnostics |
| `GET` | `/api/v1/news` | Time-ordered 24h Thermo News bulletins with Indian geocoding |
| `GET` | `/api/v1/notifications` | Operational Alerts queue (Critical & Abnormal incidents) |
| `POST` | `/api/v1/notifications/{id}/read` | Acknowledge single operational alert |
| `POST` | `/api/v1/notifications/read-all` | Acknowledge all operational alerts |
| `GET` | `/api/v1/firms/status` | Ingestion metrics, last fetch UTC, and sensor health |
| `POST` | `/api/v1/ingest/poll` | Trigger manual FIRMS ingestion cycle |
| `GET` | `/api/v1/gis/facilities` | Industrial facilities GeoJSON registry |
| `GET` | `/api/v1/reports` | Tactical PDF dossiers archive |
| `POST` | `/api/v1/reports/generate` | Generate vector ReportLab PDF dossier with SHA-256 stamp |
| `POST` | `/api/v1/chat/query` | Grounded Thermal AI chat query with active event context |

---

## 5. Verification & Test Suite

### Automated Backend Tests (Pytest)
```bash
docker-compose exec -T backend pytest
# Result: 43 passed, 0 failed (100% Pass Rate)
```

### Frontend Production Build (Turbopack)
```bash
cd frontend && npm run build
# Result: Compiled successfully with 0 TypeScript/ESLint errors
```

---

## 6. Deployment (Docker Compose)

```bash
git clone https://github.com/sharancode3/ThermoTrace-AI.git
cd ThermoTrace-AI
git checkout staged-main
cp .env.example .env
docker-compose up -d --build
```

**Service Endpoints:**
- Frontend Tactical Dashboard: `http://localhost:3000`
- FastAPI Backend Gateway: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- PostgreSQL / PostGIS Instance: `localhost:5432`
