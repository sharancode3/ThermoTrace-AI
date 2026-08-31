# Smart India Hackathon 2026 (SIH 2026) — Master PPT Winning Guide

## Project: ThermoTrace AI
- **Team Name:** Deadlock
- **Problem Statement ID:** 26162
- **Evaluating Agency:** National Technical Research Organisation (NTRO) / Central Pollution Control Board (CPCB)
- **Goal:** Transform your slides into a crystal-clear, high-impact winning presentation that any judge can understand in 15 seconds.

---

## Strategy: What SIH Judges Actually Look For
1. **Clarity Over Jargon:** Judges read 50+ decks a day. Simple, powerful explanations score higher than dense academic jargon.
2. **Clear Problem vs Solution:** Why do existing government tools fail, and how does your solution fix it?
3. **Working Practical Flow:** A logical step-by-step pipeline from satellite image to official alert.
4. **Real-World Impact:** How does this help India save lives, stop pollution, and detect industrial disasters early?

---

# Slide-by-Slide Exact Corrections

---

## Slide 1: Title Page

### What Judges Look For:
- Clear Problem Statement ID, Title, and a strong, memorable Project Name with a 1-line summary.

### Your Current Slide vs Recommended Polish:

#### Keep Your Exact Layout:
- **Left Side:** Clean bullet points.
- **Right Side:** SIH Logo.

#### What to Update in Your Text:
1. **Add Project Branding at the top:**
   - **Project Name:** `ThermoTrace AI`
   - **Tagline:** `AI-Powered Satellite Thermal Intelligence & Industrial Fire Monitoring System`

2. **Clean up the bullet points (Fix spacing and formatting):**
   - **Problem Statement ID:** `26162`
   - **Problem Statement Title:** `AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data`
   - **Theme:** `Disaster Management`
   - **Category:** `Software`
   - **Team Name:** `Deadlock`
   - **Team ID:** `[Your Team ID]`

---

## Slide 2: Proposed Solution (Idea / Prototype)

### What Judges Look For:
- A simple comparison showing why existing satellite tools fail and why your system is 10x better.
- A clean, easy-to-follow architecture diagram on the right.

---

### Part 1: Left Table Corrections (6 Rows)

| Step | Existing Systems (What Judges see today) | ThermoTrace AI (How our system solves it) |
|:---|:---|:---|
| **1. Data Ingestion** | Shows raw, scattered satellite heat dots; includes unwanted noise and foreign cross-border data. | **Automatically fetches NASA satellite heat data every 5 minutes and filters only sovereign Indian territory.** |
| **2. Event Clustering** | Individual heat dots are not grouped, creating clutter and confusing the operator. | **Smart clustering (ST-DBSCAN) combines nearby heat points from multiple satellite passes into one single real-world fire event.** |
| **3. Context Fusion** | Officials must manually look up maps to see what factory or land is at that location. | **Automatically overlays satellite land-use data (farms, forests, cities) and 27+ major industrial plant boundaries.** |
| **4. AI Classification** | Cannot tell if heat is a routine factory chimney, a flare, crop burning, or a wildfire. | **Trained AI model accurately classifies the heat source into 6 clear categories (e.g. Industrial Fire, Farm Fire, Flare).** |
| **5. Baseline Analytics** | Uses one rigid temperature cutoff for all factories, causing frequent false alarms. | **Learns each factory's normal 90-day heat baseline so it only triggers alarms during real abnormal spikes or emergencies.** |
| **6. Actionable Output** | Sends raw coordinates that are hard for field officers to interpret. | **Generates live news bulletins, instant risk alerts, interactive AI chat, and 1-click legal PDF incident reports.** |

---

### Part 2: Right Flowchart Corrections (Keep Your Existing Shapes)

Keep all your existing shapes and arrows. Update the text inside the boxes so it is simple, clean, and easy to read:

1. **Top 3 Input Boxes:**
   - `NASA Satellite Data (VIIRS & MODIS)`
   - `Industrial Map Data (Refineries & Power Plants)`
   - `Land Cover Data (ESA WorldCover 10m)`
2. **Box 1 (Below Inputs):** `Data Ingestion & India Sovereign Boundary Filter`
3. **Box 2:** `Event Formation (Smart Spatio-Temporal Clustering)`
4. **Box 3:** `Context Fusion (Combines Land Cover + Plant Location + Heat Intensity)`
5. **Split Boxes (Parallel):**
   - **Left Box:** `AI Classifier (Identifies exact fire type: Factory, Farm, Forest)`
   - **Right Box:** `Baseline Engine (Compares against plant history to spot abnormal spikes)`
6. **Merge Box:** `Thermal Intelligence Output (Fire Type + Confidence % + Severity Tier)`
7. **Application Layer (5 Feature Buttons):**
   - `[Live Map Radar]` `[Thermo News]` `[Alerts Queue]` `[AI Assistant]` `[PDF Reports]`
8. **Bottom Box:** `Secure Spatial Database (PostgreSQL / PostGIS)`

---

### Part 3: The 3 Core Innovations (Uniqueness Highlight):
1. **Zero False Alarms:** Distinguishes routine factory flaring from real accidental fires using plant-specific historical baselines.
2. **Multi-Source AI Classification:** Instantly separates crop burning, forest fires, and industrial blazes.
3. **Instant Incident Briefs:** Converts raw satellite heat pixels into 1-click tamper-proof PDF reports for rapid disaster response.

---

## Slide 3: Technical Approach & Workflow

### What Judges Look For:
- Clear technology choices (languages, frameworks, libraries).
- A logical, step-by-step implementation process and workflow.

---

### Part 1: Top-Left Tech Stack (Cleanly Grouped)

Organize your technology icons into 4 simple buckets so judges can read it instantly:

- **Satellite & Spatial:** NASA FIRMS API, ESA WorldCover, PostGIS Spatial DB, GeoPandas
- **AI & Analytics:** Python 3.11, XGBoost Machine Learning, Scikit-learn, ST-DBSCAN
- **Backend & Pipeline:** FastAPI, Redis, Docker, ReportLab (PDF Engine)
- **Frontend Dashboard:** Next.js 16, TypeScript, MapLibre GL, Tailwind CSS

---

### Part 2: Bottom-Left 4-Step Methodology Chevrons

Replace the text inside your 4 chevron boxes with clear, action-oriented engineering steps:

- **Chevron 01:**
  - **Title:** `01. Ingest & Geofence`
  - **Text:** Automatically pull NASA satellite feeds every 5 mins and filter within Indian sovereign borders.
- **Chevron 02:**
  - **Title:** `02. Cluster & Context`
  - **Text:** Group multi-pass heat points into single events and enrich with 10m land-cover and plant boundary data.
- **Chevron 03:**
  - **Title:** `03. Classify & Baseline`
  - **Text:** Classify combustion source using AI and compare against 90-day plant baselines to catch abnormal anomalies.
- **Chevron 04:**
  - **Title:** `04. Alert & Report`
  - **Text:** Display on live tactical map, dispatch real-time alerts, and generate automated PDF incident dossiers.

---

### Part 3: Right-Side Workflow Flowchart (Step-by-Step Execution)

Update the text inside your flowchart boxes:

1. **Step 1:** `Start: Satellite Pass Detects Thermal Hotspots Across India`
2. **Step 2:** `Filter Data: Remove Non-Sovereign Passes Outside Indian Territory`
3. **Step 3:** `Cluster Observations: Group Nearby Detections into a Single Fire Event`
4. **Step 4:** `Context Fusion: Add Land Cover (Farm / Forest / Urban) and Plant Distance`
5. **Decision Diamond:** `Is Fire Detected?`
   - *No:* `Log Normal Background & Await Next Satellite Pass`
   - *Yes:* Continue to Step 6
6. **Step 6:** `AI Classification & Baseline Check: Identify Fire Type & Check for Abnormal Heat Spike`
7. **Step 7:** `Output Intelligence: Assign Severity (Critical / Abnormal / Normal)`
8. **Step 8 (Action Dispatch):**
   - `[Live Map Radar]` $ightarrow$ View exact location and heat footprint
   - `[Thermo News]` $ightarrow$ Real-time public intelligence bulletin
   - `[Risk Alerts]` $ightarrow$ Priority notification to authorities
   - `[PDF Report]` $ightarrow$ Download forensic brief for enforcement
9. **End:** `Continuous 24/7 Monitoring Cycle`

---

## Slide 4: Feasibility, Viability & Potential Impact
*(Ready for next slide upload)*

---

## Slide 5: Technology Stack & Novelty
*(Ready for next slide upload)*

---

## Slide 6: Conclusion & Deliverables
*(Ready for next slide upload)*
