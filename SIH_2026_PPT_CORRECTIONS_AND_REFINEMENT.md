# Smart India Hackathon 2026 (SIH 2026) — Presentation Slide Polish & Master Refinement Guide

## Project: ThermoTrace AI
- **Team Name:** Deadlock
- **Problem Statement ID:** PS 26162 (SIH162)
- **Evaluating Agency:** National Technical Research Organisation (NTRO) / Central Pollution Control Board (CPCB)
- **Design Philosophy:** Keep your exact PowerPoint layout (Boxes, Chevrons, Flowcharts), but polish the wording inside every existing shape to make it 10/10 evaluator-ready.

---

## Slide 1: Title Page (1-to-1 Text Replacements)

### 1. Evaluator Focus & First Impression
- Evaluators look at Slide 1 to verify problem alignment and notice project branding.
- **Current Rating:** `8.0 / 10`
- **Key Polish Points:**
  1. Add prominent **Project Title & Tagline** (`ThermoTrace AI`).
  2. Clean up uneven spacing around hyphens and colons.
  3. Include the **Evaluating Agency** (`NTRO / CPCB`) to immediately establish domain alignment.

---

### 2. Exact 10/10 Slide 1 Text Replacements (Keep Your Layout)

#### A. Main Project Header (Top / Center):
- **Project Name:** `ThermoTrace AI`
- **Tagline:** `Autonomous Sovereign Satellite Thermal Intelligence & Industrial Anomaly Monitoring Platform`

---

#### B. Bulleted Information Block (Left Side):

- **Problem Statement ID:** `26162`
- **Problem Statement Title:** `AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data`
- **Theme:** `Disaster Management`
- **PS Category:** `Software (Deep-Tech Geospatial AI)`
- **Evaluating Agency:** `National Technical Research Organisation (NTRO) / CPCB`
- **Team ID:** `[Insert Your Team ID]`
- **Team Name:** `Deadlock`

---

#### C. 15-Second Speaker Pitch Cue for Slide 1
> *"Respected Evaluators, we are Team Deadlock presenting ThermoTrace AI for Problem Statement 26162: AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources. ThermoTrace AI is an automated, sovereign-compliant geospatial intelligence platform designed to eliminate false alarms, classify multi-source combustion, and detect critical industrial anomalies in near-real-time across India."*

---

## Slide 2: Proposed Solution (1-to-1 Text Replacements)

### Part 1: Left Table Text Replacements (Keep Your 6 Rows)

| Step | Existing Systems (Column 2) | ThermoTrace AI (Column 3) |
|:---|:---|:---|
| **Data Ingestion** | Displays raw, unverified FIRMS points; high noise and transboundary clutter. | **Automates 5-min multi-satellite ingestion (VIIRS & MODIS) with sovereign geofencing.** |
| **Event Clustering** | No spatio-temporal grouping; creates severe visual clutter and alert fatigue. | **ST-DBSCAN clusters multi-pass detections (1500m / 24h) into unified physical events.** |
| **Context Fusion** | Manual cross-referencing with facility registries and land-use maps. | **Automated PostGIS joins fuse 10m ESA WorldCover, zoning & Sentinel-2 optical data.** |
| **ML Classification** | Cannot distinguish routine industrial flares from blazes or stubble fires. | **Calibrated XGBoost (ECE < 3.2%) classifies 6 combustion types with TreeSHAP XAI.** |
| **Baseline Analytics** | Relies on static, uncalibrated temperature / FRP thresholds. | **Rolling 90-day facility Gaussian baselines detect true anomalies using Z-scores.** |
| **Actionable Intelligence** | Generates isolated point alerts without forensic legal validity. | **Delivers real-time Thermo News, alert queue, grounded AI chat & SHA-256 PDF dossiers.** |

---

### Part 2: Right Architecture Diagram (Keep Your Existing Shapes)
1. **Top 3 Input Boxes:** `NASA FIRMS Telemetry (VIIRS 375m / MODIS 1km)` | `Industrial Data (27 Strategic Facilities)` | `Land Cover Data (ESA WorldCover 10m)`
2. **Box 1 (Below Inputs):** `Data Ingestion & Sovereign Geofencing Filter`
3. **Box 2:** `Event Formation (ST-DBSCAN Clustering: 1500m / 24h)`
4. **Box 3:** `Context Fusion (14-D Spatial, Temporal & Land-Cover Matrix)`
5. **Split Parallel Boxes:**
   - **Left Box:** `ML Classifier (Calibrated XGBoost v1.1) Source Classification (6 Classes)`
   - **Right Box:** `Baseline & Anomaly Engine (90-Day Gaussian Baselines) Z-Score Anomaly Detection`
6. **Merge Box:** `Thermal Intelligence Output (Class + Confidence + Z-Score + TreeSHAP Attribution)`
7. **Application Layer (5 Pills):** `[Tactical Map]` `[Thermo News]` `[Alerts Queue]` `[Grounded AI Chat]` `[SHA-256 PDF Dossiers]`
8. **Bottom Box:** `Data Storage (PostgreSQL 16 / PostGIS 3.4 Spatial DB)`

---

## Slide 3: Technical Approach (1-to-1 Text Replacements)

Your existing Slide 3 layout (**Tech Stack top-left, 4 Chevrons bottom-left, Flowchart right**) is already laid out. Below are the **exact text enhancements** for your shapes.

---

### Part 1: Top-Left Tech Stack (Categorized Pillars)

Instead of a scattered logo dump, group your tech logos or labels into 4 clean horizontal pillars:

| Category | Core Technologies |
|:---|:---|
| **Satellite & Spatial Data** | NASA FIRMS (VIIRS / MODIS), ESA WorldCover 10m, Sentinel-2 MSI, PostGIS 3.4, GeoPandas, Rasterio |
| **Calibrated AI & Analytics** | Python 3.11, Calibrated XGBoost v1.1 (Platt Scaling), TreeSHAP XAI, Scikit-learn, ST-DBSCAN |
| **Backend & Ingestion** | FastAPI, Celery, Redis 7, SQLAlchemy PostGIS, ReportLab (Vector PDF), Docker Compose |
| **Tactical Radar UI** | Next.js 16 (App Router), TypeScript, MapLibre GL JS, Tailwind CSS, Server-Sent Events (SSE) |

---

### Part 2: Bottom-Left 4-Step Methodology Chevrons

Replace the text inside your 4 chevron boxes with these punchy, technical engineering steps:

- **Chevron 01:**
  - **Header:** `01. Ingestion & Sovereign Geofencing`
  - **Body Text:** Autonomous 5-min polling daemon across VIIRS (375m) & MODIS (1km); filters points via Survey of India sovereign territorial polygon.

- **Chevron 02:**
  - **Header:** `02. ST-DBSCAN & 14-D Feature Fusion`
  - **Body Text:** Groups multi-pass points ($arepsilon=1500	ext{m}, \Delta t=24	ext{h}$); extracts 14-D matrix (Peak/Mean FRP, Land Cover %, Facility Distance, Diurnal Ratio).

- **Chevron 03:**
  - **Header:** `03. Calibrated ML & 90-Day Baselines`
  - **Body Text:** Platt-scaled XGBoost ($ECE < 3.2\%$) classifies 6 combustion types; computes 90-day Gaussian facility baselines ($Z = rac{	ext{FRP}-\mu}{\sigma}, N \ge 10$).

- **Chevron 04:**
  - **Header:** `04. Tactical UI, XAI & Forensic PDF`
  - **Body Text:** Renders MapLibre radar (camera offset $[-180, 0]$), TreeSHAP decision drivers, grounded RAG AI chat, and SHA-256 checksummed vector PDF briefs.

---

### Part 3: Right-Side Flowchart (1-to-1 Box Text Replacements)

Keep all your existing flowchart shapes and connectors exactly as they are. Just update the text inside each step:

```text
[ START ]
   │
   ▼
[ Step 1: Ingest NASA FIRMS Telemetry (VIIRS & MODIS NRT Data) ]
   │
   ▼
[ Step 2: Apply Survey of India Sovereign Territorial Geofence ]
   │
   ▼
[ Step 3: ST-DBSCAN Spatio-Temporal Clustering (1500m / 24h Window) ]
   │
   ▼
[ Step 4: Context Extraction (14-D Features: Land Cover, Zoning, Facility Proximity) ]
   │
   ▼
< Decision Diamond: Thermal Cluster Formed? >
   ├───> [ No ] ───> [ Log Routine Background / Await Next Polling Cycle ]
   │
   └───> [ Yes ]
           │
           ▼
[ Step 5: Execute Platt-Calibrated XGBoost (6 Classes) & 90-Day Baseline Engine (Z-Scores) ]
           │
           ▼
[ Step 6: Generate Thermal Intelligence Package (Class + Probability + Anomaly Tier + TreeSHAP) ]
           │
           ▼
[ Step 7: Render Tactical Radar Map & Dispatch Alerts ]
           │
     ┌─────┴──────────────────┬─────────────────────┬──────────────────┐
     ▼                        ▼                     ▼                  ▼
[ Thermo News ]        [ Alert Queue ]       [ Grounded Chat ]   [ SHA-256 PDF ]
(24h Bulletins)        (Critical/Abnormal)   (Active Context)    (Forensic Brief)
     └─────┬──────────────────┴─────────────────────┴──────────────────┘
           │
           ▼
        [ END ]
```

---

### Part 4: 30-Second Speaker Pitch Cue for Slide 3
> *"Moving to our technical approach: our system is built on a resilient geospatial stack powered by PostGIS, FastAPI, and Next.js 16. The pipeline begins with autonomous 5-minute multi-sensor polling and sovereign boundary filtering. Observations are clustered using ST-DBSCAN and enriched into a 14-dimensional feature vector. From there, our Platt-calibrated XGBoost classifier predicts the exact combustion source while our empirical 90-day baseline engine computes statistical Z-score anomalies. Finally, operators receive real-time tactical radar visualization, TreeSHAP decision drivers, and SHA-256 signed forensic PDF briefs for enforcement."*

---

## Slide 4: Feasibility, Viability & Potential Impact
*(Awaiting your Slide 4 screenshot or text for the same 1-to-1 polish)*
