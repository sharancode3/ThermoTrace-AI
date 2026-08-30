# Thermo Intelligence — Stage 1 Implementation Plan

## Goal Description
Establish the absolute end-to-end foundation of the Thermo Intelligence platform exactly as specified in the authoritative architecture documents. This stage will not implement intelligent ML or ingestion workers, but will construct the structural boundary for the PostGIS → FastAPI → Next.js → MapLibre data flow using verified sample data. 

## User Review Required
> [!IMPORTANT]
> Please review this exhaustive phase-by-phase implementation plan. Once you click **Proceed**, I will begin executing these phases iteratively, stopping to verify each major integration checkpoint.

## Open Questions
None. The provided authoritative documentation is highly comprehensive and perfectly clear on all technical requirements for Stage 1.

## Proposed Implementation Phases

### Phase 1: Repository / Monorepo Foundation
- Initialize `backend/` and `frontend/` directories.
- Define root-level `docker-compose.yml`, `.env.example`, and `.gitignore`.
- Set up FastAPI project scaffold in `backend/` using pip/requirements.txt (keeping it light).
- Set up Next.js app in `frontend/` using `npx -y create-next-app@latest ./` with TypeScript and Tailwind CSS.

### Phase 2: Docker Development Environment
- Create `Dockerfile` for the FastAPI backend (Uvicorn).
- Create `Dockerfile` for the Next.js frontend (Dev mode).
- Configure `docker-compose.yml` to orchestrate:
  - `postgres` (PostGIS 16 image)
  - `backend` (FastAPI mapped to port 8000)
  - `frontend` (Next.js mapped to port 3000)
- Ensure persistent volumes for database data.

### Phase 3: Database Foundation (PostgreSQL + PostGIS)
- Initialize SQLAlchemy declarative base in `backend/app/db/`.
- Translate the authoritative DDL into SQLAlchemy ORM models.
- Set up Alembic for migrations.
- Create the initial migration for:
  - `thermal_observations`
  - `industrial_facilities`
  - `thermal_events`
- Apply migrations and verify the PostGIS extension is active.

### Phase 4: Database Seed / Sample Data
- Create a Python script (`backend/scripts/seed_demo_data.py`) to inject synthetic, geographically valid data into PostGIS.
- Seed 3-5 Industrial Facilities (e.g., Reliance Jamnagar).
- Seed 5-10 Thermal Events strictly marked as DEMO data.

### Phase 5 & 6: FastAPI Foundation & API Contract
- Implement Pydantic models mapping exactly to `openapi.yaml`.
- Set up global error handling, logging, and CORS.
- Implement the following required endpoints:
  - `GET /api/v1/health` (System status)
  - `GET /api/v1/gis/events` (Returns GeoJSON FeatureCollection for MapLibre)
  - `GET /api/v1/events/{event_id}` (Detail panel payload)
- Verify endpoints return data exactly matching the contract.

### Phase 7 & 8: Frontend & Responsive UI Foundation
- Install `shadcn/ui` components (buttons, cards, drawers, dialogs).
- Configure Next.js layout with dark mode as default.
- Build the persistent navigation shell (Desktop Sidebar / Mobile Header + Bottom Nav).
- Build the `/monitor` command-center layout preventing map squeeze.

### Phase 9 & 10: MapLibre Foundation & API Integration
- Install `maplibre-gl` and `react-map-gl`.
- Implement `MapComponent` fetching GeoJSON from `GET /api/v1/gis/events`.
- Render the DEMO events as distinct geographic features on a dark-themed basemap.
- Ensure the map zooms and pans responsively without breaking the UI layout.

### Phase 11 & 12: Event Detail Panel & Shared API Client
- Create a typed `apiClient.ts` wrapper (avoiding scattered `fetch` calls).
- Implement a click listener on MapLibre markers.
- Trigger `GET /api/v1/events/{event_id}` and display the data in a slide-out investigation drawer (Desktop) or bottom sheet (Mobile).

### Phase 13: Error / Loading / Empty States
- Implement UI skeletons for the map and event detail panel.
- Implement toast notifications for API failures.
- Implement empty states if no geographic data is returned.

### Phase 14 & 15: Verification & Browser Test
- Write a basic Playwright test in the frontend repository confirming the map loads and a marker can be clicked.
- Execute Pytest backend tests verifying the PostGIS spatial queries.

### Phase 16 & 17: Code Quality & Acceptance
- Run linters (`flake8`/`black` for backend, `eslint` for frontend).
- Verify the 17-point checklist from the Stage 1 prompt.
- Save the final execution report.

## Verification Plan
1. **Automated Tests:** Run backend unit tests (`pytest`) for database/API routes and a Playwright test for the browser flow.
2. **Manual Verification:** Build and start the entire stack via `docker-compose up`. Visually confirm the map loads, data is fetched dynamically from the database, and the responsive design behaves correctly on simulated mobile devices.
