"""
Phase 8: NASA FIRMS Foreground-Triggered Poller & Ingestion Engine
Handles polar-orbiting satellite cadence, dynamic day_range gap recovery,
idempotent deduplication, and ingestion-time spatial filtering.
"""
import os
import sys
import time
import uuid
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

# Explicit server-side credential configuration only (no embedded fallback keys)
FIRMS_API_KEY = (os.getenv("FIRMS_MAP_KEY") or "").strip().strip('"')
INDIA_BBOX = "68,6,97,37"

SUPPORTED_SENSORS = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT",
    "MODIS_NRT"
]

LAST_POLL_TIMESTAMP = None
POLL_INTERVAL_MINUTES = max(1, int(os.getenv("FIRMS_POLL_INTERVAL_MINUTES", "60")))
POLL_INTERVAL_SECONDS = POLL_INTERVAL_MINUTES * 60

# Track per-sensor telemetry across poll cycles
SENSOR_TELEMETRY: Dict[str, Dict[str, Any]] = {
    s: {
        "sensor": s,
        "last_attempt_utc": None,
        "last_success_utc": None,
        "latest_observation_utc": None,
        "returned_count": 0,
        "accepted_count": 0,
        "duplicate_count": 0,
        "rejected_count": 0,
        "status": "IDLE",
        "error_message": None
    }
    for s in SUPPORTED_SENSORS
}

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
    return max(2, min(5, gap_days))

def fetch_sensor_telemetry(sensor: str, day_range: int) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Fetches satellite telemetry for Indian bounding box with per-sensor diagnostics.
    Returns (DataFrame, telemetry_dict).
    """
    global SENSOR_TELEMETRY
    now_utc = datetime.now(timezone.utc)
    meta = SENSOR_TELEMETRY.get(sensor, {
        "sensor": sensor,
        "last_attempt_utc": None,
        "last_success_utc": None,
        "latest_observation_utc": None,
        "returned_count": 0,
        "accepted_count": 0,
        "duplicate_count": 0,
        "rejected_count": 0,
        "status": "UNKNOWN",
        "error_message": None
    })
    meta["last_attempt_utc"] = now_utc.isoformat()

    if not FIRMS_API_KEY:
        meta["status"] = "CONFIG_MISSING"
        meta["error_message"] = "FIRMS_MAP_KEY environment variable is not configured on server."
        print(f"[FIRMS CONFIG] {meta['error_message']}")
        return pd.DataFrame(), meta

    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_API_KEY}/{sensor}/{INDIA_BBOX}/{day_range}"
    try:
        resp = requests.get(url, timeout=25)
        if resp.status_code == 200:
            text_content = resp.text.strip()
            if text_content.startswith("Invalid"):
                meta["status"] = "INVALID_KEY"
                meta["error_message"] = "NASA FIRMS reported Invalid MAP_KEY credential."
                print(f"[FIRMS API ERROR] {sensor}: Invalid MAP_KEY")
                return pd.DataFrame(), meta
            elif text_content.startswith("No data") or not text_content:
                meta["status"] = "NO_DATA"
                meta["last_success_utc"] = now_utc.isoformat()
                meta["returned_count"] = 0
                meta["error_message"] = None
                return pd.DataFrame(), meta

            df = pd.read_csv(StringIO(resp.text))
            required_cols = {'latitude', 'longitude', 'acq_date', 'acq_time'}
            if not required_cols.issubset(df.columns):
                meta["status"] = "MALFORMED_CSV"
                meta["error_message"] = f"Missing required CSV columns: {required_cols - set(df.columns)}"
                return pd.DataFrame(), meta

            meta["status"] = "SUCCESS"
            meta["last_success_utc"] = now_utc.isoformat()
            meta["returned_count"] = len(df)
            meta["error_message"] = None
            return df, meta
        else:
            meta["status"] = f"HTTP_{resp.status_code}"
            meta["error_message"] = f"NASA FIRMS API returned HTTP {resp.status_code}"
            print(f"[FIRMS HTTP ERROR] {sensor}: HTTP {resp.status_code}")
            return pd.DataFrame(), meta
    except requests.exceptions.Timeout:
        meta["status"] = "TIMEOUT"
        meta["error_message"] = "NASA FIRMS API request timed out (25s)"
        print(f"[FIRMS TIMEOUT] {sensor}: Network timeout")
        return pd.DataFrame(), meta
    except Exception as e:
        meta["status"] = "ERROR"
        meta["error_message"] = str(e)
        print(f"[FIRMS ERROR] {sensor}: {e}")
        return pd.DataFrame(), meta

def poll_firms_foreground_cycle(session: Session, force: bool = False) -> Dict[str, Any]:
    """
    Executes an optimized 60-minute cadence polling cycle with transaction savepoint isolation.
    """
    global LAST_POLL_TIMESTAMP, SENSOR_TELEMETRY
    t_start = time.time()
    now = datetime.now(timezone.utc)
    
    if not force and LAST_POLL_TIMESTAMP is not None:
        elapsed = (now - LAST_POLL_TIMESTAMP).total_seconds()
        if elapsed < POLL_INTERVAL_SECONDS:
            return {
                "status": "THROTTLED",
                "message": f"Polling cadence active ({int(elapsed)}s elapsed since last poll). Next poll in {int(POLL_INTERVAL_SECONDS - elapsed)}s.",
                "inserted_count": 0,
                "duplicated_count": 0,
                "new_events_formed": 0
            }
            
    LAST_POLL_TIMESTAMP = now
    day_range = calculate_dynamic_day_range(session)
    
    total_received = 0
    total_inserted = 0
    total_duplicated = 0
    total_rejected = 0
    sensor_statuses = []

    for sensor in SUPPORTED_SENSORS:
        df, meta = fetch_sensor_telemetry(sensor, day_range)
        total_received += len(df)
        SENSOR_TELEMETRY[sensor] = meta
        sensor_statuses.append(meta["status"])

        sensor_inserted = 0
        sensor_duplicated = 0
        sensor_rejected = 0
        sensor_latest_ts = None
        
        for _, row in df.iterrows():
            try:
                lat = float(row['latitude'])
                lon = float(row['longitude'])
                
                # Sovereign Point-in-Polygon First Gate: Exclude transboundary / oceanic points
                if not is_within_sovereign_india(lat, lon):
                    sensor_rejected += 1
                    continue
                    
                frp = float(row.get('frp', 1.0))
                bright = float(row.get('bright_ti4', row.get('brightness', 300.0)))
                acq_date_str = str(row['acq_date']).strip()
                acq_time_str = str(row['acq_time']).strip().zfill(4)
                
                try:
                    acq_date = datetime.strptime(acq_date_str, '%Y-%m-%d').date()
                    acq_time = datetime.strptime(acq_time_str, '%H%M').time()
                    obs_dt = datetime.combine(acq_date, acq_time).replace(tzinfo=timezone.utc)
                except Exception:
                    sensor_rejected += 1
                    continue

                # Clock skew / future timestamp guard (reject observations > 2h in the future)
                if obs_dt > now + timedelta(hours=2):
                    sensor_rejected += 1
                    continue

                if sensor_latest_ts is None or obs_dt > sensor_latest_ts:
                    sensor_latest_ts = obs_dt
                
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
                
                # Nested savepoint isolates single-row failures without aborting outer transaction
                try:
                    with session.begin_nested():
                        res = session.execute(stmt)
                        if res.rowcount > 0:
                            sensor_inserted += 1
                        else:
                            sensor_duplicated += 1
                except Exception:
                    # Savepoint is rolled back automatically; do NOT roll back outer session!
                    sensor_rejected += 1
                    continue
            except Exception:
                sensor_rejected += 1
                continue

        # Commit successfully ingested batch per sensor
        try:
            session.commit()
        except Exception as commit_err:
            session.rollback()
            print(f"[FIRMS BATCH COMMIT ERROR] {sensor}: {commit_err}")

        total_inserted += sensor_inserted
        total_duplicated += sensor_duplicated
        total_rejected += sensor_rejected

        meta["accepted_count"] = sensor_inserted
        meta["duplicate_count"] = sensor_duplicated
        meta["rejected_count"] = sensor_rejected
        if sensor_latest_ts:
            meta["latest_observation_utc"] = sensor_latest_ts.isoformat()
        SENSOR_TELEMETRY[sensor] = meta

    # Determine overall cycle status
    all_failed = all(s in ["CONFIG_MISSING", "INVALID_KEY", "TIMEOUT", "ERROR"] or s.startswith("HTTP_") for s in sensor_statuses)
    any_failed = any(s in ["CONFIG_MISSING", "INVALID_KEY", "TIMEOUT", "ERROR"] or s.startswith("HTTP_") for s in sensor_statuses)
    
    if all_failed and len(sensor_statuses) > 0:
        job_status = "FAILED"
    elif any_failed:
        job_status = "PARTIAL_SUCCESS"
    else:
        job_status = "SUCCESS"

    duration_ms = max(1, int((time.time() - t_start) * 1000))
    
    # Record IngestionJob to persist accurate telemetry metadata
    try:
        job = IngestionJob(
            id=uuid.uuid4(),
            source_feed="FIRMS_INDIA_MULTI_SENSOR",
            status=job_status,
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
                "status": job_status,
                "duration_ms": duration_ms,
                "executed_at": now
            })
            session.commit()
        except Exception as err2:
            print(f"Notice: could not record to ingestion_jobs table: {err2}")

    # Check for any unlinked observations in the database within 7-day lookback window
    unlinked_obs_count = 0
    try:
        unlinked_obs_count = session.execute(text("""
            SELECT count(o.id)
            FROM thermal_observations o
            LEFT JOIN event_observations eo ON o.id = eo.observation_id
            WHERE eo.event_id IS NULL
              AND o.observation_timestamp_utc >= NOW() - INTERVAL '7 days';
        """)).scalar() or 0
    except Exception as count_err:
        print(f"[UNLINKED CHECK NOTICE] {count_err}")

    # Trigger event clustering & intelligence pipeline if new observations were inserted OR unlinked observations exist
    new_events = 0
    if total_inserted > 0 or unlinked_obs_count > 0:
        try:
            from app.domain.event_formation import form_events_from_observations
            new_events = form_events_from_observations(session, lookback_days=7)
        except Exception as e:
            print(f"Error during event formation in poller: {e}")

    # Refresh top active Thermo News bulletins with latest telemetry
    try:
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
        session.rollback()
        print(f"Error refreshing event intelligence in poller: {e}")

    # Clean up stale unlinked observations older than 30 days
    try:
        session.execute(text("""
            DELETE FROM thermal_observations
            WHERE id NOT IN (SELECT observation_id FROM event_observations)
              AND observation_timestamp_utc < NOW() - INTERVAL '30 days';
        """))
        session.execute(text("""
            DELETE FROM ingestion_jobs
            WHERE id NOT IN (
                SELECT id FROM ingestion_jobs ORDER BY executed_at DESC LIMIT 50
            );
        """))
        session.commit()
    except Exception as cleanup_err:
        session.rollback()
        print(f"[CLEANUP NOTICE] {cleanup_err}")

    return {
        "status": job_status,
        "day_range_polled": day_range,
        "total_received": total_received,
        "inserted_count": total_inserted,
        "duplicated_count": total_duplicated,
        "rejected_count": total_rejected,
        "new_events_formed": new_events,
        "duration_ms": duration_ms,
        "poll_timestamp_utc": now.isoformat(),
        "sensor_telemetry": SENSOR_TELEMETRY
    }

def get_last_poll_info(session: Session) -> Dict[str, Any]:
    """Retrieves metadata and per-sensor metrics of the most recent NASA FIRMS ingestion poll."""
    global LAST_POLL_TIMESTAMP, SENSOR_TELEMETRY
    try:
        job = (
            session.query(IngestionJob)
            .order_by(IngestionJob.executed_at.desc())
            .first()
        )
        latest_obs_ts = session.query(func.max(ThermalObservation.observation_timestamp_utc)).scalar()
        
        last_exec = job.executed_at if (job and job.executed_at) else (LAST_POLL_TIMESTAMP or datetime.now(timezone.utc))
        return {
            "last_polled_at": last_exec.isoformat() if hasattr(last_exec, 'isoformat') else str(last_exec),
            "latest_observation_utc": latest_obs_ts.isoformat() if latest_obs_ts else None,
            "records_received": job.records_received if job else 0,
            "records_inserted": job.records_inserted if job else 0,
            "records_duplicated": job.records_duplicated if job else 0,
            "status": job.status if job else "IDLE",
            "duration_ms": job.execution_duration_ms if job else 0,
            "sensor_telemetry": SENSOR_TELEMETRY
        }
    except Exception as e:
        ts = LAST_POLL_TIMESTAMP or datetime.now(timezone.utc)
        return {
            "last_polled_at": ts.isoformat() if hasattr(ts, 'isoformat') else str(ts),
            "latest_observation_utc": None,
            "records_received": 0,
            "records_inserted": 0,
            "records_duplicated": 0,
            "status": "ERROR",
            "duration_ms": 0,
            "sensor_telemetry": SENSOR_TELEMETRY
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
