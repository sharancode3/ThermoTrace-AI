import os
import socket
import subprocess
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

def _resolve_postgres_host(default_server: str, port: int) -> str:
    # 1. Quick probe default server (127.0.0.1)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.4)
    try:
        s.connect((default_server, port))
        s.close()
        return default_server
    except Exception:
        s.close()

    # 2. If on Windows WSL2, query WSL IP
    try:
        out = subprocess.check_output(["wsl", "-d", "Ubuntu", "hostname", "-I"], text=True, timeout=2).strip()
        for ip in out.split():
            s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s2.settimeout(0.4)
            try:
                s2.connect((ip, port))
                s2.close()
                return ip
            except Exception:
                s2.close()
    except Exception:
        pass

    return default_server

POSTGRES_USER = os.getenv("POSTGRES_USER", "thermo_admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "thermo_secret")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "thermo_db")

configured_server = os.getenv("POSTGRES_SERVER", "127.0.0.1")
POSTGRES_SERVER = _resolve_postgres_host(configured_server, POSTGRES_PORT)

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
