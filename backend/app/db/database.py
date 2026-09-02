import os
import subprocess
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

POSTGRES_USER = os.getenv("POSTGRES_USER", "thermo_admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "thermo_secret")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "thermo_db")

def _resolve_postgres_host() -> str:
    configured = os.getenv("POSTGRES_SERVER")
    candidates = []
    if configured:
        candidates.append(configured)
    candidates.extend(["postgres", "127.0.0.1", "localhost"])

    # Query WSL IP if available
    try:
        out = subprocess.check_output(["wsl", "-d", "Ubuntu", "hostname", "-I"], text=True, timeout=2).strip()
        candidates.extend(out.split())
    except Exception:
        pass

    for host in candidates:
        try:
            c = psycopg2.connect(
                host=host,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                dbname=POSTGRES_DB,
                connect_timeout=2
            )
            c.close()
            return host
        except Exception:
            continue

    return "127.0.0.1"

# Support Cloud DATABASE_URL (Supabase, Neon, Render Postgres) or Local Fallback
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    POSTGRES_SERVER = _resolve_postgres_host()
    SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True, pool_size=15, max_overflow=25)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
