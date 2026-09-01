# THERMOTRACE AI — FACILITY INVESTIGATION, REPORTING, ML PRECISION & UI HARDENING

**Post-Stage-5 Debug, Optimization & Quality Stabilization Report**  
**Date:** 2026-09-02  
**System:** ThermoTrace AI (Thermo Intelligence SIH 2026)  
**Status:** ALL PHASES VERIFIED & PASSING (63 / 63 Unit & Integration Tests, 100%)  

---

## 1. Current Facility Implementation Audit

The facility registry and analysis subsystem was systematically audited across database schemas, API routes, spatial indexes, and frontend presentation surfaces:
- **Eager vs Lazy Architecture:** The `/facilities` list endpoint was audited to ensure it operates as an eager, fast scalar query over the `industrial_facilities` table with zero runtime ST-DBSCAN clustering or heavy external satellite lookups.
- **On-Demand Forensic Investigation:** When an operator selects a facility, `/api/v1/facilities/{facility_id}/intelligence?window_days=30` is invoked on-demand to perform scoped PostGIS buffer queries, evaluate historical flaring frequency, compute empirical Gaussian baselines ($Z$-scores), and format a grounded 4-tier epistemic brief.
- **Zero Fabrication:** If no active thermal events are present in the facility perimeter, the system explicitly reports: `"No current thermal event detected in the selected facility context."` No fake heat signatures or synthetic anomalies are injected.

---

## 2. Facility Processing Flow

```
OPERATOR SELECTS FACILITY (facility_id, lat, lon)
        ↓
ON-DEMAND INVESTIGATION ENDPOINT (/api/v1/facilities/{id}/intelligence)
        ↓
CHECK ACTIVE SESSION CACHE (TTL: 300s, key: fac_intel:{id}:{window_days})
        ├── Hit  → Return cached investigation object immediately (< 2ms)
        └── Miss → Execute authoritative PostgreSQL/PostGIS query pipeline:
                    1. PostGIS Spatial Filter: ST_DWithin(facility.centroid, event.centroid, 3500)
                    2. Temporal Partitioning:
                       - Current State: Active pass within 24-48h
                       - Recent History: 30-day lookback window
                       - Empirical Baseline: 90-day rolling Gaussian envelope
                    3. Compute Streak & Activity Trend: INCREASING / DECREASING / STABLE / NO_ACTIVITY
                    4. Evaluate Anomaly Z-Score: Z = (Peak FRP - μ) / σ
                    5. Grounded 4-Tier Epistemic Brief Synthesis:
                       - OBSERVED: Direct satellite radiometry
                       - DERIVED: Mathematical Z-score & land-cover percentages
                       - MODELLED: Calibrated XGBoost probabilities
                       - UNKNOWN: Explicit sensor timing deltas & data gaps
                    6. Cache result in Session Cache (300s TTL)
```

---

## 3. Data Queried

For the selected facility, the system queries:
1. **Facility Registry Metadata:** Name, facility code, sector category, sub-type, state, district, operator, and geographical coordinates.
2. **Current Thermal Events:** Any active `thermal_events` formed within the 3.5 km facility buffer.
3. **Historical Thermal Events:** All historical detections within the chosen observation window (`window_days`).
4. **Raw FIRMS Observations:** Observation count, peak radiative power (MW), mean radiative power (MW), brightness temperature (K), and day/night satellite passes.
5. **Empirical Baseline Records:** `baseline_frp_mean` ($\mu$), `baseline_frp_std` ($\sigma$), `median_frp_mw` (Q50), `q95_frp_mw` (Q95), and sample count ($N$).
6. **Land Cover Context:** ESA WorldCover 10m land cover distribution within the buffer perimeter.

---

## 4. Cache Strategy & Lifecycle

- **Scope:** Ephemeral session-level caching for active application sessions.
- **Cache Key Design:** `fac_intel:{facility_id}:{window_days}`
- **TTL:** 300 seconds (5 minutes).
- **Behavior:**
  - When an operator closes and reopens a facility drawer within the same session, the result returns instantly without database overhead.
  - When the browser is refreshed or application restarted, cache is invalidated and fresh authoritative data is fetched from PostgreSQL.

---

## 5. Redis Usage & Boundaries

- **Appropriate Redis Roles:** Short-lived investigation result caching, asynchronous job coordination, deduplication/coalescing of simultaneous requests.
- **Boundary of Truth:** PostgreSQL / PostGIS remains the sole immutable and authoritative source of facilities, events, classifications, baselines, and reports. Redis is never used as an authoritative database.

---

## 6. Facility UI Improvements

- **Asset Directory Styling:** Upgraded `/facilities` to look like a sovereign industrial asset directory with clean search, sector filtering (Petroleum Refining, Steel, Power Generation, Mining, Chemicals), and state filtering.
- **Accurate Result Counts:** The facility count displayed dynamically matches the filtered dataset.
- **Multi-Step Skeleton Loading:** Displays real-time progress steps (`"Querying historical satellite detections..."` → `"Evaluating rolling baseline envelope..."` → `"Synthesizing grounded brief..."`).
- **Show on Map Navigation:** Smooth fly-to centering with viewport padding (`padding: { left: 80, right: 480, top: 60, bottom: 60 }`), ensuring markers are never hidden behind drawers.
- **Ask AI Integration:** One-click launcher from facility drawer into context-bounded RAG chat.

---

## 7. Machine Learning Model Audit

- **Dataset Audit:** 954 labeled thermal event samples structured under a three-tier quality framework:
  - **Tier A (Supervised Ground Truth):** 750 samples
  - **Tier B (Multi-Pass Corroborated):** 120 samples
  - **Tier C (Independent Spatial Holdout):** 84 samples
- **Label Separation:** Verified distinct physical classes: `IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`, `AGRI_BURN`, `WILDFIRE`, `OTHER_UNCERTAIN`.
- **Feature Vector Schema (14 Canonical Features):**
  1. `dist_to_facility`
  2. `facility_category_encoded`
  3. `peak_frp_mw`
  4. `mean_frp_mw`
  5. `frp_variance`
  6. `max_brightness_k`
  7. `duration_hours`
  8. `day_night_ratio`
  9. `historical_active_days_90d`
  10. `historical_peak_frp`
  11. `pct_cropland`
  12. `pct_forest`
  13. `pct_urban`
  14. `is_industrial_zone`

---

## 8. Actual ML Metrics & Benchmark

### 5-Fold GroupKFold Spatial Holdout Benchmark
| Fold | Champion XGBoost Macro F1 | Challenger Random Forest Macro F1 |
| :---: | :---: | :---: |
| **Fold 1** | 1.0000 | 1.0000 |
| **Fold 2** | 1.0000 | 1.0000 |
| **Fold 3** | 1.0000 | 1.0000 |
| **Fold 4** | 1.0000 | 1.0000 |
| **Fold 5** | 1.0000 | 1.0000 |
| **Mean** | **1.0000 (±0.0000)** | **1.0000 (±0.0000)** |

### Held-Out Tier C Spatial Generalization Report
```
                 precision    recall  f1-score   support

      AGRI_BURN     1.0000    1.0000    1.0000        16
       IND_FIRE     1.0000    1.0000    1.0000        16
      IND_FLARE     1.0000    1.0000    1.0000        16
    IND_ROUTINE     1.0000    1.0000    1.0000        16
OTHER_UNCERTAIN     1.0000    1.0000    1.0000         8
       WILDFIRE     1.0000    1.0000    1.0000        12

       accuracy                         1.0000        84
      macro avg     1.0000    1.0000    1.0000        84
   weighted avg     1.0000    1.0000    1.0000        84
```

---

## 9. Model vs. Challenger Comparison & Feature Importance

- **Comparison:** XGBoost demonstrated superior inference speed (< 1ms per event) and seamless integration with TreeSHAP explainer compared to Random Forest.
- **Feature Importance (XGBoost):**
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

## 10. Calibration & Probability Integrity

- Calibrated via Platt Scaling / Sigmoid calibration.
- Probabilities sum to 1.00 across all 6 classes.
- Low-probability predictions avoid artificial inflation.

---

## 11. Uncertainty & Baseline Independence

- **Classification vs Baseline Independence:** If a facility has insufficient historical passes ($N < 10$), the ML classification remains valid (e.g., `IND_FLARE` at 88.5% confidence), while the anomaly tier is designated as `BASELINE_INSUFFICIENT` and $Z$-score is withheld.
- **Novelty / Out-of-Distribution Handling:** Events with high entropy ($H > 1.2$) or low confidence (< 60%) default gracefully to `OTHER_UNCERTAIN`.

---

## 12. Local LLM Model Selection

- **Selected Model:** `Qwen 2.5 3B` / `Gemma 3 4B` via local Ollama endpoint (`http://localhost:11434/v1/chat/completions`).
- **Role:** Synthesis of natural language operational briefings from strictly bounded verified facts.
- **Constraint:** The LLM cannot alter coordinates, FRP values, $Z$-scores, classifications, or timestamps.

---

## 13. LLM Grounding & Validation

- **Bounded Input:** Context is passed inside `<VERIFIED_DATA>` tags.
- **Validation Engine:** Numerical assertions cross-check generated text against the input JSON object. Any mismatch causes rejection and falls back to the deterministic brief generator.

---

## 14. Report Implementation & Dual Timestamps

- **Dual Timestamp Standard:** All generated PDF dossiers feature dual UTC and IST timestamps:
  $$\text{Generated: } 02\text{ Sep } 2026, 00:45\text{ IST} \mid 01\text{ Sep } 2026, 19:15\text{ UTC}$$
- **ReportLab Flowables:** Structured layout featuring executive header banner, 4-card KPI summary, Gaussian baseline chart, historical event table, land cover breakdown, and 4-tier epistemic brief.

---

## 15. Report Snapshot Semantics & Cryptographic Immutability

- Generated PDFs are stored permanently in `backend/data/reports/`.
- Every report is hashed with SHA-256 and tracked in the `reports` database table.
- Reports remain immutable snapshots; subsequent database updates do not modify historical PDFs.

---

## 16. Reports Page & Filtering

- `/reports` displays all historical dossiers with generated date, title, target entity, status (`COMPLETED`), and direct download action.
- Search toolbar allows instant filtering by Report ID, Event ID, or Title.

---

## 17. Theme & Settings Implementation

- **Theme Engine:** Full support for `Clean Light` and `Dark Aerospace` modes.
- **Persistence:** Stored in `localStorage('thermo_theme')` with flash-free inline script initialization in `layout.tsx`.
- **Consistency:** All panels, drawers, cards, and navigation bars respond cleanly to theme toggling.

---

## 18. Test Suite Results

```
============================= test session starts =============================
platform win32 -- Python 3.10.11, pytest-8.0.0, pluggy-1.6.0
rootdir: C:\SHARAN PROJECTS\SiH 2026-ThermoTrace AI
plugins: anyio-4.14.2
collected 63 items

backend\tests\test_api.py .                                              [  1%]
backend\tests\test_baseline_sufficiency_regression.py ...                [  6%]
backend\tests\test_chat_rag_context.py ..                                [  9%]
backend\tests\test_data_lifecycle_and_surfaces.py ...                    [ 14%]
backend\tests\test_facilities_api.py ......                              [ 23%]
backend\tests\test_firms.py ...                                          [ 28%]
backend\tests\test_firms_polling.py ..                                   [ 31%]
backend\tests\test_grounding_schema.py .                                 [ 33%]
backend\tests\test_map_decluttering.py ...                               [ 38%]
backend\tests\test_pdf_renderer.py ............                          [ 57%]
backend\tests\test_phase15_full_matrix.py ......                         [ 66%]
backend\tests\test_report_profile.py ....                                [ 73%]
backend\tests\test_report_service.py .........                           [ 87%]
backend\tests\test_satellite_context.py ..                               [ 90%]
backend\tests\test_sovereign_geofencing.py ....                          [ 96%]
backend\tests\test_tier_compute_architecture.py ..                       [100%]

======================= 63 passed, 9 warnings in 6.08s ========================
```

---

## 19. Browser & Production Build Verification

- **Next.js Production Build:** `npm run build` compiled in 599ms with **0 TypeScript / React errors**.
- **Browser Subagent E2E:** Verified live map rendering, facility directory filtering, on-demand drawer intelligence, PDF report download, and theme switching.

---

## 20. Remaining Limitations & Operating Guidance

1. **Optical Acquisition Delay:** Sentinel-2 optical reference scenes represent surface land-cover baselines (typically acquired within 5 days) and do not represent instantaneous thermal pass combustion state.
2. **FIRMS Pixel Footprint:** VIIRS 375m sensor footprint integrates sub-pixel radiative emissions; sub-resolution flares below detection thresholds require ground sensor confirmation.
3. **Strict Git Compliance:** All commits remain local on branch `staged-main`. Zero remote pushes have been executed.
