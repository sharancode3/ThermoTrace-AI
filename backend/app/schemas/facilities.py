"""Pydantic schemas for the Strategic Industrial Registry and Facility Intelligence."""
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class FacilitySummaryItem(BaseModel):
    id: UUID
    facility_code: str
    name: str
    sector_category: str
    sub_type: Optional[str] = None
    operator_name: Optional[str] = None
    state: str
    district: Optional[str] = None
    latitude: float
    longitude: float
    baseline_frp_mean: Optional[float] = None
    baseline_frp_std: Optional[float] = None
    baseline_frp_median: Optional[float] = None
    historical_event_count: int = 0
    is_statistically_sufficient: bool = True
    is_active: bool = True
    data_source: Optional[str] = None

    class Config:
        from_attributes = True


class FacilityListResponse(BaseModel):
    items: List[FacilitySummaryItem]
    total_count: int
    page: int
    page_size: int
    sectors: List[str]
    states: List[str]


class FacilityAggregationMetrics(BaseModel):
    total_events: int = 0
    distinct_active_days: int = 0
    mean_frp_mw: float = 0.0
    peak_frp_mw: float = 0.0
    longest_streak_days: int = 0
    activity_trend: str = "NO_ACTIVITY"  # INCREASING | DECREASING | STABLE | NO_ACTIVITY
    classification_counts: Dict[str, int] = Field(default_factory=dict)
    anomaly_tier_counts: Dict[str, int] = Field(default_factory=dict)
    first_detected_in_window: Optional[datetime] = None
    latest_detected_in_window: Optional[datetime] = None


class FacilityHistoricalEventItem(BaseModel):
    event_id: str
    first_detected_utc: datetime
    latest_detected_utc: datetime
    peak_frp_mw: float
    mean_frp_mw: float
    classification: str
    anomaly_tier: str
    z_score: Optional[float] = None
    confidence_pct: Optional[float] = None
    observation_count: int = 1
    distance_to_facility_m: Optional[float] = None


class FacilityBaselineProfile(BaseModel):
    sample_observation_count: int
    mean_frp_mw: float
    std_frp_mw: float
    median_frp_mw: float
    q75_frp_mw: float
    q95_frp_mw: float
    max_recorded_frp_mw: float
    is_statistically_sufficient: bool
    calculated_at: Optional[datetime] = None


class GroundedBrief(BaseModel):
    observed: List[str] = Field(default_factory=list)
    derived: List[str] = Field(default_factory=list)
    modelled: List[str] = Field(default_factory=list)
    unknown: List[str] = Field(default_factory=list)
    narrative_summary: str = ""


class FacilityIntelligenceResponse(BaseModel):
    facility: FacilitySummaryItem
    baseline_profile: Optional[FacilityBaselineProfile] = None
    window_days: int = 30
    window_metrics: FacilityAggregationMetrics
    historical_events: List[FacilityHistoricalEventItem] = Field(default_factory=list)
    land_cover_context: Dict[str, Any] = Field(default_factory=dict)
    grounded_brief: GroundedBrief
    cached_at: datetime = Field(default_factory=datetime.utcnow)
