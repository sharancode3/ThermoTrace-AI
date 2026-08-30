# Stage 3: Thermal Intelligence Engine Implementation Plan

This is the comprehensive implementation plan for Stage 3: Anomaly Detection Engine Development, rigorously following the **Thermo Intelligence Data/ML/GIS Architecture** and the provided prompt.

## Phase 0: Existing Data / Stage 2 Audit (Status: BLOCKED)

> **Database Unreachable / Offline**
> I attempted to audit the Stage 2 database to verify 	hermal_observations, industrial_facilities, and historical records. However, **the PostgreSQL database at localhost:5432 is refusing connections.** 
> Furthermore, docker and docker-compose are not available on this Windows system to spin up the docker-compose.yml services.
> 
> **To proceed with Phase 1+, I need the PostGIS database to be running.** Please either start the local PostgreSQL service, start Docker, or provide connection credentials to a remote/hosted PostGIS database.

---

## Execution Methodology

The implementation will be executed strictly sequentially, with manual verification at each checkpoint. I will not proceed to a subsequent checkpoint until the current one passes deterministic and numerical inspection.

### CHECKPOINT A: Raw Data → Events (Phases 1, 2)
1. **ST-DBSCAN Engine**: Implement ackend/app/domain/clustering.py.
2. **Parameters**: eps_spatial = 750m, eps_temporal = 12h, MinPts = 1.
3. **Geometry**: Single observation = buffered point. Multiple = ST_ConvexHull.
4. **Merge Logic**: Merge overlapping active events while preserving lineage in event_observations.
5. **Idempotency Test**: Run twice, ensure no duplicates.

### CHECKPOINT B: Events → Context (Phases 3, 4)
1. **Facility Context**: Use ST_DWithin to associate events with industrial_facilities.
2. **Land-Cover Context**: Extract pct_cropland, pct_forest, pct_urban using Rasterio windowed reads from data/raw/esa_worldcover.
3. **Edge Cases**: Handle missing raster tiles, no facilities, and strict numerical distance preservation.

### CHECKPOINT C: Context → Features (Phase 5)
1. **Feature Schema**: Build the exact 14-dimension feature vector (Spatial, Radiometric, Temporal, Historical, Land Cover).
2. **Leakage Audit**: Ensure no future observations or post-event data bleed into historical features.
3. **Parity**: Guarantee training and inference use the exact same feature builder.

### CHECKPOINT D: Features → Dataset (Phases 6, 7)
1. **Label Generation**: Separate weak labels from verified ground truth.
2. **Dataset**: Create event-level tabular dataset.
3. **Spatial K-Fold**: Group by geographic region/facility to prevent memorization leakage.
4. **Distribution Report**: Measure sample counts across the 6 canonical classes.

### CHECKPOINT E: Dataset → Model (Phases 8, 9, 10)
1. **Baseline Model**: Train a lightweight tree model to benchmark against XGBoost.
2. **XGBoost Training**: Train with strict hyperparameter control and early stopping.
3. **Calibration**: Calibrate probabilities and enforce the OTHER_UNCERTAIN low-confidence policy.
4. **Artifacts**: Serialize to 	hermo_xgb_v1.0.0.joblib.
5. **Validation Report**: Produce macro F1, per-class F1, and confusion matrix.

### CHECKPOINT F: Model → Persistence / Baseline / Anomaly (Phases 11, 12, 13)
1. **Persistence Engine**: Calculate historical recurrence and assign TRANSIENT, INTERMITTENT, or PERSISTENT.
2. **Baseline Engine**: Calculate Facility Q25/Q50/Q75, mean, and std over a 90-day window.
3. **Anomaly Engine**: Calculate Z = (FRP_current - mean) / std. Assign NORMAL, ELEVATED, ABNORMAL, or CRITICAL.
4. **Safety**: Implement fallbacks for std=0 or insufficient history (<10 events).

### CHECKPOINT G: Complete Intelligence Object & API (Phases 14, 15, 16, 27)
1. **Assembly**: Combine Event, Context, Features, Classification, Persistence, Baseline, and Anomaly into a single DTO.
2. **Storage**: Persist all derived metrics back into the frozen schema (	hermal_events, event_classifications, event_anomalies, acility_baselines).
3. **API Integrity**: Ensure openapi.yaml REST endpoints return the structured object for downstream systems.

---

## Open Questions

> **PostGIS Database Access**
> How should I connect to the PostGIS database? Since docker is not installed on this machine, are we using a remote database (e.g., Supabase, Neon, AWS RDS), or do you have a local Windows native installation of PostgreSQL that needs to be started?

> **Land Cover Raster**
> The WorldCover raster at ackend/data/raw/esa_worldcover does not appear to exist currently. Will you provide this raster, or should I run the prepare_worldcover.py script to fetch it once the DB is online?
