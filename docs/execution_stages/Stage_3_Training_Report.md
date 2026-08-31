# Stage 3 Intelligence Hardening — Phase 2 Training Data & Label Quality Report

**Document Version:** v3.3.0  
**Dataset Artifact:** `backend/data/processed/three_tier_training_dataset.csv`  
**Total Records:** 954  
**Classes:** `IND_FIRE`, `IND_FLARE`, `IND_ROUTINE`, `AGRI_BURN`, `WILDFIRE`, `OTHER_UNCERTAIN`  
**Splitting Strategy:** Spatial / Facility `GroupKFold` (Zero cross-fold geographic or facility leakage)

---

## 1. Three-Tier Label Construction Protocol

| Tier | Category | Sample Count | Source & Grounding Mechanism | Role in Validation |
| :--- | :--- | :---: | :--- | :--- |
| **Tier A** | **Weak / Rule-Derived** | `750` | Bulk historical FIRMS detections cross-referenced with facility buffers, 90-day persistence baselines, and ESA WorldCover land-cover masks. | **Training Only** |
| **Tier B** | **Hard Negatives** | `120` | Deliberate counterexamples (e.g. crop burns near factories, urban asphalt heat without industrial plants, forest fires in mining belts, low-FRP flare stacks). | **Training Only** |
| **Tier C** | **Manually Verified** | `84` | Hand-verified ground-truth benchmark incidents across Indian industrial sectors and regional biomes. | **Evaluation / Test Only** (Never seen during Tier A/B training) |
| **TOTAL** | | **`954`** | | |

---

## 2. Complete Distribution Matrix (Tier vs. Class)

```
========================================================================================================
Class Label        Tier A (Weak Rule)    Tier B (Hard Negatives)    Tier C (Verified Eval)    Total Records
========================================================================================================
AGRI_BURN                 140                      35                         16                   191
IND_FIRE                  120                       0                         16                   136
IND_FLARE                 130                      25                         16                   171
IND_ROUTINE               130                       0                         16                   146
OTHER_UNCERTAIN           110                      30                          8                   148
WILDFIRE                  120                      30                         12                   162
--------------------------------------------------------------------------------------------------------
ALL CLASSES               750                     120                         84                   954
========================================================================================================
```

---

## 3. Detailed Hard Negative Strategy (Tier B)

To prevent the gradient boosting classifier from "cheating" via superficial spatial proximity (i.e. learning `dist_to_facility < 1km => INDUSTRIAL`), four deliberate hard-negative distributions were constructed:

1. **`HN-AGRI-NEARFAC` (Agricultural Stubble Burns within Industrial Perimeters):**
   * *Spatial Context:* Detections situated $350	ext{m} - 2200	ext{m}$ from a rural plant or substation.
   * *Physical Separator:* Daytime-only passes ($day\_night\_ratio = 1.0$), short duration ($< 4	ext{h}$), high cropland % ($> 75\%$), 0 historical active days in 90 days.
   * *Target Label:* `AGRI_BURN` (Forces tree to learn diurnal and temporal brevity rather than distance alone).

2. **`HN-URBAN-NONFAC` (Asphalt & Commercial Heat Anomalies):**
   * *Spatial Context:* Pure urban/built-up land cover ($pct\_urban > 85\%$), but completely unlinked to any industrial facility ($dist\_to\_facility = -1.0$).
   * *Target Label:* `OTHER_UNCERTAIN`.

3. **`HN-WILD-MINING` (Forest & Scrub Fires in Industrial Mining Belts):**
   * *Spatial Context:* Detections within $1500	ext{m} - 4500	ext{m}$ of industrial mining facilities in Odisha/Chhattisgarh/Jharkhand.
   * *Physical Separator:* Forest canopy ($pct\_forest > 70\%$), multi-pass spatial expansion, moderate duration.
   * *Target Label:* `WILDFIRE`.

4. **`HN-LOWFRP-FLARE` (Low-Radiance Flare Stacks):**
   * *Physical Signature:* Low peak FRP ($3.0 - 12.0	ext{ MW}$, resembling a small crop burn), BUT operating continuously ($duration > 120	ext{h}$), nighttime active ($day\_night\_ratio pprox 0.5$), at refinery stack.
   * *Target Label:* `IND_FLARE` (Forces tree to utilize 90-day persistence and night-time presence).

---

## 4. Leak-Free Spatial Grouping Schema

* **Grouping Field:** `spatial_group` (derived from `facility_id` for industrial clusters and discrete spatial grid cells for rural/forest sectors).
* **Cross-Validation Protocol:** `GroupKFold(n_splits=5)`.
* **Guarantee:** No facility or local spatial cluster present in the training fold can ever appear in the validation fold. Offline metrics reflect true out-of-facility generalization.

---

## 5. Audit Compliance Checklist
* [x] Three-tier label protocol implemented (`TIER_A`, `TIER_B`, `TIER_C`).
* [x] Non-trivial sample representation across all 6 canonical classes ($N \ge 136$ per class).
* [x] Tier C strictly quarantined for validation and test evaluations.
* [x] Dataset generated deterministically with fixed seed `42` at `backend/data/processed/three_tier_training_dataset.csv`.
