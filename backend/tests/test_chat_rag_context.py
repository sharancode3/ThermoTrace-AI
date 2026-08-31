import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db, SessionLocal
from app.db.models import ThermalEvent, IndustrialFacility

client = TestClient(app)

def test_chat_query_basic():
    response = client.post("/api/v1/chat/query", json={"query": "Show me critical alerts in Gujarat"})
    assert response.status_code == 200
    data = response.json().get("data", {})
    assert "answer_markdown" in data
    assert "grounded_events" in data
    assert "provenance" in data

def test_chat_query_with_selected_event():
    db = SessionLocal()
    try:
        event = db.query(ThermalEvent).first()
        event_id = event.event_id if event else "EVT-TEST-001"
        
        response = client.post(
            "/api/v1/chat/query",
            json={
                "query": "What is the status of this event?",
                "selected_event_id": event_id
            }
        )
        assert response.status_code == 200
        data = response.json().get("data", {})
        assert "answer_markdown" in data
        assert isinstance(data.get("grounded_events"), list)
    finally:
        db.close()
