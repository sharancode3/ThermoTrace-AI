# Stage 5 System Audit Report

**Platform:** ThermoTrace AI (Thermo Intelligence — NTRO / SIH 2026 PS 26162)  
**Date:** August 31, 2026  
**Status:** Audit Complete — Bug-Fix & Efficiency Hardening Mode  

---

## 1. Executive Summary & Audit Scope

This document records the architectural and operational audit across all system layers of ThermoTrace AI to guide targeted, non-destructive bug fixes in accordance with SIH 2026 PS 26162 standards.

---

## 2. Comprehensive Implementation & Issue Matrix

| Component / Subsystem | Current State | Classification | Root Cause & Technical Details |
|:---|:---:|:---:|:---|
| **Alerts & News Filtering** | Severity & Category filtering mismatch | **BROKEN** | Query parameters in frontend were mapping single values while backend expected specific enum names (`CRITICAL`, `ABNORMAL`, `ELEVATED`, `NORMAL`). Restrictive `24h` window returned 0 records when timestamps were older than 24 hours. |
| **Map Event Centering & Pan Offset** | Marker hidden behind sliding panel | **BROKEN** | `map.flyTo({ center: [lon, lat] })` centered the marker in the middle of the screen ($50\%$ width). When right-side drawers (450px–480px or dual 930px) opened, the marker was covered by the panel. |
| **Theme Switcher (Dark/Light)** | Theme toggle inconsistent across components | **BROKEN** | `handleThemeChange` toggled `document.documentElement.classList.add('dark')`, but root `<body>` had static `bg-slate-50 text-slate-900` without `dark:bg-slate-950 dark:text-slate-100` and child components lacked systematic CSS variable bindings. |
| **Geographic Sovereign Bounds** | Non-Indian / Oceanic points | **IMPLEMENTED / HARDENED** | Point-in-polygon Survey of India sovereign check (`is_within_sovereign_india`) filters incoming FIRMS telemetry. Old leftover demo records needed database-level purge. |
| **ML & Evidence Quality** | Low confidence / excessive "insufficient data" fallback | **BROKEN** | Non-facility regional agricultural and forest hotspots defaulted to `BASELINE_INSUFFICIENT` due to lack of historical facility records ($N < 10$). Replaced with calibrated physical radiance grading ($FRP \ge 150\text{ MW} \rightarrow \text{Critical}$, $FRP \ge 50\text{ MW} \rightarrow \text{Abnormal}$). |
| **Tactical RAG AI Chat** | Local LLM grounding & contextual querying | **PARTIAL** | Intent extractor and PostGIS query engine were functional, but active `eventId` from map selection was not passed into the chat query context automatically. |
| **ReportLab PDF Generation** | PDF report rendering | **IMPLEMENTED** | Validated and functional via ReportLab 4.1 with tamper-evident digital layout. |
| **NASA FIRMS Polling Cadence** | 5-minute background telemetry | **IMPLEMENTED** | Debounced at 300,000 ms to prevent external API rate-limiting. |

---

## 3. Detailed Technical Deficiencies Identified

### A. Map Camera Offset Defect
- **Observation:** Selecting an event in News or Alerts called `mapRef.current?.flyTo({ center: [lon, lat] })`.
- **Defect:** With a 450px (News/Alerts) or 480px (Event Dossier) or 930px (Dual Drawer) panel anchored on the right edge, the geographical marker at screen center was obscured by the opaque drawer.
- **Resolution Path:** Apply camera offset `offset: [-180, 0]` (single drawer) or `offset: [-350, 0]` (dual drawer) to MapLibre camera ease/fly transitions.

### B. Theming State Persistence & Root Class
- **Observation:** Clicking *Dark Aerospace* saved `thermo_theme: "dark"` to `localStorage`, but theme did not persist on page reloads or propagate across all custom Tailwind elements.
- **Resolution Path:** Add an inline theme initialization script in `app/layout.tsx` `<head>` and ensure dark mode variants (`dark:...`) are active on all layout containers and panels.

### C. Active Event Context in AI Chat
- **Observation:** If an operator selected `EVT-IN-GUJ-0001` on the map and opened Chat, asking *"What is the anomaly severity?"* failed to resolve the active event because `eventId` was not included in `ChatQueryRequest`.
- **Resolution Path:** Extend `ChatQueryRequest` with optional `selected_event_id: Optional[str] = None` and inject the active event telemetry directly into the LLM grounding context (`<VERIFIED_DATA>`).

---

## 4. Verification Checklist for Stage 5

- [ ] All Severity dropdown filters (`Critical`, `Abnormal`, `Elevated`, `Nominal`, `All`) return matching active hotspots.
- [ ] Map camera pans with dynamic left-offset so markers remain fully visible when drawers open.
- [ ] Dark/Light mode toggles cleanly across all surfaces and persists across reloads.
- [ ] Sovereign India geofencing rejects 100% of out-of-bounds telemetry.
- [ ] Active selected event is passed into Chat query for zero-hallucination contextual RAG.
- [ ] All 41 backend tests pass and Next.js frontend builds with 0 errors.
