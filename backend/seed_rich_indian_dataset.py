import uuid
import random
from datetime import datetime, timezone, timedelta
from app.db.database import SessionLocal
from app.db.models import (
    IndustrialFacility, ThermalEvent, EventAnomaly, EventClassification,
    FacilityBaseline, Notification, ThermoNews, MlModel, User
)

FACILITIES_SEED = [
    {"code": "FAC-GUJ-001", "name": "Reliance Jamnagar Super Refinery", "sector": "Refinery", "state": "Gujarat", "lat": 22.3512, "lon": 69.8524, "operator": "Reliance Industries", "mean_frp": 165.0, "std_frp": 25.0},
    {"code": "FAC-GUJ-002", "name": "Hazira LNG & Petrochemicals Terminal", "sector": "LNG / Petrochemicals", "state": "Gujarat", "lat": 21.1523, "lon": 72.6518, "operator": "Shell / ArcelorMittal", "mean_frp": 48.0, "std_frp": 8.5},
    {"code": "FAC-MAH-001", "name": "BPCL Mahul Refinery Mumbai", "sector": "Refinery", "state": "Maharashtra", "lat": 19.0125, "lon": 72.8954, "operator": "Bharat Petroleum", "mean_frp": 82.0, "std_frp": 14.0},
    {"code": "FAC-MAH-002", "name": "HPCL Trombay Refinery Mumbai", "sector": "Refinery", "state": "Maharashtra", "lat": 19.0041, "lon": 72.9012, "operator": "Hindustan Petroleum", "mean_frp": 76.0, "std_frp": 12.5},
    {"code": "FAC-ODI-001", "name": "IOCL Paradip Mega Refinery", "sector": "Refinery", "state": "Odisha", "lat": 20.2845, "lon": 86.6432, "operator": "Indian Oil Corporation", "mean_frp": 140.0, "std_frp": 22.0},
    {"code": "FAC-HAR-001", "name": "IOCL Panipat Petrochemical Complex", "sector": "Refinery", "state": "Haryana", "lat": 29.3921, "lon": 76.9745, "operator": "Indian Oil Corporation", "mean_frp": 95.0, "std_frp": 16.0},
    {"code": "FAC-UP-001", "name": "IOCL Mathura Refinery", "sector": "Refinery", "state": "Uttar Pradesh", "lat": 27.4924, "lon": 77.6738, "operator": "Indian Oil Corporation", "mean_frp": 68.0, "std_frp": 11.0},
    {"code": "FAC-TN-001", "name": "CPCL Manali Refinery Chennai", "sector": "Refinery", "state": "Tamil Nadu", "lat": 13.1685, "lon": 80.2642, "operator": "Chennai Petroleum", "mean_frp": 88.0, "std_frp": 15.0},
    {"code": "FAC-AP-001", "name": "HPCL Visakhapatnam Refinery", "sector": "Refinery", "state": "Andhra Pradesh", "lat": 17.6868, "lon": 83.2185, "operator": "Hindustan Petroleum", "mean_frp": 72.0, "std_frp": 13.0},
    {"code": "FAC-WB-001", "name": "Haldia Petrochemicals & Refinery", "sector": "Petrochemicals", "state": "West Bengal", "lat": 22.0624, "lon": 88.0845, "operator": "Haldia Petrochemicals Ltd", "mean_frp": 110.0, "std_frp": 19.0},
    {"code": "FAC-KAR-001", "name": "MRPL Mangalore Refinery", "sector": "Refinery", "state": "Karnataka", "lat": 12.9845, "lon": 74.8312, "operator": "ONGC / MRPL", "mean_frp": 84.0, "std_frp": 14.5},
    {"code": "FAC-ASM-001", "name": "Numaligarh Refinery Complex", "sector": "Refinery", "state": "Assam", "lat": 26.5684, "lon": 93.7541, "operator": "Numaligarh Refinery Ltd", "mean_frp": 54.0, "std_frp": 9.0},
    {"code": "FAC-GUJ-003", "name": "ONGC Dahej Petrochemical Complex", "sector": "Petrochemicals", "state": "Gujarat", "lat": 21.7124, "lon": 72.5841, "operator": "ONGC Petro additions Ltd", "mean_frp": 125.0, "std_frp": 20.0},
    {"code": "FAC-JHK-001", "name": "Tata Steel Jamshedpur Works", "sector": "Iron & Steel", "state": "Jharkhand", "lat": 22.7984, "lon": 86.1845, "operator": "Tata Steel Ltd", "mean_frp": 210.0, "std_frp": 32.0},
    {"code": "FAC-ODI-002", "name": "SAIL Rourkela Steel Plant", "sector": "Iron & Steel", "state": "Odisha", "lat": 22.2214, "lon": 84.8712, "operator": "Steel Authority of India", "mean_frp": 190.0, "std_frp": 28.0},
    {"code": "FAC-KAR-002", "name": "JSW Steel Vijayanagar Works", "sector": "Iron & Steel", "state": "Karnataka", "lat": 15.1845, "lon": 76.6812, "operator": "JSW Steel Ltd", "mean_frp": 240.0, "std_frp": 35.0},
    {"code": "FAC-CG-001", "name": "SAIL Bhilai Steel Plant", "sector": "Iron & Steel", "state": "Chhattisgarh", "lat": 21.1984, "lon": 81.3845, "operator": "Steel Authority of India", "mean_frp": 215.0, "std_frp": 30.0},
    {"code": "FAC-WB-002", "name": "SAIL Durgapur Steel Plant", "sector": "Iron & Steel", "state": "West Bengal", "lat": 23.5124, "lon": 87.3214, "operator": "Steel Authority of India", "mean_frp": 175.0, "std_frp": 26.0},
    {"code": "FAC-ODI-003", "name": "Jindal Steel & Power Angul Complex", "sector": "Iron & Steel", "state": "Odisha", "lat": 20.8412, "lon": 85.1245, "operator": "JSPL", "mean_frp": 185.0, "std_frp": 27.0},
    {"code": "FAC-AP-002", "name": "RINL Visakhapatnam Steel Plant", "sector": "Iron & Steel", "state": "Andhra Pradesh", "lat": 17.6312, "lon": 83.1845, "operator": "Rashtriya Ispat Nigam Ltd", "mean_frp": 160.0, "std_frp": 24.0},
    {"code": "FAC-TEL-001", "name": "NTPC Ramagundam Super Thermal Power", "sector": "Thermal Power", "state": "Telangana", "lat": 18.7541, "lon": 79.4845, "operator": "NTPC Ltd", "mean_frp": 130.0, "std_frp": 18.0},
    {"code": "FAC-MP-001", "name": "NTPC Vindhyachal Super Thermal Power", "sector": "Thermal Power", "state": "Madhya Pradesh", "lat": 24.1012, "lon": 82.6741, "operator": "NTPC Ltd", "mean_frp": 260.0, "std_frp": 38.0},
    {"code": "FAC-ODI-004", "name": "NTPC Talcher Thermal Power Station", "sector": "Thermal Power", "state": "Odisha", "lat": 20.9124, "lon": 85.2214, "operator": "NTPC Ltd", "mean_frp": 145.0, "std_frp": 21.0},
    {"code": "FAC-CG-002", "name": "NTPC Korba Super Thermal Power", "sector": "Thermal Power", "state": "Chhattisgarh", "lat": 22.3612, "lon": 82.7145, "operator": "NTPC Ltd", "mean_frp": 180.0, "std_frp": 25.0},
    {"code": "FAC-TN-002", "name": "NLC Neyveli Lignite Thermal Complex", "sector": "Thermal Power", "state": "Tamil Nadu", "lat": 11.5984, "lon": 79.4812, "operator": "NLC India Ltd", "mean_frp": 115.0, "std_frp": 17.0},
    {"code": "FAC-JHK-002", "name": "BCCL Jharia Coalfield Operations", "sector": "Coal Mining", "state": "Jharkhand", "lat": 23.7512, "lon": 86.4185, "operator": "Bharat Coking Coal Ltd", "mean_frp": 195.0, "std_frp": 30.0},
    {"code": "FAC-MP-002", "name": "NCL Singrauli Coalfield Complex", "sector": "Coal Mining", "state": "Madhya Pradesh", "lat": 24.2014, "lon": 82.6841, "operator": "Northern Coalfields Ltd", "mean_frp": 170.0, "std_frp": 26.0}
]

AGRICULTURAL_AND_FOREST_ZONES = [
    {"name": "Bhatinda Agricultural Biomass Zone", "state": "Punjab", "lat": 30.2112, "lon": 74.9512, "class": "AGRI_BURN", "peak_frp": 78.4},
    {"name": "Sangrur Stubble Combustion Cluster", "state": "Punjab", "lat": 30.2415, "lon": 75.8412, "class": "AGRI_BURN", "peak_frp": 92.1},
    {"name": "Karnal Crop Residue Thermal Belt", "state": "Haryana", "lat": 29.6845, "lon": 76.9812, "class": "AGRI_BURN", "peak_frp": 64.3},
    {"name": "Ludhiana Rural Farmfire Hotspot", "state": "Punjab", "lat": 30.9012, "lon": 75.8541, "class": "AGRI_BURN", "peak_frp": 85.0},
    {"name": "Kaithal Paddy Field Thermal Sector", "state": "Haryana", "lat": 29.8012, "lon": 76.4012, "class": "AGRI_BURN", "peak_frp": 71.8},
    {"name": "Simlipal Forest Buffer Thermal Anomaly", "state": "Odisha", "lat": 21.8541, "lon": 86.3412, "class": "WILDFIRE", "peak_frp": 115.6},
    {"name": "Melghat Tiger Reserve Perimeter Heat", "state": "Maharashtra", "lat": 21.4512, "lon": 77.2145, "class": "WILDFIRE", "peak_frp": 104.2},
    {"name": "Nallamala Forest Foothills Fire", "state": "Andhra Pradesh", "lat": 15.6812, "lon": 78.9145, "class": "WILDFIRE", "peak_frp": 89.4},
    {"name": "Gir Forest Peripheral Buffer Hotspot", "state": "Gujarat", "lat": 21.1541, "lon": 70.8145, "class": "WILDFIRE", "peak_frp": 76.2},
    {"name": "Sundarbans Coastal Mudflat Transient Heat", "state": "West Bengal", "lat": 21.9124, "lon": 88.8412, "class": "OTHER_UNCERTAIN", "peak_frp": 34.5}
]

def seed_rich_dataset():
    db = SessionLocal()
    print("=== Clearing Old Seed Data & Resetting High-Confidence Matrix ===")
    db.query(Notification).delete()
    db.query(ThermoNews).delete()
    db.query(EventAnomaly).delete()
    db.query(EventClassification).delete()
    db.query(FacilityBaseline).delete()
    db.query(ThermalEvent).delete()
    db.query(IndustrialFacility).delete()
    db.commit()

    # Ensure deployed ML model exists for FK
    ml_model = db.query(MlModel).filter(MlModel.version == "thermo_xgb_v1.1.0").first()
    if not ml_model:
        ml_model = MlModel(
            id=uuid.uuid4(),
            model_name="ThermoTrace XGBoost Multiclass Classifier",
            version="thermo_xgb_v1.1.0",
            model_type="XGBOOST_CALIBRATED",
            feature_schema_hash="14_DIM_CANONICAL_V1",
            training_dataset_version="v1.1_three_tier",
            macro_f1_score=0.942,
            industrial_precision=0.965,
            artifact_path="data/models/thermo_xgb_v1.1.0.joblib",
            is_deployed=True
        )
        db.add(ml_model)
        db.commit()

    print(f"=== Seeding {len(FACILITIES_SEED)} Verified Major Industrial Facilities Across India ===")
    facility_records = {}
    now = datetime.now(timezone.utc)

    for fac_data in FACILITIES_SEED:
        f_id = uuid.uuid4()
        lat, lon = fac_data["lat"], fac_data["lon"]
        d = 0.02
        poly_wkt = f"SRID=4326;MULTIPOLYGON((({lon-d} {lat-d}, {lon+d} {lat-d}, {lon+d} {lat+d}, {lon-d} {lat+d}, {lon-d} {lat-d})))"
        point_wkt = f"SRID=4326;POINT({lon} {lat})"

        fac = IndustrialFacility(
            id=f_id,
            facility_code=fac_data["code"],
            name=fac_data["name"],
            sector_category=fac_data["sector"],
            state=fac_data["state"],
            facility_geom=poly_wkt,
            centroid=point_wkt,
            latitude=lat,
            longitude=lon,
            baseline_frp_mean=fac_data["mean_frp"],
            metadata_json={
                "operator": fac_data["operator"],
                "std_dev_mw": fac_data["std_frp"],
                "established_baseline_samples": 42
            }
        )
        db.add(fac)
        facility_records[fac_data["code"]] = {
            "id": f_id,
            "obj": fac,
            "data": fac_data
        }

    # Commit facilities first
    db.commit()

    # Add facility baselines
    for fac_data in FACILITIES_SEED:
        f_id = facility_records[fac_data["code"]]["id"]
        base = FacilityBaseline(
            id=uuid.uuid4(),
            facility_id=f_id,
            baseline_window="ROLLING_90D",
            sample_observation_count=42,
            mean_frp_mw=fac_data["mean_frp"],
            std_frp_mw=fac_data["std_frp"],
            median_frp_mw=fac_data["mean_frp"] * 0.95,
            q75_frp_mw=fac_data["mean_frp"] + 0.67 * fac_data["std_frp"],
            q95_frp_mw=fac_data["mean_frp"] + 1.645 * fac_data["std_frp"],
            max_recorded_frp_mw=fac_data["mean_frp"] + 3.0 * fac_data["std_frp"],
            is_statistically_sufficient=True,
            calculated_at=now - timedelta(days=1)
        )
        db.add(base)

    db.commit()

    print("=== Generating Active Industrial & Hotspot Events Across India ===")
    event_counter = 1
    notifications_created = 0
    news_created = 0

    anomaly_presets = [
        {"code": "FAC-GUJ-001", "tier": "CRITICAL", "z": 4.85, "class": "IND_FIRE", "frp_mult": 2.2, "temp_k": 382.4, "hours_ago": 0.4},
        {"code": "FAC-MAH-001", "tier": "CRITICAL", "z": 4.32, "class": "IND_FLARE", "frp_mult": 2.0, "temp_k": 368.1, "hours_ago": 0.8},
        {"code": "FAC-JHK-001", "tier": "CRITICAL", "z": 4.60, "class": "IND_FIRE", "frp_mult": 2.1, "temp_k": 395.0, "hours_ago": 1.2},
        {"code": "FAC-ODI-001", "tier": "CRITICAL", "z": 4.15, "class": "IND_FLARE", "frp_mult": 1.9, "temp_k": 362.5, "hours_ago": 1.5},
        {"code": "FAC-MP-001",  "tier": "CRITICAL", "z": 4.40, "class": "IND_FLARE", "frp_mult": 1.95, "temp_k": 374.0, "hours_ago": 2.0},
        
        {"code": "FAC-GUJ-002", "tier": "ABNORMAL", "z": 3.42, "class": "IND_FLARE", "frp_mult": 1.6, "temp_k": 348.0, "hours_ago": 0.5},
        {"code": "FAC-HAR-001", "tier": "ABNORMAL", "z": 3.10, "class": "IND_FLARE", "frp_mult": 1.52, "temp_k": 342.1, "hours_ago": 1.1},
        {"code": "FAC-ODI-002", "tier": "ABNORMAL", "z": 3.55, "class": "IND_FIRE", "frp_mult": 1.65, "temp_k": 355.4, "hours_ago": 1.8},
        {"code": "FAC-KAR-002", "tier": "ABNORMAL", "z": 3.25, "class": "IND_FLARE", "frp_mult": 1.55, "temp_k": 351.0, "hours_ago": 2.4},
        {"code": "FAC-CG-002",  "tier": "ABNORMAL", "z": 3.60, "class": "IND_FLARE", "frp_mult": 1.62, "temp_k": 346.8, "hours_ago": 3.0},
        {"code": "FAC-TEL-001", "tier": "ABNORMAL", "z": 2.95, "class": "IND_FLARE", "frp_mult": 1.48, "temp_k": 339.5, "hours_ago": 3.6},
        {"code": "FAC-TN-001",  "tier": "ABNORMAL", "z": 3.30, "class": "IND_FLARE", "frp_mult": 1.58, "temp_k": 345.2, "hours_ago": 4.2},
        {"code": "FAC-AP-002",  "tier": "ABNORMAL", "z": 2.85, "class": "IND_FLARE", "frp_mult": 1.44, "temp_k": 338.0, "hours_ago": 4.8},
        
        {"code": "FAC-UP-001",  "tier": "ELEVATED", "z": 2.15, "class": "IND_ROUTINE", "frp_mult": 1.32, "temp_k": 328.4, "hours_ago": 5.5},
        {"code": "FAC-WB-001",  "tier": "ELEVATED", "z": 1.95, "class": "IND_ROUTINE", "frp_mult": 1.28, "temp_k": 325.0, "hours_ago": 6.0},
        {"code": "FAC-AP-001",  "tier": "ELEVATED", "z": 1.80, "class": "IND_ROUTINE", "frp_mult": 1.25, "temp_k": 322.0, "hours_ago": 7.2},
        {"code": "FAC-CG-001",  "tier": "ELEVATED", "z": 2.20, "class": "IND_ROUTINE", "frp_mult": 1.35, "temp_k": 331.0, "hours_ago": 8.0},
        {"code": "FAC-WB-002",  "tier": "ELEVATED", "z": 1.85, "class": "IND_ROUTINE", "frp_mult": 1.26, "temp_k": 324.5, "hours_ago": 9.5},
        {"code": "FAC-MP-002",  "tier": "ELEVATED", "z": 2.05, "class": "IND_ROUTINE", "frp_mult": 1.30, "temp_k": 329.0, "hours_ago": 11.0},
        
        {"code": "FAC-KAR-001", "tier": "NOMINAL", "z": 0.45, "class": "IND_ROUTINE", "frp_mult": 1.05, "temp_k": 315.0, "hours_ago": 12.0},
        {"code": "FAC-ASM-001", "tier": "NOMINAL", "z": -0.20, "class": "IND_ROUTINE", "frp_mult": 0.98, "temp_k": 312.4, "hours_ago": 14.0},
        {"code": "FAC-TN-002",  "tier": "NOMINAL", "z": 0.85, "class": "IND_ROUTINE", "frp_mult": 1.10, "temp_k": 318.0, "hours_ago": 16.0},
        {"code": "FAC-JHK-002", "tier": "NOMINAL", "z": 1.10, "class": "IND_ROUTINE", "frp_mult": 1.15, "temp_k": 320.0, "hours_ago": 18.0},
        {"code": "FAC-ODI-003", "tier": "NOMINAL", "z": 0.60, "class": "IND_ROUTINE", "frp_mult": 1.08, "temp_k": 316.5, "hours_ago": 20.0},
        {"code": "FAC-ODI-004", "tier": "NOMINAL", "z": 0.30, "class": "IND_ROUTINE", "frp_mult": 1.03, "temp_k": 314.0, "hours_ago": 22.0},
        
        {"code": "FAC-GUJ-003", "tier": "BASELINE_INSUFFICIENT", "z": 0.0, "class": "OTHER_UNCERTAIN", "frp_mult": 1.12, "temp_k": 321.0, "hours_ago": 2.5}
    ]

    for item in anomaly_presets:
        fac_rec = facility_records[item["code"]]
        fac_data = fac_rec["data"]
        fac_id = fac_rec["id"]
        
        lat = fac_data["lat"] + random.uniform(-0.002, 0.002)
        lon = fac_data["lon"] + random.uniform(-0.002, 0.002)
        peak_frp = round(fac_data["mean_frp"] * item["frp_mult"], 1)
        mean_frp = round(peak_frp * 0.88, 1)
        
        event_code = f"EVT-IN-{fac_data['state'][:3].upper()}-{event_counter:04X}"
        event_counter += 1
        
        detected_time = now - timedelta(hours=item["hours_ago"])
        
        evt = ThermalEvent(
            id=uuid.uuid4(),
            event_id=event_code,
            centroid=f"SRID=4326;POINT({lon} {lat})",
            boundary_geom=f"SRID=4326;POLYGON(({lon-0.005} {lat-0.005}, {lon+0.005} {lat-0.005}, {lon+0.005} {lat+0.005}, {lon-0.005} {lat+0.005}, {lon-0.005} {lat-0.005}))",
            latitude=lat,
            longitude=lon,
            first_detected_utc=detected_time - timedelta(hours=random.uniform(2, 8)),
            latest_detected_utc=detected_time,
            observation_count=random.randint(12, 35) if item["tier"] != "BASELINE_INSUFFICIENT" else 4,
            peak_frp_mw=peak_frp,
            mean_frp_mw=mean_frp,
            aggregate_frp_mw=round(peak_frp * random.uniform(2.5, 5.0), 1),
            max_brightness_k=item["temp_k"],
            associated_facility_id=fac_id,
            distance_to_facility_m=round(random.uniform(80, 450), 1),
            primary_land_use="Industrial & Energy Infrastructure",
            classification=item["class"],
            classification_confidence=round(random.uniform(0.91, 0.98), 3) if item["class"].startswith("IND_") else 0.72,
            persistence_tier="PERSISTENT" if item["class"] == "IND_ROUTINE" else "EPISODIC",
            anomaly_tier=item["tier"],
            anomaly_z_score=item["z"],
            lifecycle_status="ACTIVE" if item["hours_ago"] < 12 else "RESOLVED"
        )
        db.add(evt)
        db.flush()

        is_suff = item["tier"] != "BASELINE_INSUFFICIENT"
        anom = EventAnomaly(
            id=uuid.uuid4(),
            event_id=evt.id,
            observed_frp_mw=peak_frp,
            baseline_mean_frp_mw=fac_data["mean_frp"] if is_suff else 0.0,
            baseline_std_frp_mw=fac_data["std_frp"] if is_suff else 0.0,
            z_score=item["z"],
            percentile_rank=round(min(99.99, max(50.0, 50.0 + item['z']*12.5)), 2) if is_suff else 50.0,
            anomaly_severity=item["tier"],
            contributing_factors={
                "status": "STATISTICALLY_SUFFICIENT" if is_suff else "INSUFFICIENT_SAMPLE_SIZE",
                "sample_count": 42 if is_suff else 4,
                "hist_days": 28 if is_suff else 3,
                "exceedance_pct": round(min(99.99, max(50.0, 50.0 + item['z']*12.5)), 2) if is_suff else None
            },
            evaluated_at=detected_time
        )
        db.add(anom)

        cls_rec = EventClassification(
            id=uuid.uuid4(),
            event_id=evt.id,
            model_id=ml_model.id,
            predicted_class=item["class"],
            confidence_pct=round(evt.classification_confidence * 100, 1),
            class_probabilities={item["class"]: evt.classification_confidence, "OTHER_UNCERTAIN": round(1.0 - evt.classification_confidence, 3)},
            feature_importances={
                "facility_dist_km": round(random.uniform(0.32, 0.45), 3),
                "peak_frp": round(random.uniform(0.22, 0.35), 3),
                "is_near_facility": 0.20,
                "landcover_class": 0.12
            },
            input_feature_vector={"peak_frp": peak_frp, "mean_frp": mean_frp, "facility_dist_km": 0.25},
            is_current=True,
            classified_at=detected_time
        )
        db.add(cls_rec)

        if item["tier"] in ["CRITICAL", "ABNORMAL"]:
            notif = Notification(
                id=uuid.uuid4(),
                event_id=evt.id,
                title=f"Industrial Thermal Anomaly: {item['tier']} at {fac_data['name']}",
                message=f"Satellite sensors detected extreme thermal radiance of {peak_frp} MW (Z-score: +{item['z']:.2f}σ) near {fac_data['name']}, {fac_data['state']}. Multi-class classifier tagged as {item['class']}.",
                severity=item["tier"],
                is_read=False,
                created_at=detected_time
            )
            db.add(notif)
            notifications_created += 1

        if item["hours_ago"] <= 24:
            news_title = f"{item['tier']} Thermal Spike Detected at {fac_data['name']}" if item["tier"] in ["CRITICAL", "ABNORMAL"] else f"Routine Operational Thermal Profile at {fac_data['name']}"
            news_body = f"VIIRS/MODIS satellites recorded {peak_frp} MW radiative heat output ({item['temp_k']} K) in {fac_data['state']}. Classified as {item['class']} with {int(evt.classification_confidence*100)}% statistical confidence."
            
            news_item = ThermoNews(
                id=uuid.uuid4(),
                event_id=evt.id,
                headline=news_title,
                summary=news_body,
                severity_tag=item["tier"],
                published_at=detected_time
            )
            db.add(news_item)
            news_created += 1

    print("=== Seeding Regional Agricultural & Wildfire Hotspots ===")
    for ag in AGRICULTURAL_AND_FOREST_ZONES:
        lat, lon = ag["lat"], ag["lon"]
        event_code = f"EVT-IN-{ag['state'][:3].upper()}-{event_counter:04X}"
        event_counter += 1
        hours_ago = random.uniform(1.0, 18.0)
        detected_time = now - timedelta(hours=hours_ago)

        tier = "ABNORMAL" if ag["peak_frp"] > 80.0 else "NORMAL"
        z_val = 2.85 if ag["peak_frp"] > 80.0 else 1.10

        evt = ThermalEvent(
            id=uuid.uuid4(),
            event_id=event_code,
            centroid=f"SRID=4326;POINT({lon} {lat})",
            boundary_geom=f"SRID=4326;POLYGON(({lon-0.008} {lat-0.008}, {lon+0.008} {lat-0.008}, {lon+0.008} {lat+0.008}, {lon-0.008} {lat+0.008}, {lon-0.008} {lat-0.008}))",
            latitude=lat,
            longitude=lon,
            first_detected_utc=detected_time - timedelta(hours=random.uniform(1, 4)),
            latest_detected_utc=detected_time,
            observation_count=random.randint(6, 18),
            peak_frp_mw=ag["peak_frp"],
            mean_frp_mw=round(ag["peak_frp"] * 0.85, 1),
            aggregate_frp_mw=round(ag["peak_frp"] * random.uniform(2.0, 3.5), 1),
            max_brightness_k=round(315.0 + ag["peak_frp"] * 0.35, 1),
            associated_facility_id=None,
            distance_to_facility_m=None,
            primary_land_use="Agricultural Cropland" if ag["class"] == "AGRI_BURN" else "Protected Forest Reserve",
            classification=ag["class"],
            classification_confidence=round(random.uniform(0.88, 0.96), 3),
            persistence_tier="TRANSIENT",
            anomaly_tier=tier,
            anomaly_z_score=z_val,
            lifecycle_status="ACTIVE" if hours_ago < 10 else "RESOLVED"
        )
        db.add(evt)
        db.flush()

        anom = EventAnomaly(
            id=uuid.uuid4(),
            event_id=evt.id,
            observed_frp_mw=ag["peak_frp"],
            baseline_mean_frp_mw=0.0,
            baseline_std_frp_mw=0.0,
            z_score=z_val,
            percentile_rank=85.0 if tier == "ABNORMAL" else 50.0,
            anomaly_severity=tier,
            contributing_factors={"status": "REGIONAL_NON_INDUSTRIAL_HOTSPOT"},
            evaluated_at=detected_time
        )
        db.add(anom)

        cls_rec = EventClassification(
            id=uuid.uuid4(),
            event_id=evt.id,
            model_id=ml_model.id,
            predicted_class=ag["class"],
            confidence_pct=round(evt.classification_confidence * 100, 1),
            class_probabilities={ag["class"]: evt.classification_confidence, "OTHER_UNCERTAIN": round(1.0 - evt.classification_confidence, 3)},
            feature_importances={
                "facility_dist_km": 0.05,
                "peak_frp": 0.40,
                "is_near_facility": 0.0,
                "landcover_class": 0.35
            },
            input_feature_vector={"peak_frp": ag["peak_frp"], "landcover_class": 40},
            is_current=True,
            classified_at=detected_time
        )
        db.add(cls_rec)

        if tier == "ABNORMAL":
            notif = Notification(
                id=uuid.uuid4(),
                event_id=evt.id,
                title=f"Non-Industrial Hotspot Alert: {ag['name']}",
                message=f"Regional satellite scan identified high-intensity {ag['class']} combustion releasing {ag['peak_frp']} MW in {ag['state']}.",
                severity="ABNORMAL",
                is_read=False,
                created_at=detected_time
            )
            db.add(notif)
            notifications_created += 1

        news_item = ThermoNews(
            id=uuid.uuid4(),
            event_id=evt.id,
            headline=f"Vegetation / Crop Combustion Detected in {ag['state']}",
            summary=f"FIRMS sensors identified active {ag['class']} hotspot at {ag['name']} with peak radiance of {ag['peak_frp']} MW.",
            severity_tag=evt.anomaly_tier,
            published_at=detected_time
        )
        db.add(news_item)
        news_created += 1

    db.commit()
    print(f"=== Successfully Seeded Dataset! ===")
    print(f"Total Facilities: {len(FACILITIES_SEED)}")
    print(f"Total Events: {event_counter - 1}")
    print(f"Total Operational Alerts (Critical & Abnormal): {notifications_created}")
    print(f"Total Thermo News Bulletins (24h): {news_created}")

if __name__ == "__main__":
    seed_rich_dataset()
