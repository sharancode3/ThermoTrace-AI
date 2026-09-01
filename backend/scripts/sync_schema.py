import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import engine, Base
from sqlalchemy import text
# Import all models so they are registered with Base
from app.db.models import *

def sync_schema():
    print("Synchronizing database schema...")
    try:
        # Create all tables (will not drop existing tables, will just create missing ones)
        Base.metadata.create_all(bind=engine)
        # Apply additive changes that create_all cannot make on existing tables.
        with engine.begin() as connection:
            connection.execute(text("""
                ALTER TABLE event_classifications
                ADD COLUMN IF NOT EXISTS tier2_computed_at TIMESTAMP WITH TIME ZONE
            """))
            connection.execute(text("""
                ALTER TABLE thermal_observations
                ADD COLUMN IF NOT EXISTS is_within_india_sovereign_bounds
                BOOLEAN NOT NULL DEFAULT TRUE
            """))
        print("Schema synchronization completed successfully.")
    except Exception as e:
        print(f"Error synchronizing schema: {e}")

if __name__ == "__main__":
    sync_schema()
