# ThermoTrace AI — Final Scientific Error Analysis & Failure Audit
**Model:** `thermo_xgb_v1.1.0`  
**Focus:** Boundary Confusion, Hard Negatives, and Out-of-Distribution Vulnerabilities  

---

## 1. Primary Boundary Confusion Mechanisms
Through evaluating the 216 hard-negative edge cases in TEST-D, two distinct operational confusion modes were identified:

1. **Agricultural Stubble Fires in Industrial Corridors:**
   - *Phenomenon:* In states like Gujarat and Punjab, farmers burn crop residues right up to the perimeter fence of petrochemical refineries and power stations ($d < 500\text{ m}$).
   - *Model Challenge:* Proximity feature `dist_to_facility` strongly indicates industrial activity, but land cover `pct_cropland` and transient duration ($< 3\text{ h}$) contradict this.
   - *Resolution:* Contextual fusion weighs short duration ($< 3\text{ h}$) and high cropland ($> 0.80$) to correctly reject the industrial hypothesis.

2. **Asphalt Batching & Road Construction Heat:**
   - *Phenomenon:* Highway asphalt heaters generate intense localized thermal radiances ($FRP \approx 10-25\text{ MW}$) in non-agricultural, urban fringe areas.
   - *Model Behavior:* Without registered facility matches ($d > 5000\text{ m}$) and with zero cropland/forest Canopy, confidence drops below $0.50$ with elevated entropy ($H > 1.35$).
   - *Resolution:* Automated abstention triggers and routes the event to `OTHER_UNCERTAIN`.

---

## 2. Adversarial Stress & Context Deprivation
Evaluated in TEST-E:
- **Solar Glint & Thar Desert Heating:** Low FRP, zero variance, 0% cropland/forest/urban $\rightarrow$ Correctly classified as `OTHER_UNCERTAIN` ($96.5\%$ confidence).
- **Steel Slag Yard Cooling:** Unassociated hot metal yard $\rightarrow$ High entropy triggers automated abstention.
- **Missing Land Cover Raster:** Graceful degradation into `OTHER_UNCERTAIN` rather than false industrial alarm.
