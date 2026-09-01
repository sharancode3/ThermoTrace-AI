# Phase 0 Audit: /facilities Strategic Industrial Registry

**Audit Date:** 2026-09-01  
**Auditor:** ThermoTrace AI Core Engineering  
**Scope:** Current state of `/facilities` page, database schemas, baseline records, report pipeline, and chat integration.

---

## 1. Frontend Page Current State
- **Route:** `/facilities` (`frontend/src/app/(workspace)/facilities/page.tsx`)
- **Status:** Empty placeholder view.
- **Renders:** Static `h1` "Facilities Directory" with text *"Facility tracking is currently under development"*.
- **Missing Features:**
  - No eager list/grid of stored industrial facilities.
  - No server-side debounced search input (name, state, operator).
  - No dynamic sector filter pills (derived from distinct database values).
  - No facility detail drawer / slide-over panel.
  - No on-demand scoped historical aggregation pipeline.
  - No contextual handoff to ReportLab PDF or Grounded Chat.

---

## 2. Database Schema & Data Population Audit

### Table: `industrial_facilities`
- **Total Registered Facilities:** 27 strategic mega-complexes across India.
- **Columns Populated:**
  - `id` (UUID)
  - `facility_code` (e.g., `FAC-GUJ-001`, `FAC-ODI-002`, `FAC-MAH-001`)
  - `name` (e.g., `Reliance Jamnagar Super Refinery`, `SAIL Rourkela Steel Plant`)
  - `sector_category` (6 distinct stored sectors: `'Refinery'`, `'Iron & Steel'`, `'Thermal Power'`, `'Petrochemicals'`, `'LNG / Petrochemicals'`, `'Coal Mining'`)
  - `state` & `district` (e.g., `Gujarat`, `Odisha`, `Maharashtra`, `Jharkhand`)
  - `latitude` & `longitude` (Verified within sovereign Indian boundaries)
  - `facility_geom` (PostGIS MultiPolygon) & `centroid` (PostGIS Point)
  - `baseline_frp_mean`, `baseline_frp_std`, `historical_event_count`

### Table: `facility_baselines`
- **Precomputed Rows:** 27 rows (1 per facility).
- **Statistical State:** All 27 facilities have computed rolling baseline statistics:
  - Sample observation counts: $N = 25 \text{ to } 30$ ($N \ge 10$, statistically sufficient).
  - Mean FRP ($\mu$), Standard Deviation ($\sigma$), Median, Q75, Q95, Max Recorded FRP.
  - `is_statistically_sufficient = True`.
- **Eager Display Availability:** These baseline aggregates are already stored and free to display on the facility list card without triggering new compute.

### Table: `thermal_events`
- **Total Events:** 1,505 clustered thermal events.
- **Associated to Facilities:** 34 events linked via `associated_facility_id`.
- **Spatial Index:** PostGIS GIST index available for spatial buffering and proximity queries.

---

## 3. Report Generation Pipeline Audit
- **Service:** `backend/app/services/report_service.py` & `backend/app/adapters/pdf_renderer.py`
- **Generation Endpoint:** `POST /api/v1/reports/generate`
- **Async Execution:** Celery task `generate_pdf_report_task` with SHA-256 cryptographic provenance hashing.
- **Integration Plan for Phase 12:** Extend `ReportService` and `PDFRenderer` to support report type `"FACILITY_SUMMARY_DOSSIER"` alongside single-event dossiers, reusing the exact same async workflow and SHA-256 archive.

---

## 4. Chat Service Context Handoff Audit
- **Service:** `backend/app/services/chat_service.py` & `backend/app/api/routes/chat.py`
- **Prompt Grounding:** Uses `<VERIFIED_DATA>` XML block injected with strict factual telemetry before calling LLM.
- **Integration Plan for Phase 13:** Add a facility-initiated chat context that injects the Phase 10 structured facility summary into a fresh, isolated session ID (`facility_{id}_{timestamp}`) with zero session cross-contamination.

---

## 5. Next Steps
- Proceed to **Phase 1-3 (Checkpoint B):** Implement `GET /api/v1/facilities` (cheap, eager, plain read of `industrial_facilities`) and the light-theme facility list UI with debounced search and dynamic sector filters.
