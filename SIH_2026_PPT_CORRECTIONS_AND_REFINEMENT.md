# Smart India Hackathon 2026 (SIH 2026) — Presentation Slide Polish & Master Refinement Guide

## Project: ThermoTrace AI
- **Team Name:** Deadlock
- **Problem Statement ID:** PS 26162 (SIH162)
- **Evaluating Agency:** National Technical Research Organisation (NTRO) / Central Pollution Control Board (CPCB)
- **Design Philosophy:** Keep your exact PowerPoint visual layout (Table on Left, Flowchart on Right), but polish the wording inside every existing box to make it sharp, accurate, and 10/10 evaluator-ready.

---

## Slide 2: Proposed Solution (1-to-1 Word Polish for Your Existing PPT)

Your existing layout (Table on Left, Flowchart on Right) is already structured well. Below are the **exact, polished text replacements** to plug straight into your existing PowerPoint shapes.

---

### Part 1: Left Table Text Replacements (Keep Your 6 Rows)

| Step | Existing Systems (What to write in Column 2) | ThermoTrace AI (What to write in Column 3) |
|:---|:---|:---|
| **Data Ingestion** | Displays raw, unverified FIRMS points; high noise and transboundary clutter. | **Automates 5-min multi-satellite ingestion (VIIRS & MODIS) with sovereign geofencing.** |
| **Event Clustering** | No spatio-temporal grouping; creates severe visual clutter and alert fatigue. | **ST-DBSCAN clusters multi-pass detections (1500m / 24h) into unified physical events.** |
| **Context Fusion** | Manual cross-referencing with facility registries and land-use maps. | **Automated PostGIS joins fuse 10m ESA WorldCover, zoning & Sentinel-2 optical data.** |
| **ML Classification** | Cannot distinguish routine industrial flares from blazes or stubble fires. | **Calibrated XGBoost (ECE < 3.2%) classifies 6 combustion types with TreeSHAP XAI.** |
| **Baseline Analytics** | Relies on static, uncalibrated temperature / FRP thresholds. | **Rolling 90-day facility Gaussian baselines detect true anomalies using Z-scores.** |
| **Actionable Intelligence** | Generates isolated point alerts without forensic legal validity. | **Delivers real-time Thermo News, alert queue, grounded AI chat & SHA-256 PDF dossiers.** |

---

### Part 2: Right Flowchart Text Replacements (Keep Your Exact Diagram Shapes)

Use the exact same boxes and arrows already in your slide, just update the text inside each box:

#### Top 3 Input Boxes (Top of diagram):
- **Box 1 (Left):** `NASA FIRMS Telemetry (VIIRS 375m & MODIS 1km)`
- **Box 2 (Middle):** `Industrial Data (27 Strategic Facilities)`
- **Box 3 (Right):** `Land Cover Data (ESA WorldCover 10m)`

#### Flowchart Vertical Steps:
1. **Box 1 (Below Inputs):** `Data Ingestion & Sovereign Geofencing Filter`
2. **Box 2:** `Event Formation (ST-DBSCAN Clustering: 1500m / 24h)`
3. **Box 3:** `Context Fusion (14-D Spatial, Temporal & Land-Cover Matrix)`
4. **Split Parallel Boxes (Step 4):**
   - **Left Branch:** `ML Classifier (Calibrated XGBoost v1.1) Source Classification (6 Classes)`
   - **Right Branch:** `Baseline & Anomaly Engine (90-Day Gaussian Baselines) Z-Score Anomaly Detection`
5. **Merge Box (Step 5):** `Thermal Intelligence Output (Class + Confidence + Z-Score + TreeSHAP Attribution)`
6. **Application Layer Box (Step 6):** Contains your 5 pill buttons:
   - `[Tactical Map]` `[Thermo News]` `[Alerts Queue]` `[Grounded AI Chat]` `[SHA-256 PDF Dossiers]`
7. **Bottom Box (Step 7):** `Data Storage (PostgreSQL 16 / PostGIS 3.4 Spatial DB)`

---

### Part 3: What Made This Slide 10/10
1. **Zero Layout Distortion:** Preserved your clean two-column layout.
2. **Accurate Engineering Terms:** Replaced *"12-month baselines"* with the hardened **"Rolling 90-Day Gaussian Baselines ($Z$-scores)"**.
3. **Regulatory Punchwords:** Added **Sovereign Geofencing**, **ECE < 3.2% Calibration**, **TreeSHAP Explainability**, and **SHA-256 PDF Provenance**—the exact phrases NTRO and CPCB evaluators grade for.

---

## Slide 3: Technical Approach / Methodology
*(Awaiting your Slide 3 screenshot or text for the same 1-to-1 polish)*
