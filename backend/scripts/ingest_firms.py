import os
import sys
import requests
import pandas as pd
from datetime import datetime
from io import StringIO
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath('backend'))
from app.db.database import engine
from app.db.models import ThermalObservation

Session = sessionmaker(bind=engine)
session = Session()

FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "5ee48ea9900661577c1dc26dfcc70550").strip('\"')
area_str = "68,6,97,37"

# Valid days range for FIRMS area API is 1..5
url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/{area_str}/5"
print(f"Fetching real satellite observations from NASA FIRMS API with active key...")

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
                frp = float(row.get('frp', 1.0))
                bright = float(row.get('bright_ti4', 300.0))
                acq_date_str = str(row['acq_date'])
                acq_time_str = str(row['acq_time']).zfill(4)
                
                acq_date = datetime.strptime(acq_date_str, '%Y-%m-%d').date()
                acq_time = datetime.strptime(acq_time_str, '%H%M').time()
                obs_dt = datetime.combine(acq_date, acq_time)
                
                sensor = "VIIRS_SNPP"
                day_night = str(row.get('daynight', 'D'))
                dedup_key = f"{lat:.5f}_{lon:.5f}_{acq_date_str}_{acq_time_str}_{sensor}"
                
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
