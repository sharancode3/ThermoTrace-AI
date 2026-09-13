# ThermoTrace AI — Official Production Model Card
**Model Identifier:** `thermo_xgb_v1.1.0`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26162 (PS 162)  
**Evaluating Authorities:** National Technical Research Organisation (NTRO) / Central Pollution Control Board (CPCB)  
**Architecture:** Calibrated Gradient Boosted Decision Trees (`CalibratedClassifierCV(Float64XGBClassifier, method='sigmoid', cv=5)`)  
**Status:** FROZEN DEFENSE-GRADE BENCHMARK (78/78 Passing Backend Regression Tests)  

---

## 1. Model Summary & Mission Scope
ThermoTrace AI delivers sovereign real-time satellite thermal anomaly intelligence across Indian sovereign territory.
- **Primary Task:** Automated multi-class combustion classification into 6 canonical categories:
  - `IND_ROUTINE`: Continuous steady-state industrial furnace/smelter operation
  - `IND_FLARE`: Refinery or chemical plant elevated flaring
  - `IND_FIRE`: Catastrophic uncontained industrial blaze or disaster
  - `AGRI_BURN`: Seasonal agricultural stubble/crop residue burning
  - `WILDFIRE`: Forest canopy or grassland brush fire
  - `OTHER_UNCERTAIN`: High-entropy, out-of-distribution, or low-confidence thermal anomaly
- **Secondary Task:** Operational facility anomaly grading decoupled from classification ($Z$-score & Robust MAD vs historical 90-day facility baseline). `IND_FIRE` $\ne$ `CRITICAL`.
- **Explainability:** Native C++ instance-level TreeSHAP attributions per event.

---

## 2. Model Specifications
- **Base Estimator:** Float64XGBClassifier (Double Precision Cython core)
- **Estimator Count:** 120 trees | **Max Depth:** 4 | **Learning Rate:** 0.08
- **Objective:** `multi:softprob` | **Subsample Ratio:** 0.85 | **Colsample By Tree:** 0.85
- **Probability Calibration:** 5-Fold Cross-Validated Sigmoid Platt Scaling
- **Inference Latency:** 7.14 ms per single event (Median over 100 benchmark runs)
- **Model Artifact Size:** 3.48 MB (`thermo_xgb_v1.1.0.joblib`, SHA-256: `75b346698c656152...`)
- **Git Commit Baseline:** `3af6a1c1de7d98f577488d2a2ad224384ac1a7ae`

---

## 3. Canonical 14-Dimensional Multimodal Feature Contract
| Dim | Feature Name | Physical Interpretation | Value Range | Missing / Edge Fallback |
|:---:|:---|:---|:---:|:---|
| 0 | `dist_to_facility` | Distance to registered industrial plant centroid/polygon | $[0, 99999]$ m | $99999.0$ m (Unassociated) |
| 1 | `facility_category_encoded` | Industrial sector ID (1=Refinery, 2=Power, 3=Smelter, 4=Steel) | $[0, 100]$ | $0$ (Unregistered) |
| 2 | `peak_frp_mw` | Maximum Fire Radiative Power across ST-DBSCAN cluster | $[0.1, 2000+]$ MW | Event max observation |
| 3 | `mean_frp_mw` | Mean cluster radiative power output | $[0.1, 1500+]$ MW | Cluster average |
| 4 | `frp_variance` | Temporal variance of radiant power across multi-pass telemetry | $[0.0, 5000+]$ MW$^2$ | $0.0$ (Single pass) |
| 5 | `max_brightness_k` | Maximum 4um infrared brightness temperature | $[290, 520]$ K | Maximum brightness |
| 6 | `duration_hours` | Elapsed span between earliest and latest satellite pass | $[0.0, 2500+]$ h | $0.0$ (Single pass) |
| 7 | `day_night_ratio` | Proportion of daytime satellite observations ($T_{day} / T_{total}$) | $[0.0, 1.0]$ | $0.5$ (Balanced/Unknown) |
| 8 | `historical_active_days_90d` | Historical recurrence within 2.5 km over trailing 90 days | $[0, 90]$ days | $0$ days |
| 9 | `historical_peak_frp` | Historical peak radiant output observed at location | $[0.0, 500+]$ MW | $0.0$ MW |
| 10 | `pct_cropland` | Fractional overlap with agricultural cropland terrain | $[0.0, 1.0]$ | $0.0$ |
| 11 | `pct_forest` | Fractional overlap with forest and reserve canopy | $[0.0, 1.0]$ | $0.0$ |
| 12 | `pct_urban` | Fractional overlap with built-up and urban infrastructure | $[0.0, 1.0]$ | $0.0$ |
| 13 | `is_industrial_zone` | National industrial corridor or facility buffer geofence flag | $0$ or $1$ | $0$ |

---

## 4. Development Benchmark Results (DEV-BENCHMARK, with 95% Bootstrap CI)
Evaluated across 5 development stress regimes with $B = 1,000$ non-parametric bootstrap iterations:

| Evaluation Regime | Test Size | Focus & Rigor | Macro F1 [95% CI] | Weighted F1 [95% CI] | Brier Score [95% CI] | ECE % [95% CI] |
|:---|:---:|:---|:---:|:---:|:---:|:---:|
| **DEV-TEST-A: Held-Out Facilities** | 101 | Zero plant identity overlap | **0.9851** [0.9407, 1.0000] | **0.9898** [0.9668, 1.0000] | 0.0300 [0.0172, 0.0517] | 9.85% [8.55%, 11.41%] |
| **DEV-TEST-B: Held-Out Spatial Belts** | 117 | Geographically blocked regions | **1.0000** [1.0000, 1.0000] | **1.0000** [1.0000, 1.0000] | 0.1725 [0.0989, 0.2485] | 13.54% [9.85%, 17.25%] |
| **DEV-TEST-C: Future-Time Chronological** | 411 | Zero future leakage; temporal drift | **0.9039** [0.8719, 0.9297] | **0.8765** [0.8417, 0.9048] | 0.4978 [0.4282, 0.5713] | 23.52% [19.64%, 27.66%] |
| **DEV-TEST-D: Hard Negatives Benchmark** | 216 | High-confusion boundary stress | **0.9860** [0.9673, 1.0000] | **0.9861** [0.9677, 1.0000] | 0.3088 [0.2618, 0.3629] | 13.16% [10.67%, 18.13%] |
| **DEV-TEST-E: Adversarial & OOD** | 208 | Glint, slag, missing context | **0.8672** [0.8182, 0.9078] | **0.8571** [0.8101, 0.9006] | 1.0084 [0.8794, 1.1277] | 47.90% [41.28%, 54.35%] |

---

## 5. Untouched Independent Gold Benchmark (GOLD-TEST)
Evaluated in a single frozen run on $N = 300$ real Indian satellite telemetry events and held-out verified cases that were **never inspected or used during rule derivation**:

| Benchmark Metric | Point Estimate | 95% Bootstrap Confidence Interval | Operational Significance |
|:---|:---:|:---:|:---|
| **Macro F1** | **0.6470** | [0.5996, 0.6877] | Truly independent generalization on unseen Indian satellite telemetry |
| **Weighted F1** | **0.5947** | [0.5305, 0.6538] | Real-world class frequency-weighted F1 |
| **Macro Precision** | **0.8148** | — | 81.5% precision across all classes |
| **Macro Recall** | **0.6828** | — | 68.3% recall across all classes |
| **Brier Score** | **0.5669** | [0.4836, 0.6559] | Multi-class calibrated probability loss |
| **Expected Calibration Error** | **20.98%** | [16.16%, 26.44%] | Calibration error under full distribution shift |
| **Selective Accuracy** | **69.95%** | — | Accuracy on accepted predictions ($67.7\%$ coverage) |
| **Automated Abstention Rate**| **32.33%** | — | Percentage of events routed safely to `OTHER_UNCERTAIN` |

---

## 6. Automated Abstention & Hybrid Safety Protocol
When input evidence is weak, contradictory, or out-of-distribution:
- **Confidence Cutoff:** Calibrated $P_{max} < 0.50$
- **Entropy Cutoff:** Shannon Entropy $H(P) > 1.35$ nats
- **Spatial Integrity Gate:** Thermal events $> 2,500\text{ m}$ from registered industrial plants in non-industrial zones cannot be classified as `IND_ROUTINE` or `IND_FLARE`.
- **Perimeter Agricultural Gate:** Short ephemeral fires ($\le 6\text{h}$) with zero historical persistence in dense cropland ($\ge 70\%$) are attributed to `AGRI_BURN`.
- **Action:** Automated abstention to `OTHER_UNCERTAIN` for human analyst triage. Forcing an ungrounded industrial attribution is prohibited.

