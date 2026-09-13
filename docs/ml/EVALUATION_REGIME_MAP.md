# ThermoTrace AI — Evaluation Regime Map & Sample Provenance Flow
**Document ID:** `TT-REGIME-MAP-2026`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26162 | NTRO / CPCB  
**Scope:** Complete architectural mapping of dataset decomposition, evaluation regimes, sample reuse, and mutual independence guarantees.  

---

## 1. High-Level Sample Flow Diagram

```mermaid
flowchart TD
    subgraph Master Corpus ["Master Audited Corpus (2,132 Events)"]
        direction TB
        T_A["Tier A: Weak / Heuristic Labels\n(1,706 samples - 80.0%)\nStrictly Quarantined to Training"]
        T_BC["Independent Ground Truth Pool\n(426 samples - 20.0%)\nNon-Circular & Verified"]
        T_BC --> T_B["Tier B: Hard Negatives (216 samples)"]
        T_BC --> T_C["Tier C: Hand-Verified Imagery (210 samples)"]
    end

    subgraph Training Reservoir
        TRAIN_RES["Training Reservoir\n(Up to 1,988 samples per regime)\nConsists of 1,706 Tier A + in-split Tier B/C"]
    end

    subgraph Evaluation Regimes ["5 Multi-Regime Evaluation Slices (from 426 Independent Pool)"]
        direction TB
        R_A["TEST-A: Facility Holdout (101 samples)\nSplit Axis: Facility UUID Geofence"]
        R_B["TEST-B: Spatial Holdout (117 samples)\nSplit Axis: Lat/Lon Geographic Blocks"]
        R_C["TEST-C: Temporal Holdout (411 samples)\nSplit Axis: Chronological Timestamp"]
        R_D["TEST-D: Hard Negatives (216 samples)\nSplit Axis: Curated Boundary Stress"]
        R_E["TEST-E: Adversarial OOD (208 samples)\nSplit Axis: Extreme Radiance / Missing Context"]
    end

    T_A --> TRAIN_RES
    T_BC --> Evaluation Regimes
```

---

## 2. Clarification on Regime Overlap & Sample Reuse

### Why do test set sizes sum to 1,053 when the independent pool has 426 samples?
The 5 regimes are **not 5 mutually exclusive partitions** of the dataset. Rather, they are **5 distinct multidimensional stress tests (stress-testing lenses)** applied to the **same master independent pool of 426 events** (210 Tier C Hand-Verified + 216 Tier B Hard-Negatives).

Each regime evaluates a specific hypothesis of generalisation failure:
1. **TEST-A (Plant Generalisation):** Tests whether the model memorised specific factory footprints by holding out entire plant UUIDs.
2. **TEST-B (Spatial Transferability):** Tests whether the model overfits to specific state corridors by holding out 2°×2° geographic bounding boxes.
3. **TEST-C (Temporal Robustness):** Tests whether the model handles seasonal and atmospheric drift by training strictly on the past and evaluating on the future.
4. **TEST-D (Boundary Stress):** Tests whether the model confuses non-industrial thermal anomalies (crop burning near fences, asphalt heaters) with true factories.
5. **TEST-E (Adversarial Robustness):** Tests whether the model safely abstains on corrupted, context-deprived, or out-of-distribution thermal signatures.

---

## 3. Pairwise Overlap Matrix Across Test Regimes

The exact intersection counts between the test sets of each regime:

| Regime | Test Size | TEST-A | TEST-B | TEST-C | TEST-D | TEST-E | Overlap Explanation |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **TEST-A (Facility Holdout)** | 101 | **101** | 22 | 100 | 49 | 53 | 49 samples are hard negatives at held-out plants; 100 occurred in recent satellite passes. |
| **TEST-B (Spatial Holdout)** | 117 | 22 | **117** | 103 | 57 | 61 | 22 samples are located in held-out facilities within the held-out spatial corridors. |
| **TEST-C (Temporal Holdout)** | 411 | 100 | 103 | **411** | 201 | 193 | Chronological split captures 96.5% of the independent pool that occurred in the future horizon. |
| **TEST-D (Hard Negatives)** | 216 | 49 | 57 | 201 | **216** | 96 | Curated edge cases; 201 occurred in the future monitoring horizon; 96 exhibit adversarial features. |
| **TEST-E (Adversarial OOD)** | 208 | 53 | 61 | 193 | 96 | **208** | High-entropy and extreme-radiance stress cases across all geography and time. |

---

## 4. Leakage & Independence Guarantees

1. **Zero Weak-Label Leakage:** All 1,706 Tier A weak-rule samples are **100% quarantined to the training reservoir**. Not a single Tier A sample is ever evaluated in TEST-A, TEST-B, TEST-C, TEST-D, or TEST-E.
2. **Zero In-Regime Leakage:** Within any individual regime $R$:
   $$\text{Train}_R \cap \text{Test}_R = \emptyset$$
   There is zero sample overlap between the training set and the test set within any evaluation regime.
3. **Plant Identity Isolation in TEST-A:** No facility UUID appearing in $\text{Test}_A$ appears in $\text{Train}_A$.
4. **Spatial Isolation in TEST-B:** No geographic bounding box appearing in $\text{Test}_B$ appears in $\text{Train}_B$.
5. **Temporal Isolation in TEST-C:** Every sample in $\text{Train}_C$ occurred strictly before the earliest sample in $\text{Test}_C$.

---

## 5. Summary Table for Scientific Reviewers

| Property | Value | Audit Status |
|:---|:---:|:---|
| **Total Corpus Size** | 2,132 events | Verified in `hardened_training_dataset.csv` |
| **Quarantined Weak Samples (Tier A)** | 1,706 events | Training only (0 in test benchmarks) |
| **Independent Ground Truth (Tier B + C)** | 426 events | 100% of all evaluation benchmarks |
| **Hand-Verified Historical Events (Tier C)** | 210 events | Verified against satellite imagery and CPCB records |
| **Curated Hard Negatives (Tier B)** | 216 events | Borderline agricultural & urban edge cases |
| **Evaluation Lenses** | 5 Regimes | Multi-dimensional evaluation across distinct stress axes |
| **Bootstrap Iterations** | $B = 1,000$ | Non-parametric resamples per regime |
| **Reported Metric Intervals** | Empirical 95% CI | $[CI_{2.5\%}, CI_{97.5\%}]$ |
