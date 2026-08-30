from app.db.database import SessionLocal
from app.db.models import ThermalEvent, Notification

db = SessionLocal()

event = db.query(ThermalEvent).filter(ThermalEvent.event_id == 'TEST-EVT-0004').first()

if event:
    deleted_notifs = db.query(Notification).filter(Notification.event_id == event.id).delete()
    db.delete(event)
    db.commit()
    print(f"Deleted event TEST-EVT-0004 and {deleted_notifs} related notification(s).")
else:
    print("No event found with event_id 'TEST-EVT-0004' — nothing to delete.")