# Stage 4 audit

Measured on the `stage4-apis` branch on 2026-08-31.

| Area | Status | Measured fact |
| --- | --- | --- |
| Monitor route | Working | `/monitor` renders the existing MapLibre canvas with the Google raster basemap. |
| GIS events | Working | The map requests `/api/v1/gis/events` after a 350 ms settled-viewport debounce, passing `west`, `south`, `east`, `north`, and `zoom`. |
| GIS layers | Working | Facilities and FIRMS observations are already conditional viewport-scoped layers. FIRMS data is suppressed server-side below zoom 9. |
| Event selection | Working | Map click updates `eventId` in the URL and opens the investigation drawer. |
| Investigation | Working | The drawer consumes detail, observation-history, and comparison endpoints. It has Overview, Timeline, Geographic Context, and Historical Baseline tabs. |
| Historical area comparison | Missing contract field | The current comparison endpoint returns FRP and brightness deltas, but no earlier/current area or area delta. The frontend must not fabricate it. |
| Query caching | Missing | React Query is described by the architecture but is not installed in the existing frontend. |
| Duplicate rendering | Broken | Event GeoJSON circles and one React marker per event are both currently rendered, creating unnecessary DOM work. |
