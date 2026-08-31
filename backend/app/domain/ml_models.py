"""
ML Model Architecture & Custom Estimators for ThermoTrace AI
"""
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from xgboost import XGBClassifier

class Float64XGBClassifier(BaseEstimator, ClassifierMixin):
    """Wrapper to guarantee continuous double precision for Cython probability calibrators."""
    def __init__(self, n_estimators=120, max_depth=4, learning_rate=0.08, subsample=0.85, colsample_bytree=0.85, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.random_state = random_state
        self.model_ = None

    def fit(self, X, y):
        self.classes_ = np.unique(y)
        self.model_ = XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            objective="multi:softprob",
            random_state=self.random_state,
            eval_metric="mlogloss"
        )
        self.model_.fit(np.asarray(X, dtype=np.float64), np.asarray(y, dtype=np.int64))
        return self

    def predict_proba(self, X):
        probs = self.model_.predict_proba(np.asarray(X, dtype=np.float64))
        return np.ascontiguousarray(probs, dtype=np.float64)

    def predict(self, X):
        preds = self.model_.predict(np.asarray(X, dtype=np.float64))
        return np.asarray(preds, dtype=np.int64)
