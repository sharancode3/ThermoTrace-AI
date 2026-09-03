# ThermoTrace AI — Final Data & Label Provenance Report
**Document ID:** `TT-PROV-2026-FINAL`  
**Audited Corpus:** `backend/data/processed/hardened_training_dataset.csv` (2,132 records)  

---

## 1. Provenance Classification Schema
Every sample in the ThermoTrace AI repository has been strictly audited and classified into one of three tiers:
- **Tier A (Rule-Derived / Weak Label):** 1,706 samples (80.0%). Generated using heuristic radiance and spatial cutoffs. **100% QUARANTINED TO TRAINING ONLY.** Strictly barred from evaluation benchmarks.
- **Tier B (Hard Negative):** 216 samples (10.1%). Curated boundary edge cases (adjacent crop fires, commercial asphalt heat, non-industrial thermal signatures).
- **Tier C (Hand-Verified Historical Ground Truth):** 210 samples (9.8%). Geographically matched against verified satellite imagery, CPCB emission records, and confirmed plant incidents.

---

## 2. Benchmark Independence & Zero-Leakage Guarantee
- **Total Independent Non-Circular Pool:** 426 samples (Tier B + Tier C).
- **Facility Independence:** Held-out facilities in TEST-A have zero representation in training.
- **Spatial Independence:** Held-out quadrants in TEST-B have zero representation in training.
- **Temporal Independence:** TEST-C strictly evaluates on subsequent chronological timeframes.
