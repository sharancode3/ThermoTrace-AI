import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.database import SessionLocal
from sqlalchemy import text

def add_constraint():
    session = SessionLocal()
    try:
        session.execute(text("ALTER TABLE event_observations ADD CONSTRAINT uq_event_obs UNIQUE(event_id, observation_id);"))
        session.commit()
        print("Constraint added successfully.")
    except Exception as e:
        print(f"Error adding constraint: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    add_constraint()
