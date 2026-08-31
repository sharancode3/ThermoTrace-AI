# Stage 3 Intelligence Hardening — Phase 8 FIRMS Polling Cadence Report

**Document Version:** v3.3.0  
**Design Standard:** Foreground-Triggered Polling with Dynamic Day Range Recovery & Idempotent Deduplication.

---

## 1. Technical Cadence Model (Polar-Orbiting Constellation)

* **Physical Reality:** VIIRS (Suomi-NPP, NOAA-20, NOAA-21) and MODIS (Terra, Aqua) are polar-orbiting satellites with sun-synchronous orbits ($\sim 2-4$ Indian overpasses per day per sensor).
* **Cadence Purpose:** A 2-minute foreground cadence is designed to capture newly-published satellite swaths as soon as NASA finishes NRT processing, not to manufacture fake observations every 2 minutes. Receiving 0 new rows during inter-pass periods is physically accurate and expected.
* **Foreground-Only Resource Efficiency:** Polling is triggered strictly during active user sessions (`document.visibilityState === "visible"`), eliminating wasteful background daemon loops when zero operators are logged in.

---

## 2. Dynamic Gap Recovery & Idempotency

1. **Gap Recovery:**
   * When an operator opens the application after hours or days of inactivity, the system calculates the delta between `now()` and the database's latest observation timestamp.
   * Dynamically requests $N_{	ext{days}} = \min(5, \max(1, \Delta t_{	ext{days}} + 1))$ to backfill all missed satellite swaths in a single API round-trip.

2. **Idempotent Ingestion:**
   * Uses deterministic SHA-256 deduplication key:
     $$	ext{dedup\_key} = 	ext{SHA256}(	ext{round}(	ext{lat}, 4) \parallel 	ext{round}(	ext{lon}, 4) \parallel 	ext{acq\_date} \parallel 	ext{acq\_time} \parallel 	ext{sensor})$$
   * Executed via PostgreSQL `INSERT ... ON CONFLICT (dedup_key) DO NOTHING` to guarantee zero duplicate rows or event distortions on repeated fetches.

3. **Ingestion-Time Spatial Filtering:**
   * Bounding box and sovereign landmass filters reject out-of-boundary and oceanic points before writing to `thermal_observations`.

---

## 3. Automated Test Verification

* **`test_dynamic_day_range_recovery`**: Verified dynamic expansion to 4-5 days when recovering from multi-day gaps.
* **`test_dedup_key_idempotence`**: Verified deterministic SHA-256 hash consistency.
* **Full Core Test Suite**: 11 of 11 tests passing in `pytest`.
