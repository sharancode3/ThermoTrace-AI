# Stage 4 Audit

Date: 2026-08-30

## Measured current state

- `/monitor` preserves the existing MapLibre implementation with Google Roadmap and Hybrid raster base maps.
- The original monitor client loaded all GIS events with no viewport parameters; the staged API branch provides viewport, time, facility, observation, history, and comparison endpoints.
- URL state already uses `eventId` and reconstructs the selected event on refresh.
- The existing detail panel displayed Stage 1–3 intelligence but did not provide the required four-tab Stage 4 investigation workflow or real observation history.
- `/facilities` and `/reports` are intentionally placeholder surfaces; Stage 4 does not expand them.
- Frontend dependencies are absent in this workspace (`eslint` and `next` commands cannot be resolved), so browser build and Playwright execution cannot be measured locally.

## Working

- Google base-map implementation, selection URL state, backend event detail, and staged Stage 4 GIS/history/comparison endpoints.

## Missing before Stage 4 integration

- Debounced viewport-aware client requests.
- Server-backed timeline filter and backed layer controls.
- Investigation Timeline and Earlier-vs-Now UI.

## Duplicated / broken

- No duplicate map instance was found. The original map had both GeoJSON circles and one HTML marker for every event, which is not suitable for a large viewport response.
- Local frontend validation is blocked by missing installed dependencies.
