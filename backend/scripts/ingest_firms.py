import os
import sys
import hashlib
import requests
import pandas as pd
from datetime import datetime, timezone
from io import StringIO
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import engine
from app.db.models import ThermalObservation

<<<<<<< Updated upstream
def compute_dedup_key(lat: float, lon: float, acq_date: str, acq_time: str, sensor: str) -> str:
    """Computes a deterministic SHA-256 deduplication key for a satellite observation with 4-decimal rounding."""
    r_lat = round(float(lat), 4)
    r_lon = round(float(lon), 4)
    raw = f"{r_lat:.4f}_{r_lon:.4f}_{str(acq_date)}_{str(acq_time)}_{str(sensor)}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def ingest_firms():
    Session = sessionmaker(bind=engine)
    session = Session()

    FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "5ee48ea9900661577c1dc26dfcc70550").strip('\"')
    area_str = "68,6,97,37"

    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/{area_str}/5"
    print("Fetching real satellite observations from NASA FIRMS API with active key...")

    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200 and not resp.text.startswith("Invalid"):
            df = pd.read_csv(StringIO(resp.text))
            print(f"Retrieved {len(df)} live observations from NASA FIRMS.")
            
            raw_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/raw/firms"))
            os.makedirs(raw_dir, exist_ok=True)
            raw_path = os.path.join(raw_dir, f"firms_india_viirs_5d_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv")
            df.to_csv(raw_path, index=False)
            print(f"Saved raw telemetry archive: {raw_path}")
            
            added = 0
            for _, row in df.iterrows():
                try:
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                    frp = float(row.get('frp', 1.0))
                    bright = float(row.get('bright_ti4', 300.0))
                    acq_date_str = str(row['acq_date'])
                    acq_time_str = str(row['acq_time']).zfill(4)
                    
                    obs = ThermalObservation(
                        latitude=lat,
                        longitude=lon,
                        geom=f"SRID=4326;POINT({lon} {lat})",
                        frp_mw=frp,
                        brightness_temperature_kelvin=bright,
                        sensor="VIIRS_SNPP_NRT",
                        satellite="SNPP",
                        day_night=str(row.get('daynight', 'D')),
                        confidence_raw=str(row.get('confidence', 'nominal')),
                        observation_timestamp_utc=datetime.strptime(f"{acq_date_str} {acq_time_str}", "%Y-%m-%d %H%M")
                    )
                    session.add(obs)
                    added += 1
                except Exception:
                    continue
            session.commit()
            print(f"Successfully ingested {added} observations.")
    except Exception as e:
        print(f"Ingestion error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    ingest_firms()
=======
# Import landmass check for filtering observations
from app.domain.geocoding import is_within_india_landmass

def compute_dedup_key(lat: float, lon: float, acq_date: str, acq_time: str, sensor: str) -> str:
    """Create a deterministic deduplication key consistent with existing logic.
    The key matches the format used elsewhere in the code base.
    """
    # Round coordinates to 5 decimal places for consistency
    lat_str = f"{round(lat, 5):.5f}"
    lon_str = f"{round(lon, 5):.5f}"
    return f"{lat_str}_{lon_str}_{acq_date}_{acq_time}_{sensor}"

def main():
    Session = sessionmaker(bind=engine)
    session = Session()
    FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "5ee48ea9900661577c1dc26dfcc70550").strip('"')
    area_str = "68,6,97,37"
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/{area_str}/5"
    print("Fetching real satellite observations from NASA FIRMS API with active key...")
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200 and not resp.text.startswith("Invalid"):
            df = pd.read_csv(StringIO(resp.text))
            print(f"Retrieved {len(df)} live observations from NASA FIRMS.")
            os.makedirs(os.path.join("data", "raw", "firms"), exist_ok=True)
            raw_path = os.path.join("data", "raw", "firms", f"firms_india_viirs_5d_{datetime.utcnow().strftime('%Y%m%d')}.csv")
            df.to_csv(raw_path, index=False)
            print(f"Saved raw telemetry archive: {raw_path}")

            added = 0
            for _, row in df.iterrows():
                try:
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                    # Skip observations outside Indian sovereign landmass
                    if not is_within_india_landmass(lat, lon):
                        continue
                    frp = float(row.get('frp', 1.0))
                    bright = float(row.get('bright_ti4', 300.0))
                    acq_date_str = str(row['acq_date'])
                    acq_time_str = str(row['acq_time']).zfill(4)
                    acq_date = datetime.strptime(acq_date_str, '%Y-%m-%d').date()
                    acq_time = datetime.strptime(acq_time_str, '%H%M').time()
                    obs_dt = datetime.combine(acq_date, acq_time)
                    sensor = "VIIRS_SNPP"
                    day_night = str(row.get('daynight', 'D'))
                    dedup_key = compute_dedup_key(lat, lon, acq_date_str, acq_time_str, sensor)
                    obs = ThermalObservation(
                        dedup_key=dedup_key,
                        geom=f"SRID=4326;POINT({lon} {lat})",
                        latitude=lat,
                        longitude=lon,
                        brightness_temp_k=bright,
                        frp_mw=frp,
                        acq_date=acq_date,
                        acq_time_utc=acq_time,
                        observation_timestamp_utc=obs_dt,
                        satellite_sensor=sensor,
                        day_night=day_night,
                        source_product='FIRMS_NRT'
                    )
                    session.merge(obs)
                    added += 1
                    if added % 500 == 0:
                        session.commit()
                except Exception:
                    session.rollback()
            session.commit()
            print(f"Successfully ingested {added} real NASA FIRMS observations into PostGIS.")
        else:
            print(f"FIRMS response status: {resp.status_code}, content: {resp.text[:200]}")
    except Exception as e:
        print(f"Failed to fetch FIRMS: {e}")
    total = session.query(ThermalObservation).count()
    print(f"Total Thermal Observations in PostGIS: {total}")
    session.close()

if __name__ == '__main__':
    main()
>>>>>>> Stashed changes
