#!/bin/sh
set -eu

echo "Waiting for API-led database migrations to complete..."
python - <<'PY'
import time

from sqlalchemy import create_engine, inspect, text

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

deadline = time.time() + 180

while time.time() < deadline:
    try:
        inspector = inspect(engine)
        if "alembic_version" in inspector.get_table_names():
            with engine.connect() as connection:
                connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
            print("Migration metadata found. Worker can start.")
            break
    except Exception:
        pass
    time.sleep(2)
else:
    raise SystemExit("Timed out waiting for database migrations to complete")
PY

exec rq worker reconciliation -u "${REDIS_URL:-redis://redis:6379/0}"
