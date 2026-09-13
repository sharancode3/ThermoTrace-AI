# TEST-D Hard-Negative Failure Taxonomy & Mechanism Dissection
**Total Hard-Negative Benchmark Size:** 216 events  
**Total Failures Observed:** 68 events  
**Empirical Baseline Accuracy:** 68.52% (Macro F1: 0.3928, Weighted F1: 0.7999)  

---

## 1. Structural Failure Mode Breakdown

| Failure Category | Count | % of Errors | Root Cause Mechanism |
|:---|:---:|:---:|:---|
| **1. Urban Hot Surfaces / Dense Infrastructure** | 49 | 72.1% | Distant urban heat ($d > 5\text{ km}$, urban $> 80\%$) wrongly predicted as `IND_ROUTINE` due to absence of non-facility urban baseline. |
| **2. Agricultural Stubble Burns Adjacent to Plants** | 19 | 27.9% | `is_industrial_zone = 1` and plant proximity overwhelming $77\%$ cropland fraction and 0 historical active days. |
| **3. Other Uncertain / Boundary Absorptions** | 0 | 0.0% | Rare boundary anomalies where raw argmax failed to invoke calibrated abstention threshold. |

---

## 2. Failure Category 1: Misleading Urban Hot Surfaces (49 Events)
- **Physical Reality:** These events are commercial HVAC rejections, rooftop metal heating, and asphalt batching located $15\text{ to }45\text{ km}$ away from any registered industrial facility.
- **Why Current Model Failed:** Because `dist_to_facility` was large but `pct_urban` was high ($> 80\%$), and the model lacked training prior for distant urban thermal noise, it assigned the default built-environment label (`IND_ROUTINE`).
- **Required Mitigation:** Spatial Constraint Filter: An event with $\text{dist\_to\_facility} > 2,500\text{ m}$ and $\text{is\_industrial\_zone} = 0$ is physically barred from `IND_ROUTINE` and `IND_FLARE`.

---

## 3. Failure Category 2: Agricultural Burns Near Plants (19 Events)
- **Physical Reality:** Indian farmers burn crop stubble directly against refinery fences ($d < 2\text{ km}$).
- **Why Current Model Failed:** The model gave excessive weight to `is_industrial_zone = 1`, ignoring that the event has **zero 90-day active days**, **ephemeral duration ($< 3.5\text{ h}$)**, and sits in **$77\%$ cropland**.
- **Required Mitigation:** Temporal-Spatial Fusion: Stubble fires have $\text{active\_days} = 0$ and $\text{pct\_cropland} \ge 70\%$. Industrial routine operations require historical persistence (active days $> 5$).

---

## 4. Exemplar Audit Records

### AGRI_BURN_NEAR_FACILITY (Showing top 3 of 19)
- **Event `HARD-NEG-AGRI-003`**: True=`AGRI_BURN` -> Pred=`IND_ROUTINE` | Dist=1659.4m | Zone=1 | Crop=76.8% | Urban=10.0% | ActiveDays=0 | Dur=3.42h | Conf=79.3%
- **Event `HARD-NEG-AGRI-017`**: True=`AGRI_BURN` -> Pred=`IND_ROUTINE` | Dist=1645.1m | Zone=1 | Crop=78.0% | Urban=10.0% | ActiveDays=0 | Dur=2.59h | Conf=79.5%
- **Event `HARD-NEG-AGRI-018`**: True=`AGRI_BURN` -> Pred=`IND_ROUTINE` | Dist=2794.6m | Zone=1 | Crop=77.9% | Urban=10.0% | ActiveDays=0 | Dur=3.22h | Conf=57.7%

### MISLEADING_URBAN_HOT_SURFACE (Showing top 3 of 49)
- **Event `HARD-NEG-URBAN-001`**: True=`OTHER_UNCERTAIN` -> Pred=`IND_ROUTINE` | Dist=33804.5m | Zone=0 | Crop=5.0% | Urban=87.8% | ActiveDays=0 | Dur=4.32h | Conf=38.9%
- **Event `HARD-NEG-URBAN-003`**: True=`OTHER_UNCERTAIN` -> Pred=`IND_ROUTINE` | Dist=19665.7m | Zone=0 | Crop=5.0% | Urban=86.9% | ActiveDays=1 | Dur=7.2h | Conf=42.0%
- **Event `HARD-NEG-URBAN-004`**: True=`OTHER_UNCERTAIN` -> Pred=`IND_ROUTINE` | Dist=44642.6m | Zone=0 | Crop=5.0% | Urban=86.0% | ActiveDays=0 | Dur=1.49h | Conf=41.2%

### WILDFIRE_NEAR_MINING (Showing top 3 of 0)

### OTHER_UNCERTAIN_ABSORPTION (Showing top 3 of 0)
