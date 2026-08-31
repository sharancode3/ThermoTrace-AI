import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import sessionmaker
from app.db.database import engine
from app.db.models import ThermalEvent
from app.domain.geocoding import is_within_india_landmass

Session = sessionmaker(bind=engine)
session = Session()

events = session.query(ThermalEvent).all()
bad = []
for e in events:
    if not is_within_india_landmass(e.latitude, e.longitude):
        bad.append(e)

print(f"Total events: {len(events)}")
print(f"Failing geofence: {len(bad)}")
for e in bad:
    print(f"  {e.event_id} | {e.latitude} | {e.longitude}")

session.close()
