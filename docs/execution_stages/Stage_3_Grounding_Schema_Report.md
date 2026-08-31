# Stage 3 Intelligence Hardening — Phase 13 Grounding Schema Extension Report

**Document Version:** v3.3.0  
**Design Standard:** Strict OBSERVED / DERIVED / MODELLED / UNKNOWN Grounding Partition with Zero-Hallucination Guarantees.

---

## 1. Grounding Partition Matrix

| Schema Layer | Grounded Data Source | Permitted Content | Strict Prohibition |
| :--- | :--- | :--- | :--- |
| **OBSERVED** | Raw NASA FIRMS Telemetry | Observation pass count, raw Peak FRP (MW), Mean FRP (MW), Brightness Temp (K), Detection Timestamps (UTC). | Never round or alter observed sensor values. |
| **DERIVED** | Mathematical & Spatial Pipelines | Calibrated Z-Score ($N \ge 10$), Heat-Aware Buffer Radius (km), ESA WorldCover 10m Land-Cover Percentages, Distance to Facility (m). | Never compute Z-scores on insufficient history ($N < 10$). |
| **MODELLED** | Calibrated ML & TreeSHAP | Calibrated XGBoost multi:softprob prediction, Calibrated Probability (%), Evidence Strength Tag, TreeSHAP top feature attributions. | Never invent new facts or outside circumstances. |
| **UNKNOWN** | Systematic Uncertainty Engine | Explicitly states: Non-simultaneous optical scene time offset (e.g. 48h prior), Baseline sample size gaps ($N < 10$), Sparse pass counts ($N < 3$), Unassociated facility status. | Never conceal uncertainty or lack of baseline data. |

---

## 2. Example Grounded Intelligence Output (Real Stored Event)

```json
{
  "headline": "BASELINE_INSUFFICIENT THERMAL SIGNATURE: INDUSTRIAL GAS FLARING NEAR RELIANCE JAMNAGAR PETROCHEM COMPLEX",
  "what_happened": "OBSERVED: Satellite radiometry recorded 3 pass(es) with peak radiant power of 78.0 MW (mean 62.4 MW) and brightness temp 342.1 K. Thermal trend: STABLE.",
  "why_it_matters": "DERIVED: Located 142m from Reliance Jamnagar Petrochem Complex. Historical baseline is statistically insufficient (3 of 10 required observations); anomaly tier and Z-score are withheld. ESA WorldCover analysis within 2.28km buffer confirms Industrial / Built-up Infrastructure (75% urban, 15% cropland, 10% forest).",
  "model_assessment": "MODELLED: Calibrated XGBoost classification: Industrial Gas Flaring (68.4% calibrated probability, Evidence: MODERATE). Key TreeSHAP decision drivers: frp_variance: +1.71, peak_frp_mw: -0.76.",
  "uncertainty_and_gaps": "UNKNOWN: Optical Sentinel-2 reference scene was acquired 48.0h prior to detection (surface land-cover baseline; does not capture active combustion state). Site historical sample size (3/10) is below empirical sufficiency threshold for statistical Z-score computation."
}
```

---

## 3. Automated Test Verification

* **`tests/test_grounding_schema.py`**:
  * `test_grounding_schema_partition_and_uncertainty`: Verified strict 4-way separation and explicit uncertainty disclosures.
* **Full Core Suite**: 21 of 21 tests passing in `pytest`.
