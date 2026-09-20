import os
import subprocess
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables from root and backend .env files
root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env"))
backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))

for ef in [root_env, backend_env]:
    if os.path.exists(ef):
        with open(ef, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    val = v.strip().strip('"').strip("'")
                    os.environ[k.strip()] = val

POSTGRES_USER = os.getenv("POSTGRES_USER", "thermo_admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "thermo_secret")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "thermo_db")

def _resolve_postgres_host() -> str:
    configured = os.getenv("POSTGRES_SERVER", "127.0.0.1")
    candidates = [configured, "127.0.0.1", "localhost", "postgres"]

    for host in candidates:
        try:
            c = psycopg2.connect(
                host=host,
                port=POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                dbname=POSTGRES_DB,
                connect_timeout=1
            )
            c.close()
            return host
        except Exception:
            continue

    return "127.0.0.1"

DEFAULT_SUPABASE_DATABASE_URL = "postgresql://postgres.mlkgaoxnvptewcxblmes:Sharan1%40bmsce@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.strip():
    SQLALCHEMY_DATABASE_URL = DATABASE_URL.strip().strip('"').strip("'")
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    # Default to production Supabase PostGIS database instance
    SQLALCHEMY_DATABASE_URL = DEFAULT_SUPABASE_DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_timeout=15,
    pool_recycle=300
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
