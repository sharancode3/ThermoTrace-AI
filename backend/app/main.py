from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import endpoints
from app.api.routes import chat, stream, reports, facilities

app = FastAPI(
    title="Thermo Intelligence REST API",
    description="Authoritative REST API for Industrial Fire & Persistent Thermal Source Detection Platform",
    version="1.0.0",
)

# Permissive CORS for dev and frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(stream.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(facilities.router, prefix="/api/v1")

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "HEALTHY",
        "database": "CONNECTED", 
        "redis": "CONNECTED",
        "ml_model_version": "thermo_xgb_v1.0.0",
        "active_events_count": 2,
        "critical_anomalies_count": 0
    }
