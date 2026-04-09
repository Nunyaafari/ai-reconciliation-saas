#!/bin/sh
set -eu

BOOTSTRAP_STATE=""
PSQL_DATABASE_URL="$(printf '%s' "${DATABASE_URL:-}" | sed 's#^postgresql+psycopg://#postgresql://#')"

if [ -n "$PSQL_DATABASE_URL" ] && psql "$PSQL_DATABASE_URL" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alembic_version' LIMIT 1" \
  2>/dev/null | grep -q 1; then
  BOOTSTRAP_STATE="managed"
  echo "$BOOTSTRAP_STATE"
else
  BOOTSTRAP_OUTPUT_FILE="$(mktemp)"
  python -m app.database.bootstrap >"$BOOTSTRAP_OUTPUT_FILE" 2>&1
  cat "$BOOTSTRAP_OUTPUT_FILE" >&2
  BOOTSTRAP_STATE="$(tail -n 1 "$BOOTSTRAP_OUTPUT_FILE" | tr -d '\r')"
  rm -f "$BOOTSTRAP_OUTPUT_FILE"
fi

if [ "$BOOTSTRAP_STATE" = "legacy" ]; then
  echo "Legacy schema detected. Stamping current migration head after compatibility sync..."
  alembic stamp head
elif [ "$BOOTSTRAP_STATE" = "fresh" ]; then
  echo "Running database migrations..."
  alembic upgrade head
else
  echo "Migration metadata already present. Skipping startup migration run."
fi

if [ "${APP_ENV:-development}" = "production" ] || [ "${API_RELOAD:-false}" != "true" ]; then
  exec uvicorn app.main:app \
    --host "${API_HOST:-0.0.0.0}" \
    --port "${API_PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}"
fi

exec uvicorn app.main:app --reload --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
