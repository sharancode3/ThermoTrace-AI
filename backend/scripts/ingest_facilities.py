import os
import sys
import glob
import uuid
import pandas as pd
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.abspath('backend'))
from app.db.database import engine
from app.db.models import IndustrialFacility

Session = sessionmaker(bind=engine)
session = Session()

def identify_gem_sheet(xl):
    candidates = ['Main Data', 'Data', 'Plant data', 'Final data', 'Field-level main data', 'Non-closed mines', 'Gas & Oil Units']
    for s in xl.sheet_names:
        if s in candidates: return s
    for s in xl.sheet_names:
        if 'About' not in s and 'README' not in s and 'Historical' not in s and 'Metadata' not in s:
            return s
    return xl.sheet_names[0]

gem_files = glob.glob(os.path.join('data', 'raw', 'facilities', 'gem', '*.xlsx'))
total_added = 0

for f in gem_files:
    try:
        xl = pd.ExcelFile(f)
        sheet = identify_gem_sheet(xl)
        df = pd.read_excel(f, sheet_name=sheet)
        
        lat_col, lon_col = None, None
        for col in df.columns:
            c_low = str(col).lower()
            if 'latitude' in c_low or c_low == 'lat': lat_col = col
            elif 'longitude' in c_low or c_low == 'lon' or c_low == 'lng': lon_col = col
            
        if not lat_col or not lon_col: continue
        
        fname_low = os.path.basename(f).lower()
        sector = 'Heavy Industry'
        if 'coal' in fname_low: sector = 'Coal Mine'
        elif 'oil' in fname_low or 'gas' in fname_low: sector = 'Oil & Gas'
        elif 'cement' in fname_low: sector = 'Cement'
        elif 'iron' in fname_low or 'steel' in fname_low: sector = 'Iron & Steel'
        elif 'nuclear' in fname_low: sector = 'Nuclear'
        elif 'chemical' in fname_low: sector = 'Chemicals'

        for _, row in df.iterrows():
            try:
                lat, lon = float(row[lat_col]), float(row[lon_col])
                if pd.isna(lat) or pd.isna(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180): continue
                
                fac_code = f"GEM-{uuid.uuid4().hex[:8]}"
                for id_cand in ['GEM unit ID', 'GEM location ID', 'Tracker ID', 'ProjectID']:
                    if id_cand in df.columns and pd.notna(row.get(id_cand)):
                        fac_code = str(row[id_cand])[:32]
                        break
                        
                name = 'Industrial Facility'
                for name_cand in ['Facility / Project name', 'Project name', 'Plant name', 'Unit name', 'Location name']:
                    if name_cand in df.columns and pd.notna(row.get(name_cand)):
                        name = str(row[name_cand])[:255]
                        break
                        
                state = 'Global'
                for state_cand in ['State / Province', 'State/Province', 'State', 'Province', 'Subnational unit (province/state)']:
                    if state_cand in df.columns and pd.notna(row.get(state_cand)):
                        state = str(row[state_cand])[:64]
                        break

                fac = IndustrialFacility(
                    facility_code=fac_code,
                    name=name,
                    sector_category=sector,
                    sub_type='Industrial Unit',
                    state=state,
                    facility_geom=f"SRID=4326;MULTIPOLYGON((({lon-0.001} {lat-0.001}, {lon+0.001} {lat-0.001}, {lon+0.001} {lat+0.001}, {lon-0.001} {lat+0.001}, {lon-0.001} {lat-0.001})))",
                    centroid=f"SRID=4326;POINT({lon} {lat})",
                    latitude=lat,
                    longitude=lon,
                    data_source='GEM_GLOBAL'
                )
                session.merge(fac)
                total_added += 1
                if total_added % 500 == 0:
                    session.commit()
            except Exception:
                session.rollback()
        session.commit()
        print(f"Processed {os.path.basename(f)} (Total: {total_added})")
    except Exception as e:
        print(f"Failed {f}: {e}")

session.commit()
final_count = session.query(IndustrialFacility).count()
print(f"DONE! Total facilities in database: {final_count}")
session.close()
