import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.db.models import (
    IndustrialFacility, ThermalEvent, EventAnomaly, EventClassification, MlModel
)

def populate_30d_history():
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    ml_model = db.query(MlModel).first()

    print("Fetching active facilities...")
    facilities = db.query(IndustrialFacility).filter(IndustrialFacility.historical_event_count > 1).all()
    print(f"Found {len(facilities)} facilities needing historical 30-day detections.")

    from sqlalchemy import func
    existing_counts = dict(
        db.query(ThermalEvent.associated_facility_id, func.count(ThermalEvent.id))
        .filter(ThermalEvent.associated_facility_id.isnot(None))
        .group_by(ThermalEvent.associated_facility_id)
        .all()
    )

    new_events = []
    anomalies = []
    classifications = []
    evt_num = 1000

    for fac in facilities:
        target_count = fac.historical_event_count
        current_count = existing_counts.get(fac.id, 0)
        needed = target_count - current_count
        if needed <= 0:
            continue

        base_frp = float(fac.baseline_frp_mean or 100.0)
        base_std = float(fac.baseline_frp_std or 15.0)
        lat, lon = float(fac.latitude), float(fac.longitude)
        state_code = (fac.state[:3] if fac.state else "IND").upper()

        sector_lower = (fac.sector_category or "").lower()
        if "refin" in sector_lower or "oil" in sector_lower or "gas" in sector_lower or "petro" in sector_lower:
            default_cls = "IND_FLARE" if random.random() < 0.4 else "IND_ROUTINE"
        else:
            default_cls = "IND_ROUTINE"

        for i in range(needed):
            evt_num += 1
            if i == 0 and needed > 2:
                hours_ago = random.uniform(8.0, 23.5)
            elif i < 3:
                hours_ago = random.uniform(24.0, 160.0)
            else:
                hours_ago = random.uniform(168.0, 690.0)

            event_time = now - timedelta(hours=hours_ago)
            frp = max(15.0, round(random.gauss(base_frp, base_std), 1))
            mean_frp = round(frp * random.uniform(0.85, 0.95), 1)
            duration_hrs = random.uniform(1.5, 6.0)
            first_time = event_time - timedelta(hours=duration_hrs)

            j_lat = lat + random.uniform(-0.003, 0.003)
            j_lon = lon + random.uniform(-0.003, 0.003)

            tier = "NORMAL"
            z = round((frp - base_frp) / (base_std if base_std > 0 else 1.0), 2)
            if default_cls == "IND_FLARE" and z >= 2.5:
                tier = "ABNORMAL"

            e_id = uuid.uuid4()
            event_code = f"EVT-30D-{state_code}-{evt_num:05d}"

            poly_wkt = f"SRID=4326;POLYGON(({j_lon-0.004} {j_lat-0.004}, {j_lon+0.004} {j_lat-0.004}, {j_lon+0.004} {j_lat+0.004}, {j_lon-0.004} {j_lat+0.004}, {j_lon-0.004} {j_lat-0.004}))"
            point_wkt = f"SRID=4326;POINT({j_lon} {j_lat})"

            te = ThermalEvent(
                id=e_id,
                event_id=event_code,
                centroid=point_wkt,
                boundary_geom=poly_wkt,
                latitude=j_lat,
                longitude=j_lon,
                bounding_area_ha=round(random.uniform(4.0, 18.0), 1),
                first_detected_utc=first_time,
                latest_detected_utc=event_time,
                observation_count=random.randint(4, 20),
                peak_frp_mw=frp,
                mean_frp_mw=mean_frp,
                aggregate_frp_mw=round(frp * random.uniform(1.8, 3.5), 1),
                max_brightness_k=round(315.0 + frp * 0.25, 1),
                associated_facility_id=fac.id,
                distance_to_facility_m=round(random.uniform(50, 450), 1),
                primary_land_use=fac.sector_category or "Industrial",
                classification=default_cls,
                classification_confidence=round(random.uniform(0.92, 0.98), 3),
                persistence_tier="PERSISTENT" if default_cls == "IND_ROUTINE" else "EPISODIC",
                anomaly_tier=tier,
                anomaly_z_score=z,
                lifecycle_status="COOLING" if hours_ago < 72 else "RESOLVED"
            )
            new_events.append(te)

            if ml_model:
                classifications.append(
                    EventClassification(
                        id=uuid.uuid4(),
                        event_id=e_id,
                        model_id=ml_model.id,
                        predicted_class=default_cls,
                        confidence_pct=round(te.classification_confidence * 100, 1),
                        class_probabilities={default_cls: te.classification_confidence, "OTHER_UNCERTAIN": round(1.0 - te.classification_confidence, 3)},
                        feature_importances={"facility_dist_km": 0.40, "peak_frp": 0.35, "landcover_class": 0.25},
                        input_feature_vector={"peak_frp": frp, "mean_frp": mean_frp, "facility_dist_km": 0.2},
                        is_current=True,
                        classified_at=event_time
                    )
                )

            anomalies.append(
                EventAnomaly(
                    id=uuid.uuid4(),
                    event_id=e_id,
                    observed_frp_mw=frp,
                    baseline_mean_frp_mw=base_frp,
                    baseline_std_frp_mw=base_std,
                    z_score=z,
                    percentile_rank=round(min(99.0, max(10.0, 50.0 + z * 15.0)), 1),
                    anomaly_severity=tier,
                    contributing_factors={"status": "HISTORICAL_RECORDED_PASS"},
                    evaluated_at=event_time
                )
            )

    regional_zones = [
        ("Punjab Crop Residue Cluster", "Punjab", 30.3, 75.4, "AGRI_BURN"),
        ("Haryana Stubble Burning Belt", "Haryana", 29.7, 76.6, "AGRI_BURN"),
        ("UP Terai Agricultural Fires", "Uttar Pradesh", 27.8, 80.5, "AGRI_BURN"),
        ("Simlipal Forest Foothills", "Odisha", 21.7, 86.4, "WILDFIRE"),
        ("Melghat Peripheral Heat", "Maharashtra", 21.4, 77.3, "WILDFIRE"),
        ("Bastar Forest Thermal Anomaly", "Chhattisgarh", 19.2, 81.8, "WILDFIRE"),
    ]

    for zone_name, state, z_lat, z_lon, z_cls in regional_zones:
        for k in range(18):
            evt_num += 1
            hours_ago = random.uniform(12.0, 680.0)
            event_time = now - timedelta(hours=hours_ago)
            frp = round(random.uniform(45.0, 110.0), 1)
            mean_frp = round(frp * 0.85, 1)
            j_lat = z_lat + random.uniform(-0.4, 0.4)
            j_lon = z_lon + random.uniform(-0.4, 0.4)
            e_id = uuid.uuid4()
            state_code = state[:3].upper()
            event_code = f"EVT-30D-{state_code}-{evt_num:05d}"
            poly_wkt = f"SRID=4326;POLYGON(({j_lon-0.006} {j_lat-0.006}, {j_lon+0.006} {j_lat-0.006}, {j_lon+0.006} {j_lat+0.006}, {j_lon-0.006} {j_lat+0.006}, {j_lon-0.006} {j_lat-0.006}))"
            point_wkt = f"SRID=4326;POINT({j_lon} {j_lat})"

            tier = "ABNORMAL" if frp > 90.0 else "NORMAL"
            te = ThermalEvent(
                id=e_id,
                event_id=event_code,
                centroid=point_wkt,
                boundary_geom=poly_wkt,
                latitude=j_lat,
                longitude=j_lon,
                bounding_area_ha=round(random.uniform(6.0, 25.0), 1),
                first_detected_utc=event_time - timedelta(hours=random.uniform(1, 4)),
                latest_detected_utc=event_time,
                observation_count=random.randint(4, 15),
                peak_frp_mw=frp,
                mean_frp_mw=mean_frp,
                aggregate_frp_mw=round(frp * 2.2, 1),
                max_brightness_k=round(315.0 + frp * 0.3, 1),
                associated_facility_id=None,
                distance_to_facility_m=None,
                primary_land_use="Agricultural Cropland" if z_cls == "AGRI_BURN" else "Protected Forest",
                classification=z_cls,
                classification_confidence=round(random.uniform(0.90, 0.97), 3),
                persistence_tier="TRANSIENT",
                anomaly_tier=tier,
                anomaly_z_score=2.2 if tier == "ABNORMAL" else 0.8,
                lifecycle_status="COOLING" if hours_ago < 72 else "RESOLVED"
            )
            new_events.append(te)

            if ml_model:
                classifications.append(
                    EventClassification(
                        id=uuid.uuid4(),
                        event_id=e_id,
                        model_id=ml_model.id,
                        predicted_class=z_cls,
                        confidence_pct=round(te.classification_confidence * 100, 1),
                        class_probabilities={z_cls: te.classification_confidence, "OTHER_UNCERTAIN": round(1.0 - te.classification_confidence, 3)},
                        feature_importances={"peak_frp": 0.50, "landcover_class": 0.50},
                        input_feature_vector={"peak_frp": frp, "mean_frp": mean_frp},
                        is_current=True,
                        classified_at=event_time
                    )
                )

    print(f"Total new 30-day historical events to insert: {len(new_events)}")

    chunk_size = 200
    for i in range(0, len(new_events), chunk_size):
        chunk_e = new_events[i:i+chunk_size]
        chunk_c = classifications[i:i+chunk_size]
        chunk_a = anomalies[i:i+chunk_size]
        db.bulk_save_objects(chunk_e)
        if chunk_c:
            db.bulk_save_objects(chunk_c)
        if chunk_a:
            db.bulk_save_objects(chunk_a)
        db.commit()
        print(f"Committed chunk {i // chunk_size + 1}/{(len(new_events) + chunk_size - 1) // chunk_size}")

    total_events = db.query(ThermalEvent).count()
    print(f"Done! Total events in DB across 30-day window: {total_events}")
    db.close()

if __name__ == "__main__":
    populate_30d_history()
