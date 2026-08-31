# Smart India Hackathon 2026 (SIH 2026) — Presentation Deck Audit & 10/10 Refinement Guide

## Project: ThermoTrace AI
- **Team Name:** Deadlock
- **Problem Statement ID:** PS 26162 (SIH162)
- **Evaluating Agency:** National Technical Research Organisation (NTRO) / Central Pollution Control Board (CPCB)
- **Theme:** Clean & Green Technology / Space Technology / Disaster & Homeland Security
- **Goal:** Provide a comprehensive, slide-by-slide audit, rating, and word-for-word copy-paste replacement content to achieve a 10/10 qualifying submission deck for SIH 2026.

---

## Slide 1: Idea Title & Problem Definition

### 1.1 Evaluator Focus
- Problem clarity and alignment with the evaluating ministry.
- High-level impact and core value proposition.

### 1.2 Status
- **Review Status:** Pending User Review / Initial Template
- **Target Grade:** 10 / 10

---

## Slide 2: Proposed Solution (Describe your Idea/Solution/Prototype)

### 2.1 Evaluator Focus
- Clear, defensible architectural pipeline.
- Explicit contrast between traditional systems and ThermoTrace AI.
- Concrete technical innovations rather than generic software claims.

### 2.2 Current Audit & Score
- **Current Rating:** `7.5 / 10`
- **Identified Weaknesses in Original Slide:**
  1. *Inaccurate Baseline Horizon:* The original slide stated *"12-month baselines"*, whereas the actual hardened operational standard is a **Rolling 90-Day Empirical Gaussian Baseline ($N \ge 10$)**.
  2. *Generic Terminology:* Phrases like *"validates and deduplicates"* fail to communicate the technical rigor of our **5-Minute Multi-Sensor Poller with Survey of India Sovereign Geofencing**.
  3. *Omitted Calibration & XAI:* Failed to highlight **Platt-Scaled & Isotonic Calibration ($ECE < 3.2\%$)** and **On-Demand TreeSHAP Decision Drivers**, which are critical for NTRO/CPCB regulatory validity.
  4. *Generic Architecture Labels:* Boxes labeled *"Data Storage"* or *"Event Formation"* missed exact technical specifications.

---

### 2.3 Exact 10/10 Slide 2 Replacement Content

#### Slide Header & Title
- **Slide Header:** `IDEA TITLE: THERMOTRACE AI`
- **Slide Title:** `Proposed Solution: Automated Sovereign Satellite Thermal Intelligence Platform`
- **Sub-caption:** *An end-to-end, defense-grade platform converting raw NASA FIRMS multi-sensor telemetry into calibrated, facility-baselined, and audit-ready intelligence dossiers.*

---

#### Left Column: Value Proposition & Existing Systems vs. ThermoTrace AI Table

| Pipeline Stage | Existing Systems (NASA FIRMS / State Web Portals) | ThermoTrace AI (Our Proposed Solution) |
|:---|:---|:---|
| **1. Telemetry Ingestion** | Displays isolated, unverified raw hotspot pixels; suffers from transboundary non-sovereign data pollution. | **Autonomous 5-min multi-sensor poller (VIIRS 375m & MODIS 1km) with Survey of India sovereign geofencing filter.** |
| **2. Event Formation** | No spatio-temporal grouping; causes severe visual clutter and operator alarm fatigue. | **ST-DBSCAN clustering ($\varepsilon=1500\text{m}, \Delta t=24\text{h}$) aggregates multi-pass passes into unified physical combustion events.** |
| **3. Context Fusion** | Manual cross-referencing with facility lists and satellite land-use registries. | **Automated PostGIS spatial joins fuse ESA WorldCover 10m land cover, facility buffers, and Sentinel-2 MSI optical context.** |
| **4. ML Classification** | Cannot distinguish routine flaring from blazes or agricultural stubble burning. | **Platt-Calibrated XGBoost v1.1 ($ECE < 3.2\%$) classifies 6 combustion tiers with on-demand TreeSHAP decision attribution.** |
| **5. Baseline & Anomaly** | Relies on static, uncalibrated temperature/FRP thresholds. | **Empirical 90-day Gaussian facility baselines ($N \ge 10$) score statistical $Z$-deviations across 4 severity tiers (Critical to Nominal).** |
| **6. Tactical Action** | Emits raw pixel coordinates without forensic legal validity. | **Real-time geocoded Thermo News feed, live SSE alert queue, grounded RAG AI chat, and SHA-256 signed vector PDF dossiers.** |

---

#### Right Column: Clean Technical Architecture Flowchart

```text
[ Data Sources: NASA FIRMS (VIIRS NOAA-20/21/SNPP & MODIS Terra/Aqua) + ESA WorldCover 10m + 27 Industrial Baselines ]
                                     │
                                     ▼
        [ Ingestion & Preprocessing: 5-Min Ingestion Daemon + Sovereign Geofencing Filter ]
                                     │
                                     ▼
        [ Spatio-Temporal Clustering: ST-DBSCAN Engine (eps=1500m, time_window=24h) ]
                                     │
                                     ▼
        [ Context Fusion: 14-D Feature Engineering + ESA 10m Buffer + Sentinel-2 MSI Match ]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [ Calibrated XGBoost v1.1 ]              [ 90-Day Empirical Baselines ]
    (Platt-Scaled, ECE < 3.2%)               (Z = [FRP - μ] / σ, N >= 10)
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
      [ Tier 2 Compute: TreeSHAP Shapley Attribution + Epistemic AI Grounding ]
                                     │
                                     ▼
        [ Application Layer: MapLibre Tactical Radar | Thermo News | RAG Chat | SHA-256 PDF ]
                                     │
                                     ▼
             [ Spatial Storage: PostgreSQL 16 + PostGIS 3.4 Spatial Database ]
```

---

#### Bottom Banner: 3 Core Uniqueness & Innovation Pillars
1. **Calibrated Multi-Class ML ($ECE < 3.2\%$):** Replaces uncalibrated heuristics with Platt-scaled probabilities and TreeSHAP explainability.
2. **Empirical 90-Day Facility Baselines:** Statistical $Z$-score anomaly grading eliminates false alarms from authorized operational flaring.
3. **Forensic Integrity & Grounded AI:** Grounded RAG chat with zero hallucinations and tamper-proof SHA-256 signed PDF dossiers for environmental enforcement.

---

## Slide 3: Technical Approach / Methodology
*(Awaiting user slide upload for audit)*

---

## Slide 4: Feasibility, Viability & Potential Impact
*(Awaiting user slide upload for audit)*

---

## Slide 5: Technology Stack & Novelty
*(Awaiting user slide upload for audit)*

---

## Slide 6: Conclusion, Team Matrix & Deliverables
*(Awaiting user slide upload for audit)*
