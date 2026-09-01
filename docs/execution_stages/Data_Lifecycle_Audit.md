# Phase 0 — Data Lifecycle, Query Retention & Cross-Surface Audit Report

**Date:** 2026-09-02  
**System:** ThermoTrace AI (Thermo Intelligence)  
**Environment:** PostGIS 16 + FastAPI + Next.js 15  

---

## 1. Executive Summary & Root-Cause Audit

A systematic code audit was performed across the backend ingestion engine, domain models, database queries, and frontend state management.

### Key Finding: Zero Destructive Deletions in Runtime
- **Database Retention:** PostgreSQL table inspection confirmed that no `DELETE` or `TRUNCATE` operations exist in runtime API handlers or background workers.
- **Root Cause of Apparent "Data Loss":**
  1. **Strict Client-Side Default Window in Map:** `MapComponent.tsx` initialized `windowHours = 24`, transmitting `start_time = now() - 24h` to `/api/v1/gis/events`. When observation timestamps were outside the immediate 24h client clock, the API returned an empty array, triggering the *"No Thermal Events Found"* modal.
  2. **Alerts Table Desynchronization:** Anomaly events formed by ST-DBSCAN were stored in `thermal_events`, but `Notification` rows were only generated when explicitly seeded. When the ML model previously misclassified events as `NORMAL` (due to scikit-learn version mismatch), zero new `CRITICAL`/`ABNORMAL` alerts were qualified.
  3. **ThermoNews Sliding Window Boundary:** `/api/v1/news` filtered on `now() - 24h`. If FIRMS data was older than 24h from the live system clock, the news feed dropped below threshold and required dynamic telemetry-relative windowing.
  4. **Map Decluttering Logic:** `/api/v1/gis/events` with `show_all=False` strictly filtered out `NORMAL` and `ELEVATED` events, giving the visual appearance that map points vanished on reload.

---

## 2. Table-by-Table Data Retention Audit

| Database Table | Lifecycle / Retention Policy | Destructive Deletion in Runtime? | Query-Level Presentation Filter |
| :--- | :--- | :--- | :--- |
| `thermal_observations` | **Permanent Archive** (all raw FIRMS passes stored with SHA-256 deduplication) | **NO** | Ingestion geofence (India bounds only) |
| `thermal_events` | **Permanent History** (formed clusters & lifecycle tracks) | **NO** | Viewport bounding box & UI time filters (`6h`, `24h`, `7d`, `30d`, `All`) |
| `event_classifications` | **Permanent Record** (model version, probabilities, SHAP drivers) | **NO** | Linked 1:1 with `thermal_events` |
| `event_anomalies` | **Permanent Record** (Z-score, baseline mean, baseline std) | **NO** | Linked 1:1 with `thermal_events` |
| `thermo_news` | **Rolling 24-Hour Continuous Presentation** | **NO** | Dynamic sliding window: `published_at >= ref_time - 24h` |
| `notifications` (Alerts) | **Top-100 Operational Display** | **NO** | `LIMIT 100` ordered by severity (`CRITICAL > ABNORMAL`) & time descending |
| `industrial_facilities` | **Authoritative Sovereign Registry** (28,234 plants) | **NO** | Sector & state search filters |
| `facility_baselines` | **Permanent Empirical Distributions** (90-day rolling Gaussian parameters) | **NO** | Linked to facility |

---

## 3. Detailed Component Audit

### A. Thermo News Feed (`/api/v1/news`)
- **Semantic Rule:** Continuous sliding window (`now_utc - 24h`). An event detected at 13:00 today remains until 13:00 tomorrow.
- **Continuous Expiry:** No midnight reset or calendar-day truncation.
- **Non-Destructive:** Older records remain in `thermo_news` and `thermal_events` permanently.

### B. Operational Alerts (`/api/v1/notifications`)
- **Semantic Rule:** Display top 100 highest-priority actionable incidents (`CRITICAL`, `ABNORMAL`, `IND_FIRE`, `IND_FLARE`).
- **Ordering:** Severity priority first (`CRITICAL > ABNORMAL`), peak FRP descending, timestamp descending.
- **Database Safety:** `LIMIT 100` query parameter only. Zero deletion of records beyond row 100.

### C. Sovereign Map (`/api/v1/gis/events`)
- **Semantic Rule:** Independent viewport and time filter (`6h`, `24h`, `7d`, `30d`, `All`).
- **No Shared Coupling with News:** Map displays all qualifying sovereign thermal events regardless of whether they appear in the 24h News feed.
- **Focus Bypass:** When `focus_event_id` is passed (from News or Alerts "Show on Map"), the target event is unconditionally guaranteed to load on the map.

---

## 4. Phase Plan for Implementation & Quality Hardening

1. **Phase 1 & 2:** Standardize UTC continuous rolling 24h window in `backend/app/api/endpoints.py` for `/news` with telemetry-relative fallback.
2. **Phase 3:** Enforce query-level `LIMIT 100` with severity priority for `/notifications` and auto-sync from `thermal_events`.
3. **Phase 4 & 5:** Map filter independence (`6h`, `24h`, `7d`, `30d`, `All`) with proper React Query keys and zero-flicker loading state.
4. **Phase 6, 7, 8, 9:** Unified camera targeting (`thermo-fly-to-event`) with dynamic padding accounting for left sidebar, right drawers, and usable map canvas.
5. **Phase 10 & 11:** Marker symbology and decoupled baseline sufficiency from classification uncertainty.
6. **Phase 12, 13, 14, 15:** Real ML pipeline verification with cached XGBoost model and continuous double-precision feature extraction.
7. **Phase 20, 21, 22, 23, 24, 25:** Local LLM integration with `<VERIFIED_DATA>` boundaries, structured JSON outputs, and deterministic fallback.
8. **Phase 45 & 46:** Theme verification (Light/Dark mode) across all panels.
