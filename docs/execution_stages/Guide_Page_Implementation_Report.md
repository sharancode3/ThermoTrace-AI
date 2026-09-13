# Authoritative System Guide & Info Page Implementation Report

**Document Identifier:** DOC-STAGE-GUIDE-3.3.0  
**Project:** ThermoTrace AI (SIH 2026 / NTRO / CPCB Domain)  
**Status:** Completed & Browser Verified  
**Date:** September 2, 2026  

---

## 1. Executive Summary

The **System Guide & Operational Reference Page** (`/guide`) of ThermoTrace AI has been transformed into a technical, interactive, and educational reference designed for evaluators, SIH judges, domain analysts, and system operators.

All changes are strictly contained within the `/guide` frontend route and its dedicated data modules (`frontend/src/app/(workspace)/guide/page.tsx` and `guideData.ts`). No backend modifications were introduced.

---

## 2. 17-Chapter Architecture Structure

| Chapter | Title | Content Delivered |
| :--- | :--- | :--- |
| **01** | **Executive Overview** | Vision statement, sovereign mandate (CPCB/NTRO), horizontal 7-stage architectural pipeline overview. |
| **02** | **The Problem We Solve** | Detailed side-by-side comparison of uncontextualized raw satellite points vs. ThermoTrace context-aware intelligence. |
| **03** | **How ThermoTrace AI Works** | Step-by-step technical breakdown from NRT ingestion to cryptographic dossier export. |
| **04** | **Data Sources & Lifecycle** | NASA FIRMS (VIIRS/MODIS), GEM/OSM Industrial Registry, and ESA WorldCover 10m LULC rasters with database table lifecycle matrix. |
| **05** | **Event Formation** | Spatio-temporal ST-DBSCAN clustering ($ε_s = 3.5\text{km}$, $ε_t = 12\text{h}$) with PostGIS convex hull geometries. |
| **06** | **Context Fusion Engine** | Exact definition of the 14-dimensional normalized feature vector across spatial, radiometric, land-cover, temporal, and historical axes. |
| **07** | **Machine Learning Classifier** | Production XGBoost model (`thermo_xgb_v1.0.0.joblib`), 6 canonical classes (`IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`, `AGRI_BURN`, `WILDFIRE`, `OTHER_UNCERTAIN`), and epistemic uncertainty rules. |
| **08** | **TreeSHAP Explainability** | Shapley value feature attribution bar graphs, model confidence calibration, and non-causal interpretability guidelines. |
| **09** | **Baselines & Anomaly Engine** | Mathematical formulation of rolling 90-day baselines, Z-Score equation $Z = \frac{\text{Observed} - \mu}{\sigma}$, and standard anomaly tiers (`NORMAL`, `ELEVATED`, `ABNORMAL`, `CRITICAL`). |
| **10** | **GIS Investigation Layer** | MapLibre GL JS WebGL rendering, level-of-detail (LOD) zoom streaming, and Earlier vs. Now delta inspection. |
| **11** | **Application Surfaces** | Deep-dive into all 5 system surfaces: Live Sovereign Radar (`/monitor`), Thermo News, Operational Alerts, Strategic Facilities (`/facilities`), and PDF Reports (`/reports`). |
| **12** | **Grounded AI Architecture** | RAG framework with `<VERIFIED_DATA>` XML delimiter context injection and output reference scrubbing to eliminate hallucinations. |
| **13** | **Trust & Reliability** | Spatial K-Fold cross validation (preventing spatial leakage), SHA-256 report digital signatures, and 70/70 automated test suite status. |
| **14** | **Implemented vs. Future Scope** | Visually distinct two-column matrix separating active capabilities from the future research roadmap. |
| **15** | **Scientific Limitations** | Transparent documentation of satellite orbital overpass intervals, monsoon cloud attenuation, sub-pixel aggregation, and probabilistic interpretation. |
| **16** | **System Architecture & Stack** | Technology stack matrix spanning Next.js 16, MapLibre GL JS, FastAPI, PostGIS, XGBoost, and ReportLab. |
| **17** | **Interactive Glossary** | Dynamic codex featuring 15+ domain terms with category filtering and real-time instant search. |

---

## 3. Interactive Features Built

1. **Executive vs. Technical Mode Switcher:**
   - **Executive Mode:** Clean conceptual explanations for high-level evaluators and decision makers.
   - **Technical / Formulas Mode:** Displays exact mathematical formulations, PostGIS spatial queries, Python feature keys, and academic literature citations.
2. **Sticky In-Page Navigation:**
   - Left-sidebar navigator providing instant smooth scrolling to all 17 chapters with active highlighting.
3. **Searchable & Categorized Glossary:**
   - Real-time search across terms and technical details, with category pills (`Space & Telemetry`, `Spatial & GIS`, `Machine Learning`, `Baselines & Anomaly`, `Architecture`).
