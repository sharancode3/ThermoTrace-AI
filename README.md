# ThermoTrace AI (Thermo Intelligence)
### National-Scale Satellite Thermal Monitoring, Industrial Flaring Detection & Autonomous Intelligence Platform

[![Docker Compose](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](backend/)
[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-000000?logo=next.js&logoColor=white)](frontend/)
[![PostgreSQL](https://img.shields.io/badge/PostGIS-16--3.4-336791?logo=postgresql&logoColor=white)](backend/app/db/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-EB5424?logo=xgboost&logoColor=white)](backend/app/domain/)
[![NASA FIRMS](https://img.shields.io/badge/NASA_FIRMS-NRT_Active-0B3D91?logo=nasa&logoColor=white)](https://firms.modaps.eosdis.nasa.gov/)

ThermoTrace AI is an enterprise-grade, real-time thermal intelligence and satellite monitoring system built for national technical research and environmental compliance agencies (e.g., NTRO, CPCB). The platform ingests real-time Near-Real-Time (NRT) satellite telemetry from NASA FIRMS (VIIRS NOAA-20, NOAA-21, Suomi-NPP, and MODIS), executes spatio-temporal clustering (ST-DBSCAN), runs 14-dimensional calibrated XGBoost machine learning classification with additive SHAP explanations, performs rolling 90-day Gaussian statistical baseline anomaly detection, and provides an interactive command dashboard with full Google Maps integration.

---

## 🏛️ System Architecture

```text
                               ┌────────────────────────────────────────┐
                               │  NASA FIRMS NRT Satellite Data API     │
                               │  (VIIRS NOAA-20/21/SNPP + MODIS)       │
                               └──────────────────┬─────────────────────┘
                                                  │ (5-Min Live Polling)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │  FIRMS Live Daemon & Sovereign Mask    │
                               │  - Deduplication via Unique Keys       │
                               │  - India Landmass Spatial Filter       │
                               └──────────────────┬─────────────────────┘
                                                  │ Raw Observations
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │  PostgreSQL 16 + PostGIS Database      │
                               │  - GIST Spatio-Temporal Indexing       │
                               │  - 3,000+ Registered Facilities        │
                               └──────────────────┬─────────────────────┘
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
┌─────────────────────────────────┐                             ┌─────────────────────────────────┐
│ Spatio-Temporal Event Engine    │                             │ ML & Baseline Intelligence      │
│ - ST-DBSCAN Clustering (1500m)  │                             │ - 14-D Feature Extraction       │
│ - Convex Hull Footprint Area    │                             │ - Calibrated XGBoost Inference  │
│ - Multi-Pass Persistence Tiers  │                             │ - SHAP TreeExplainer Attrib     │
│ - Facility Proximity (< 2.5km)  │                             │ - Rolling 90-Day Gaussian Bell  │
└────────────────┬────────────────┘                             └────────────────┬────────────────┘
                 │                                                                 │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │  FastAPI Backend (High-Perf REST API)  │
                               │  - `/api/events`, `/api/gis-events`    │
                               │  - `/api/events/{id}/intelligence`     │
                               │  - `/api/news/feed`, `/api/facilities` │
                               └──────────────────┬─────────────────────┘
                                                  │ Real-Time JSON Telemetry
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │  Next.js 14 Web Command Center         │
                               │  - Locked Google Maps (Road / Hybrid)  │
                               │  - Multi-Tier Radiant Heat Haze Glow   │
                               │  - 3-Column Tactical Command Dossier   │
                               │  - 4-Part Grounded LLM Intelligence    │
                               └────────────────────────────────────────┘
```

---

## ✨ Key Capabilities & Implemented Features

### 1. 🛰️ Real-Time NASA FIRMS Ingestion
- Continuous background polling daemon fetching live satellite passes across India every **5 minutes**.
- Multi-sensor ingestion: **VIIRS Suomi-NPP** (375m), **VIIRS NOAA-20** (375m), **VIIRS NOAA-21** (375m), and **MODIS Terra/Aqua** (1km).
- Deduplication using composite natural keys (`{lat}_{lon}_{date}_{time}_{sat}`).
- **Sovereign India Geographic Mask:** Enforces strict boundary verification (`8.30°N–36.74°N`, `68.00°E–96.98°E`), actively rejecting Sri Lanka and oceanic noise.

### 2. 🧠 Spatio-Temporal Clustering & Feature Extraction
- **ST-DBSCAN Event Aggregator:** Clusters raw multi-satellite observations within **1500 meters** and **24 hours**.
- Computes Peak FRP ($MW$), Mean FRP, Day/Night observation ratio, thermal variance, duration, and centroid coordinates.
- Multi-pass persistence tiers:
  - `TRANSIENT` ($< 3	ext{ days}$)
  - `INTERMITTENT` ($3	ext{--}14	ext{ days}$)
  - `PERSISTENT` ($\ge 15	ext{ days}$)

### 3. 🎯 14-D Machine Learning Classification & SHAP
- **Calibrated XGBoost Model** categorizes thermal events into clear operational classes:
  - `IND_FLARE`: Industrial Gas Flaring
  - `IND_FIRE`: Industrial Incident / High-Heat Flare
  - `IND_PROCESS_HEAT`: Routine Facility Thermal Operations
  - `AGRI_BURN`: Agricultural Crop Residue / Stubble Burning
  - `WILDFIRE`: Forest / Vegetative Wildfire
- **Primary Operational Verdict:** Clearly surfaces whether an event is **INDUSTRIAL** or **NON-INDUSTRIAL** with posterior match confidence.
- **Explainable AI (XAI):** Additive SHAP feature contributions highlighting the top 4 drivers behind every classification.

### 4. 📈 Statistical Baseline Anomaly Detection ($\mu \pm \sigma$)
- Computes rolling 90-day facility emission baselines ($\mu = 	ext{mean FRP}$, $\sigma = 	ext{standard deviation}$).
- Calculates statistical $Z$-score deviations:
  $$Z = rac{	ext{Peak FRP} - \mu}{\sigma}$$
- Anomaly Classification Tiers:
  - `NORMAL`: $Z < 1.50\sigma$
  - `ELEVATED`: $1.50\sigma \le Z < 2.50\sigma$
  - `ABNORMAL`: $2.50\sigma \le Z < 4.00\sigma$
  - `CRITICAL`: $Z \ge 4.00\sigma$

### 5. 🗺️ High-Resolution Google Maps Command Interface
- **Permanently Locked Basemap:** High-resolution **Google Roadmap** & **Google Satellite Hybrid** with zero API key watermarks.
- **Adaptive Thermal Radiant Layers:**
  - Outer Radiant Heat Haze (soft Gaussian glow scaled to FRP).
  - Mid Dispersion Thermal Core (intense orange-red halo).
  - White-Hot Centroid Marker with pulsing radar rings.
- **3D Camera Fly-To:** Automatically centers and tilts camera ($0^\circ	ext{--}35^\circ$ pitch) when selecting incidents.

### 6. 📋 Multi-Column Tactical Command Dossier
- **3-Column Tactical Command Grid:**
  - **Col 1:** Sensor radiometry table (Peak FRP, Mean FRP, Brightness Temp, Pass Count, Duration, Thermal Trend) + Plain-English Alert Banner.
  - **Col 2:** 14-D canonical feature vector matrix + SHAP additive contribution bars.
  - **Col 3:** 90-day Gaussian bell curve SVG + Exceedance % + Facility proximity info.
  - **Full-Width Bottom:** 4-Part Grounded LLM Intelligence Brief (`OBSERVED`, `DERIVED`, `MODELLED`, `UNKNOWN`).

---

## 🚀 Quick Start & Deployment

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.20+)

### Launching the Full Stack
1. Clone the repository:
   ```bash
   git clone https://github.com/sharan-10/SiH-2026-ThermoTrace-AI.git
   cd SiH-2026-ThermoTrace-AI
   ```
2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
3. Build and launch all containers:
   ```bash
   docker-compose up -d --build
   ```
4. Access the web applications:
   - **Frontend Command Center:** [http://localhost:3000](http://localhost:3000)
   - **Live Thermal News Feed:** [http://localhost:3000/monitor?overlay=news](http://localhost:3000/monitor?overlay=news)
   - **FastAPI Interactive Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **PostgreSQL / PostGIS:** `localhost:5432` (`thermotrace` / `thermotrace_dev_pwd`)

---

## 📂 Repository Structure

```text
SiH-2026-ThermoTrace-AI/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints (events, news, facilities)
│   │   ├── core/            # App configuration & logging
│   │   ├── db/              # SQLAlchemy models & database session setup
│   │   └── domain/          # ML classifier, SHAP, anomaly engine & geocoding
│   ├── scripts/             # FIRMS live ingestion daemon & testing audits
│   ├── Dockerfile           # Backend container image
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js 14 App Router pages
│   │   ├── components/      # UI components (MapComponent, EventDetailPanel, Sidebar)
│   │   └── lib/             # API client & data fetchers
│   ├── Dockerfile           # Frontend Next.js container image
│   └── package.json         # Node.js dependencies
├── data/                    # Geospatial datasets & facility definitions
├── docs/                    # Authoritative PRD, TRD, UI/UX & ML documentation
├── docker-compose.yml       # Production/development stack orchestration
├── .env.example             # Template environment variables
└── README.md                # Platform documentation
```

---

## 🔒 Confidentiality & Intellectual Property
*Developed for the Smart India Hackathon (SIH 2026) / National Technical Research Organisation (NTRO).*
