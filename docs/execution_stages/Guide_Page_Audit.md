# Guide Page Audit & Implementation Plan

**Document Version:** 1.0.0  
**Target:** ThermoTrace AI System Guide & Operational Reference (`/guide`)  
**Scope:** Frontend `/guide` route and dedicated helper components only.  
**Git Rule:** No Git push, no staging, no commits. Pure local changes.

---

## 1. Current Guide Page Audit & Deficiencies

### Identified Deficiencies in Existing `guide/page.tsx`:
1. **Limited Coverage:** Currently has only 8 hardcoded cards. Missing critical sections:
   - Data Sources & Lifecycle Pipeline
   - Confidence, Calibration & Uncertainty Handling
   - TreeSHAP & Feature Vector Explainability
   - Anti-Hallucination Grounded AI Workflow
   - Trust, Reliability, Leakage-Aware Validation & Data Integrity
   - Implemented vs. Future Scope explicit two-column distinction
   - Scientific Limitations & Responsible Interpretation
   - Complete 15-stage Architecture Pipeline & Tech Stack
2. **Missing Interactivity & Epistemic Modes:**
   - No **Simple / Technical explanation toggle** (`Simple` for high-level non-technical evaluators, `Technical` revealing equations, exact PostGIS operators, and SHAP vectors).
   - No interactive searchable & expandable glossary for core terminology (FIRMS, FRP, Brightness Temp, ST-DBSCAN, TreeSHAP, Z-Score, etc.).
   - No active sticky section navigation with smooth scrolling.
3. **Typography & Aesthetic Inconsistencies:**
   - Needs strict typography hierarchy with modern clean cards, mathematical callouts, and seamless dark aerospace theme support.

---

## 2. Verified Technical Facts & Project Constants

| System Area | Verified Technical Ground Truth |
| :--- | :--- |
| **Satellites & Sensors** | NASA FIRMS LANCE (VIIRS S-NPP 375m I-band, VIIRS NOAA-20 375m, VIIRS NOAA-21 375m, MODIS Terra/Aqua 1km). |
| **Geographic Scope** | Sovereign Indian Territory & EEZ (`[68.0°E – 97.5°E, 6.5°N – 37.5°N]`). |
| **Event Formation** | ST-DBSCAN (`eps_spatial = 750m–3500m`, `eps_temporal = 12h`, `min_pts = 1`, convex hull polygons). |
| **Classification Model** | Dual-Stage Calibrated **XGBoost** (`thermo_xgb_v1.0.0.joblib`) with TreeSHAP explainability. |
| **Canonical Classes** | `IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`, `AGRI_BURN`, `WILDFIRE`, `OTHER_UNCERTAIN`. |
| **14 Canonical Features** | `dist_to_facility`, `facility_category_encoded`, `peak_frp_mw`, `mean_frp_mw`, `frp_variance`, `max_brightness_k`, `duration_hours`, `day_night_ratio`, `historical_active_days_90d`, `historical_peak_frp`, `pct_cropland`, `pct_forest`, `pct_urban`, `is_industrial_zone`. |
| **Baselines & Anomalies** | Rolling 90-day empirical facility baseline ($Z = \frac{\text{Observed FRP} - \mu}{\sigma}$). Tiers: `NORMAL` ($Z < 1.5$), `ELEVATED` ($1.5 \le Z < 2.5$), `ABNORMAL` ($2.5 \le Z < 4.0$), `CRITICAL` ($Z \ge 4.0$). |
| **Persistence Enums** | `TRANSIENT`, `INTERMITTENT`, `PERSISTENT`. |
| **Grounded AI / Chat** | Retrieval-Augmented Generation (RAG) over verified PostGIS database records using `<VERIFIED_DATA>` delimiter and strict anti-hallucination validation. |
| **Reports** | Deterministic PDF dossiers with dual UTC/IST timestamps, SHA-256 integrity hash verification, and High-DPI Matplotlib/ReportLab rendering. |

---

## 3. Comprehensive 16-Section Information Architecture

1. **01. Hero / Executive Overview** (Thermal Intelligence for Geospatial Monitoring & Industrial Risk Awareness).
2. **02. The Problem We Solve** (Raw Hotspot Observations vs. Context-Aware Thermal Intelligence — Before/After Matrix).
3. **03. How ThermoTrace AI Works** (10-Stage End-to-End Visual Pipeline).
4. **04. Data Sources & Data Lifecycle** (NASA FIRMS, OSM/GEM Facilities, ESA WorldCover Land-Cover).
5. **05. Spatio-Temporal Thermal Event Formation** (ST-DBSCAN Clustering, Convex Hull Geometries).
6. **06. Context Fusion Engine** (Spatial, Industrial, Land-Cover, Temporal, and Historical Feature Synthesis).
7. **07. Machine Learning Classification & Uncertainty** (XGBoost Multi-Class, Softmax Calibration, `OTHER_UNCERTAIN` handling).
8. **08. TreeSHAP & Transparent Explainability** (Feature importance drivers vs. causal claims).
9. **09. 90-Day Empirical Baselines & Z-Score Anomaly Engine** (Equation $Z = \frac{\text{FRP} - \mu}{\sigma}$, Baseline Sufficiency, Persistence Tiers).
10. **10. Geospatial Investigation & Viewport LOD** (PostGIS GiST indexing, MapLibre WebGL, Earlier vs. Now Delta).
11. **11. Application Surfaces Architecture** (Live Radar Map, Thermo News, Alerts Queue, Grounded Chat, PDF Reports).
12. **12. Grounded AI & Anti-Hallucination Framework** (Context injection `<VERIFIED_DATA>`, Deterministic parameter extraction).
13. **13. Trust, Reliability & Provenance** (Spatial K-Fold cross-validation, SHA-256 signatures, 70-test test suite pass rate).
14. **14. Currently Implemented vs. Future Research Scope** (Visually distinct two-column comparison).
15. **15. Scientific Limitations & Responsible Interpretation** (Satellite cadence, cloud occlusion, probabilistic confidence).
16. **16. System Architecture Summary & Technical Tech Stack** (End-to-End Diagram, Engineering Stack, Interactive Glossary & Codex).
