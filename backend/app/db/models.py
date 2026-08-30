import uuid
from sqlalchemy import Column, String, Float, Integer, DateTime, Date, Time, SmallInteger, JSON, Boolean, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from sqlalchemy.sql import func
from app.db.database import Base
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    pass # Will handle gracefully if pgvector is missing, though the DB contract demands it

class ThermalObservation(Base):
    __tablename__ = "thermal_observations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dedup_key = Column(String(64), unique=True, nullable=False)
    geom = Column(Geometry('POINT', srid=4326), nullable=False)
    latitude = Column(Numeric(8, 5), nullable=False)
    longitude = Column(Numeric(8, 5), nullable=False)
    brightness_temp_k = Column(Float, nullable=False)
    brightness_temp_alt_k = Column(Float)
    frp_mw = Column(Float, nullable=False)
    acq_date = Column(Date, nullable=False)
    acq_time_utc = Column(Time, nullable=False)
    observation_timestamp_utc = Column(DateTime(timezone=True), nullable=False)
    ingestion_timestamp_utc = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    satellite_sensor = Column(String(32), nullable=False)
    confidence_level = Column(String(16))
    confidence_pct = Column(SmallInteger)
    day_night = Column(String(1), nullable=False)
    source_product = Column(String(32), default='FIRMS_NRT', nullable=False)
    scan_angle = Column(Float)
    track_pixel_size = Column(Float)
    raw_metadata = Column(JSONB, default={}, nullable=False)

class IndustrialFacility(Base):
    __tablename__ = "industrial_facilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_code = Column(String(32), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    sector_category = Column(String(64), nullable=False)
    sub_type = Column(String(64))
    operator_name = Column(String(255))
    state = Column(String(64), nullable=False)
    district = Column(String(64))
    facility_geom = Column(Geometry('MULTIPOLYGON', srid=4326), nullable=False)
    centroid = Column(Geometry('POINT', srid=4326), nullable=False)
    latitude = Column(Numeric(8, 5), nullable=False)
    longitude = Column(Numeric(8, 5), nullable=False)
    baseline_frp_mean = Column(Float, default=0.0, nullable=False)
    baseline_frp_std = Column(Float, default=1.0, nullable=False)
    baseline_frp_median = Column(Float, default=0.0, nullable=False)
    historical_event_count = Column(Integer, default=0, nullable=False)
    data_source = Column(String(64), default='OSM_GEM_V1', nullable=False)
    source_external_id = Column(String(128))
    metadata_json = Column(JSONB, default={}, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class ThermalEvent(Base):
    __tablename__ = "thermal_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(32), unique=True, nullable=False)
    centroid = Column(Geometry('POINT', srid=4326), nullable=False)
    boundary_geom = Column(Geometry('GEOMETRY', srid=4326), nullable=False)
    latitude = Column(Numeric(8, 5), nullable=False)
    longitude = Column(Numeric(8, 5), nullable=False)
    bounding_area_ha = Column(Float, default=0.0, nullable=False)
    first_detected_utc = Column(DateTime(timezone=True), nullable=False)
    latest_detected_utc = Column(DateTime(timezone=True), nullable=False)
    observation_count = Column(Integer, default=1, nullable=False)
    peak_frp_mw = Column(Float, nullable=False)
    mean_frp_mw = Column(Float, nullable=False)
    aggregate_frp_mw = Column(Float, nullable=False)
    max_brightness_k = Column(Float, nullable=False)
    associated_facility_id = Column(UUID(as_uuid=True), ForeignKey("industrial_facilities.id", ondelete="SET NULL"))
    distance_to_facility_m = Column(Float)
    primary_land_use = Column(String(64), default="Unknown", nullable=False)
    classification = Column(String(32), default="OTHER_UNCERTAIN", nullable=False)
    classification_confidence = Column(Float, default=0.0, nullable=False)
    persistence_tier = Column(String(32), default="TRANSIENT", nullable=False)
    anomaly_tier = Column(String(32), default="NORMAL", nullable=False)
    anomaly_z_score = Column(Float, default=0.0, nullable=False)
    lifecycle_status = Column(String(32), default="ACTIVE", nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class EventObservation(Base):
    __tablename__ = "event_observations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False)
    observation_id = Column(UUID(as_uuid=True), ForeignKey("thermal_observations.id", ondelete="RESTRICT"), nullable=False)
    attached_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class MlModel(Base):
    __tablename__ = "ml_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(64), nullable=False)
    version = Column(String(32), unique=True, nullable=False)
    model_type = Column(String(32), nullable=False)
    feature_schema_hash = Column(String(64), nullable=False)
    training_dataset_version = Column(String(64), nullable=False)
    macro_f1_score = Column(Float, nullable=False)
    industrial_precision = Column(Float, nullable=False)
    artifact_path = Column(String(255), nullable=False)
    is_deployed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class EventClassification(Base):
    __tablename__ = "event_classifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_models.id", ondelete="RESTRICT"), nullable=False)
    predicted_class = Column(String(32), nullable=False)
    confidence_pct = Column(Float, nullable=False)
    class_probabilities = Column(JSONB, nullable=False)
    feature_importances = Column(JSONB, nullable=False)
    input_feature_vector = Column(JSONB, nullable=False)
    is_current = Column(Boolean, default=True, nullable=False)
    classified_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class FacilityBaseline(Base):
    __tablename__ = "facility_baselines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_id = Column(UUID(as_uuid=True), ForeignKey("industrial_facilities.id", ondelete="CASCADE"), nullable=False)
    baseline_window = Column(String(32), default="ROLLING_12M", nullable=False)
    sample_observation_count = Column(Integer, nullable=False)
    mean_frp_mw = Column(Float, nullable=False)
    std_frp_mw = Column(Float, nullable=False)
    median_frp_mw = Column(Float, nullable=False)
    q75_frp_mw = Column(Float, nullable=False)
    q95_frp_mw = Column(Float, nullable=False)
    max_recorded_frp_mw = Column(Float, nullable=False)
    is_statistically_sufficient = Column(Boolean, default=True, nullable=False)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class EventAnomaly(Base):
    __tablename__ = "event_anomalies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("thermal_events.id", ondelete="CASCADE"), unique=True, nullable=False)
    observed_frp_mw = Column(Float, nullable=False)
    baseline_mean_frp_mw = Column(Float, nullable=False)
    baseline_std_frp_mw = Column(Float, nullable=False)
    z_score = Column(Float, nullable=False)
    percentile_rank = Column(Float, nullable=False)
    anomaly_severity = Column(String(32), nullable=False)
    contributing_factors = Column(JSONB, nullable=False)
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ThermoNews(Base):
    __tablename__ = "thermo_news"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("thermal_events.id", ondelete="CASCADE"), unique=True, nullable=False)
    headline = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    severity_tag = Column(String(32), nullable=False)
    published_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(32), default="ANALYST", nullable=False)
    notification_preferences = Column(JSONB, default={"critical_only": True, "push_enabled": True}, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    event_id = Column(UUID(as_uuid=True), ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(String(64), unique=True, nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    included_sections = Column(JSONB, nullable=False)
    storage_path = Column(String(512), nullable=False)
    download_url = Column(String(512), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    generation_status = Column(String(32), default="COMPLETED", nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ChatAuditLog(Base):
    __tablename__ = "chat_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(64), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    raw_query = Column(Text, nullable=False)
    extracted_parameters = Column(JSONB, nullable=False)
    retrieved_event_ids = Column(JSONB, nullable=False)
    response_text = Column(Text, nullable=False)
    latency_ms = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_feed = Column(String(32), nullable=False)
    time_window_start = Column(DateTime(timezone=True), nullable=False)
    time_window_end = Column(DateTime(timezone=True), nullable=False)
    records_received = Column(Integer, default=0, nullable=False)
    records_inserted = Column(Integer, default=0, nullable=False)
    records_duplicated = Column(Integer, default=0, nullable=False)
    status = Column(String(32), nullable=False)
    error_message = Column(Text)
    execution_duration_ms = Column(Integer, nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
