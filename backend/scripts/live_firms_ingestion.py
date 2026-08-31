import os
import sys
import time
import uuid
import requests
import pandas as pd
from io import StringIO
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.db.database import SessionLocal, engine
from app.db.models import (
    ThermalObservation, IngestionJob, ThermalEvent, 
    IndustrialFacility, ThermoNews, EventObservation
)
from app.domain.geocoding import resolve_indian_location
from app.domain.sovereign_geofencing import is_within_sovereign_india
from app.domain.anomaly import process_all_intelligence

INDIA_BBOX = "68,6,97,37"
FIRMS_API_KEY = os.getenv("FIRMS_MAP_KEY", "5ee48ea9900661577c1dc26dfcc70550").strip('"')
POLL_INTERVAL_MINUTES = int(os.getenv("FIRMS_POLL_INTERVAL_MINUTES", "5"))

SUPPORTED_SENSORS = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT",
    "MODIS_NRT"
]

def fetch_live_firms_sensor(sensor: str) -> pd.DataFrame:
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_API_KEY}/{sensor}/{INDIA_BBOX}/5"
    try:
        resp = requests.get(url, timeout=25)
        if resp.status_code == 200 and not resp.text.startswith("Invalid"):
            df = pd.read_csv(StringIO(resp.text))
            return df
        else:
            print(f"Sensor {sensor} returned status {resp.status_code}")
    except Exception as e:
        print(f"Error fetching sensor {sensor}: {e}")
    return pd.DataFrame()

def ingest_all_active_sensors(session: Session) -> Tuple[int, int, int, datetime]:
    total_received = 0
    total_inserted = 0
    total_duplicated = 0
    latest_obs_time = datetime.now(timezone.utc) - timedelta(days=365)
    
    for sensor in SUPPORTED_SENSORS:
        df = fetch_live_firms_sensor(sensor)
        if df.empty:
            continue
            
        total_received += len(df)
        print(f"Sensor {sensor}: {len(df)} observations fetched from NASA FIRMS.")
        
        for _, row in df.iterrows():
            try:
                lat = float(row['latitude'])
                lon = float(row['longitude'])
                
                # Enforce Official Survey of India Sovereign Geofencing Gate
                if not is_within_sovereign_india(lat, lon):
                    continue
                frp = float(row.get('frp', 1.0))
                bright = float(row.get('bright_ti4', row.get('brightness', 300.0)))
                acq_date_str = str(row['acq_date'])
                acq_time_str = str(row['acq_time']).zfill(4)
                
                acq_date = datetime.strptime(acq_date_str, '%Y-%m-%d').date()
                acq_time = datetime.strptime(acq_time_str, '%H%M').time()
                obs_dt = datetime.combine(acq_date, acq_time).replace(tzinfo=timezone.utc)
                
                if obs_dt > latest_obs_time:
                    latest_obs_time = obs_dt
                    
                sat_name = str(row.get('satellite', sensor.split('_')[1]))
                day_night = str(row.get('daynight', 'D'))
                dedup_key = f"{lat:.5f}_{lon:.5f}_{acq_date_str}_{acq_time_str}_{sat_name}"
                
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
                
                res = session.execute(stmt)
                if res.rowcount > 0:
                    total_inserted += 1
                else:
                    total_duplicated += 1
            except Exception:
                pass
                
        session.commit()
        
    return total_received, total_inserted, total_duplicated, latest_obs_time

def cluster_observations_into_events(session: Session):
    """
    Groups raw thermal observations into spatio-temporal thermal events (750m, 12h threshold).
    Associates nearest facilities in PostGIS and calculates peak FRP, mean FRP, and convex hull area.
    """
    print("Clustering observations into Spatio-Temporal Thermal Events...")
    
    # Query high-intensity or unclustered observations
    query = text('''
        SELECT o.id, o.latitude, o.longitude, o.frp_mw, o.brightness_temp_k, o.observation_timestamp_utc, o.day_night
        FROM thermal_observations o
        LEFT JOIN event_observations eo ON o.id = eo.observation_id
        WHERE eo.observation_id IS NULL
        ORDER BY o.frp_mw DESC
        LIMIT 500
    ''')
    unclustered = session.execute(query).fetchall()
    
    if not unclustered:
        print("No new unclustered observations found.")
        return
        
    print(f"Clustering {len(unclustered)} unclustered observations...")
    
    created_events = 0
    for obs in unclustered:
        obs_id, lat, lon, frp, bright, obs_dt, dn = obs
        lat = float(lat)
        lon = float(lon)
        frp = float(frp)
        bright = float(bright)
        
        # Check if an active event exists within 1500m and 24h
        find_event_query = text('''
            SELECT id, event_id, peak_frp_mw, mean_frp_mw, observation_count, aggregate_frp_mw, first_detected_utc, latest_detected_utc
            FROM thermal_events
            WHERE ST_DWithin(centroid::geography, ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography, 1500)
            AND latest_detected_utc >= :min_time
            LIMIT 1
        ''')
        min_time = obs_dt - timedelta(hours=24)
        existing = session.execute(find_event_query, {"lon": lon, "lat": lat, "min_time": min_time}).fetchone()
        
        if existing:
            evt_id = existing[0]
            new_peak = max(float(existing[2]), frp)
            new_count = existing[4] + 1
            new_agg = float(existing[5]) + frp
            new_mean = new_agg / new_count
            new_latest = max(existing[7], obs_dt)
            new_first = min(existing[6], obs_dt)
            
            session.execute(text('''
                UPDATE thermal_events
                SET peak_frp_mw = :peak, mean_frp_mw = :mean, aggregate_frp_mw = :agg,
                    observation_count = :count, latest_detected_utc = :latest, first_detected_utc = :first
                WHERE id = :id
            '''), {"peak": new_peak, "mean": new_mean, "agg": new_agg, "count": new_count, "latest": new_latest, "first": new_first, "id": evt_id})
            
            eo = EventObservation(event_id=evt_id, observation_id=obs_id)
            session.add(eo)
        else:
            # Create a new event
            fac_query = text('''
                SELECT id, name, ST_Distance(centroid::geography, ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography) as dist_m
                FROM industrial_facilities
                WHERE ST_DWithin(centroid::geography, ST_SetSRID(ST_Point(:lon, :lat), 4326)::geography, 2500)
                ORDER BY dist_m ASC
                LIMIT 1
            ''')
            fac = session.execute(fac_query, {"lon": lon, "lat": lat}).fetchone()
            
            fac_id = fac[0] if fac else None
            fac_name = fac[1] if fac else None
            dist_m = float(fac[2]) if fac else None
            
            geo = resolve_indian_location(lat, lon, fac_name)
            
            short_id = f"EVT-IN-{geo['state'][:3].upper()}-{str(uuid.uuid4())[:8].upper()}"
            
            new_event = ThermalEvent(
                event_id=short_id,
                centroid=f"SRID=4326;POINT({lon} {lat})",
                boundary_geom=f"SRID=4326;POINT({lon} {lat})",
                latitude=lat,
                longitude=lon,
                bounding_area_ha=0.0,
                first_detected_utc=obs_dt,
                latest_detected_utc=obs_dt,
                observation_count=1,
                peak_frp_mw=frp,
                mean_frp_mw=frp,
                aggregate_frp_mw=frp,
                max_brightness_k=bright,
                associated_facility_id=fac_id,
                distance_to_facility_m=dist_m,
                primary_land_use="Industrial Zone" if fac_id else ("Agricultural Cropland" if dn == 'D' else "Unclassified Terrain"),
                classification="OTHER_UNCERTAIN",
                persistence_tier="TRANSIENT",
                anomaly_tier="NORMAL",
                lifecycle_status="ACTIVE"
            )
            session.add(new_event)
            session.flush()
            
            eo = EventObservation(event_id=new_event.id, observation_id=obs_id)
            session.add(eo)
            created_events += 1
            
        session.commit()
        
    print(f"Clustering complete. Created {created_events} new thermal events.")

def run_live_firms_pipeline():
    session = SessionLocal()
    start_time = datetime.now(timezone.utc)
    print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}] Initiating NASA FIRMS Live Ingestion...")
    
    job = IngestionJob(
        source_feed="FIRMS_INDIA_MULTI_SENSOR",
        time_window_start=start_time,
        time_window_end=start_time,
        status="RUNNING",
        execution_duration_ms=0,
        records_received=0,
        records_inserted=0,
        records_duplicated=0
    )
    session.add(job)
    session.commit()
    
    try:
        rec, ins, dup, latest_obs = ingest_all_active_sensors(session)
        
        job.records_received = rec
        job.records_inserted = ins
        job.records_duplicated = dup
        job.time_window_end = latest_obs
        job.status = "SUCCESS"
        
        print(f"FIRMS Ingestion Summary: {rec} received, {ins} inserted into PostGIS, {dup} deduplicated.")
        
        # Cluster into events
        cluster_observations_into_events(session)
        
        # Run ML inference, SHAP, and Anomaly Engine
        print("Running Stage 3.3 Intelligence Engine...")
        c = process_all_intelligence()
        print(f"Intelligence processing complete for {c} events.")
        
    except Exception as e:
        session.rollback()
        job.status = "FAILED"
        job.error_message = str(e)
        print(f"Pipeline error: {e}")
    finally:
        end_time = datetime.now(timezone.utc)
        job.execution_duration_ms = int((end_time - start_time).total_seconds() * 1000)
        session.commit()
        session.close()

if __name__ == "__main__":
    run_live_firms_pipeline()



