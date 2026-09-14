"""Load the bundled Indian facility registries into PostGIS.

The import is safe to run at every local startup: existing facility codes are
updated and an already-populated database is left alone unless --force is used.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.database import SessionLocal  # noqa: E402
from app.db.models import IndustrialFacility  # noqa: E402
from app.domain.sovereign_geofencing import is_within_sovereign_india  # noqa: E402

MOUNTED_DATA_ROOT = Path("/data/raw/facilities")
DATA_ROOT = MOUNTED_DATA_ROOT if MOUNTED_DATA_ROOT.exists() else BACKEND_ROOT.parent / "data" / "raw" / "facilities"
SEEN_CODES: set[str] = set()


def clean(value: object, fallback: str = "") -> str:
    if value is None or pd.isna(value):
        return fallback
    return str(value).strip()


def code_for(source: str, external_id: str, name: str, lat: float, lon: float) -> str:
    identity = f"{source}|{external_id}|{name}|{lat:.5f}|{lon:.5f}"
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20].upper()
    return f"{source[:8].upper()}-{digest}"[:32]


def upsert(session, *, source: str, external_id: str, name: str, sector: str,
           state: str, operator: str, lat: float, lon: float) -> bool:
    if not is_within_sovereign_india(lat, lon):
        return False
    facility_code = code_for(source, external_id, name, lat, lon)
    if facility_code in SEEN_CODES:
        return False
    SEEN_CODES.add(facility_code)
    facility = session.query(IndustrialFacility).filter_by(facility_code=facility_code).first()
    if facility is None:
        facility = IndustrialFacility(facility_code=facility_code)
        session.add(facility)
    delta = 0.001
    facility.name = name[:255] or "Industrial Facility"
    facility.sector_category = sector[:64] or "Industrial Facility"
    facility.operator_name = operator[:255] or None
    facility.state = state[:64] or "India"
    facility.latitude = lat
    facility.longitude = lon
    facility.facility_geom = (
        f"SRID=4326;MULTIPOLYGON((("
        f"{lon-delta} {lat-delta}, {lon+delta} {lat-delta}, "
        f"{lon+delta} {lat+delta}, {lon-delta} {lat+delta}, "
        f"{lon-delta} {lat-delta})))"
    )
    facility.centroid = f"SRID=4326;POINT({lon} {lat})"
    facility.data_source = source
    facility.source_external_id = external_id[:128] or None
    facility.is_active = True
    return True


def import_wri(session) -> int:
    path = DATA_ROOT / "wri" / "database_IND.csv"
    if not path.exists():
        return 0
    count = 0
    for _, row in pd.read_csv(path).iterrows():
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
            facility_name = clean(row.get("name"), "Power Facility")
            primary_fuel = clean(row.get("primary_fuel"), "Power Generation")
            lowered_name = facility_name.lower()
            sector = "Refinery" if ("refinery" in lowered_name or "petrochemical" in lowered_name) else primary_fuel
            if upsert(
                session,
                source="WRI_GPPD_IND",
                external_id=clean(row.get("gppd_idnr")),
                name=facility_name,
                sector=sector,
                state="India",
                operator=clean(row.get("owner")),
                lat=lat,
                lon=lon,
            ):
                count += 1
        except (TypeError, ValueError, KeyError):
            continue
    return count


def pick_column(columns, candidates):
    normalized = {str(column).strip().lower(): column for column in columns}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    for key, original in normalized.items():
        if any(candidate in key for candidate in candidates):
            return original
    return None


def import_gem(session) -> int:
    count = 0
    gem_dir = DATA_ROOT / "gem"
    for path in sorted(gem_dir.glob("*.xlsx")) if gem_dir.exists() else []:
        try:
            workbook = pd.ExcelFile(path)
            for sheet in workbook.sheet_names:
                if "readme" in sheet.lower() or "about" in sheet.lower():
                    continue
                frame = pd.read_excel(path, sheet_name=sheet)
                lat_col = pick_column(frame.columns, ["latitude", "lat"])
                lon_col = pick_column(frame.columns, ["longitude", "lon", "lng"])
                if lat_col is None or lon_col is None:
                    continue
                name_col = pick_column(frame.columns, ["facility / project name", "project name", "plant name", "unit name", "mine name", "location name"])
                id_col = pick_column(frame.columns, ["gem unit id", "gem location id", "tracker id", "projectid", "project id"])
                state_col = pick_column(frame.columns, ["state / province", "state/province", "state"])
                operator_col = pick_column(frame.columns, ["owner", "operator"])
                filename = path.name.lower()
                sector = next((label for token, label in {
                    "coal": "Coal Mining", "oil": "Oil & Gas", "gas": "Oil & Gas",
                    "cement": "Cement", "steel": "Iron & Steel", "iron": "Iron & Steel",
                    "nuclear": "Nuclear", "chemical": "Chemicals",
                }.items() if token in filename), "Heavy Industry")
                for _, row in frame.iterrows():
                    try:
                        lat, lon = float(row[lat_col]), float(row[lon_col])
                    except (TypeError, ValueError):
                        continue
                    name = clean(row.get(name_col) if name_col is not None else None, "Industrial Facility")
                    external_id = clean(row.get(id_col) if id_col is not None else None)
                    if upsert(
                        session, source="GEM_GLOBAL", external_id=external_id,
                        name=name, sector=sector,
                        state=clean(row.get(state_col) if state_col is not None else None, "India"),
                        operator=clean(row.get(operator_col) if operator_col is not None else None),
                        lat=lat, lon=lon,
                    ):
                        count += 1
                break
        except Exception as exc:
            print(f"[FACILITIES] Skipped {path.name}: {exc}")
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Refresh an already-populated database")
    args = parser.parse_args()
    with SessionLocal() as session:
        existing = session.query(IndustrialFacility).count()
        if existing and not args.force:
            print(f"[FACILITIES] Ready: {existing} records already present.")
            return
        try:
            processed = import_wri(session) + import_gem(session)
            session.commit()
        except Exception:
            session.rollback()
            raise
        total = session.query(IndustrialFacility).count()
        print(f"[FACILITIES] Ready: {total} Indian facilities ({processed} source rows processed).")


if __name__ == "__main__":
    main()
