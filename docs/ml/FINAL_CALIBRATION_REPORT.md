# ThermoTrace AI — Final Calibration & Uncertainty Report
**Model:** `thermo_xgb_v1.1.0`  
**Calibration Architecture:** 5-Fold Cross-Validated Sigmoid Platt Scaling  
**Single Source-of-Truth:** Multi-Regime Prediction Parquet Files  

---

## 1. Principles of Honest Confidence
In sovereign defense operations and environmental disaster tracking, model overconfidence causes critical alarm fatigue.
ThermoTrace AI enforces honest probability calibration:
- Across held-out facilities (TEST-A), the model achieves an Expected Calibration Error (ECE) of **9.85%** (95% CI: [8.55%, 11.41%]) and Brier score of **0.0300**.
- Across held-out spatial regions (TEST-B), ECE is **13.54%** and Brier is **0.1725**.

---

## 2. Multi-Regime Calibration Breakdown
| Regime | Expected Calibration Error (ECE) | 95% Confidence Interval | Multi-Class Brier Score | 95% Confidence Interval |
|:---|:---:|:---:|:---:|:---:|
| **TEST-A: Held-Out Facilities** | **9.85%** | [8.55%, 11.41%] | **0.0300** | [0.0172, 0.0517] |
| **TEST-B: Held-Out Spatial Belts** | **13.54%** | [9.85%, 17.25%] | **0.1725** | [0.0989, 0.2485] |
| **TEST-C: Temporal Holdout** | **23.52%** | [19.64%, 27.66%] | **0.4978** | [0.4282, 0.5713] |
| **TEST-D: Hard Negatives** | **13.16%** | [10.67%, 18.13%] | **0.3088** | [0.2618, 0.3629] |
| **TEST-E: Adversarial OOD** | **47.90%** | [41.28%, 54.35%] | **1.0084** | [0.8794, 1.1277] |
