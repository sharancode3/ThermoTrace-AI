"""Import the checked-in FIRMS CSV and form real thermal events for local development."""
import os
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy.dialects.postgresql import insert

from app.db.database import SessionLocal
from app.db.models import ThermalObservation
from scripts.live_firms_ingestion import cluster_observations_into_events


DEFAULT_CSV = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/raw/firms/firms_india_viirs_5d_20260830.csv"))


def import_local_firms(path: str = DEFAULT_CSV) -> None:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"FIRMS source file not found: {path}")

    data = pd.read_csv(path)
    session = SessionLocal()
    inserted = 0
    try:
        for _, row in data.iterrows():
            date_value = datetime.strptime(str(row["acq_date"]), "%Y-%m-%d").date()
            time_value = datetime.strptime(str(row["acq_time"]).zfill(4), "%H%M").time()
            observed_at = datetime.combine(date_value, time_value, tzinfo=timezone.utc)
            latitude, longitude = float(row["latitude"]), float(row["longitude"])
            satellite = str(row.get("satellite", "VIIRS"))
            dedup_key = f"{latitude:.5f}_{longitude:.5f}_{date_value}_{time_value}_{satellite}"
            result = session.execute(
                insert(ThermalObservation)
                .values(
                    dedup_key=dedup_key,
                    geom=f"SRID=4326;POINT({longitude} {latitude})",
                    latitude=latitude,
                    longitude=longitude,
                    brightness_temp_k=float(row["bright_ti4"]),
                    brightness_temp_alt_k=float(row["bright_ti5"]) if pd.notna(row.get("bright_ti5")) else None,
                    frp_mw=float(row["frp"]),
                    acq_date=date_value,
                    acq_time_utc=time_value,
                    observation_timestamp_utc=observed_at,
                    satellite_sensor=satellite,
                    confidence_level=str(row.get("confidence", "unknown")),
                    day_night=str(row.get("daynight", "D")),
                    source_product="FIRMS_LOCAL_CSV",
                    raw_metadata=row.to_dict(),
                )
                .on_conflict_do_nothing(index_elements=["dedup_key"])
            )
            inserted += max(result.rowcount, 0)
        session.commit()
        print(f"Imported {inserted} observations from {path}.")
        cluster_observations_into_events(session)
    finally:
        session.close()


if __name__ == "__main__":
    import_local_firms()
