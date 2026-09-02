# ML Integrity & Confidence Precision Audit Report

## 1. Executive Summary
This document records the baseline audit of the machine learning inference, confidence calculation, notification gating, and feature calculation pipelines prior to the precision overhaul.

## 2. Hardcoded Confidence Assignment Audit (Phase 0, Step 1)
The following hardcoded overrides were identified in `backend/app/domain/anomaly.py`:
* **Line 154**: `confidence = max(confidence, 0.94)` (Applied when `is_ind` and `peak_frp >= 250.0`)
* **Line 157**: `confidence = max(confidence, 0.92)` (Applied when `is_ind` and `duration_hours >= 24.0` or `obs_count >= 4`)
* **Line 160**: `confidence = max(confidence, 0.89)` (Applied when `is_ind`)
* **Line 163**: `confidence = max(confidence, 0.91)` (Applied when `pct_forest >= 0.40`)
* **Line 166**: `confidence = max(confidence, 0.93)` (Applied when `pct_cropland >= 0.35`)

**Finding**: These hardcoded floors artificially inflated all event classifications to >= 89%, masking the true model calibration on edge cases.

## 3. Frontend Consumer Blast Radius (Phase 0, Step 2)
The following frontend components read, render, or process `confidence_pct` / `classification_confidence`:
1. `frontend/src/features/events/EventInvestigationDrawer.tsx`: Renders `classification_confidence * 100` in the KPI metrics grid.
2. `frontend/src/components/EventDetailPanel.tsx`: Renders calibrated confidence bar and percentage display (`(classification_confidence || 0) * 100`).
3. `frontend/src/components/NewsPanel.tsx`: Renders `item.confidence_pct || 0` in the newsfeed card headers.
4. `frontend/src/app/(workspace)/analytics/page.tsx`: Displays `mean_confidence_pct` and `median_confidence_pct` national and state summaries.
5. `frontend/src/components/OverlayManager.tsx`: Displays mean and median model confidence in the analytics overlay drawer.
6. `frontend/src/lib/apiClient.ts`: Defines TypeScript interface `confidence_pct?: number`.

## 4. Live Dataset Class Distribution (Phase 0, Step 3)
Audited directly against live Supabase PostgreSQL dataset of 1,622 active events:
* `AGRI_BURN`: 1,379 (85.0%)
* `WILDFIRE`: 94 (5.8%)
* `IND_FLARE`: 81 (5.0%)
* `IND_ROUTINE`: 39 (2.4%)
* `OTHER_UNCERTAIN`: 21 (1.3%)
* `IND_FIRE`: 8 (0.5%)
* **Total Events**: 1,622

## 5. Anomaly Tier & Notification Over-Firing Distribution (Phase 0, Step 5)
* `NORMAL`: 1,507 (92.9%)
* `ABNORMAL`: 66 (4.1%)
* `ELEVATED`: 29 (1.8%)
* `CRITICAL`: 20 (1.2%)

**Notification Table Audit**:
* `notifications` row count: **1,622** (Exact 1:1 match with total events).
* Root Cause: `is_alert_worthy = event.anomaly_tier in ["CRITICAL", "ABNORMAL"] or (event.classification and event.classification.startswith("IND_"))`.
* Defect Impact: Even routine, nominal industrial events fired high-priority notifications.
* Targeted Post-Fix Count: 20 (`CRITICAL`) + 66 (`ABNORMAL`) = **86 qualifying alerts**.

## 6. Feature Variance & Computation Audit (Phase 0, Step 4)
| Feature Name | Min | Mean | Max | Std Dev | Zero Variance Flag | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dist_to_facility` | 205.45 m | 158.3 km | 960.5 km | 150.5 km | False | Healthy continuous variance |
| `facility_category_encoded`| 0.0 | 1.05 | 83.0 | 7.87 | False | Healthy discrete distribution |
| `peak_frp_mw` | 0.32 MW | 7.89 MW | 104.2 MW | 13.01 MW | False | Normal right-skewed distribution |
| `mean_frp_mw` | 0.32 MW | 6.57 MW | 88.6 MW | 10.25 MW | False | Healthy distribution |
| `frp_variance` | 0.0 | 4.17 | 390.14 | 28.47 | False | Healthy multi-point variance |
| `max_brightness_k` | 297.61 K | 330.51 K | 367.0 K | 15.35 K | False | Physical satellite range |
| `duration_hours` | **-111.93 h** | 14.05 h | 163.10 h | 59.85 h | False | **BUG DETECTED**: Unordered timestamps |
| `day_night_ratio` | 0.0 | 0.79 | 1.0 | 0.40 | False | Healthy binomial distribution |
| `historical_active_days_90d` | 0.0 | 0.17 | 3.0 | 0.47 | False | Starved on low satellite revisit counts |
| `historical_peak_frp` | 0.0 | 1.04 MW | 28.78 MW | 3.37 MW | False | Baseline historical variance |
| `pct_cropland` | 0.05 | 0.78 | 0.85 | 0.22 | False | High variance across terrain |
| `pct_forest` | 0.05 | 0.13 | 0.80 | 0.15 | False | High variance across terrain |
| `pct_urban` | 0.05 | 0.09 | 0.85 | 0.17 | False | High variance across terrain |
| `is_industrial_zone` | 0.0 | 0.035 | 1.0 | 0.18 | False | Binary geofence indicator |

### Bug Fix Required in Phase 3:
* Fix `duration_hours` calculation in `features.py` using `abs((latest_utc - first_utc).total_seconds()) / 3600.0`.
