# Detailed Error Analysis: TEST_D_HARD_NEGATIVES
**Test Samples:** 216 | **Error Count:** 68 | **Accuracy:** 68.52%

---

## 1. Per-Class Performance Matrix
| Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
| `AGRI_BURN` | 1.0000 | 0.8417 | 0.9140 | 120 |
| `IND_FIRE` | 0.0000 | 0.0000 | 0.0000 | 0 |
| `IND_FLARE` | 0.0000 | 0.0000 | 0.0000 | 0 |
| `IND_ROUTINE` | 0.0000 | 0.0000 | 0.0000 | 0 |
| `OTHER_UNCERTAIN` | 1.0000 | 0.4896 | 0.6573 | 96 |
| `WILDFIRE` | 0.0000 | 0.0000 | 0.0000 | 0 |

**Macro Average:** Precision: 0.3333 | Recall: 0.2219 | F1: 0.2619  
**Weighted Average:** Precision: 1.0000 | Recall: 0.6852 | F1: 0.7999  

---

## 2. Confusion Matrix
```text
Rows = True Label | Columns = Predicted Label
Labels: ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']
True \ Pred         AGRI_BURN   IND_FIRE  IND_FLARE IND_ROUTIN OTHER_UNCE   WILDFIRE
------------------------------------------------------------------------------------
AGRI_BURN                 101          0          2         17          0          0
IND_FIRE                    0          0          0          0          0          0
IND_FLARE                   0          0          0          0          0          0
IND_ROUTINE                 0          0          0          0          0          0
OTHER_UNCERTAIN             0          0          0         49         47          0
WILDFIRE                    0          0          0          0          0          0
```

---

## 3. Major Confusion Pairs (Ranked by Frequency)
| True Label $\rightarrow$ Predicted Label | Error Count | Share of All Errors |
|:---|:---:|:---:|
| `OTHER_UNCERTAIN -> IND_ROUTINE` | 49 | 72.1% |
| `AGRI_BURN -> IND_ROUTINE` | 17 | 25.0% |
| `AGRI_BURN -> IND_FLARE` | 2 | 2.9% |

---

## 4. Root Cause Dissection & Exemplar Failures

### Event `HARD-NEG-AGRI-003`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 79.3%, Entropy: 0.66)
- **Spatial Context:** `dist_to_facility` = 1659.4 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 76.8% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 4.7 MW | Duration = 3.4 h | Active Days = 0

### Event `HARD-NEG-AGRI-017`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 79.5%, Entropy: 0.65)
- **Spatial Context:** `dist_to_facility` = 1645.1 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 78.0% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 16.5 MW | Duration = 2.6 h | Active Days = 0

### Event `HARD-NEG-AGRI-018`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 57.7%, Entropy: 0.89)
- **Spatial Context:** `dist_to_facility` = 2794.6 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 77.9% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 22.9 MW | Duration = 3.2 h | Active Days = 0

### Event `HARD-NEG-AGRI-033`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 77.0%, Entropy: 0.70)
- **Spatial Context:** `dist_to_facility` = 2481.0 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 76.0% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 6.5 MW | Duration = 0.7 h | Active Days = 0

### Event `HARD-NEG-AGRI-037`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 80.0%, Entropy: 0.64)
- **Spatial Context:** `dist_to_facility` = 1639.1 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 76.6% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 5.3 MW | Duration = 1.3 h | Active Days = 0

### Event `HARD-NEG-AGRI-040`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 82.0%, Entropy: 0.61)
- **Spatial Context:** `dist_to_facility` = 688.4 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 77.0% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 7.6 MW | Duration = 2.6 h | Active Days = 0

### Event `HARD-NEG-AGRI-041`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 64.9%, Entropy: 0.97)
- **Spatial Context:** `dist_to_facility` = 1579.9 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 80.2% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 14.7 MW | Duration = 3.3 h | Active Days = 0

### Event `HARD-NEG-AGRI-048`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_FLARE` (Confidence: 76.7%, Entropy: 0.78)
- **Spatial Context:** `dist_to_facility` = 971.8 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 75.2% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 32.0 MW | Duration = 3.2 h | Active Days = 0

### Event `HARD-NEG-AGRI-050`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_FLARE` (Confidence: 88.1%, Entropy: 0.45)
- **Spatial Context:** `dist_to_facility` = 1845.9 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 76.2% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 24.8 MW | Duration = 0.8 h | Active Days = 0

### Event `HARD-NEG-AGRI-054`
- **True Label:** `AGRI_BURN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 59.1%, Entropy: 0.92)
- **Spatial Context:** `dist_to_facility` = 1307.2 m | `is_industrial_zone` = 1
- **Land Cover:** Cropland = 76.1% | Forest = 5.0% | Urban = 10.0%
- **Telemetry:** Peak FRP = 17.2 MW | Duration = 0.5 h | Active Days = 0
