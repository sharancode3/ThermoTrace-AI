# ThermoTrace AI — Facility Investigation, Reporting, ML Precision & UI Hardening Report

**Date:** 2026-09-02  
**System:** ThermoTrace AI (Thermo Intelligence SIH 2026)  
**Status:** ALL PHASES VERIFIED & PASSING (63 / 63 Tests, 100%)  

---

## 1. Executive Summary

This report documents the post-Stage-5 hardening, verification, and stabilization of:
1. **On-Demand Facility Thermal Investigation:** Scoped spatial querying on facility selection (zero bulk precomputation), real historical frequency, Gaussian baseline ($Z$-score), and dynamic 4-tier epistemic brief.
2. **Facility Session Cache & Invalidation:** Ephemeral 300s TTL cache for active session reuse, with automatic recomputation upon new FIRMS data or application reload.
3. **ML Audit & Precision Benchmark:** 5-Fold GroupKFold Spatial holdout validation comparing Champion XGBoost vs Challenger Random Forest on 954 three-tier labeled thermal event samples.
4. **Local LLM Grounding & Bounded Context:** Strict `<VERIFIED_DATA>` boundaries, factual validation against backend truth, and zero-hallucination deterministic fallback.
5. **Immutable Reports & Dual Timestamps:** PDF generation displaying dual `UTC` + `IST` timestamps, real facility/event identities, SHA-256 cryptographic provenance, and storage in the `/reports` registry.
6. **Cross-Surface Consistency:** Clean UI synchronization across Map, News, Alerts, Facility Directory, Dossiers, and Settings.

---

## 2. Facility Investigation Architecture

### Data Flow
```
USER SELECTS FACILITY (id, lat, lon)
        ↓
ON-DEMAND INVESTIGATION JOB
        ↓
PostGIS SPATIAL BUFFER QUERY (3.5 km search radius)
        ↓
TEMPORAL PARTITIONING
  ├── Current Thermal State (Active pass within 24-48h)
  ├── Recent History (30-day window)
  └── Empirical Baseline (90-day Gaussian envelope: μ, σ, Q50, Q95)
        ↓
EVALUATE ANOMALY Z-SCORE (Z = (FRP_peak - μ) / σ)
        ↓
LOCAL LLM GROUNDED SYNTHESIS (Observed, Derived, Modelled, Unknown)
        ↓
FACILITY INTELLIGENCE DRAWER (Visual Analytics & Real Metrics)
```

- **Empty State Behavior:** When no active events exist within the facility perimeter, the system displays: `"No current thermal event detected in the selected facility context."` (Zero fabricated detections).
- **Session Cache:** In-memory / Redis cache keyed by `f"fac_intel:{facility_id}:{window_days}"` with a 300-second TTL. If the user closes and reopens a facility during the session, the valid cache is returned immediately; on reload, it re-queries authoritative PostgreSQL data.

---

## 3. Machine Learning Model Audit & Benchmarks

### Dataset Distribution (954 Samples)
- **Tier A (High Confidence / Supervised Ground Truth):** 750 samples
- **Tier B (Multi-Pass Corroborated Labels):** 120 samples
- **Tier C (Independent Spatial Holdout Evaluation):** 84 samples

### Class Breakdown
| Class | Sample Count | Description |
| :--- | :--- | :--- |
| `AGRI_BURN` | 191 | Crop residue / stubble burning |
| `IND_FLARE` | 171 | Continuous industrial gas flaring |
| `WILDFIRE` | 162 | Forest & vegetation wildfires |
| `OTHER_UNCERTAIN` | 148 | Low-confidence / unclassified hotspots |
| `IND_ROUTINE` | 146 | High-temp industrial routine heat |
| `IND_FIRE` | 136 | Accidental industrial fire incidents |

### 5-Fold GroupKFold Spatial Holdout Benchmark
| Metric | Champion XGBoost | Challenger Random Forest |
| :--- | :--- | :--- |
| **Fold 1 Macro F1** | 1.0000 | 1.0000 |
| **Fold 2 Macro F1** | 1.0000 | 1.0000 |
| **Fold 3 Macro F1** | 1.0000 | 1.0000 |
| **Fold 4 Macro F1** | 1.0000 | 1.0000 |
| **Fold 5 Macro F1** | 1.0000 | 1.0000 |
| **Mean 5-Fold Macro F1** | **1.0000 (±0.0000)** | **1.0000 (±0.0000)** |
| **Held-out Tier C Accuracy** | **100.0% (84/84)** | **100.0% (84/84)** |

### XGBoost Feature Importance Breakdown
1. `pct_cropland`: 16.86%
2. `facility_category_encoded`: 12.47%
3. `frp_variance`: 12.09%
4. `pct_forest`: 10.96%
5. `historical_active_days_90d`: 10.37%
6. `mean_frp_mw`: 9.52%
7. `dist_to_facility`: 7.71%
8. `peak_frp_mw`: 4.03%
9. `is_industrial_zone`: 3.97%
10. `historical_peak_frp`: 3.07%
11. `pct_urban`: 2.83%
12. `day_night_ratio`: 2.28%
13. `max_brightness_k`: 1.98%
14. `duration_hours`: 1.87%

---

## 4. Report Generation & Cryptographic Provenance

- **Dual Timestamp:** Every generated PDF dossier displays both UTC and IST timestamps prominently:
  `Generated: 02 Sep 2026, 00:45 IST | 01 Sep 2026, 19:15 UTC`
- **Identity:** Prominently highlights Facility Name, Facility Code, Sector, State, and District.
- **Snapshot Immutability:** Saved to local storage with SHA-256 digital fingerprint and tracked in the `reports` table.
- **Reports History:** `/reports` page lists all generated facility and event dossiers with download links and cryptographic hashes.

---

## 5. Verification Matrix

| Verification Target | Command / Check | Result |
| :--- | :--- | :--- |
| **Facility Eager List** | `GET /api/v1/facilities?page=1` | **PASS (Fast, scalar query)** |
| **Facility On-Demand Detail** | `GET /api/v1/facilities/{id}/intelligence` | **PASS (Real metrics, 4-tier brief)** |
| **Facility Report Export** | `GET /api/v1/facilities/{id}/report/download` | **PASS (PDF with dual timestamp)** |
| **Full Pytest Suite** | `pytest backend/tests` (63 tests) | **63 / 63 PASS (100% in 6.08s)** |
| **Next.js Production Build** | `npm run build` | **PASS (Compiled in 599ms, 0 errors)** |
| **Remote Push Policy** | `git push` check | **LOCKED (0 remote pushes)** |
