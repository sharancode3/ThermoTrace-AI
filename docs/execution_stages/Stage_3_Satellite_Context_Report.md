# Stage 3 Intelligence Hardening — Phase 12 On-Demand Satellite Context & Land-Cover Report

**Document Version:** v3.3.0  
**Design Standard:** Heat-Aware Buffer Scaling, ESA WorldCover 10m Classification, and Sentinel-2 / Landsat Optical Verification with Mandatory Honesty Timestamps.

---

## 1. Heat-Aware Radius Scaling

* **Formula:** $	ext{radius\_km} = 	ext{clamp}(1.5 + (	ext{peak\_frp\_mw} / 100.0), \min=1.5, \max=5.0)$
* **Physical Behavior:**
  * Routine industrial flares ($10-30	ext{ MW}$): Focused $1.6 - 1.8	ext{ km}$ buffer.
  * Major refinery flares (e.g. Jamnagar $78	ext{ MW}$): Scaled $2.28	ext{ km}$ buffer.
  * Massive runaway thermal events ($>350	ext{ MW}$): Broad $5.0	ext{ km}$ landscape footprint.

---

## 2. ESA WorldCover 10m Classification Reuse

* Extracts the underlying land-cover distribution within the heat-scaled buffer radius:
  * `pct_cropland`: Agricultural crop stubble / farmlands
  * `pct_urban`: Built-up industrial infrastructure / refinery units
  * `pct_forest`: Vegetative tree canopy
  * `pct_barren`: Open uncultivated terrain
* Reuses existing ESA trained pipeline outputs without training redundant models.

---

## 3. Optical Verification Scene (Sentinel-2 / Landsat Open Data)

* **Immutable Rule 8 Compliance:** Zero reliance on Google Maps tile pixels. Imagery and metadata are resolved exclusively from open Copernicus Sentinel-2 Level-2A bottom-of-atmosphere passes.
* **Mandatory Honesty Standard:**
  * Displays the **exact optical scene acquisition timestamp** (e.g. `28 Aug 2026 05:24 UTC`) and time offset (e.g. `48h prior to thermal detection`).
  * Explicitly includes honesty disclaimer banner:
    > *"Sentinel-2 MSI reference scene acquired 48h prior to thermal detection. Optical scene provides surface land-cover baseline, not simultaneous overpass."*

---

## 4. Tier 2 Permanent Caching & Automated Test Results

* Computed once on first drawer open via `/api/v1/events/{id}` and permanently cached.
* **Automated Tests (`tests/test_satellite_context.py`):**
  * `test_heat_aware_radius_scaling`: Verified dynamic buffer scaling from $1.5	ext{km}$ to $5.0	ext{km}$.
  * `test_sentinel2_honesty_timestamp_and_metadata`: Verified non-simultaneous disclaimer and cloud-cover metadata.
* **Full Core Suite:** 20 of 20 tests passing in `pytest`.
* **Frontend Production Build:** `next build` compiled with 0 errors.
