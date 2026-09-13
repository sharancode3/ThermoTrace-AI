from pathlib import Path

from sqlalchemy import text


def apply_runtime_migrations(engine) -> None:
    """Apply additive, idempotent migrations for deployments without Alembic."""
    migration_dir = Path(__file__).resolve().parents[2] / "migrations"
    with engine.begin() as connection:
        for path in sorted(migration_dir.glob("*.sql")):
            connection.execute(text(path.read_text(encoding="utf-8")))
