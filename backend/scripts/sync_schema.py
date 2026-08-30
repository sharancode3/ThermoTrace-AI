import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import engine, Base
# Import all models so they are registered with Base
from app.db.models import *

def sync_schema():
    print("Synchronizing database schema...")
    try:
        # Create all tables (will not drop existing tables, will just create missing ones)
        Base.metadata.create_all(bind=engine)
        print("Schema synchronization completed successfully.")
    except Exception as e:
        print(f"Error synchronizing schema: {e}")

if __name__ == "__main__":
    sync_schema()
