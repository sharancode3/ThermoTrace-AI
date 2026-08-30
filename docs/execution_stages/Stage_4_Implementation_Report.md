# Stage 4 Implementation Report

Date: 2026-08-30
Branch: `stage4-apis`
Implementation commit: `52571be0e8409790df9728b6878d33db55a923a0`

## Implemented surfaces

- `/monitor`: debounced viewport-aware event requests, current/past time windows, and backed layer controls.
- Event investigation: responsive right-side desktop drawer and mobile bottom sheet with Overview, Timeline, Geographic Context, and Historical Baseline tabs.

## GIS layers and endpoints

- Thermal events: `GET /api/v1/gis/events` with `west`, `south`, `east`, `north`, `zoom`, and observation-time bounds.
- Facilities: `GET /api/v1/gis/facilities`, requested only when its layer is enabled.
- FIRMS observations: `GET /api/v1/gis/observations`, requested only when enabled; the API returns no points below its supported zoom.
- Investigation: `GET /api/v1/events/{id}`, `/history`, and `/compare`.

## Behaviour

- The map retains the established Google Roadmap/Hybrid base map and MapLibre instance.
- Map movement waits 350 ms after movement ends before fetching; spatial and temporal filtering occur server-side.
- Event selection continues to use `?eventId=…`; refresh reconstructs the drawer.
- Timeline renders only actual linked observations and shows `INSUFFICIENT DATA` when none are available.
- Earlier-vs-Now renders only API-provided earlier/current satellite observations and ΔFRP/brightness; it clearly avoids causal claims. Area delta is not shown because the current comparison endpoint does not return area measurements.

## Verification and limitations

- Static review: passed `git diff --check`.
- Frontend lint/build and Playwright are blocked in this checkout because frontend dependencies are not installed (`eslint` and `next` cannot be resolved). No passing test result is claimed.
- No new APIs, facilities-management work, Stage 5 features, or simulated intelligence were added.
