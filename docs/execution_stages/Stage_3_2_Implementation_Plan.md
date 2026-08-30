# THERMO INTELLIGENCE — STAGE 3.2 IMPLEMENTATION PLAN
**Thermal Intelligence Hardening, Validation, Uncertainty, Robust Anomaly Intelligence, Live FIRMS Foundation & Application Testability**

## Objective
To make the Thermal Intelligence engine trustworthy, reproducible, well-validated, uncertainty-aware, and as strong as practically possible for the SIH prototype without introducing unnecessary complexity. Concurrently, to ensure the application surface is fully navigable, testable, and structurally ready for downstream integrations.

---

## STREAM A: APPLICATION SCREEN FOUNDATION / TESTABILITY PASS
**Goal:** Ensure the existing application surface is complete and testable so that every screen, navigation target, drawer, and route defined by the current project architecture can be opened and verified.

*Execution constraint: Do this incrementally. Audit, fix route, run app, test in browser, fix, continue.*

- [ ] **Phase 0: Audit** - Inspect current routes, navigation links, architecture, API client, Zustand setup, MapLibre persistence, event detail implementation, and backend endpoints.
- [ ] **Phase 1: Global Application Navigation** - Ensure every visible navigation item routes correctly (real route, overlay, or clearly marked unavailable).
- [ ] **Phase 2: Monitor Preservation** - Ensure the MapLibre instance is preserved on /monitor when overlays open.
- [ ] **Phase 3: Facilities Screen** - Implement /facilities (page title, list/table, real records, loading/empty/error states).
- [ ] **Phase 4: Reports Screen** - Implement /reports (shell for report generation, unavailable/processing states).
- [ ] **Phase 5: Event Investigation** - Implement URL-driven deep-linked state (/monitor?eventId=...). Show actual Stage 3 data (classification, confidence, anomaly, FRP, etc.).
- [ ] **Phase 6: Thermo News Surface** - Implement News drawer/panel. Show real records or clean empty state.
- [ ] **Phase 7: Notification / Alert Surface** - Implement Notifications drawer/panel (read/unread, empty states).
- [ ] **Phase 8: Chat Surface** - Implement RAG terminal interface shell. Use real endpoint if available, else show unavailable state.
- [ ] **Phase 9: Settings Surface** - Implement Settings shell (if exposed) for theme/map preferences.
- [ ] **Phase 10: Responsive Behaviour** - Ensure all surfaces work on Desktop, Tablet, and Mobile (<768px vs >=768px).
- [ ] **Phase 11: Real API Boundary** - Ensure every screen uses the centralized, typed API client (no scattered fetch logic).
- [ ] **Phase 12: Honest Data States** - Implement LOADING, EMPTY, ERROR, SUCCESS states for all screens without fake data.
- [ ] **Phase 13: Consistent Application Shell** - Enforce consistent typography, spacing, theme, and component language.
- [ ] **Phase 14: Map Context Preservation** - Ensure Event, News, Alerts, and Chat overlays preserve map context.
- [ ] **Phase 15: Deep-Link Testing** - Verify /monitor, /monitor?eventId=..., /monitor?facilityId=..., /facilities, /reports.
- [ ] **Phase 16: Application Route QA** - Create a route matrix and verify every route manually.
- [ ] **Phase 17: Playwright Smoke Test** - Create E2E browser tests covering all application surfaces.
- [ ] **Phase 18: Error Testing** - Simulate backend unavailability, empty responses, malformed IDs.
- [ ] **Phase 19: Visual QA** - Inspect at 1440px, 768px, and 390px (clipping, overflow, target sizes, themes).
- [ ] **Phase 20: Do Not Change Analytical Truth** - Ensure this pass does not alter Stage 3 analytical outputs.
- [ ] **Phase 21: Clean Repository** - Maintain feature-oriented structure (pp/, components/, eatures/, lib/).
- [ ] **Phase 22: Final Acceptance Criteria** - All UI testability conditions met.

---

## STREAM B: STAGE 3.2 THERMAL INTELLIGENCE HARDENING & VALIDATION
**Goal:** Harden the analytical contract (Source Identity, Persistence, Operational Anomaly).

*Execution constraint: Work checkpoint-by-checkpoint. Inspect, implement, test, fix, rerun, document.*

### CHECKPOINT A: Initial Audits & Quality Control
- [ ] **Phase 0: Audit the Existing Stage 3** - Inspect ST-DBSCAN parameters, geometries, features, labels, leakage, model version, baseline, anomaly calculations. Create Stage_3_2_Audit.md.
- [ ] **Phase 1: Investigate "Confidence 1.00" Problem** - Diagnose probability calibration, test distribution, label leakage, and model overconfidence.
- [ ] **Phase 2: Rebuild Dataset Audit** - Measure event counts, class distributions, missing contexts. Generate reports.
- [ ] **Phase 3: Label Quality Hardening** - Distinguish VERIFIED, WEAK, UNKNOWN. Prevent feature-target leakage in expert rules.
- [ ] **Phase 4: Hard Negative Mining** - Add difficult counterexamples (e.g., agricultural burns near factories, high-FRP rural events).

### CHECKPOINT B: Feature Engineering & Event Quality
- [ ] **Phase 5: Feature Engineering Audit** - Audit the exact 14 features (spatial, radiometric, temporal, historical, land cover).
- [ ] **Phase 6: Add Features Only Where Justified** - Ensure any new features are derivable, consistent, leakage-free, and documented.
- [ ] **Phase 7: Event-Level Data Integrity** - Verify model operates on Thermal Events (counts, durations, footprint). Test edge cases (1 observation, many observations).
- [ ] **Phase 8: ST-DBSCAN Quality Hardening** - Use 750m / 12h / MinPts=1 defaults. Run parameterized experiments to minimize fragmentation/over-merging.

### CHECKPOINT C: Model Validation, Leakage & Imbalance
- [ ] **Phase 9: Spatial Leakage Prevention** - Use GroupKFold or Spatial K-Fold. Zero overlap between train and validation geographic groups.
- [ ] **Phase 10: Temporal Leakage Prevention** - Ensure historical features strictly respect classification cutoff times.
- [ ] **Phase 11: Model Champion / Challenger Experiment** - Benchmark XGBoost against LightGBM/Random Forest under strict identical conditions.
- [ ] **Phase 12: Imbalance Handling** - Evaluate class weighting/synthetic oversampling (only inside training folds).
- [ ] **Phase 13: Model Hyperparameter Validation** - Perform bounded, reproducible tuning on XGBoost (depth, LR, subsampling).

### CHECKPOINT D: Calibration, Uncertainty & Explainability
- [ ] **Phase 14: Calibrated Probabilities** - Evaluate and apply Platt scaling or isotonic calibration.
- [ ] **Phase 15: Uncertainty-Aware Classification** - Separate class prediction from uncertainty (HIGH/MODERATE/LOW). Use OTHER_UNCERTAIN for low evidence.
- [ ] **Phase 16: Out-of-Distribution / Novelty Check** - Implement lightweight novelty strategy (feature-space distance, entropy).
- [ ] **Phase 17: SHAP Explainability** - Implement Tree SHAP to extract top contributing features per event.

### CHECKPOINT E: Advanced Analytics, Baselines & Persistence
- [ ] **Phase 18: Facility-Specific Thermal Fingerprint** - Build historical profiles (mean, std, Q25/Q50/Q75, active days) for industrial contexts.
- [ ] **Phase 19: Robust Baseline Analytics** - Keep Z-score. Add robust statistics (median, MAD, IQR) to support anomaly interpretation.
- [ ] **Phase 20: Baseline Contamination Protection** - Ensure evaluated events do not contribute to their own baseline.
- [ ] **Phase 21: Persistence Engine Hardening** - Base persistence on distinct event episodes, not raw satellite frequency.
- [ ] **Phase 22: Temporal Recurrence Profile** - Differentiate long single incidents from repeated thermal activity.
- [ ] **Phase 23: Observed Thermal Footprint** - Calculate footprint area, convex hull, spatial expansion. Do not claim physical heat propagation.
- [ ] **Phase 24: Thermal Trend** - Calculate deterministic temporal trend (INCREASING/STABLE/DECREASING) for multi-observation events.
- [ ] **Phase 25: Event Evidence Score** - Differentiate MODEL CONFIDENCE from EVIDENCE COMPLETENESS.
- [ ] **Phase 26: Small-Evidence Event Handling** - Expose observation_count clearly and prevent false precision on 1-observation events.

### CHECKPOINT F: Live FIRMS Foundation
- [ ] **Phase 27: Real-Time FIRMS Polling Foundation** - Establish 2-minute polling frequency strictly for the India extent.
- [ ] **Phase 28: FIRMS Ingestion Efficiency** - Fetch, validate, deduplicate, and insert ONLY new observations. Track last_successful_fetch separately.
- [ ] **Phase 29: FIRMS API Rate Safety** - Enforce backend as the single FIRMS client. Utilize caching to prevent MAP_KEY exhaustion.
- [ ] **Phase 30: India-Only Live Ingestion** - Live ingestion operates exclusively on the defined India bounding box.
- [ ] **Phase 31: "FIRMS Data" User Concept** - Prepare boundary for raw FIRMS view vs ML intelligence view.
- [ ] **Phase 32: On-Demand Investigation Preparation** - Prepare boundary for requesting observations by bbox/time.
- [ ] **Phase 33: Maximum Available FIRMS Attributes** - Capture all available, validated FIRMS attributes (day/night, bright_ti4, etc.).
- [ ] **Phase 34: Data Freshness** - Separate timestamps for fetch, latest observation, and processing completion.

### CHECKPOINT G: Final Deliverables, Lineage & E2E Acceptance
- [ ] **Phase 35: Model Artifact Governance** - Version artifact with metadata (schema, hash, hyperparameters).
- [ ] **Phase 36: Model Reproducibility** - Ensure rebuilds from exact snapshot/seed yield consistent behaviour.
- [ ] **Phase 37: Evaluation Report** - Produce Stage_3_2_Model_Evaluation.md with measured metrics (F1, precision, recall, SHAP).
- [ ] **Phase 38: Failure-Case Analysis** - Analyze false positives/negatives, feature contributions.
- [ ] **Phase 39: Confusion Matrix Quality** - Ensure separation of IND_FIRE, IND_FLARE, and IND_ROUTINE.
- [ ] **Phase 40-41: Safety Gates & Numerical Safety** - Handle NaN/Infinity safely; fallback to OTHER_UNCERTAIN.
- [ ] **Phase 42-43: Full Lineage & Idempotency** - Trace an event from output back to raw FIRMS IDs. Verify idempotency.
- [ ] **Phase 44: Performance** - Ensure practical processing limits on dev machine (indexes, batching).
- [ ] **Phase 45-46: Robustness & No Fake Scores** - Do not invent composite AI scores. Retain distinct intelligence metrics.
- [ ] **Phase 47-50: Intelligence Object Enhancement** - Provide all required fields for visualization without inventing impact footprints.
- [ ] **Phase 51-56: Final Testing & Acceptance** - Validate across all criteria, E2E real data test, generate required MD reports.

---

## STREAM C: STAGE 3.2 CONTINUATION (ADVANCED THERMAL INTELLIGENCE)
**Goal:** Enrich the intelligence package with temporal forecasting, impact context, and evidence fusion.

- [ ] **Part 1-2: Thermal Signal Enrichment & Quality** - Expose raw FIRMS attributes. Calculate Observation Quality Score (GOOD/LIMITED/INSUFFICIENT).
- [ ] **Part 3-5: Event Thermal Profile & Trend** - Build temporal profiles, calculate FRP trend slopes (RAPIDLY_INCREASING, etc.), derive Thermal Phase (EMERGING, MATURE, DORMANT).
- [ ] **Part 6-7: Footprint Dynamics & Spatial Structure** - Calculate expansion/contraction rates. Characterize structure (COMPACT, DISPERSED, etc.).
- [ ] **Part 8-11: Advanced Baselines & Multi-Scale Anomaly** - Facility fingerprint, Baseline contamination tests, Z-score plus MAD/IQR robust diagnostics, 7/30/90 day comparisons.
- [ ] **Part 12-14: Temporal Intelligence** - Detect change-points (CUSUM, sustained shifts). Develop Recurrence Profiles. Expose Diurnal signatures (Day/Night fractions).
- [ ] **Part 15-18: Context Rings & Exposure** - Evaluate Land-Cover proportions. Create surrounding contextual rings (0-500m, 500m-1km). Identify exposure (population/infrastructure) *if authoritative data exists*. No fake impact claims.
- [ ] **Part 19-22: Modelling & Forecasting** - Provide probabilistic continuation/decline models (ONLY if sufficient sequential data exists). Differentiate observed vs modelled.
- [ ] **Part 23-26: Classifier Enrichment** - Use hard negatives, test ensembles (only if justified). DO NOT force confidence to 100%. Separate Model Confidence from Evidence Completeness.
- [ ] **Part 27-29: Explanation & Reason Codes** - Construct Explainable Evidence Graphs. Generate explicit Reason Codes (NEAR_INDUSTRIAL_FACILITY, LOW_EVIDENCE). Fuse external satellite evidence where present.
- [ ] **Part 30-35: Map Intelligence** - Prepare data for high-res map context. Provide location intelligence (state/district geocoding). Provide "Time Active" and probabilistic decline estimations.
- [ ] **Part 36-38: Impact Context & Uncertainty Vis** - Expose impact summaries (observed footprint + nearby facilities). Prepare probability distributions for uncertainty UI.
- [ ] **Part 39-47: Ablation & Robustness** - Run ablation studies. Define Proximity and FIRMS-only baselines for comparison. Error stratification. Adversarial testing ("looks industrial").
- [ ] **Part 48-49: Intelligence Object Finalization** - Add all derived metrics to the DB/API contract cleanly.
- [ ] **Part 50-56: AI Boundary & Final Validation** - Exclude LLM from deterministic classification. Verify no fabricated data. Perform Champion selection and Scientific/Software review. Ensure deliverables (Stage_3_2_Error_Analysis.md, Stage_3_2_Feature_Contract.md, Stage_3_2_Intelligence_Object.md) exist.

---
**FINAL GOAL:** A TRACEABLE THERMAL INTELLIGENCE PACKAGE that knows what it knows, knows when evidence is weak, never confuses proximity with truth, and does not leak future information.
