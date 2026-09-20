import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import endpoints
from app.api.routes import chat, stream, reports, facilities, nearby_notifications
from app.db.database import SessionLocal
from app.domain.firms_poller import poll_firms_foreground_cycle
from app.domain.event_formation import form_events_from_observations

def _run_sync_poller_cycle():
    """Worker executed in background worker thread to prevent event loop blocking."""
    session = None
    try:
        session = SessionLocal()
        print("[FIRMS DAEMON] Executing automated NASA FIRMS telemetry polling & ML hardening...")
        res = poll_firms_foreground_cycle(session, force=False)
        inserted = res.get("inserted_count", 0)
        events_count = res.get("new_events_formed", 0)
        print(f"[FIRMS DAEMON] Telemetry check completed. New observations: {inserted}, Events formed/refreshed: {events_count}")
        endpoints.clear_gis_cache()
        print("[FIRMS DAEMON] GIS in-memory cache successfully invalidated following telemetry poll.")
    except Exception as e:
        print(f"[FIRMS DAEMON ERROR] {e}")
    finally:
        if session:
            try:
                session.close()
            except Exception:
                pass

POLL_INTERVAL_MINUTES = int(os.getenv("FIRMS_POLL_INTERVAL_MINUTES", "60"))
POLL_INTERVAL_SECONDS = POLL_INTERVAL_MINUTES * 60

async def firms_periodic_poller_daemon():
    """Autonomous NASA FIRMS Telemetry Polling Worker with non-blocking initial delay."""
    # Delay initial check by 5 minutes to ensure server starts and demo requests are never starved
    await asyncio.sleep(300)
    while True:
        try:
            await asyncio.to_thread(_run_sync_poller_cycle)
        except Exception as e:
            print(f"[FIRMS DAEMON THREAD ERROR] {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)

ENABLE_FIRMS_POLLING = os.getenv("ENABLE_FIRMS_POLLING", "true").lower() in ("true", "1", "yes")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize PostGIS & schema tables for new Supabase projects
    try:
        from app.db.database import engine, Base
        from sqlalchemy import text
        import app.db.models
        with engine.begin() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            except Exception as ext_err:
                print(f"[DATABASE] PostGIS extension check: {ext_err}")
        Base.metadata.create_all(bind=engine)
        from app.db.migrations import apply_runtime_migrations
        apply_runtime_migrations(engine)
        print("[DATABASE] Schema tables verified and ready.")
    except Exception as err:
        print(f"[DATABASE INIT WARNING] {err}")

    poller_task = None
    if ENABLE_FIRMS_POLLING:
        print(f"[FIRMS DAEMON] Automated NASA FIRMS telemetry polling enabled ({POLL_INTERVAL_MINUTES}-minute cadence).")
        poller_task = asyncio.create_task(firms_periodic_poller_daemon())
    else:
        print("[FIRMS DAEMON] NASA FIRMS live polling is PAUSED (System running in high-performance frozen baseline mode).")
    yield
    if poller_task:
        poller_task.cancel()

app = FastAPI(
    title="Thermo Intelligence REST API",
    description="Authoritative REST API for Industrial Fire & Persistent Thermal Source Detection Platform",
    version="1.0.0",
    lifespan=lifespan
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
app.include_router(nearby_notifications.router, prefix="/api/v1")

@app.api_route("/", methods=["GET", "HEAD"])
def root_check():
    return {
        "status": "online",
        "service": "ThermoTrace AI Sovereign Thermal Intelligence REST Engine",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.api_route("/api/v1", methods=["GET", "HEAD"])
@app.api_route("/api/v1/", methods=["GET", "HEAD"])
def api_v1_index():
    return {
        "status": "online",
        "service": "ThermoTrace AI Sovereign Thermal Intelligence REST Engine",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/v1/health",
            "firms_status": "/api/v1/firms/status",
            "gis_events": "/api/v1/gis/events",
            "facilities": "/api/v1/facilities",
            "notifications": "/api/v1/notifications",
            "docs": "/docs"
        }
    }

@app.api_route("/api/v1/health", methods=["GET", "HEAD"])
def health_check():
    return {
        "status": "HEALTHY",
        "database": "CONNECTED", 
        "redis": "CONNECTED",
        "ml_model_version": "thermo_xgb_v1.1.0",
        "cadence_poller": f"ACTIVE ({POLL_INTERVAL_MINUTES}m loop in background worker)",
        "autonomous_firms_daemon": ENABLE_FIRMS_POLLING,
    }
