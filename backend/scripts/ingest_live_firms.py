import os
import sys
import time
import uuid
import hashlib
import requests
import io
import pandas as pd
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

sys.path.insert(0, 'backend')
from app.db.database import SessionLocal
from app.db.models import ThermalObservation, ThermalEvent, IngestionJob
from app.domain.sovereign_geofencing import is_within_sovereign_india
from app.domain.firms_poller import compute_dedup_key
from app.domain.event_formation import form_events_from_observations
from app.domain.anomaly import process_event_intelligence

FIRMS_API_KEY = "5ee48ea9900661577c1dc26dfcc70550"
INDIA_BBOX = "68,6,97,37"
SUPPORTED_SENSORS = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT",
    "MODIS_NRT"
]

def ingest_live_firms():
    t0 = time.time()
    session = SessionLocal()
    now = datetime.now(timezone.utc)
    print(f"[{now.isoformat()}] Polling real-time NASA FIRMS satellite data for India...")

    total_received = 0
    all_rows = []

    for sensor in SUPPORTED_SENSORS:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_API_KEY}/{sensor}/{INDIA_BBOX}/2"
        try:
            resp = requests.get(url, timeout=20)
            if resp.status_code == 200 and not resp.text.startswith("Invalid"):
                df = pd.read_csv(io.StringIO(resp.text))
                print(f"  {sensor}: received {len(df)} records")
                total_received += len(df)
                for _, row in df.iterrows():
                    all_rows.append((sensor, row))
        except Exception as e:
            print(f"  Error fetching {sensor}: {e}")

    print(f"Total telemetry records fetched: {len(all_rows)} in {time.time() - t0:.2f}s")
    
    batch_values = []
    for sensor, row in all_rows:
        try:
            lat = float(row['latitude'])
            lon = float(row['longitude'])
            if not is_within_sovereign_india(lat, lon):
                continue
            frp = float(row.get('frp', 1.0))
            bright = float(row.get('bright_ti4', row.get('brightness', 300.0)))
            acq_date_str = str(row['acq_date'])
            acq_time_str = str(row['acq_time']).zfill(4)
            acq_date = datetime.strptime(acq_date_str, '%Y-%m-%d').date()
            acq_time = datetime.strptime(acq_time_str, '%H%M').time()
            obs_dt = datetime.combine(acq_date, acq_time).replace(tzinfo=timezone.utc)
            sat_name = str(row.get('satellite', sensor.split('_')[1] if '_' in sensor else sensor))
            day_night = str(row.get('daynight', 'D'))
            dedup_key = compute_dedup_key(lat, lon, acq_date_str, acq_time_str, sat_name)

            batch_values.append({
                "dedup_key": dedup_key,
                "geom": f"SRID=4326;POINT({lon} {lat})",
                "latitude": lat,
                "longitude": lon,
                "brightness_temp_k": bright,
                "frp_mw": frp,
                "acq_date": acq_date,
                "acq_time_utc": acq_time,
                "observation_timestamp_utc": obs_dt,
                "satellite_sensor": sat_name,
                "confidence_level": str(row.get('confidence', 'nominal')),
                "day_night": day_night,
                "source_product": 'FIRMS_NRT',
                "raw_metadata": {}
            })
        except Exception:
            continue

    print(f"Valid sovereign Indian observations to insert/update: {len(batch_values)}")
    inserted = 0
    for i in range(0, len(batch_values), 500):
        chunk = batch_values[i:i+500]
        stmt = insert(ThermalObservation).values(chunk).on_conflict_do_nothing(index_elements=['dedup_key'])
        res = session.execute(stmt)
        inserted += res.rowcount
        session.commit()

    print(f"Successfully inserted {inserted} new observations in {time.time() - t0:.2f}s!")

    # Record IngestionJob
    duration_ms = max(1, int((time.time() - t0) * 1000))
    job = IngestionJob(
        id=uuid.uuid4(),
        source_feed="FIRMS_INDIA_MULTI_SENSOR",
        status="SUCCESS",
        records_received=total_received,
        records_inserted=inserted,
        records_duplicated=len(batch_values) - inserted,
        time_window_start=now - timedelta(days=2),
        time_window_end=now,
        execution_duration_ms=duration_ms,
        executed_at=now
    )
    session.add(job)
    session.commit()

    # Form/update events
    print("Running ST-DBSCAN spatio-temporal clustering and facility association...")
    evts_count = form_events_from_observations(session, lookback_days=3)
    print(f"Active thermal events updated/formed: {evts_count}")

    # Process intelligence for active events
    print("Refreshing calibrated ML intelligence and Thermo News bulletins...")
    recent_events = (
        session.query(ThermalEvent)
        .filter(ThermalEvent.lifecycle_status != "CLOSED")
        .order_by(ThermalEvent.latest_detected_utc.desc())
        .limit(100)
        .all()
    )
    for ev in recent_events:
        process_event_intelligence(session, ev.event_id)

    print(f"ALL DONE in {time.time() - t0:.2f}s!")
    session.close()

if __name__ == "__main__":
    ingest_live_firms()
