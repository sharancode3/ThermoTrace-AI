# Stage 3 Intelligence Hardening — Phase 14 Export Boundary Verification Report

**Document Version:** v3.3.0  
**Phase Classification:** Scope Boundary Confirmation & Schema Alignment (Zero Duplicate Engine Building).

---

## 1. Scope Boundary Enforcement

* **Preserved Lightweight Action:** Retained the existing `"Export Tactical Dossier (JSON)"` feature as the primary lightweight operator export mechanism for Stage 3.
* **Stage 5 Isolation:** Formally deferred full Word / PDF / DoD-formatted reporting engines to Stage 5 (currently being implemented by the designated team). No redundant PDF builder or competing report engine was constructed in Stage 3.

---

## 2. Comprehensive Contract & Schema Alignment for Stage 5

Every field required by Stage 5's report generator is canonicalized and exported in both the REST API payload (`/api/v1/events/{id}`) and the client-side JSON Dossier:

| Field Name | Type | Example Value | Purpose in Stage 5 PDF/Word Report |
| :--- | :--- | :--- | :--- |
| `event_id` | `string` | `"EVT-IN-GUJ-JAMNAGAR-02"` | Header & document identification |
| `classification` | `string` | `"IND_FLARE"` | Sector categorization |
| `classification_confidence` | `float` | `0.684` | Calibrated model certainty |
| `evidence_strength` | `string` | `"STRONG" \| "MODERATE" \| "LIMITED"` | Evidence quality badge |
| `evidence_rationale` | `string` | `"3 obs, 78-day facility history"` | Justification subtitle |
| `anomaly_tier` | `string` | `"BASELINE_INSUFFICIENT" \| "NORMAL" \| "CRITICAL"` | Operational threat banner |
| `anomaly_z_score` | `float` | `0.00` (or `+6.82`) | Statistical deviation |
| `is_statistically_sufficient` | `boolean` | `false` | Baseline validity toggle |
| `baseline_sample_size` | `integer` | `3` | Empirical observation count |
| `baseline_sufficiency_threshold` | `integer` | `10` | Benchmark baseline minimum |
| `satellite_context.analysis_buffer_radius_km` | `float` | `2.28` | Heat-aware footprint scale |
| `satellite_context.primary_land_cover` | `string` | `"Industrial / Built-up"` | Regional land-use classification |
| `satellite_context.land_cover_breakdown` | `object` | `{"urban_pct": 75, "cropland_pct": 15}` | ESA WorldCover 10m chart |
| `satellite_context.optical_scene` | `object` | `{scene_id, acquisition_utc, cloud_cover, honesty_disclaimer}` | Optical corroboration image & caption |
| `shap_top_contributors` | `object` | `{"frp_variance": +1.71, "peak_frp_mw": -0.76}` | TreeSHAP explainability chart |
| `humanized_summary` | `object` | `{headline, what_happened, why_it_matters, model_assessment, uncertainty_and_gaps}` | Executive narrative brief |
| `is_within_india_sovereign_bounds` | `boolean` | `true` | Sovereign territory verification |
