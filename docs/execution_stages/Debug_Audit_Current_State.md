# Phase 0 — Full Current Runtime & Repository Audit

**Platform:** ThermoTrace AI / Thermo Intelligence (SIH 2026 PS 26162 — NTRO)  
**Document State:** Authoritative Phase 0 Baseline Audit  
**Date:** August 31, 2026  

---

## 1. System Inventory & Audit Status Classification

| Subsystem / Layer | Component / File | Audit Classification | Technical Reality & Verified Code Findings |
|:---|:---|:---:|:---|
| **GIS Events API** | `backend/app/api/endpoints.py` (`/api/v1/gis/events`) | **WORKING** | Viewport-aware PostGIS bounding box queries with `start_time`, `end_time`, `classification`, `anomaly_tier`, `show_all`, and `focus_event_id`. |
| **Event Intelligence API** | `backend/app/api/endpoints.py` (`/api/v1/events/{id}`) | **WORKING** | Returns 14-D features, Platt-scaled class probabilities, TreeSHAP attributions, and 90-day Gaussian baseline metrics. |
| **News & Alerts API** | `backend/app/api/endpoints.py` (`/news`, `/notifications`) | **WORKING** | Returns active bulletins (past 24h) and unacknowledged operational alarms linked to canonical `event_id`. |
| **Tactical RAG Chat API** | `backend/app/api/routes/chat.py` (`/api/v1/chat/query`) | **WORKING / HARDENED** | Intent extraction maps queries to PostGIS filters, accepts `selected_event_id`, builds bounded `<VERIFIED_DATA>` and `<ACTIVE_SELECTED_EVENT>`, queries Local LLM adapter. |
| **PDF Reporting API** | `backend/app/api/routes/reports.py` (`/reports/{id}/pdf`) | **WORKING** | ReportLab 4.1 vector PDF generation with SHA-256 digital stamp. |
| **Sovereign Geofencing** | `backend/app/domain/sovereign_geofencing.py` | **WORKING** | High-precision Point-in-Polygon Survey of India polygon check (`is_within_sovereign_india`) enforcing sovereign borders. |
| **FIRMS Ingestion Daemon** | `backend/scripts/live_firms_ingestion.py` | **WORKING** | 5-minute ingestion from NASA FIRMS VIIRS/MODIS with spatial clustering and duplicate rejection. |
| **ML Inference & Baseline** | `backend/app/domain/anomaly.py` | **WORKING / HARDENED** | Calibrated multi-class XGBoost with distinct separation between Source Classification and Facility Baseline Availability. |
| **Map Rendering & Offsets** | `frontend/src/components/MapComponent.tsx` | **WORKING / HARDENED** | Dynamic camera offset (`[-180, 0]` desktop / `[0, -80]` mobile) ensuring markers are never occluded behind right-side drawers. |
| **Root Theming Engine** | `frontend/src/app/layout.tsx` & `globals.css` | **WORKING / HARDENED** | Zero-FOUC inline `<head>` script reading `localStorage.getItem('thermo_theme')` with Tailwind v4 custom dark variant. |
| **Tactical 9-Icon Markers** | `frontend/src/components/ThermalMapMarker.tsx` | **WORKING** | Deterministic $3 \times 3 + 1$ mapping (Factory Stack, Sprout Leaf, Diamond Beacon $\times$ Ruby Red, Amber, Gold, Green, Slate). |

---

## 2. Reproduction of Current Visual Problems & Resolution Summary

### Problem A & B: Filter Mismatch & False "0 Hotspots"
- **Finding:** "No Thermal Events Found" appeared when active time filter (`24h`) rejected events whose timestamps were older than 24h.
- **Resolution:** Re-seeded with dynamic real-time timestamps (within 15–90 min) and unified query composition (Time $\land$ Severity $\land$ Classification $\land$ Priority).

### Problem C & D: News / Alert Map Synchronization
- **Finding:** Clicking "Show on Map" flew to coordinates, but if an active filter excluded the event, the marker was hidden.
- **Resolution:** Implemented `displayFeatures` layer in `MapComponent.tsx` guaranteeing selected event marker is synthesized and rendered with a radiant beacon.

### Problem E: Map Marker Occlusion Behind Drawers
- **Finding:** Standard `flyTo` centered the marker at $50\%$ screen width, directly underneath the 450px–930px sliding drawer.
- **Resolution:** Applied `offset: [-180, 0]` (desktop) / `[0, -80]` (mobile) in `flyTo`.

### Problem F & H: Grey Diamond & Baseline vs Classification Disconnect
- **Finding:** Non-facility events defaulted to `BASELINE_INSUFFICIENT` and were rendered as grey diamonds despite having high-confidence classification.
- **Resolution:** Decoupled Classification from Baseline Availability. Added physical radiance grading for open-air hotspots, preserving vivid semantic marker colors.

### Problem I: Geographic Coordinate Leakage
- **Finding:** Coastal Gujarat points triggered out-of-bounds warnings when coarse bounding boxes clipped coastal peninsulas.
- **Resolution:** Integrated official Survey of India boundary polygons in `sovereign_geofencing.py`.

### Problem J: Theme Switching Desynchronization
- **Finding:** Theme toggle failed to persist across page reloads.
- **Resolution:** Added inline `<head>` bootstrap script in `RootLayout` and `@custom-variant dark` in `globals.css`.

### Problem K & L: Real Local LLM RAG Grounding
- **Finding:** Chat did not receive active `eventId` from map selection.
- **Resolution:** Extended `ChatQueryRequest` with `selected_event_id` and injected `<ACTIVE_SELECTED_EVENT>` into system prompt.
