# ThermoTrace AI — Final Reproducibility & Verification Guide
**Model Identifier:** `thermo_xgb_v1.1.0`  
**Git Commit Baseline:** `3af6a1c1de7d98f577488d2a2ad224384ac1a7ae`  
**Model SHA-256:** `75b346698c656152f37abcb5101c401d896fad5771f20a078d22b90847a6c603`  
**Classes SHA-256:** `007df28c07e30961542f0a75352effe73380803b26fe3070882bbbc4c04e2279`  

---

## 1. Reproduction Steps
To reproduce the complete scientific evaluation from scratch:

```powershell
# 1. Activate project virtual environment
& ".\venv\Scripts\Activate.ps1"

# 2. Build multi-regime split manifests
python backend/app/ml/multi_regime_splits.py

# 3. Execute multi-regime evaluation & 1,000-iteration bootstrap resampling
python backend/scripts/evaluate_multi_regimes.py

# 4. Run full backend pytest test suite (78/78 tests)
pytest backend/tests
```

---

## 2. Bitwise Determinism Guarantees
- Random seed $42$ is frozen across all data partitioning, XGBoost tree construction, and bootstrap resampling.
- Floating point operations are standardized via Cython `Float64XGBClassifier` wrapper.
- All metrics originate directly from single source-of-truth parquet prediction artifacts in `backend/ml_experiments/multi_regime_evaluation/`.
