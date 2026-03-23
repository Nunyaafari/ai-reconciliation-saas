#!/bin/sh
set -eu

BOOTSTRAP_OUTPUT_FILE="$(mktemp)"
python -m app.database.bootstrap >"$BOOTSTRAP_OUTPUT_FILE" 2>&1
cat "$BOOTSTRAP_OUTPUT_FILE" >&2
BOOTSTRAP_STATE="$(tail -n 1 "$BOOTSTRAP_OUTPUT_FILE" | tr -d '\r')"
rm -f "$BOOTSTRAP_OUTPUT_FILE"

if [ "$BOOTSTRAP_STATE" = "legacy" ]; then
  echo "Legacy schema detected. Stamping current migration head after compatibility sync..."
  alembic stamp head
else
  echo "Running database migrations..."
  alembic upgrade head
fi

if [ "${APP_ENV:-development}" = "production" ]; then
  exec uvicorn app.main:app --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
fi

exec uvicorn app.main:app --reload --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
