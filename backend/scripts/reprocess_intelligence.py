import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from app.db.models import ThermalEvent
from app.domain.anomaly import process_event_intelligence
from app.domain.context import attach_spatial_context
from collections import Counter

def main():
    session = SessionLocal()
    events = session.query(ThermalEvent).all()
    print(f"Total events in database: {len(events)}")
    sys.stdout.flush()

    reprocessed = 0
    for idx, evt in enumerate(events):
        try:
            attach_spatial_context(session, evt.event_id)
            process_event_intelligence(session, evt.event_id)
            reprocessed += 1
            if reprocessed % 50 == 0:
                print(f"  Reprocessed {reprocessed}/{len(events)} events...")
                sys.stdout.flush()
        except Exception as e:
            print(f"Error reprocessing {evt.event_id}: {e}")
            sys.stdout.flush()

    session.close()

    session2 = SessionLocal()
    classifications = session2.query(ThermalEvent.classification).all()
    counts = Counter([c[0] for c in classifications if c[0]])
    print("\n=== REPROCESSED CLASSIFICATION DISTRIBUTION ===")
    total = len(classifications)
    for cls, count in counts.most_common():
        pct = (count / total) * 100 if total > 0 else 0
        print(f"  {cls:<18}: {count:>4} ({pct:.1f}%)")
    sys.stdout.flush()
    session2.close()

if __name__ == "__main__":
    main()
