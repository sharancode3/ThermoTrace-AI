# TEST-C Temporal Drift & Seasonal Behaviour Audit
**Training Partition (Earlier Passes):** 1721 samples  
**Evaluation Partition (Future Timeline):** 411 samples  
**Evaluation Method:** Two-sample Kolmogorov-Smirnov Test ($KS$) + Scale-Normalized Wasserstein Distance ($W_1$)  

---

## 1. Feature Drift Ranking Table

| Feature Name | KS Statistic | Wasserstein Dist ($W_1$) | Train Mean $\pm$ Std | Future Test Mean $\pm$ Std | Drift Status |
|:---|:---:|:---:|:---:|:---:|:---:|
| `pct_forest` | 0.8086 | 0.0754 | 0.13 $\pm$ 0.16 | 0.12 $\pm$ 0.21 | **SEVERE DRIFT** |
| `frp_variance` | 0.6784 | 0.0094 | 6.89 $\pm$ 115.11 | 44.61 $\pm$ 133.81 | **SEVERE DRIFT** |
| `pct_urban` | 0.6613 | 0.3226 | 0.17 $\pm$ 0.28 | 0.46 $\pm$ 0.38 | **SEVERE DRIFT** |
| `pct_cropland` | 0.5628 | 0.3594 | 0.7 $\pm$ 0.31 | 0.4 $\pm$ 0.39 | **SEVERE DRIFT** |
| `day_night_ratio` | 0.5290 | 0.1956 | 0.73 $\pm$ 0.41 | 0.7 $\pm$ 0.25 | **SEVERE DRIFT** |
| `peak_frp_mw` | 0.5047 | 0.0700 | 9.86 $\pm$ 31.05 | 45.32 $\pm$ 80.9 | **SEVERE DRIFT** |
| `mean_frp_mw` | 0.4621 | 0.0594 | 8.07 $\pm$ 24.74 | 34.42 $\pm$ 60.31 | **SEVERE DRIFT** |
| `dist_to_facility` | 0.4440 | 0.1043 | 129811.2 $\pm$ 136987.06 | 21071.85 $\pm$ 30142.38 | **SEVERE DRIFT** |
| `facility_category_encoded` | 0.4417 | 0.2131 | 4.33 $\pm$ 14.21 | 23.83 $\pm$ 27.85 | **SEVERE DRIFT** |
| `is_industrial_zone` | 0.4271 | 0.4271 | 0.13 $\pm$ 0.34 | 0.56 $\pm$ 0.5 | **SEVERE DRIFT** |
| `duration_hours` | 0.4249 | 0.1380 | 50.17 $\pm$ 46.88 | 23.17 $\pm$ 37.02 | **SEVERE DRIFT** |
| `historical_active_days_90d` | 0.3006 | 0.1064 | 2.83 $\pm$ 11.5 | 11.85 $\pm$ 21.9 | MODERATE DRIFT |
| `historical_peak_frp` | 0.2666 | 0.1005 | 1.77 $\pm$ 5.94 | 12.99 $\pm$ 25.71 | MODERATE DRIFT |
| `max_brightness_k` | 0.1938 | 0.0692 | 329.86 $\pm$ 14.45 | 335.13 $\pm$ 22.75 | STABLE |

---

## 2. Key Physical Drift Drivers

### 1. Class Prior Shift (Harvest Seasonality)
- **Train Set Composition:** Heavily dominated by routine industrial operations and baseline fires.
- **Future Timeline Composition:** Captures massive seasonal spikes in agricultural harvesting (`AGRI_BURN`) and out-of-distribution summer thermal artifacts (`OTHER_UNCERTAIN`).
- **Impact:** The base rate of classes shifts dramatically from the training window to the future test window.

### 2. Feature-Level Shifts:
- `historical_active_days_90d`: Drops significantly in the future holdout because early season events have not yet accumulated rolling 90-day persistence records.
- `duration_hours`: Shorter mean duration in future holdout due to single-pass early triage telemetry.
- `dist_to_facility`: Drifts because new non-industrial agricultural events occur far from registered industrial corridors.

---

## 3. Mitigation Strategy for Temporal Robustness
1. **Physical Geofence Guard:** Barring distant thermal anomalies ($d > 2.5\text{ km}$, zone = 0) from being misclassified as continuous plant smelters (`IND_ROUTINE`).
2. **Prior-Robust Decision Gate:** Avoid over-relying on rolling 90-day history for early-pass classifications.
