from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
from enum import Enum

class CanonicalClassification(str, Enum):
    IND_FIRE = "IND_FIRE"
    IND_FLARE = "IND_FLARE"
    IND_ROUTINE = "IND_ROUTINE"
    AGRI_BURN = "AGRI_BURN"
    WILDFIRE = "WILDFIRE"
    OTHER_UNCERTAIN = "OTHER_UNCERTAIN"

class CanonicalPersistence(str, Enum):
    TRANSIENT = "TRANSIENT"
    INTERMITTENT = "INTERMITTENT"
    PERSISTENT = "PERSISTENT"

class CanonicalAnomalyTier(str, Enum):
    NORMAL = "NORMAL"
    ELEVATED = "ELEVATED"
    ABNORMAL = "ABNORMAL"
    CRITICAL = "CRITICAL"
    BASELINE_INSUFFICIENT = "BASELINE_INSUFFICIENT"

class CanonicalLifecycleStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COOLING = "COOLING"
    RESOLVED = "RESOLVED"

class CanonicalThermalTrend(str, Enum):
    INCREASING = "INCREASING"
    STABLE = "STABLE"
    DECREASING = "DECREASING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"

class EvidenceCompletenessTier(str, Enum):
    GOOD = "GOOD"
    LIMITED = "LIMITED"
    INSUFFICIENT = "INSUFFICIENT"

class UncertaintyTier(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"

class EventResponse(BaseModel):
    event_id: str
    latitude: float
    longitude: float
    centroid: Dict[str, Any]
    boundary: Dict[str, Any]
    bounding_area_ha: float = 0.0
    first_detected_utc: datetime
    latest_detected_utc: datetime
    duration_hours: float
    observation_count: int
    peak_frp_mw: float
    mean_frp_mw: float
    aggregate_frp_mw: float
    max_brightness_k: float
    associated_facility_id: Optional[UUID] = None
    facility_name: Optional[str] = None
    distance_to_facility_m: Optional[float] = None
    primary_land_use: str = "Unknown"
    classification: str = "OTHER_UNCERTAIN"
    classification_confidence: float = 0.0
    persistence_tier: str = "TRANSIENT"
    anomaly_tier: str = "NORMAL"
    anomaly_z_score: Optional[float] = None
    lifecycle_status: str = "ACTIVE"
    thermal_trend: str = "INSUFFICIENT_DATA"
    evidence_completeness: str = "LIMITED"
    evidence_strength: str = "LIMITED"
    evidence_rationale: str = ""
    uncertainty: str = "HIGH"
    class_probabilities: Dict[str, float] = Field(default_factory=dict)
    shap_top_contributors: Dict[str, float] = Field(default_factory=dict)
    tier2_computed_at: Optional[datetime] = None
    is_tier2_cached: bool = False
    satellite_context: Optional[Dict[str, Any]] = None
    is_within_india_sovereign_bounds: bool = True
    is_statistically_sufficient: bool = False
    baseline_sample_size: int = 0
    baseline_sufficiency_threshold: int = 10
    baseline_mean_frp_mw: Optional[float] = None
    baseline_std_frp_mw: Optional[float] = None
    contributing_factors: Dict[str, Any] = Field(default_factory=dict)
    humanized_summary: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]

class NewsItemResponse(BaseModel):
    id: str
    event_id: str
    headline: str
    summary: str
    severity_tag: str
    classification: str
    anomaly_tier: str
    confidence_pct: float
    peak_frp_mw: float
    brightness_temp_k: Optional[float] = None
    is_industrial: bool = False
    evidence_strength: Optional[str] = "LIMITED"
    evidence_rationale: Optional[str] = ""
    location_name: str
    coordinates: List[float]
    published_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FirmsStatusResponse(BaseModel):
    status: str
    last_successful_firms_fetch_utc: Optional[datetime] = None
    latest_observation_timestamp_utc: Optional[datetime] = None
    last_processing_completed_utc: Optional[datetime] = None
    records_received: int = 0
    records_inserted: int = 0
    records_duplicated: int = 0
    data_freshness_status: str = "FRESH"
    active_sensors: List[str] = Field(default_factory=list)
