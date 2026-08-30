# Stage 3.3 Subsystem Audit Report

**Date:** August 30, 2026  
**Auditor:** Antigravity AI Engine  
**Target:** Thermo Intelligence Thermal Analytics & Ingestion Core  

---

## 1. Subsystem Audit Matrix

| Subsystem | Status | Current Observed Behaviour & Deficiencies |
| :--- | :--- | :--- |
| **Event Processor (ST-DBSCAN)** | `PARTIALLY IMPLEMENTED` | Points clustered spatio-temporally, but lacks formal single vs. multi-observation evidentiary stratification and full lineage tracking. |
| **Feature Builder (`features.py`)** | `PARTIALLY IMPLEMENTED` | 14-dimension vector exists, but land-cover percentages (`pct_cropland`, `pct_forest`, `pct_urban`) are hardcoded defaults (0.0). Training and inference require a single unified builder. |
| **Model Loader (`anomaly.py`)** | `IMPLEMENTED` | Loads `thermo_xgb_v1.0.0.joblib` and `classes.npy` into module memory safely. |
| **Classification Engine** | `INCORRECT` | Occasional composite labels ("IND_FLARE / AGRI_BURN") emitted in reports. Must strictly output a single canonical class string (`IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`, `AGRI_BURN`, `WILDFIRE`, `OTHER_UNCERTAIN`). |
| **Probability Calibration** | `PARTIALLY IMPLEMENTED` | L2 regularization prevents 1.00 spikes, but formal probability calibration and validation across spatial holdout folds must be finalized. |
| **Uncertainty Layer** | `PARTIALLY IMPLEMENTED` | Hardcoded threshold (< 0.55 confidence demotion) active. Needs multi-signal uncertainty classification (`HIGH`, `MODERATE`, `LOW`) and Evidence Completeness (`GOOD`, `LIMITED`, `INSUFFICIENT`). |
| **SHAP Explainability** | `IMPLEMENTED` | `shap.TreeExplainer` successfully computes and persists top 3 feature importances into `event_classifications`. |
| **Persistence Engine** | `INCORRECT` | Currently using non-canonical enum `EPHEMERAL`. Must strictly be updated to canonical enums: `TRANSIENT`, `INTERMITTENT`, `PERSISTENT`. |
| **Facility Baselines** | `PARTIALLY IMPLEMENTED` | Rolling 90-day mean & std calculation active. Missing robust quartiles (Q25, Q50, Q75) and contamination protection for active events. |
| **Operational Anomaly Engine** | `INCORRECT` | Thresholds set to 2.0 / 3.0 / 4.0. Must be strictly aligned with the contract: `NORMAL` (<1.5), `ELEVATED` (1.5–<2.5), `ABNORMAL` (2.5–<4.0), `CRITICAL` (>=4.0). |
| **Live FIRMS Ingestion** | `PARTIALLY IMPLEMENTED` | India BBOX polling script created, but needs 5-minute configurable scheduling, multi-sensor support (VIIRS NOAA-20/21, S-NPP, MODIS), explicit timestamp tracking (`last_fetch` vs `latest_observation`), and no-new-data short-circuiting. |
| **Frontend Event API** | `PARTIALLY IMPLEMENTED` | Endpoints `/gis/events` and `/events/{id}` exist. Needs serialization of the full canonical Intelligence Object (SHAP, class probabilities, baseline factors, thermal trend). |
| **Frontend Monitor UI** | `IMPLEMENTED` | MapLibre base map and markers operational on `localhost:3000/monitor`. |
| **Thermo News Feed** | `PARTIALLY IMPLEMENTED` | Table exists in Postgres, but live automatic dispatching of intelligence summaries to the news surface is not yet linked. |
| **Local LLM Humanization** | `MISSING` | Benchmark adapter for local Gemma 3 4B / Qwen 2.5 3B, strict prompt grounding, and hallucination validation not yet implemented. |

---

## 2. Mandatory Remediation Items

1. **Enum & Threshold Alignment:**
   - Classification $\rightarrow$ Single canonical class (`IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`, `AGRI_BURN`, `WILDFIRE`, `OTHER_UNCERTAIN`).
   - Persistence $\rightarrow$ `TRANSIENT`, `INTERMITTENT`, `PERSISTENT`.
   - Anomaly Tiers $\rightarrow$ `NORMAL` ($Z<1.5$), `ELEVATED` ($1.5 \le Z < 2.5$), `ABNORMAL` ($2.5 \le Z < 4.0$), `CRITICAL` ($Z \ge 4.0$).
2. **Unified Feature Contract:** Enforce single, shared feature calculation for training and inference.
3. **FIRMS 5-Minute Ingestion Daemon:** Implement robust polling loop distinguishing fetch time from observation time.
4. **Local LLM Humanizer:** Build benchmark harness between local models, enforce grounded JSON schema, and add validation fallback.
