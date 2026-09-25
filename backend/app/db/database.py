import math
import os
import re
import subprocess
try:
    import psycopg2
except ImportError:
    psycopg2 = None
from sqlalchemy import create_engine, event
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker, declarative_base
from geoalchemy2 import Geography, Geometry as GeoAlchemyGeometry
from shapely import wkb as shapely_wkb, wkt as shapely_wkt

# Compile GeoAlchemy2 Geography/Geometry types to TEXT when executing on embedded SQLite
@compiles(Geography, "sqlite")
def _compile_geography_sqlite(element, compiler, **kw):
    return "TEXT"

@compiles(GeoAlchemyGeometry, "sqlite")
def _compile_geometry_sqlite(element, compiler, **kw):
    return "TEXT"

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

DEFAULT_SUPABASE_DATABASE_URL = "postgresql://postgres.eeoadlzqlumdmikiitgm:Worksense%4012345@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
LOCAL_SOVEREIGN_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../data/sovereign_benchmark.sqlite")
)

if os.path.exists(LOCAL_SOVEREIGN_DB_PATH) and os.getenv("FORCE_REMOTE_SUPABASE", "false").lower() != "true":
    # Prioritize embedded local sovereign database to guarantee 0 MB Supabase egress and sub-millisecond reads
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{LOCAL_SOVEREIGN_DB_PATH}"
else:
    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL and DATABASE_URL.strip():
        SQLALCHEMY_DATABASE_URL = DATABASE_URL.strip().strip('"').strip("'")
        if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
            SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    else:
        SQLALCHEMY_DATABASE_URL = DEFAULT_SUPABASE_DATABASE_URL

def _parse_lon_lat(geom_val):
    if geom_val is None:
        return None
    try:
        s = str(geom_val).strip()
        if s.upper().startswith("SRID="):
            s = s.split(";", 1)[-1].strip()
        if any(s.upper().startswith(p) for p in ("POINT", "POLYGON", "MULTIPOLYGON", "LINESTRING", "GEOMETRYCOLLECTION")):
            shp = shapely_wkt.loads(s)
        else:
            shp = shapely_wkb.loads(bytes.fromhex(s))
        c = shp.centroid
        return (float(c.x), float(c.y))
    except Exception:
        return None

def _sqlite_st_distance(g1, g2) -> float:
    p1 = _parse_lon_lat(g1)
    p2 = _parse_lon_lat(g2)
    if not p1 or not p2:
        return 999999999.0
    lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
    lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.asin(min(1.0, math.sqrt(a)))
    return 6371000.0 * c

def _sqlite_st_dwithin(g1, g2, radius_m) -> int:
    try:
        return 1 if _sqlite_st_distance(g1, g2) <= float(radius_m or 0.0) else 0
    except Exception:
        return 0

def _sqlite_st_makepoint(lon, lat):
    if lon is None or lat is None:
        return None
    return f"POINT ({float(lon)} {float(lat)})"

def _sqlite_identity(val, *args):
    return val

class _SQLiteSTCollect:
    def __init__(self):
        self.pts = []

    def step(self, val):
        pt = _parse_lon_lat(val)
        if pt:
            self.pts.append(pt)

    def finalize(self):
        if not self.pts:
            return None
        from shapely.geometry import MultiPoint
        return MultiPoint(self.pts).wkt

def _sqlite_st_convexhull(geom_val):
    if not geom_val:
        return None
    try:
        shp = shapely_wkt.loads(str(geom_val))
        return shp.convex_hull.wkt
    except Exception:
        return str(geom_val)

def _sqlite_st_area(geom_val) -> float:
    if not geom_val:
        return 0.0
    try:
        shp = shapely_wkt.loads(str(geom_val))
        return float(shp.area) * (111320.0 ** 2)
    except Exception:
        return 0.0

def _sqlite_st_project(geom_val, dist_m, azimuth_rad):
    pt = _parse_lon_lat(geom_val)
    if not pt:
        return None
    lon1, lat1 = math.radians(pt[0]), math.radians(pt[1])
    d_rad = float(dist_m or 0.0) / 6371000.0
    brng = float(azimuth_rad or 0.0)
    lat2 = math.asin(math.sin(lat1) * math.cos(d_rad) + math.cos(lat1) * math.sin(d_rad) * math.cos(brng))
    lon2 = lon1 + math.atan2(math.sin(brng) * math.sin(d_rad) * math.cos(lat1), math.cos(d_rad) - math.sin(lat1) * math.sin(lat2))
    lon2_deg = ((math.degrees(lon2) + 180.0) % 360.0) - 180.0
    lat2_deg = math.degrees(lat2)
    return f"POINT ({lon2_deg} {lat2_deg})"

def _sqlite_st_x(geom_val):
    pt = _parse_lon_lat(geom_val)
    return float(pt[0]) if pt else None

def _sqlite_st_y(geom_val):
    pt = _parse_lon_lat(geom_val)
    return float(pt[1]) if pt else None

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    import sqlite3
    import uuid
    sqlite3.register_adapter(uuid.UUID, str)

    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _register_sqlite_spatial_functions(dbapi_conn, connection_record):
        dbapi_conn.create_function("ST_Distance", 2, _sqlite_st_distance)
        dbapi_conn.create_function("ST_DWithin", 3, _sqlite_st_dwithin)
        dbapi_conn.create_function("ST_MakePoint", 2, _sqlite_st_makepoint)
        dbapi_conn.create_function("ST_Point", 2, _sqlite_st_makepoint)
        dbapi_conn.create_function("ST_SetSRID", 2, _sqlite_identity)
        dbapi_conn.create_function("ST_AsEWKB", 1, _sqlite_identity)
        dbapi_conn.create_function("ST_AsBinary", 1, _sqlite_identity)
        dbapi_conn.create_function("GeomFromEWKT", 1, _sqlite_identity)
        dbapi_conn.create_function("ST_ConvexHull", 1, _sqlite_st_convexhull)
        dbapi_conn.create_function("ST_Area", 1, _sqlite_st_area)
        dbapi_conn.create_function("ST_Project", 3, _sqlite_st_project)
        dbapi_conn.create_function("ST_X", 1, _sqlite_st_x)
        dbapi_conn.create_function("ST_Y", 1, _sqlite_st_y)
        dbapi_conn.create_function("radians", 1, math.radians)
        dbapi_conn.create_aggregate("ST_Collect", 1, _SQLiteSTCollect)

    @event.listens_for(engine, "before_cursor_execute", retval=True)
    def _normalize_postgres_sql_for_sqlite(conn, cursor, statement, parameters, context, executemany):
        if "::geography" in statement or "::geometry" in statement or "ILIKE" in statement or "<->" in statement:
            statement = statement.replace("::geography", "").replace("::geometry", "")
            statement = re.sub(r"\bILIKE\b", "LIKE", statement, flags=re.IGNORECASE)
            statement = re.sub(
                r"(\w+)\s*<->\s*(ST_SetSRID\(ST_Point\([^)]+\),\s*\d+\))",
                r"ST_Distance(\1, \2)",
                statement,
            )
        return statement, parameters
else:
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

