import sys
import os
import subprocess
import socket
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

def get_postgres_server():
    server = os.getenv("POSTGRES_SERVER")
    if server:
        return server
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect(('127.0.0.1', 5432))
        s.close()
        return '127.0.0.1'
    except Exception:
        pass
    
    try:
        res = subprocess.run(['wsl.exe', '-u', 'root', '-e', 'hostname', '-I'], capture_output=True, text=True, timeout=5)
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip().split()[0]
    except Exception:
        pass
    return '127.0.0.1'

POSTGRES_USER = os.getenv("POSTGRES_USER", "thermo_admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "thermo_secret")
POSTGRES_SERVER = get_postgres_server()
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "thermo_db")

SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
