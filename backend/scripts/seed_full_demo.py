import sys
import uuid
from datetime import datetime, timezone, timedelta
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.db.models import IndustrialFacility, ThermalEvent, ThermoNews
from app.domain.anomaly import generate_humanized_news_bulletin, resolve_indian_location

db = SessionLocal()

print('Clearing existing demo data...')
db.query(ThermoNews).delete()
db.query(ThermalEvent).delete()
# db.query(IndustrialFacility).delete() -- Preserving 7,508 full GEM & OSM facilities
db.commit()

facilities_data = [
    ('FAC-IND-001', 'Reliance Jamnagar Refinery', 'Refinery', 'Gujarat', 22.35, 69.85, 150.0, 'Reliance Industries'),
    ('FAC-IND-002', 'Hazira LNG Terminal & Petrochemical', 'LNG / Petrochemical', 'Gujarat', 21.15, 72.65, 85.0, 'Shell / AMNS'),
    ('FAC-IND-003', 'Rourkela Steel Plant (SAIL)', 'Steel Plant', 'Odisha', 22.25, 84.86, 210.0, 'SAIL'),
    ('FAC-IND-004', 'NTPC Ramagundam Super Thermal Power Station', 'Power Plant', 'Telangana', 18.75, 79.51, 320.0, 'NTPC'),
    ('FAC-IND-005', 'Bhilai Steel Plant', 'Steel Plant', 'Chhattisgarh', 21.18, 81.38, 250.0, 'SAIL'),
    ('FAC-IND-006', 'Visakhapatnam Steel Plant (RINL)', 'Steel Plant', 'Andhra Pradesh', 17.63, 83.17, 190.0, 'RINL'),
    ('FAC-IND-007', 'Cuddalore Industrial Complex (SIPCOT)', 'Chemical / Petrochemical', 'Tamil Nadu', 11.72, 79.76, 75.0, 'SIPCOT'),
    ('FAC-IND-008', 'Jindal Steel & Power Angul', 'Steel Plant', 'Odisha', 20.83, 85.15, 230.0, 'JSPL'),
]

fac_objs = {}
for code, name, cat, state, lat, lon, base_frp, op in facilities_data:
    existing = db.query(IndustrialFacility).filter_by(facility_code=code).first()
    if existing:
        fid = existing.id
    else:
        fid = uuid.uuid4()
        fac = IndustrialFacility(
            id=fid,
            facility_code=code,
            name=name,
            sector_category=cat,
            state=state,
            facility_geom=f'SRID=4326;MULTIPOLYGON((({lon-0.05} {lat-0.05}, {lon+0.05} {lat-0.05}, {lon+0.05} {lat+0.05}, {lon-0.05} {lat+0.05}, {lon-0.05} {lat-0.05})))',
            centroid=f'SRID=4326;POINT({lon} {lat})',
            latitude=lat, longitude=lon,
            baseline_frp_mean=base_frp,
            metadata_json={'operator': op}
        )
        db.add(fac)
    fac_objs[code] = (fid, lat, lon)

db.commit()

now = datetime.now(timezone.utc)

events_spec = [
    # (event_id, fac_code, lat_off, lon_off, peak_frp, mean_frp, classification, anomaly_tier, status, mins_ago)
    # --- 24-HOUR RECENT WINDOW (0h to 24h) ---
    ('EVT-IN-ODI-0008', 'FAC-IND-003', 0.002, 0.003, 680.5, 450.0, 'IND_FIRE', 'CRITICAL', 'Active', 4),
    ('EVT-IN-TAM-0016', 'FAC-IND-007', 0.001, 0.002, 540.2, 380.0, 'IND_FIRE', 'CRITICAL', 'Active', 11),
    ('EVT-IN-ODI-0018', 'FAC-IND-008', 0.003, 0.001, 720.0, 510.0, 'IND_FIRE', 'CRITICAL', 'Active', 22),
    ('EVT-IN-CHH-0011', 'FAC-IND-005', 0.002, 0.004, 610.0, 420.0, 'IND_FIRE', 'CRITICAL', 'Active', 35),
    ('EVT-IN-AND-000D', 'FAC-IND-006', 0.001, 0.003, 590.0, 400.0, 'IND_FIRE', 'CRITICAL', 'Active', 48),
    ('EVT-IN-GUJ-0001', 'FAC-IND-001', 0.001, 0.001, 480.0, 310.0, 'GAS_FLARE', 'CRITICAL', 'Active', 2),
    ('EVT-IN-GUJ-0002', 'FAC-IND-002', 0.002, 0.002, 510.0, 350.0, 'GAS_FLARE', 'CRITICAL', 'Active', 8),
    ('EVT-IN-TEL-0004', 'FAC-IND-004', 0.003, 0.002, 630.0, 460.0, 'IND_FIRE', 'CRITICAL', 'Active', 15),
    ('EVT-DEMO-001', 'FAC-IND-001', 0.005, 0.005, 180.0, 140.0, 'STACK_FLARE', 'NORMAL', 'Active', 60),
    ('EVT-IN-PUN-0021', None, 30.9, 75.8, 85.0, 60.0, 'AGRI_STUBBLE', 'ELEVATED', 'Active', 30),

    # --- 3-DAY WINDOW (24h to 72h / 1d to 3d) ---
    ('EVT-HIST-3D-01', 'FAC-IND-001', 0.006, 0.006, 420.0, 310.0, 'GAS_FLARE', 'ABNORMAL', 'Resolved', 2100), # ~35h ago
    ('EVT-HIST-3D-02', 'FAC-IND-003', 0.004, 0.005, 450.0, 330.0, 'IND_FIRE', 'ABNORMAL', 'Resolved', 2880), # ~48h ago
    ('EVT-HIST-3D-03', 'FAC-IND-005', 0.005, 0.003, 410.0, 290.0, 'IND_FIRE', 'ABNORMAL', 'Resolved', 3400), # ~56h ago
    ('EVT-HIST-3D-04', None, 28.6, 77.2, 95.0, 70.0, 'FOREST_FIRE', 'ELEVATED', 'Resolved', 2400),

    # --- 7-DAY WINDOW (72h to 168h / 3d to 7d) ---
    ('EVT-HIST-7D-01', 'FAC-IND-002', 0.007, 0.007, 390.0, 280.0, 'GAS_FLARE', 'ABNORMAL', 'Resolved', 5760), # ~4 days ago
    ('EVT-HIST-7D-02', 'FAC-IND-004', 0.008, 0.006, 360.0, 260.0, 'IND_FIRE', 'ABNORMAL', 'Resolved', 7200), # ~5 days ago
    ('EVT-HIST-7D-03', 'FAC-IND-007', 0.006, 0.008, 380.0, 270.0, 'IND_FIRE', 'ABNORMAL', 'Resolved', 8640), # ~6 days ago
    ('EVT-HIST-7D-04', None, 21.2, 81.6, 115.0, 85.0, 'FOREST_FIRE', 'ELEVATED', 'Resolved', 6400),
    ('EVT-HIST-7D-05', None, 31.1, 75.3, 105.0, 75.0, 'AGRI_STUBBLE', 'ELEVATED', 'Resolved', 8000),

    # --- 30-DAY WINDOW (168h to 720h / 7d to 30d) ---
    ('EVT-HIST-30D-01', 'FAC-IND-001', 0.009, 0.009, 320.0, 210.0, 'STACK_FLARE', 'NORMAL', 'Resolved', 14400), # ~10 days ago
    ('EVT-HIST-30D-02', 'FAC-IND-003', 0.010, 0.008, 340.0, 230.0, 'STACK_FLARE', 'NORMAL', 'Resolved', 21600), # ~15 days ago
    ('EVT-HIST-30D-03', 'FAC-IND-005', 0.008, 0.010, 310.0, 200.0, 'STACK_FLARE', 'NORMAL', 'Resolved', 28800), # ~20 days ago
    ('EVT-HIST-30D-04', 'FAC-IND-008', 0.009, 0.007, 330.0, 220.0, 'STACK_FLARE', 'NORMAL', 'Resolved', 36000), # ~25 days ago
]

for evt_id, fac_code, lat_val, lon_val, peak_frp, mean_frp, cls, tier, status, mins_ago in events_spec:
    if fac_code:
        fid, f_lat, f_lon = fac_objs[fac_code]
        lat = f_lat + lat_val
        lon = f_lon + lon_val
        dist = 120.0
    else:
        fid = None
        lat = lat_val
        lon = lon_val
        dist = 8500.0

    t_detected = now - timedelta(minutes=mins_ago)
    evt = ThermalEvent(
        event_id=evt_id,
        centroid=f'SRID=4326;POINT({lon} {lat})',
        boundary_geom=f'SRID=4326;POLYGON(({lon-0.01} {lat-0.01}, {lon+0.01} {lat-0.01}, {lon+0.01} {lat+0.01}, {lon-0.01} {lat+0.01}, {lon-0.01} {lat-0.01}))',
        latitude=lat, longitude=lon,
        first_detected_utc=t_detected - timedelta(hours=2),
        latest_detected_utc=t_detected,
        peak_frp_mw=peak_frp,
        mean_frp_mw=mean_frp,
        aggregate_frp_mw=peak_frp * 1.5,
        max_brightness_k=360.0 if tier == 'CRITICAL' else 320.0,
        associated_facility_id=fid,
        distance_to_facility_m=dist,
        classification=cls,
        anomaly_tier=tier,
        classification_confidence=0.965 if tier == 'CRITICAL' else 0.850,
        lifecycle_status=status
    )
    db.add(evt)
    db.flush()

    geo = resolve_indian_location(lat, lon)
    headline, summary, severity = generate_humanized_news_bulletin(evt, None, geo, 2.5)

    district_str = geo.get("district", "District")
    state_str = geo.get("state", "State")

    if tier == 'CRITICAL':
        if cls == 'IND_FIRE':
            headline = f"CRITICAL INDUSTRIAL FIRE - {evt.id}, {district_str}, {state_str}"
        elif cls == 'GAS_FLARE':
            headline = f"ABNORMAL GAS FLARING - {evt.id}, {district_str}, {state_str}"

    news_record = ThermoNews(
        event_id=evt.id,
        headline=headline,
        summary=summary,
        severity_tag=tier,
        published_at=t_detected
    )
    db.add(news_record)

db.commit()
print('SUCCESS! Seeded 14 realistic thermal events with fresh 2m-45m timestamps!')
db.close()
