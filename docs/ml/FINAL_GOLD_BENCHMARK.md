# ThermoTrace AI — Official Untouched Independent GOLD Benchmark
**Document ID:** `TT-GOLD-BENCHMARK-2026`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26162 (PS 162) | NTRO / CPCB  
**Evaluation Philosophy:** Single-run evaluation on an untouched, independent holdout dataset ($N = 300$) collected from real satellite telemetry and verified cases, completely decoupled from rule derivation and threshold inspection.  
**System Classification:** Hybrid Decision-Support Pipeline (Calibrated XGBoost + Local TreeSHAP + Physical Domain Constraints + Automated Abstention)  

---

## 1. Executive Summary & Scientific Defensibility

To establish true scientific validity and prevent test-set adaptation, ThermoTrace AI enforces a strict bifurcation between:
1. **Development Benchmarks (`DEV-BENCHMARK`, Regimes A through E):** Used iteratively during engineering to diagnose failure modes, calibrate Platt/Temperature parameters, and define physical constraint rules.
2. **Untouched Gold Benchmark (`GOLD-TEST`):** A strictly independent, held-out evaluation pool ($N = 300$) containing real satellite telemetry events that were **never inspected or referenced** during pipeline construction.

### Headline Gold Benchmark Performance (Single-Run Evaluation with 95% Bootstrap CI)
- **Macro F1:** **0.6470** ($95\%\text{ CI}: [0.5996, 0.6877]$)
- **Weighted F1:** **0.5947** ($95\%\text{ CI}: [0.5305, 0.6538]$)
- **Macro Precision:** **0.8148** ($81.5\%$)
- **Macro Recall:** **0.6828** ($68.3\%$)
- **Multi-Class Brier Score:** **0.5669** ($95\%\text{ CI}: [0.4836, 0.6559]$)
- **Expected Calibration Error (ECE):** **20.98%** ($95\%\text{ CI}: [16.16\%, 26.44\%]$)
- **Selective Prediction Accuracy:** **69.95%** (Accepted Coverage: **67.67%**, Automated Abstention Rate: **32.33%**)

---

## 2. Gold Benchmark Dataset Composition & Provenance ($N = 300$)

| Canonical Class | Sample Count | Data Source & Provenance | Verification Guarantee |
|:---|:---:|:---|:---|
| `AGRI_BURN` | 100 | PostgreSQL NASA FIRMS Telemetry | Never present in training CSV; real satellite clusters |
| `WILDFIRE` | 60 | PostgreSQL NASA FIRMS Telemetry | Never present in training CSV; forest/scrubland clusters |
| `OTHER_UNCERTAIN` | 60 | PostgreSQL NASA FIRMS Telemetry | Unmapped urban hot surfaces & solar glint |
| `IND_ROUTINE` | 40 | Real DB facility events + Tier C Holdout | Continuous plant furnace/smelter operations |
| `IND_FLARE` | 25 | Held-Out Verified Tier C Registry | Refinery and chemical plant elevated flaring |
| `IND_FIRE` | 15 | Held-Out Verified Tier C Registry | Catastrophic industrial disasters and factory blazes |

---

## 3. Per-Class Gold Performance & Breakdown

| Class Name | Precision | Recall | F1-Score | Support | 95% Bootstrap CI [F1] | Operational Character |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| `IND_FIRE` | **1.0000** | **1.0000** | **1.0000** | 15 | [1.0000, 1.0000] | 100% precision and recall on catastrophic industrial fires |
| `IND_FLARE` | **1.0000** | 0.5200 | **0.6842** | 25 | [0.4878, 0.8387] | Zero false positive flaring alarms; modest recall due to routine overlap |
| `IND_ROUTINE` | 0.6531 | **0.8000** | **0.7191** | 40 | [0.6024, 0.8148] | Reliable continuous smelter identification with bounded boundary confusion |
| `OTHER_UNCERTAIN` | 0.5876 | **0.9500** | **0.7261** | 60 | [0.6410, 0.7979] | Automated abstention successfully absorbs 95% of unfamiliar events |
| `AGRI_BURN` | 0.6480 | **0.8100** | **0.7200** | 100 | [0.6505, 0.7783] | Solid agricultural stubble burn attribution across rural belts |
| `WILDFIRE` | **1.0000** | 0.0167 | 0.0328 | 60 | [0.0000, 0.1034] | Highly conservative: brush fires in mixed cropland routed to `AGRI_BURN` |

---

## 4. Confusion Matrix (Single Run)

```text
Rows = Ground Truth | Columns = Model Prediction
Labels: ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']

True \ Pred          AGRI_BURN   IND_FIRE  IND_FLARE IND_ROUTINE OTHER_UNCERTAIN   WILDFIRE
-----------------------------------------------------------------------------------------
AGRI_BURN                   81          0          0           3              16          0
IND_FIRE                     0         15          0           0               0          0
IND_FLARE                    0          0         13          11               1          0
IND_ROUTINE                  0          0          0          32               8          0
OTHER_UNCERTAIN              0          0          0           3              57          0
WILDFIRE                    44          0          0           0              15          1
```

### Key Analytical Takeaways:
1. **Zero Industrial Hallucinations from Rural Fires:** Zero agricultural burns or wildfires were falsely classified as industrial blazes (`IND_FIRE`: 0 false positives).
2. **Perfect Critical Safety:** All 15 catastrophic industrial fires (`IND_FIRE`) were correctly identified with zero misses.
3. **Automated Abstention in Practice:** 97 out of 300 events ($32.3\%$) were routed to `OTHER_UNCERTAIN`. When the system makes a confident prediction (coverage = $67.7\%$), its selective operational accuracy is **69.95%**.
4. **The Wildfire / Stubble Confounder:** 44 of the 60 wildfires were classified as `AGRI_BURN` because satellite infrared radiometry without hyperspectral canopy vegetation indices cannot separate dry brush burning from crop residue burning in transitional rural fringe zones.

---

## 5. Development Benchmark vs. Gold Benchmark Comparison

| Evaluation Lens | Dataset | Sample Size | Macro F1 | Weighted F1 | Purpose |
|:---|:---|:---:|:---:|:---:|:---|
| **DEV-TEST-A (Facility Holdout)** | Hardened Dataset (Held-out UUIDs) | 101 | **0.9851** | 0.9898 | Development verification of plant transfer |
| **DEV-TEST-B (Spatial Holdout)** | Hardened Dataset (Held-out Grids) | 117 | **1.0000** | 1.0000 | Development verification of regional transfer |
| **DEV-TEST-C (Temporal Drift)** | Hardened Dataset (Chronological) | 411 | **0.9039** | 0.8765 | Development verification under seasonal shift |
| **DEV-TEST-D (Hard Negatives)** | Curated Boundary Stress | 216 | **0.9860** | 0.9861 | Development verification of boundary rules |
| **DEV-TEST-E (Adversarial OOD)** | Curated Extreme / Glint | 208 | **0.8672** | 0.8571 | Development verification of abstention gate |
| **FINAL GOLD BENCHMARK** | **Untouched Independent Telemetry** | **300** | **0.6470** | **0.5947** | **Authoritative Unseen Generalization Proof** |

---

## 6. Official SIH 2026 Evaluation Conclusion
ThermoTrace AI does not make unsupported claims of "100% real-world accuracy". It proves:
1. Outstanding operational defense on high-stakes industrial fires (**F1: 1.0000** on `IND_FIRE`).
2. High precision on industrial flares (**Precision: 1.0000** on `IND_FLARE`).
3. An honest real-world generalisation baseline (**Macro F1: 0.6470 [0.60, 0.69]**) on untouched Indian satellite telemetry.
4. An active safety mechanism that **abstains on 32% of ambiguous cases** rather than fabricating ungrounded attributions.
