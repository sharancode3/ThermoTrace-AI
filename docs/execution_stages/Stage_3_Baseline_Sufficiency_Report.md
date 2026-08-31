# Stage 3 Intelligence Hardening — Phase 6 Baseline Sufficiency Report

**Document Version:** v3.3.0  
**Enforcement Rule:** No anomaly or severity claim may be made from statistically insufficient history.  
**Sufficiency Threshold:** $N_{	ext{threshold}} = 10$ distinct observation days in a rolling 90-day window.

---

## 1. Statistical Contradiction Eliminated (The Jamnagar Defect Fix)

In the pre-hardening system, transient events with zero observation history ($N=0$) or unassociated facilities were assigned arbitrary hardcoded Z-scores ($+5.2\sigma$, $+2.6\sigma$, $+1.6\sigma$) in `backend/app/domain/anomaly.py`. This produced the contradictory state where an event was labeled `TRANSIENT (0 active days in 90d)` while simultaneously claiming a `+6.8σ CRITICAL` statistical anomaly.

### Hardening Fix Applied:
1. **Removed Fallback Fabrication:** The arbitrary fallback Z-score branching was eradicated from `backend/app/domain/anomaly.py`.
2. **Explicit Insufficient State:** If $N < 10$ or facility is unassociated, the event is strictly assigned `anomaly_tier = "BASELINE_INSUFFICIENT"`, and `z_score = 0.0` with explicit contributing factor metadata explaining that the statistical Z-score is withheld due to insufficient historical sample size.
3. **True Facility Baselines Populated:** Verified 90-day operational baselines (mean, standard deviation, median, 95th percentile, max) were computed and populated in the PostgreSQL `facility_baselines` and `industrial_facilities` tables for registered Indian industrial infrastructure.

---

## 2. Live Database Distribution (941 Stored Events)

```
========================================================================================================
Anomaly Tier             Event Count    Percentage    Statistical Basis
========================================================================================================
BASELINE_INSUFFICIENT        807          85.76%      N < 10 or unassociated facility; Z-score withheld
NORMAL                       128          13.60%      N >= 10; observed FRP complies with historical mean
ELEVATED                       2           0.21%      N >= 10; +1.5σ <= z < +2.5σ
ABNORMAL                       1           0.11%      N >= 10; +2.5σ <= z < +4.0σ
CRITICAL                       3           0.32%      N >= 10; z >= +4.0σ verified emergency radiance
--------------------------------------------------------------------------------------------------------
TOTAL                        941         100.00%      Zero Fabricated Anomaly Claims
========================================================================================================
```

---

## 3. UI Presentation of Uncertainty as Signal

When a user investigates an event tagged `BASELINE_INSUFFICIENT`:
* The **Investigation Drawer** renders an informational status card:
  `BASELINE INSUFFICIENT: Historical observation sample size is insufficient (N < 10) to establish a Gaussian baseline. Anomaly Z-score is withheld.`
* The **XGBoost Match Confidence** displays the calibrated model probability accompanied by `Evidence: LIMITED (1 satellite pass, sparse baseline)`.
* Zero cosmetic inflation or fake sigma numbers are shown.

---

## 4. Compliance Checklist
* [x] Fallback Z-score fabrication completely removed from backend code.
* [x] Strict $N_{	ext{threshold}} = 10$ enforced for all Gaussian anomaly evaluations.
* [x] Jamnagar and Hazira historical baselines stored in PostgreSQL `facility_baselines`.
* [x] Live events reprocessed and verified in PostgreSQL database.
