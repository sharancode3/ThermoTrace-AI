from app.db.database import SessionLocal 
from app.db.models import ThermalEvent 
from datetime import datetime, timezone 
now = datetime.now(timezone.utc) 
db = SessionLocal() 
fake_event = ThermalEvent( event_id='TEST-EVT-0004', classification='IND_FLARE', anomaly_tier='CRITICAL', latitude=23.0, longitude=72.0, peak_frp_mw=120.0, mean_frp_mw=110.0, aggregate_frp_mw=120.0, max_brightness_k=350.0, lifecycle_status='ACTIVE', centroid='SRID=4326;POINT(72.0 23.0)', boundary_geom='SRID=4326;POLYGON((71.99 22.99, 72.01 22.99, 72.01 23.01, 71.99 23.01, 71.99 22.99))', first_detected_utc=now, latest_detected_utc=now, observation_count=1, bounding_area_ha=1.0, primary_land_use='Industrial', classification_confidence=0.95, persistence_tier='TRANSIENT', anomaly_z_score=4.5, is_demo=True ) 
db.add(fake_event) 
db.commit() 
print(f"Created event: {fake_event.id} / {fake_event.event_id}") 