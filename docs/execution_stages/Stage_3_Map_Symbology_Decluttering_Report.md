# Stage 3 Intelligence Hardening — Phase 10 & 11 Map Symbology & Decluttering Report

**Document Version:** v3.3.0  
**Design Standard:** 9-Icon Tactical Symbology (Type × Severity) & Server-Side PostGIS Decluttering.

---

## 1. Phase 10: 9-Icon Tactical Symbology System

Implemented reusable vector marker component [`frontend/src/components/ThermalMapMarker.tsx`](file:///c:/SHARAN%20PROJECTS/SiH%202026-ThermoTrace%20AI/frontend/src/components/ThermalMapMarker.tsx) conforming to clean Lucide-style minimalism:

### Matrix: 3 Shapes × 3 Severity Colors (+1 Neutral Insufficient Treatment)

| Base Shape (Classification) | Green (`#16A34A`)<br>*(Nominal / Elevated)* | Amber / Orange (`#EA580C`)<br>*(Abnormal Anomaly)* | Red (`#DC2626`)<br>*(Critical Anomaly)* | Neutral Slate (`#64748B`)<br>*(Baseline Insufficient)* |
| :--- | :--- | :--- | :--- | :--- |
| **Industrial Stack** (`IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`) | Routine refinery/flare operations | Elevated industrial pulse | Critical thermal anomaly / runaway flare | Uncalibrated baseline ($N < 10$) |
| **Vegetation Sprout** (`AGRI_BURN`, `WILDFIRE`) | Low-intensity crop stubble burn | Extensive farm clearing | Uncontrolled rapid forest fire | Sparse regional history |
| **Hexagon Target** (`OTHER_UNCERTAIN`) | Nominal transient anomaly | Unclassified heat source | High-intensity unclassified event | Insufficient historical sample |

* **Color Mapping Documented:** The architecture defines 4 anomaly tiers (`NOMINAL`, `ELEVATED`, `ABNORMAL`, `CRITICAL`). To present a clean 3-color map glance, `NOMINAL` and `ELEVATED` are mapped to **Green** ("not currently concerning to a map glance"). `ABNORMAL` maps to **Amber**, and `CRITICAL` maps to **Red**. `BASELINE_INSUFFICIENT` receives a distinct neutral slate treatment.

---

## 2. Phase 11: Server-Side PostGIS Decluttering & Feed Control

1. **Default Decluttered View:**
   * Broad national zoom shows **only priority operational events**:
     $$	ext{anomaly\_tier} \in \{	ext{'ABNORMAL'}, 	ext{'CRITICAL'}\} \lor 	ext{classification} \in \{	ext{'IND\_FIRE'}, 	ext{'IND\_FLARE'}\}$$
   * Eliminates the "messy dots everywhere" visual fatigue.

2. **Interactive Toggle:**
   * Added `[Priority Decluttered View (Count)]` vs. `[Showing All Detections (Count)]` toggle directly on the map viewport.

3. **Thermo News Click Exception:**
   * Clicking a Thermo News card passes `focus_event_id` to the API.
   * PostGIS query includes `OR event_id = :focus_event_id`, ensuring the clicked event marker is rendered and focused even with default decluttering enabled.

4. **Server-Side PostGIS Viewport Query:**
   * Filtering executes in PostgreSQL rather than sending thousands of points over the network to client RAM.

---

## 3. Automated Test Verification

* **`test_default_gis_events_decluttering`**: Verified default endpoint filters out non-priority noise.
* **`test_show_all_gis_events_toggle`**: Verified toggle expands to full sovereign stream.
* **`test_focus_event_bypass`**: Verified focus event bypasses decluttering filter.
* **Full Suite**: 18 of 18 tests passing in `pytest`.
* **Frontend Build**: `next build` compiled with 0 errors.
