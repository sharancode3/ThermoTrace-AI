# Detailed Error Analysis: TEST_E_OOD_ADVERSARIAL
**Test Samples:** 208 | **Error Count:** 110 | **Accuracy:** 47.12%

---

## 1. Per-Class Performance Matrix
| Class | Precision | Recall | F1-Score | Support |
|:---|:---:|:---:|:---:|:---:|
| `AGRI_BURN` | 0.6721 | 1.0000 | 0.8039 | 41 |
| `IND_FIRE` | 1.0000 | 1.0000 | 1.0000 | 21 |
| `IND_FLARE` | 0.0000 | 0.0000 | 0.0000 | 0 |
| `IND_ROUTINE` | 0.0000 | 0.0000 | 0.0000 | 0 |
| `OTHER_UNCERTAIN` | 1.0000 | 0.1379 | 0.2424 | 116 |
| `WILDFIRE` | 1.0000 | 0.6667 | 0.8000 | 30 |

**Macro Average:** Precision: 0.6120 | Recall: 0.4674 | F1: 0.4744  
**Weighted Average:** Precision: 0.9354 | Recall: 0.4712 | F1: 0.5100  

---

## 2. Confusion Matrix
```text
Rows = True Label | Columns = Predicted Label
Labels: ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']
True \ Pred         AGRI_BURN   IND_FIRE  IND_FLARE IND_ROUTIN OTHER_UNCE   WILDFIRE
------------------------------------------------------------------------------------
AGRI_BURN                  41          0          0          0          0          0
IND_FIRE                    0         21          0          0          0          0
IND_FLARE                   0          0          0          0          0          0
IND_ROUTINE                 0          0          0          0          0          0
OTHER_UNCERTAIN            20          0          0         80         16          0
WILDFIRE                    0          0         10          0          0         20
```

---

## 3. Major Confusion Pairs (Ranked by Frequency)
| True Label $\rightarrow$ Predicted Label | Error Count | Share of All Errors |
|:---|:---:|:---:|
| `OTHER_UNCERTAIN -> IND_ROUTINE` | 80 | 72.7% |
| `OTHER_UNCERTAIN -> AGRI_BURN` | 20 | 18.2% |
| `WILDFIRE -> IND_FLARE` | 10 | 9.1% |

---

## 4. Root Cause Dissection & Exemplar Failures

### Event `HARD-NEG-URBAN-001`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.18)
- **Spatial Context:** `dist_to_facility` = 33804.5 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 87.8%
- **Telemetry:** Peak FRP = 3.7 MW | Duration = 4.3 h | Active Days = 0

### Event `HARD-NEG-URBAN-002`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 95.1%, Entropy: 0.24)
- **Spatial Context:** `dist_to_facility` = 31848.2 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 81.0%
- **Telemetry:** Peak FRP = 6.4 MW | Duration = 7.2 h | Active Days = 1

### Event `HARD-NEG-URBAN-003`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.18)
- **Spatial Context:** `dist_to_facility` = 19665.7 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 86.9%
- **Telemetry:** Peak FRP = 5.5 MW | Duration = 7.2 h | Active Days = 1

### Event `HARD-NEG-URBAN-004`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.17)
- **Spatial Context:** `dist_to_facility` = 44642.6 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 86.0%
- **Telemetry:** Peak FRP = 1.5 MW | Duration = 1.5 h | Active Days = 0

### Event `HARD-NEG-URBAN-005`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 94.9%, Entropy: 0.25)
- **Spatial Context:** `dist_to_facility` = 25755.4 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 80.1%
- **Telemetry:** Peak FRP = 6.2 MW | Duration = 3.9 h | Active Days = 0

### Event `HARD-NEG-URBAN-006`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.18)
- **Spatial Context:** `dist_to_facility` = 25290.5 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 85.8%
- **Telemetry:** Peak FRP = 3.7 MW | Duration = 2.9 h | Active Days = 0

### Event `HARD-NEG-URBAN-007`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.17)
- **Spatial Context:** `dist_to_facility` = 33146.9 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 93.6%
- **Telemetry:** Peak FRP = 3.1 MW | Duration = 3.9 h | Active Days = 1

### Event `HARD-NEG-URBAN-008`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 95.0%, Entropy: 0.25)
- **Spatial Context:** `dist_to_facility` = 44599.8 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 82.6%
- **Telemetry:** Peak FRP = 7.1 MW | Duration = 2.6 h | Active Days = 1

### Event `HARD-NEG-URBAN-009`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.17)
- **Spatial Context:** `dist_to_facility` = 16158.0 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 87.9%
- **Telemetry:** Peak FRP = 2.9 MW | Duration = 7.8 h | Active Days = 0

### Event `HARD-NEG-URBAN-010`
- **True Label:** `OTHER_UNCERTAIN` $\rightarrow$ **Predicted:** `IND_ROUTINE` (Confidence: 97.0%, Entropy: 0.18)
- **Spatial Context:** `dist_to_facility` = 17628.6 m | `is_industrial_zone` = 0
- **Land Cover:** Cropland = 5.0% | Forest = 5.0% | Urban = 88.9%
- **Telemetry:** Peak FRP = 5.4 MW | Duration = 4.2 h | Active Days = 0
