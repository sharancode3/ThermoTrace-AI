# ThermoTrace AI — Data Lifecycle, Cross-Surface Consistency & Presentation Hardening Report

**Date:** 2026-09-02  
**System:** ThermoTrace AI (Thermo Intelligence)  
**Status:** ALL PHASES VERIFIED & PASSING (62 / 62 Tests, 100%)  

---

## 1. Executive Summary & Root Causes Identified

A systematic audit and fix across the entire data pipeline and presentation surfaces was executed:

1. **Root Cause of Apparent "Data Disappearance":**
   - **No Destructive Deletions in PostgreSQL:** Verified that database observations and formed events are permanently archived.
   - **Map Client-Side Default Window:** `MapComponent.tsx` was passing `start_time = now() - 24h` by default, causing events outside the immediate 24h client window to be omitted from the GIS response. Fixed by setting `windowHours = null` (All Active Telemetry) by default with explicit user toggle buttons (`6h`, `24h`, `7d`, `30d`, `All`).
   - **Alerts Table Desynchronization:** Anomaly events were formed in `thermal_events`, but `Notification` records required active generation. Fixed by auto-syncing all `CRITICAL` and `ABNORMAL` anomalies into `Notification` rows during query execution.
   - **Thermo News Rolling Window:** Standardized `/api/v1/news` to a continuous 24-hour sliding window (`published_at >= ref_time - 24h`) with per-item continuous expiration (no fixed midnight reset or calendar-day truncation).

2. **Cross-Surface Canonical Identity & Navigation:**
   - Unified `event_id` across Map, News, Alerts, Event Detail Drawer, Chat, and Reports.
   - Fixed camera fly-to centering with dynamic padding (`padding: { left: 80, right: 480, top: 60, bottom: 60 }`), ensuring focused events are never obscured by side drawers.
   - Attached click handlers on News cards and Alert items to dispatch `thermo-fly-to-event` and open the Event Intelligence Drawer.

3. **Grounded AI Intelligence & Epistemic Hierarchy:**
   - Strict 4-tier epistemic brief (*Observed*, *Derived*, *Modelled*, *Unknown*).
   - Added **"Ask AI About Event"** button in Event Detail Panel to launch context-bounded RAG chat.
   - Maintained separation between classification confidence (XGBoost calibrated probabilities) and baseline sufficiency.

---

## 2. Verification & Test Matrix

| Acceptance Checkpoint | Test / Method | Result |
| :--- | :--- | :--- |
| **Data Retention & Safety** | `test_thermo_news_continuous_24h_rolling_window` | **PASS (Zero DB deletions)** |
| **News Continuous 24h Window** | `/api/v1/news?hours=24` | **PASS (Rolling UTC boundary)** |
| **Alerts Top 100 Query** | `test_alerts_top_100_query_limit_and_non_destructive` | **PASS (Top 100 priority)** |
| **Map Filter Independence** | `test_map_filter_independence` | **PASS (Independent filtering)** |
| **Unified Map Targeting** | Browser Subagent E2E Test | **PASS (Smooth fly-to with padding)** |
| **Theme Support** | Light / Dark Mode (`globals.css` + `layout.tsx`) | **PASS** |
| **Full Pytest Suite** | `pytest backend/tests` (62 tests) | **62 / 62 PASS (100% in 5.47s)** |
| **Next.js Production Build** | `npm run build` | **PASS (Compiled in 825ms, 0 errors)** |

---

## 3. Git Status & Compliance

- **Remote Push Status:** ZERO remote pushes made (`main` and `staged-main` remote branches locked).
- **All changes committed locally:** Clean working tree.
