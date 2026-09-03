"""
Phase 8: NASA FIRMS Foreground-Triggered Poller & Ingestion Engine
Handles polar-orbiting satellite cadence, dynamic day_range gap recovery,
idempotent deduplication, and ingestion-time spatial filtering.
"""
import os
import sys
import hashlib
import requests
import pandas as pd
from io import StringIO
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import insert

sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.db.models import ThermalObservation, ThermalEvent, IndustrialFacility, EventObservation, IngestionJob
from app.domain.clustering import run_st_dbscan
from app.domain.anomaly import process_event_intelligence
from app.domain.sovereign_geofencing import is_within_sovereign_india

FIRMS_API_KEY = os.getenv("FIRMS_MAP_KEY", "5ee48ea9900661577c1dc26dfcc70550").strip('"')
INDIA_BBOX = "68,6,97,37"

SUPPORTED_SENSORS = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT",
    "MODIS_NRT"
]

LAST_POLL_TIMESTAMP = None

def compute_dedup_key(lat: float, lon: float, acq_date: str, acq_time: str, sensor: str) -> str:
    """Computes a deterministic SHA-256 deduplication key for a satellite observation with 4-decimal rounding."""
    r_lat = round(float(lat), 4)
    r_lon = round(float(lon), 4)
    raw = f"{r_lat:.4f}_{r_lon:.4f}_{str(acq_date)}_{str(acq_time)}_{str(sensor)}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def calculate_dynamic_day_range(session: Session) -> int:
    """
    Computes day_range based on gap since latest observation in database.
    Clamps between 2 and 5 days (minimum 2 days ensures rolling 24-48h passes are always retrieved).
    """
    latest_ts = session.query(func.max(ThermalObservation.observation_timestamp_utc)).scalar()
    if latest_ts is None:
        return 5
        
    now = datetime.now(timezone.utc)
    if latest_ts.tzinfo is None:
        latest_ts = latest_ts.replace(tzinfo=timezone.utc)
        
    gap_seconds = (now - latest_ts).total_seconds()
    gap_days = int(gap_seconds / 86400) + 1
    # Minimum 2 days ensures polar orbiting passes over India are captured across the rolling 24-48h window
    return max(2, min(5, gap_days))

def fetch_sensor_telemetry(sensor: str, day_range: int) -> pd.DataFrame:
    """Fetches satellite telemetry for Indian bounding box."""
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_API_KEY}/{sensor}/{INDIA_BBOX}/{day_range}"
    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code == 200 and not resp.text.startswith("Invalid"):
            df = pd.read_csv(StringIO(resp.text))
            return df
    except Exception as e:
        print(f"Error fetching sensor {sensor}: {e}")
    return pd.DataFrame()

def poll_firms_foreground_cycle(session: Session, force: bool = False) -> Dict[str, Any]:
    """
    Executes a foreground-triggered polling cycle.
    Rate-limited to 90 seconds unless forced.
    """
    global LAST_POLL_TIMESTAMP
    now = datetime.now(timezone.utc)
    
    if not force and LAST_POLL_TIMESTAMP is not None:
        elapsed = (now - LAST_POLL_TIMESTAMP).total_seconds()
        if elapsed < 90:
            return {
                "status": "THROTTLED",
                "message": f"Polar satellite overpass interval active ({int(elapsed)}s since last poll). Min cadence: 90s.",
                "inserted_count": 0,
                "duplicated_count": 0
            }
            
    LAST_POLL_TIMESTAMP = now
    day_range = calculate_dynamic_day_range(session)
    
    total_received = 0
    total_inserted = 0
    total_duplicated = 0
    
    for sensor in SUPPORTED_SENSORS:
        df = fetch_sensor_telemetry(sensor, day_range)
        if df.empty:
            continue
            
        total_received += len(df)
        
        for _, row in df.iterrows():
            try:
                lat = float(row['latitude'])
                lon = float(row['longitude'])
                
                # Sovereign Point-in-Polygon First Gate: Exclude all foreign transboundary or oceanic points
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
                
                stmt = insert(ThermalObservation).values(
                    dedup_key=dedup_key,
                    geom=f"SRID=4326;POINT({lon} {lat})",
                    latitude=lat,
                    longitude=lon,
                    brightness_temp_k=bright,
                    frp_mw=frp,
                    acq_date=acq_date,
                    acq_time_utc=acq_time,
                    observation_timestamp_utc=obs_dt,
                    satellite_sensor=sat_name,
                    confidence_level=str(row.get('confidence', 'nominal')),
                    day_night=day_night,
                    source_product='FIRMS_NRT',
                    raw_metadata=row.to_dict()
                ).on_conflict_do_nothing(index_elements=['dedup_key'])
                
                try:
                    with session.begin_nested():
                        res = session.execute(stmt)
                        if res.rowcount > 0:
                            total_inserted += 1
                        else:
                            total_duplicated += 1
                except Exception:
                    session.rollback()
                    continue
            except Exception:
                session.rollback()
                continue
                
    # Record IngestionJob to persist accurate last updated timestamp
    duration_ms = max(1, int((time.time() - (t_start if 't_start' in locals() else time.time())) * 1000))
    try:
        job = IngestionJob(
            id=uuid.uuid4(),
            source_feed="FIRMS_INDIA_MULTI_SENSOR",
            status="SUCCESS",
            records_received=total_received,
            records_inserted=total_inserted,
            records_duplicated=total_duplicated,
            time_window_start=now - timedelta(days=day_range),
            time_window_end=now,
            execution_duration_ms=duration_ms,
            executed_at=now,
        )
        session.add(job)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error persisting IngestionJob via ORM: {e}")
        try:
            session.execute(text("""
                INSERT INTO ingestion_jobs (id, source_feed, time_window_start, time_window_end, records_received, records_inserted, records_duplicated, status, execution_duration_ms, executed_at)
                VALUES (:id, :source_feed, :tw_start, :tw_end, :rcv, :ins, :dup, :status, :duration_ms, :executed_at)
            """), {
                "id": uuid.uuid4(),
                "source_feed": "FIRMS_INDIA_MULTI_SENSOR",
                "tw_start": now - timedelta(days=day_range),
                "tw_end": now,
                "rcv": total_received,
                "ins": total_inserted,
                "dup": total_duplicated,
                "status": "SUCCESS",
                "duration_ms": duration_ms,
                "executed_at": now
            })
            session.commit()
        except Exception as err2:
            print(f"Notice: could not record to ingestion_jobs table: {err2}")

    # Trigger event clustering & intelligence pipeline if new observations were ingested
    new_events = 0
    if total_inserted > 0:
        try:
            from app.domain.event_formation import form_events_from_observations
            new_events = form_events_from_observations(session, lookback_days=7)
        except Exception as e:
            print(f"Error during event formation in poller: {e}")

    # Refresh top active Thermo News bulletins with latest telemetry
    try:
        from app.domain.anomaly import process_event_intelligence
        recent_events = (
            session.query(ThermalEvent)
            .filter(ThermalEvent.lifecycle_status != "CLOSED")
            .order_by(ThermalEvent.latest_detected_utc.desc())
            .limit(25)
            .all()
        )
        for ev in recent_events:
            process_event_intelligence(session, ev.event_id)
    except Exception as e:
        pass

    return {
        "status": "SUCCESS",
        "day_range_polled": day_range,
        "total_received": total_received,
        "inserted_count": total_inserted,
        "duplicated_count": total_duplicated,
        "new_events_formed": new_events,
        "poll_timestamp_utc": now.isoformat()
    }

def get_last_poll_info(session: Session) -> Dict[str, Any]:
    """Retrieves metadata of the most recent NASA FIRMS ingestion poll."""
    global LAST_POLL_TIMESTAMP
    try:
        job = (
            session.query(IngestionJob)
            .order_by(IngestionJob.executed_at.desc())
            .first()
        )
        if job and job.executed_at:
            return {
                "last_polled_at": job.executed_at.isoformat(),
                "records_received": job.records_received,
                "records_inserted": job.records_inserted,
                "status": job.status
            }
    except Exception:
        pass
    
    ts = LAST_POLL_TIMESTAMP or datetime.now(timezone.utc)
    return {
        "last_polled_at": ts.isoformat() if hasattr(ts, 'isoformat') else str(ts),
        "records_received": 0,
        "records_inserted": 0,
        "status": "SUCCESS"
    }

def fetch_firms_telemetry_for_facility_area(session: Session, lat: float, lon: float, day_range: int = 5) -> int:
    """
    On-Demand FIRMS Telemetry Fetch for a specific facility's perimeter.
    Queries NASA FIRMS Area API around the facility coordinates (+/- 0.15 deg),
    ingests any new observations, and triggers ST-DBSCAN formation.
    """
    min_lon = max(68.0, lon - 0.15)
    max_lon = min(97.0, lon + 0.15)
    min_lat = max(6.0, lat - 0.15)
    max_lat = min(37.0, lat + 0.15)
    facility_bbox = f"{min_lon:.2f},{min_lat:.2f},{max_lon:.2f},{max_lat:.2f}"

    inserted = 0
    for sensor in ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_API_KEY}/{sensor}/{facility_bbox}/{day_range}"
        try:
            resp = requests.get(url, timeout=12)
            if resp.status_code == 200 and not resp.text.startswith("Invalid") and len(resp.text.strip().splitlines()) > 1:
                df = pd.read_csv(StringIO(resp.text))
                for _, row in df.iterrows():
                    r_lat = float(row['latitude'])
                    r_lon = float(row['longitude'])
                    if not is_within_sovereign_india(r_lat, r_lon):
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
                    dedup_key = compute_dedup_key(r_lat, r_lon, acq_date_str, acq_time_str, sat_name)

                    stmt = insert(ThermalObservation).values(
                        dedup_key=dedup_key,
                        geom=f"SRID=4326;POINT({r_lon} {r_lat})",
                        latitude=r_lat,
                        longitude=r_lon,
                        brightness_temp_k=bright,
                        frp_mw=frp,
                        acq_date=acq_date,
                        acq_time_utc=acq_time,
                        observation_timestamp_utc=obs_dt,
                        satellite_sensor=sat_name,
                        confidence_level=str(row.get('confidence', 'nominal')),
                        day_night=day_night,
                        source_product='FIRMS_ON_DEMAND',
                        raw_metadata=row.to_dict()
                    ).on_conflict_do_nothing(index_elements=['dedup_key'])

                    try:
                        with session.begin_nested():
                            res = session.execute(stmt)
                            if res.rowcount > 0:
                                inserted += 1
                    except Exception:
                        session.rollback()
                        continue
        except Exception as e:
            print(f"[ON-DEMAND FIRMS ERROR] {sensor}: {e}")
            continue

    if inserted > 0:
        try:
            session.commit()
            from app.domain.event_formation import form_events_from_observations
            form_events_from_observations(session)
        except Exception:
            session.rollback()

    return inserted
