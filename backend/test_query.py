import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.db.database import SessionLocal
from app.db.models import ThermalEvent

def test_query():
    db = SessionLocal()
    try:
        events = db.query(ThermalEvent).filter(
            ThermalEvent.lifecycle_status != "CLOSED"
        ).filter(
            ThermalEvent.longitude >= 68.0,
            ThermalEvent.longitude <= 96.98,
            ThermalEvent.latitude >= 8.3,
            ThermalEvent.latitude <= 36.74
        ).limit(10).all()
        
        for evt in events:
            lon = float(evt.longitude)
            lat = float(evt.latitude)
            print(f"Lon: {lon}, Lat: {lat}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_query()
