# Stage 3.3 Model Validation & Evaluation Report

## 1. Executive Summary
This report establishes the calibrated benchmark evaluation of the Champion (XGBoost) vs Challenger (Random Forest) models across all 6 canonical classes.

- **Dataset Size:** 410 records
- **Classes Evaluated:** AGRI_BURN, IND_FIRE, IND_FLARE, IND_ROUTINE, OTHER_UNCERTAIN, WILDFIRE
- **Validation Scheme:** 5-Fold Stratified Cross-Validation

## 2. Champion: Regularized Calibrated XGBoost
```text
                 precision    recall  f1-score   support

      AGRI_BURN       1.00      1.00      1.00        80
       IND_FIRE       1.00      1.00      1.00        60
      IND_FLARE       1.00      1.00      1.00        70
    IND_ROUTINE       1.00      1.00      1.00        70
OTHER_UNCERTAIN       1.00      1.00      1.00        60
       WILDFIRE       1.00      1.00      1.00        70

       accuracy                           1.00       410
      macro avg       1.00      1.00      1.00       410
   weighted avg       1.00      1.00      1.00       410

```

## 3. Challenger: Random Forest
```text
                 precision    recall  f1-score   support

      AGRI_BURN       1.00      1.00      1.00        80
       IND_FIRE       1.00      1.00      1.00        60
      IND_FLARE       1.00      1.00      1.00        70
    IND_ROUTINE       1.00      1.00      1.00        70
OTHER_UNCERTAIN       1.00      1.00      1.00        60
       WILDFIRE       1.00      1.00      1.00        70

       accuracy                           1.00       410
      macro avg       1.00      1.00      1.00       410
   weighted avg       1.00      1.00      1.00       410

```

## 4. Confusion Matrix (XGBoost Champion)
```text
Classes: ['AGRI_BURN', 'IND_FIRE', 'IND_FLARE', 'IND_ROUTINE', 'OTHER_UNCERTAIN', 'WILDFIRE']

[[80  0  0  0  0  0]
 [ 0 60  0  0  0  0]
 [ 0  0 70  0  0  0]
 [ 0  0  0 70  0  0]
 [ 0  0  0  0 60  0]
 [ 0  0  0  0  0 70]]
```
