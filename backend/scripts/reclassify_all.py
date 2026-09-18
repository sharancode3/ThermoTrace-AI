import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from app.db.models import ThermalEvent
from app.domain.anomaly import process_event_intelligence
from collections import Counter

def main():
    session = SessionLocal()
    events = session.query(ThermalEvent).all()
    print(f"Bulk ML classification on {len(events)} events...", flush=True)

    for idx, evt in enumerate(events):
        try:
            process_event_intelligence(session, evt.event_id)
            if (idx + 1) % 100 == 0:
                print(f"  Processed {idx + 1}/{len(events)} events...", flush=True)
        except Exception as e:
            pass

    session.close()

    session2 = SessionLocal()
    classifications = session2.query(ThermalEvent.classification).all()
    counts = Counter([c[0] for c in classifications if c[0]])
    print("\n=== BRAND NEW REALISTIC ML CLASSIFICATION DISTRIBUTION ===", flush=True)
    total = len(classifications)
    for cls, count in counts.most_common():
        pct = (count / total) * 100 if total > 0 else 0
        print(f"  {cls:<18}: {count:>4} ({pct:.1f}%)", flush=True)
    session2.close()

if __name__ == "__main__":
    main()
