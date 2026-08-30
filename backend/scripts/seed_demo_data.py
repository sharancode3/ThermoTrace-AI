import uuid
from datetime import datetime, timezone
import json
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.db.models import IndustrialFacility, ThermalEvent

def seed_data():
    print("Starting database seed...")
    # Base.metadata.create_all(bind=engine) # Create tables if not exists using SQLAlchemy

    db: Session = SessionLocal()

    # Clear existing demo data if any
    print("Clearing old demo data...")
    db.query(ThermalEvent).delete()
    db.query(IndustrialFacility).delete()
    db.commit()

    print("Seeding Industrial Facilities...")
    # Jamnagar Refinery
    jamnagar_id = uuid.uuid4()
    jamnagar = IndustrialFacility(
        id=jamnagar_id,
        facility_code="FAC-IND-001",
        name="Reliance Jamnagar Refinery",
        sector_category="Refinery",
        state="Gujarat",
        facility_geom="SRID=4326;MULTIPOLYGON(((69.8 22.3, 69.9 22.3, 69.9 22.4, 69.8 22.4, 69.8 22.3)))",
        centroid="SRID=4326;POINT(69.85 22.35)", latitude=22.35, longitude=69.85,
        baseline_frp_mean=150.0,
        metadata_json={"operator": "Reliance Industries"}
    )

    # Hazira LNG
    hazira_id = uuid.uuid4()
    hazira = IndustrialFacility(
        id=hazira_id,
        facility_code="FAC-IND-002",
        name="Hazira LNG Terminal",
        sector_category="LNG",
        state="Gujarat",
        facility_geom="SRID=4326;MULTIPOLYGON(((72.6 21.1, 72.7 21.1, 72.7 21.2, 72.6 21.2, 72.6 21.1)))",
        centroid="SRID=4326;POINT(72.65 21.15)", latitude=21.15, longitude=72.65,
        baseline_frp_mean=45.0,
        metadata_json={"operator": "Shell"}
    )

    db.add(jamnagar)
    db.add(hazira)
    db.commit()

    print("Seeding Thermal Events...")
    now = datetime.now(timezone.utc)
    
    event1 = ThermalEvent(
        event_id="EVT-DEMO-001",
        centroid="SRID=4326;POINT(69.851 22.351)", latitude=22.351, longitude=69.851,
        boundary_geom="SRID=4326;POLYGON((69.85 22.35, 69.86 22.35, 69.86 22.36, 69.85 22.36, 69.85 22.35))",
        first_detected_utc=now,
        latest_detected_utc=now,
        peak_frp_mw=340.5,
        mean_frp_mw=300.0,
        aggregate_frp_mw=600.0,
        max_brightness_k=350.2,
        associated_facility_id=jamnagar_id,
        distance_to_facility_m=100.0,
        lifecycle_status="Active"
    )

    event2 = ThermalEvent(
        event_id="EVT-DEMO-002",
        centroid="SRID=4326;POINT(72.651 21.151)", latitude=21.151, longitude=72.651,
        boundary_geom="SRID=4326;POLYGON((72.65 21.15, 72.66 21.15, 72.66 21.16, 72.65 21.16, 72.65 21.15))",
        first_detected_utc=now,
        latest_detected_utc=now,
        peak_frp_mw=120.0,
        mean_frp_mw=100.0,
        aggregate_frp_mw=200.0,
        max_brightness_k=310.2,
        associated_facility_id=hazira_id,
        distance_to_facility_m=50.0,
        lifecycle_status="Resolved"
    )

    db.add(event1)
    db.add(event2)
    db.commit()

    print("Demo data seeded successfully.")

if __name__ == "__main__":
    seed_data()
