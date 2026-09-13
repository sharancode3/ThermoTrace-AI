# Detailed Error Analysis: TEST_C_TEMPORAL_HOLDOUT
**Test Samples:** 411 | **Error Count:** 130 | **Accuracy:** 68.37%

---

## 1. Per-Class Performance Matrix
| Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
| `AGRI_BURN` | 0.8772 | 0.8824 | 0.8798 | 170 |
| `IND_FIRE` | 1.0000 | 1.0000 | 1.0000 | 25 |
| `IND_FLARE` | 0.7759 | 1.0000 | 0.8738 | 45 |
| `IND_ROUTINE` | 0.3333 | 1.0000 | 0.5000 | 40 |
| `OTHER_UNCERTAIN` | 0.0588 | 0.0099 | 0.0169 | 101 |
| `WILDFIRE` | 1.0000 | 0.6667 | 0.8000 | 30 |

**Macro Average:** Precision: 0.6742 | Recall: 0.7598 | F1: 0.6784  
**Weighted Average:** Precision: 0.6285 | Recall: 0.6837 | F1: 0.6316  

---

## 2. Confusion Matrix
```text
Rows = True Label | Columns = Predicted Label
Labels: ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']
True \ Pred         AGRI_BURN   IND_FIRE  IND_FLARE IND_ROUTIN OTHER_UNCE   WILDFIRE
------------------------------------------------------------------------------------
AGRI_BURN                 150          0          4          0         16          0
IND_FIRE                    0         25          0          0          0          0
IND_FLARE                   0          0         45          0          0          0
IND_ROUTINE                 0          0          0         40          0          0
OTHER_UNCERTAIN            20          0          0         80          1          0
WILDFIRE                    1          0          9          0          0         20
```

---

## 3. Major Confusion Pairs (Ranked by Frequency)
| True Label $\rightarrow$ Predicted Label | Error Count | Share of All Errors |
|:---|:---:|:---:|
| `OTHER_UNCERTAIN -> IND_ROUTINE` | 80 | 61.5% |
| `OTHER_UNCERTAIN -> AGRI_BURN` | 20 | 15.4% |
| `AGRI_BURN -> OTHER_UNCERTAIN` | 16 | 12.3% |
| `WILDFIRE -> IND_FLARE` | 9 | 6.9% |
| `AGRI_BURN -> IND_FLARE` | 4 | 3.1% |
| `WILDFIRE -> AGRI_BURN` | 1 | 0.8% |

---

## 4. Root Cause Dissection & Exemplar Failures

### Event `HARD-NEG-AGRI-023`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_FLARE` (Confidence: 52.6%, Entropy: 1.10)
- **Spatial Context:** `dist_to_facility` = 1732.5 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 80.6% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 12.1 MW | Duration = 3.1 h | Active Days = 0

### Event `HARD-NEG-AGRI-025`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_FLARE` (Confidence: 49.1%, Entropy: 1.14)
- **Spatial Context:** `dist_to_facility` = 1855.4 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 84.0% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 15.5 MW | Duration = 1.4 h | Active Days = 0

### Event `HARD-NEG-AGRI-050`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_FLARE` (Confidence: 50.0%, Entropy: 1.12)
- **Spatial Context:** `dist_to_facility` = 1845.9 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 76.2% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 24.8 MW | Duration = 0.8 h | Active Days = 0

### Event `HARD-NEG-AGRI-116`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_FLARE` (Confidence: 45.4%, Entropy: 1.16)
- **Spatial Context:** `dist_to_facility` = 2431.4 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 84.9% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 22.5 MW | Duration = 0.7 h | Active Days = 0

### Event `HARD-NEG-URBAN-001`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 80.9%, Entropy: 0.66)
- **Spatial Context:** `dist_to_facility` = 33804.5 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 87.8%
- **Telemetry:** Peak FRP = 3.7 MW | Duration = 4.3 h | Active Days = 0

### Event `HARD-NEG-URBAN-002`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 89.1%, Entropy: 0.48)
- **Spatial Context:** `dist_to_facility` = 31848.2 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 81.0%
- **Telemetry:** Peak FRP = 6.4 MW | Duration = 7.2 h | Active Days = 1

### Event `HARD-NEG-URBAN-003`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 84.3%, Entropy: 0.59)
- **Spatial Context:** `dist_to_facility` = 19665.7 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 86.9%
- **Telemetry:** Peak FRP = 5.5 MW | Duration = 7.2 h | Active Days = 1

### Event `HARD-NEG-URBAN-004`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 88.6%, Entropy: 0.48)
- **Spatial Context:** `dist_to_facility` = 44642.6 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 86.0%
- **Telemetry:** Peak FRP = 1.5 MW | Duration = 1.5 h | Active Days = 0

### Event `HARD-NEG-URBAN-005`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 88.1%, Entropy: 0.51)
- **Spatial Context:** `dist_to_facility` = 25755.4 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 80.1%
- **Telemetry:** Peak FRP = 6.2 MW | Duration = 3.9 h | Active Days = 0

### Event `HARD-NEG-URBAN-006`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 81.2%, Entropy: 0.66)
- **Spatial Context:** `dist_to_facility` = 25290.5 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 85.8%
- **Telemetry:** Peak FRP = 3.7 MW | Duration = 2.9 h | Active Days = 0
