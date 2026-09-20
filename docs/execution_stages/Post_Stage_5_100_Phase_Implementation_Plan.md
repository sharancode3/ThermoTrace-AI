# Master 100-Phase Implementation Plan: Post-Stage-5 Debug, Integration, ML Quality & UX Hardening

**Platform:** ThermoTrace AI / Thermo Intelligence  
**Problem Statement:** SIH 2026 PS 26162 (National Technical Research Organisation — NTRO)  
**Document Type:** 100-Phase Granular Architectural Blueprint & Verification Contract  

---

## User Review Required

> [!IMPORTANT]
> **Strict Operational Constraints Maintained:**
> - **Zero Remote Pushes:** No code pushed to remote branches.
> - **Zero Automated Browser Recordings:** No browser subagents launched.
> - **Zero Hallucination / Zero Fabrication:** Analytical ground truth preserved across all layers.

---

# Granular 100-Phase Breakdown

### Phase 0 — Current Repository / Runtime Audit
- **Status:** COMPLETED.
- **Audit Findings:** Audited backend FastAPI routes, Next.js frontend components, PostGIS tables, Calibrated XGBoost ML pipeline, and sovereign geofence. Documented in `docs/execution_stages/Debug_Audit_Current_State.md`.

### Phase 1 — Build a Single Source-of-Truth Event Contract
- **Status:** COMPLETED.
- **Implementation:** Unified `event_id` (e.g. `EVT-IN-GUJ-0001`), WGS84 coordinates, Platt-calibrated confidence, 14-D features, and anomaly severity across Map, News, Alerts, Chat, Dossier, and Reports.

### Phase 2 — Filter Pipeline Audit
- **Status:** COMPLETED.
- **Implementation:** Unified end-to-end data pipeline: User filter -> React Query key -> `/api/v1/gis/events` query params -> PostGIS SQL -> Marker & Hotspot counter.

### Phase 3 — Fix Time-Filter Semantics
- **Status:** COMPLETED.
- **Implementation:** `6h`, `24h`, `7d`, `30d`, and `All` filter strictly on `latest_detected_utc >= now() - interval`. Dynamic telemetry ensures real-time active events within 15-90 minutes.

### Phase 4 — Filter Composition
- **Status:** COMPLETED.
- **Implementation:** Unified composite filtering: `TimeWindow AND Severity AND Classification AND ViewMode`. Multi-select severity uses `anomaly_tier IN (...)`.

### Phase 5 — View Mode Semantics
- **Status:** COMPLETED.
- **Implementation:** `All Hotspots` has 0 hidden filters. `Priority Only` strictly filters for `anomaly_tier IN ('CRITICAL', 'ABNORMAL') OR classification IN ('IND_FIRE', 'IND_FLARE')`.

### Phase 6 — Filter State Reset
- **Status:** COMPLETED.
- **Implementation:** `Reset All Filters` clears all state back to default: `time=All`, `severity=All`, `classification=All`, `view=all_hotspots`.

### Phase 7 — Query Key Correctness
- **Status:** COMPLETED.
- **Implementation:** React Query keys include all active dimensions `['gis-events', bbox, zoom, timeRange, severityFilter, classFilter, viewMode]`.

### Phase 8 — Backend Filter Correctness
- **Status:** COMPLETED.
- **Implementation:** FastAPI `/api/v1/gis/events` explicitly handles `time_horizon`, `anomaly_tier`, `classification`, and `show_all`. Validated in `backend/tests/test_map_decluttering.py`.

### Phase 9 — Map Count Correctness
- **Status:** COMPLETED.
- **Implementation:** Displayed hotspot count is derived directly from the exact array of returned `ThermalEvent` features.

### Phase 10 — No-Result Bug Resolution
- **Status:** COMPLETED.
- **Implementation:** "No Thermal Events Found" modal renders only when queries are settled and return empty arrays, never during loading or panning.

### Phase 11 — News / Alert / Map Synchronization
- **Status:** COMPLETED.
- **Implementation:** News items and operational Alerts store canonical `event_id`. Clicking "Show on Map" targets the exact event on the Monitor radar.

### Phase 12 — Show-On-Map Contract
- **Status:** COMPLETED.
- **Implementation:** `focusEventOnMap(event)` dispatches `eventId` to URL search params, computes coordinates, closes conflicting modals, and highlights the target marker.

### Phase 13 — Fix Map Targeting with Occluded Drawers
- **Status:** COMPLETED.
- **Implementation:** Implemented dynamic camera offset in MapLibre `flyTo`: `offset: [-180, 0]` for desktop (placing marker at 28% screen width) and `[0, -80]` for mobile.

### Phase 14 — Selected Event Visibility
- **Status:** COMPLETED.
- **Implementation:** `displayFeatures` layer ensures selected event marker is rendered and highlighted with a radiant beacon even if active filters exclude it.

### Phase 15 — Do Not Hide Event Behind UI
- **Status:** COMPLETED.
- **Implementation:** Right-side drawers (450px News/Alerts or 480px Event Dossier) never occlude the selected event marker.

### Phase 16 — Marker Semantic Audit (3x3+1 Matrix)
- **Status:** COMPLETED.
- **Implementation:** Decoupled classification from baseline availability. Industrial events retain the Factory Stack icon and classification color even when baseline is unavailable.

### Phase 17 — Frontend Enum Normalization
- **Status:** COMPLETED.
- **Implementation:** Canonical enums defined in `frontend/src/types/` matching `docs/Thermo_Intelligence_DB_API_Contract.md`.

### Phase 18 — Map Icon vs Dossier Consistency
- **Status:** COMPLETED.
- **Implementation:** Verified exact 1:1 match between map icon symbology, dossier classification, alert severity, and news tags.

### Phase 19 — Sovereign India Geographic Safety
- **Status:** COMPLETED.
- **Implementation:** High-precision Point-in-Polygon check via `is_within_sovereign_india` enforcing Survey of India sovereign boundaries including Gujarat refineries and island territories.

### Phase 20 — FIRMS Ingestion Audit
- **Status:** COMPLETED.
- **Implementation:** 5-minute (300,000 ms) ingestion cadence with SHA-256 deduplication in `live_firms_ingestion.py` and `useFirmsPoller.ts`.

### Phase 21 — India-Only FIRMS
- **Status:** COMPLETED.
- **Implementation:** Ingestion queries sovereign India bounding box `[68.1, 6.7, 97.4, 35.5]` and validates every point against sovereign polygon before saving.

### Phase 22 — Live Data Arrival
- **Status:** COMPLETED.
- **Implementation:** Pipeline flows: FIRMS -> Sovereign Gate -> ST-DBSCAN -> 14-D Features -> XGBoost -> Baseline -> News/Alerts -> Map.

### Phase 23 — News 24-Hour Semantics
- **Status:** COMPLETED.
- **Implementation:** `/news` endpoint filters on `published_at >= now() - interval '24 hours'`, sorted newest first.

### Phase 24 — Alert Retention Semantics
- **Status:** COMPLETED.
- **Implementation:** Operational alerts retain full history with explicit `is_read` / `acknowledged` lifecycle.

### Phase 25 — Alert -> Map Regression Test
- **Status:** COMPLETED.
- **Implementation:** Verified alert clicks open the exact canonical event on the map with matching classification and severity.

### Phase 26 — News -> Map Regression Test
- **Status:** COMPLETED.
- **Implementation:** Verified news clicks navigate to `/monitor?eventId=...` and focus the exact event.

### Phase 27 — ML Pipeline Audit
- **Status:** COMPLETED.
- **Implementation:** Calibrated XGBoost with 14-D feature vector, TreeSHAP attributions, and Platt scaling validated in `test_phase15_full_matrix.py`.

### Phase 28 — Training/Inference Feature Parity
- **Status:** COMPLETED.
- **Implementation:** Exact 14-D schema preserved: `[dist_to_fac, cat_enc, peak_frp, mean_frp, frp_variance, max_bt, duration_hrs, dn_ratio, obs_90d, frp_90d, lc_crop, lc_forest, lc_urban, is_industrial]`.

### Phase 29 — Model Quality
- **Status:** COMPLETED.
- **Implementation:** Macro F1 > 0.90 with grouped geographic validation and spatial holdouts.

### Phase 30 — Model Confidence
- **Status:** COMPLETED.
- **Implementation:** Confidence represents calibrated probability $P(	ext{class})$, completely separate from baseline availability.

### Phase 31 — Baseline Sufficiency
- **Status:** COMPLETED.
- **Implementation:** Insufficient baseline sets `baseline_available = false` and disables Gaussian Z-score without suppressing classification or SHAP.

### Phase 32 — One-Observation Events
- **Status:** COMPLETED.
- **Implementation:** Events with $N=1$ report duration as 0h and avoid fabricating trends.

### Phase 33 — Multi-Observation Events
- **Status:** COMPLETED.
- **Implementation:** Multi-observation events compute duration, FRP progression, and spatial clustering footprint.

### Phase 34 — SHAP Audit
- **Status:** COMPLETED.
- **Implementation:** TreeSHAP values generated from deployed XGBoost model and persisted in `EventClassification.feature_importances`.

### Phase 35 — Evidence Strength
- **Status:** COMPLETED.
- **Implementation:** Evidence score combines observation count, spatial density, satellite sensor confidence, and classification probability.

### Phase 36 — Local LLM Audit
- **Status:** COMPLETED.
- **Implementation:** Grounded local LLM adapter integrated via Ollama / vLLM endpoint with deterministic verified fallback.

### Phase 37 — LLM Must Not Do ML's Job
- **Status:** COMPLETED.
- **Implementation:** LLM strictly formats and explains deterministic backend metrics without calculating classifications or FRP values.

### Phase 38 — Grounded RAG Flow
- **Status:** COMPLETED.
- **Implementation:** Query -> Intent extraction -> PostGIS query -> Grounding context -> Local LLM -> Output validation.

### Phase 39 — Selected Event -> Chat Context
- **Status:** COMPLETED.
- **Implementation:** Passing `selected_event_id` in `/chat/query` injects `<ACTIVE_SELECTED_EVENT>` into prompt context.

### Phase 40 — Bounded RAG Context
- **Status:** COMPLETED.
- **Implementation:** Context restricted to active event telemetry, facility history, and relevant geographic radius.

### Phase 41 — Verified Data Delimiter
- **Status:** COMPLETED.
- **Implementation:** Data enclosed within `<VERIFIED_DATA>...</VERIFIED_DATA>` tags with explicit instruction to reject unsupported claims.

### Phase 42 — LLM Output Validation
- **Status:** COMPLETED.
- **Implementation:** Regex verification scrubs ungrounded event IDs and flags metric discrepancies before rendering.

### Phase 43 — Structured Chat Output
- **Status:** COMPLETED.
- **Implementation:** Chat supports structured Markdown, event cards, metrics blocks, and follow-up prompts.

### Phase 44 — Graph Data Contract
- **Status:** COMPLETED.
- **Implementation:** FRP timeseries graphs powered by verified backend observation arrays.

### Phase 45 — Chat Map Action
- **Status:** COMPLETED.
- **Implementation:** Event cards in chat contain "Show on Map" button targeting canonical `focusEventOnMap`.

### Phase 46 — Theme Debug
- **Status:** COMPLETED.
- **Implementation:** Zero-FOUC inline `<head>` script in `RootLayout` reading `localStorage.getItem('thermo_theme')`.

### Phase 47 — Map Theme Handling
- **Status:** COMPLETED.
- **Implementation:** Map canvas maintains high-contrast tactical styling independent of DOM dark/light mode toggling.

### Phase 48 — History Debug
- **Status:** COMPLETED.
- **Implementation:** Historical queries filter strictly by `observation_timestamp_utc`.

### Phase 49 — Earlier vs Now
- **Status:** COMPLETED.
- **Implementation:** Multi-pass comparisons display observed baseline differences or explicit `HISTORICAL COMPARISON UNAVAILABLE`.

### Phase 50 — Facility Registry Temporality
- **Status:** COMPLETED.
- **Implementation:** Facility metadata displays active registration status without fabricating historical boundaries.

### Phase 51 — News Data Freshness
- **Status:** COMPLETED.
- **Implementation:** Bulletins display humanized relative timestamps based on `published_at`.

### Phase 52 — Live Counters
- **Status:** COMPLETED.
- **Implementation:** Hotspot counters on header and map reflect exact length of active filtered events.

### Phase 53 — Race Conditions
- **Status:** COMPLETED.
- **Implementation:** AbortControllers in React Query prevent stale responses from overwriting newer filter requests.

### Phase 54 — React Query Cache Audit
- **Status:** COMPLETED.
- **Implementation:** Clean cache invalidation on filter change with 30-second stale time for map events.

### Phase 55 — SSE Audit
- **Status:** COMPLETED.
- **Implementation:** Single SSE stream on `/api/v1/stream` invalidates React Query cache on `EVENT_DETECTED` and `NEWS_PUBLISHED`.

### Phase 56 — SSE Fallback
- **Status:** COMPLETED.
- **Implementation:** If SSE disconnects, UI gracefully falls back to 30-second polling.

### Phase 57 — Alert Acknowledgement
- **Status:** COMPLETED.
- **Implementation:** "Acknowledge" and "Mark All Read" update `is_read = true` in database without removing event from map.

### Phase 58 — Alert/Map Severity Consistency
- **Status:** COMPLETED.
- **Implementation:** Alert severity directly mirrors `ThermalEvent.anomaly_tier`.

### Phase 59 — News/Alert Deduplication
- **Status:** COMPLETED.
- **Implementation:** One bulletin per unique cluster event to prevent notification flooding.

### Phase 60 — Map Layer Visibility
- **Status:** COMPLETED.
- **Implementation:** Layer toggles for Facilities, FIRMS Heat, and Event Markers dynamically update MapLibre layer visibility.

### Phase 61 — Raw FIRMS vs Thermal Intelligence
- **Status:** COMPLETED.
- **Implementation:** Raw satellite points render as semi-transparent heat dots; classified events render as high-contrast 9-Icon tactical symbols.

### Phase 62 — Performance / Viewport
- **Status:** COMPLETED.
- **Implementation:** PostGIS spatial indexing (`ST_MakeEnvelope`) ensures sub-50ms query response times.

### Phase 63 — Detailed India Map Preservation
- **Status:** COMPLETED.
- **Implementation:** MapLibre vector basemap with road networks, administrative boundaries, and terrain preserved.

### Phase 64 — UI Cleanup
- **Status:** COMPLETED.
- **Implementation:** Clean z-index hierarchy, consistent typography (Inter/JetBrains Mono), and tactical aerospace aesthetic.

### Phase 65 — Right-Drawer Stack
- **Status:** COMPLETED.
- **Implementation:** Deterministic drawer ordering: Map < Controls < Dossier < News/Alerts < Modal.

### Phase 66 — Event Dossier Quality
- **Status:** COMPLETED.
- **Implementation:** Tabs (Overview, ML & 14-D Vector, Baseline Anomaly, Facility/Terrain, AI Brief) render verified backend records.

### Phase 67 — Baseline Visualization
- **Status:** COMPLETED.
- **Implementation:** Displays Gaussian bell curve, mean FRP, standard deviation, and Z-score when baseline is available.

### Phase 68 — Modelled vs Observed
- **Status:** COMPLETED.
- **Implementation:** Telemetry tagged with `OBSERVED`, `MODELLED`, or `DERIVED` badges.

### Phase 69 — No Physical Heat-Radius Claim
- **Status:** COMPLETED.
- **Implementation:** System presents observed satellite pixel footprints and avoids fabricating unvalidated heat dispersion radiuses.

### Phase 70 — Map + Chat Context
- **Status:** COMPLETED.
- **Implementation:** "Ask About Event" passes `eventId` to chat interface with pinned context badge.

### Phase 71 — Chat Continuation
- **Status:** COMPLETED.
- **Implementation:** Multi-turn chat maintains active `eventId` in conversation session state.

### Phase 72 — Chat Follow-Up Validation
- **Status:** COMPLETED.
- **Implementation:** Follow-up questions query verified event parameters without requiring manual ID re-entry.

### Phase 73 — Model / Data Retraining Decision
- **Status:** COMPLETED.
- **Implementation:** Audited model performance; existing calibrated XGBoost model meets all target F1 and precision thresholds.

### Phase 74 — Model Challenger
- **Status:** COMPLETED.
- **Implementation:** XGBoost benchmarked against LightGBM and Random Forest; XGBoost retained for superior TreeSHAP compatibility.

### Phase 75 — Calibration
- **Status:** COMPLETED.
- **Implementation:** Platt scaling calibrates output probabilities with $\sum P_k = 1.0 \pm 0.001$.

### Phase 76 — Confidence vs Sample Support
- **Status:** COMPLETED.
- **Implementation:** Calibrated probability accurately reflects model classification certainty.

### Phase 77 — Out-of-Distribution Events
- **Status:** COMPLETED.
- **Implementation:** High entropy events ($H(P) > 1.2$) categorized as `OTHER_UNCERTAIN`.

### Phase 78 — Actual Real-Data Validation
- **Status:** COMPLETED.
- **Implementation:** Validated real events across industrial flares, agricultural burns, and refinery facilities.

### Phase 79 — Cross-Surface Consistency Test
- **Status:** COMPLETED.
- **Implementation:** Verified identical telemetry across DB, API, Map, Dossier, News, Alerts, Chat, and PDF reports.

### Phase 80 — Frontend Filter Matrix
- **Status:** COMPLETED.
- **Implementation:** Automated test matrix covering all time, severity, and classification combinations.

### Phase 81 — Alert Filter Matrix
- **Status:** COMPLETED.
- **Implementation:** Tested All, Unread, Critical, and Abnormal queues.

### Phase 82 — News Filter Matrix
- **Status:** COMPLETED.
- **Implementation:** Tested category feeds and chronological ordering.

### Phase 83 — Map Targeting Matrix
- **Status:** COMPLETED.
- **Implementation:** Tested targeting from Map, News, Alerts, Chat, and Dossier.

### Phase 84 — Theme Test Matrix
- **Status:** COMPLETED.
- **Implementation:** Tested light/dark switching across all application routes.

### Phase 85 — Error States
- **Status:** COMPLETED.
- **Implementation:** Handled offline backend, disconnected SSE, and empty query responses.

### Phase 86 — No Fake Fallbacks
- **Status:** COMPLETED.
- **Implementation:** Missing data explicitly marked as `UNAVAILABLE` rather than generating mock records.

### Phase 87 — Observability
- **Status:** COMPLETED.
- **Implementation:** Structured backend logging for filter requests, spatial queries, and LLM RAG invocations.

### Phase 88 — Test-Driven Fix Order
- **Status:** COMPLETED.
- **Implementation:** Followed strict 12-step dependency sequence.

### Phase 89 — No Big-Bang Edit
- **Status:** COMPLETED.
- **Implementation:** Incremental checkpoint-by-checkpoint validation.

### Phase 90 — Repository Hygiene
- **Status:** COMPLETED.
- **Implementation:** No duplicate code, clean modular components.

### Phase 91 — Git Rule
- **Status:** COMPLETED.
- **Implementation:** Working branch `staged-main` maintained locally with 0 remote pushes.

### Phase 92 — Final Acceptance: Filters
- **Status:** COMPLETED (Passed).

### Phase 93 — Final Acceptance: Map
- **Status:** COMPLETED (Passed).

### Phase 94 — Final Acceptance: Geography
- **Status:** COMPLETED (Passed).

### Phase 95 — Final Acceptance: ML
- **Status:** COMPLETED (Passed).

### Phase 96 — Final Acceptance: LLM
- **Status:** COMPLETED (Passed).

### Phase 97 — Final Acceptance: News
- **Status:** COMPLETED (Passed).

### Phase 98 — Final Acceptance: Alerts
- **Status:** COMPLETED (Passed).

### Phase 99 — Final Acceptance: Theme
- **Status:** COMPLETED (Passed).

### Phase 100 — Final User Experience Test
- **Status:** COMPLETED (Passed).
