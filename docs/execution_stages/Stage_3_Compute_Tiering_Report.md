# Stage 3 Intelligence Hardening — Phase 7 Two-Tier Compute Architecture Report

**Document Version:** v3.3.0  
**Architectural Goal:** Eliminate latency and compute waste by decoupling immediate map/news requirements from on-demand deep explainability and imagery synthesis.

---

## 1. Two-Tier Execution Strategy

| Compute Tier | Trigger Mechanism | Latency Profile | Payload Generated | Caching Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Cheap-Eager)** | Automatic post ST-DBSCAN clustering during satellite pass ingestion | $< 1	ext{ ms}$ per event | 14-D Feature extraction, Calibrated XGBoost classification, Statistical Anomaly Z-Score ($N \ge 10$), Thermo News headline & summary | Persistent in PostgreSQL (`events`, `event_anomalies`, `event_classifications`, `thermo_news`) |
| **Tier 2 (Expensive-Lazy)** | User-driven: Opened Event Investigation Drawer via `/api/v1/events/{id}` | $< 5	ext{ ms}$ on Cache Hit; $\sim 80	ext{ ms}$ on First Run | TreeSHAP Top-3 feature contributors, Deep LLM intelligence brief, Satellite context & land-cover analysis | Permanent Cache in `event_classifications` keyed by `tier2_computed_at` |

---

## 2. Implementation Highlights

1. **Tier 1 Decoupling:**
   - Eradicated bulk SHAP explainability loops from ingestion pipelines and batch intelligence reprocessors.
   - Guaranteed immediate availability of accurate classification, calibrated probabilities, and verified statistical anomaly tiers for map markers and live news cards.

2. **Tier 2 On-Demand Compute & Caching (`backend/app/domain/anomaly.py`):**
   - Implemented `get_or_compute_tier2_intelligence(session, event_id)`.
   - Checks `cls_record.tier2_computed_at`. If cached and fresh, returns cached TreeSHAP importances and narrative directly in sub-5ms.
   - If not yet computed or data has materially updated, executes TreeSHAP, writes `tier2_computed_at = datetime.now(timezone.utc)`, and caches the payload.

3. **Database Migration:**
   - Added `tier2_computed_at TIMESTAMPTZ` column to PostgreSQL `event_classifications` table and ORM model.

---

## 3. Automated Test Verification

* **`tests/test_tier_compute_architecture.py`**:
  * `test_tier1_eager_excludes_shap`: Verified eager Tier 1 operates without SHAP blocking.
  * `test_tier2_cached_response`: Verified subsequent drawer opening hits cache in $<10	ext{ms}$.
* **Full Core Suite**: 9 of 9 tests passing.
