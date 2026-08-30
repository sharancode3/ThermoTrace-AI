import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from scripts.live_firms_ingestion import run_live_firms_pipeline, POLL_INTERVAL_MINUTES

def start_continuous_daemon():
    print(f"=== NASA FIRMS India Continuous Ingestion Daemon Started (Cadence: {POLL_INTERVAL_MINUTES} min) ===")
    while True:
        try:
            print(f"\n[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}] Executing scheduled 5-minute FIRMS cycle...")
            run_live_firms_pipeline()
        except Exception as e:
            print(f"Daemon cycle error: {e}")
        
        sleep_sec = POLL_INTERVAL_MINUTES * 60
        print(f"Cycle finished. Sleeping for {POLL_INTERVAL_MINUTES} minutes ({sleep_sec}s)...")
        time.sleep(sleep_sec)

if __name__ == "__main__":
    start_continuous_daemon()
