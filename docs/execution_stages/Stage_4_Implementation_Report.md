# Stage 4 implementation report

## Implemented surfaces

- `/monitor`: viewport-scoped thermal event workspace with monitor-window, severity, classification, facility, and FIRMS controls.
- Event investigation: existing URL deep-link (`?eventId=`) and four-tab drawer retained.

## API endpoints consumed

- `GET /api/v1/gis/events` with the live backend's `west`, `south`, `east`, `north`, `zoom`, time, classification, and anomaly-tier parameters.
- Existing event detail, history, comparison, facilities, and observations endpoints remain the only data sources.

## Viewport and layers

- The existing Google base map is preserved.
- Event fetching remains debounced after map movement and backend-culls to the viewport.
- Severity and classification filters are sent to the backend rather than applied to a national client-side dataset.
- Facility and FIRMS layers only request data when enabled.

## Investigation and history

- Event selection remains URL-driven and the drawer is responsive: side drawer on desktop and bottom sheet on mobile.
- The drawer keeps API-provided event telemetry, observation ordering, geographic context, baseline values, and Earlier vs Now FRP/brightness comparison.
- Area deltas are not displayed because the implemented comparison API does not return them.

## Known limitations

- React Query and Zustand are not present in the dependency set, so this incremental change preserves the existing React-state data flow.
- Full footprint geometry and area comparison require backend payload support; current GIS events and event boundaries are points.
- Verification has not included a running browser session or Playwright because this change was made in a restricted workspace session.

## Git

- Branch inspected: `stage4-apis`.
- No commit, push, merge, reset, or other Git mutation was performed.
