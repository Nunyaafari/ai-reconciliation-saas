#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_URL="${API_URL:-http://127.0.0.1:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3001}"
SKIP_FRONTEND_CHECK="${SKIP_FRONTEND_CHECK:-false}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-8}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "ERROR: docker compose/docker-compose not found."
  exit 1
fi

compose() {
  "${COMPOSE_CMD[@]}" "$@"
}

require_running_service() {
  local service="$1"
  local running
  running="$(compose ps --services --filter status=running | tr -d '\r')"
  if ! grep -qx "$service" <<<"$running"; then
    echo "ERROR: Service '$service' is not running."
    echo "Hint: docker compose up -d"
    exit 1
  fi
}

echo "==> Verifying required services are running..."
require_running_service api
require_running_service worker
require_running_service postgres
require_running_service redis
if [ "$SKIP_FRONTEND_CHECK" != "true" ]; then
  require_running_service frontend
fi

echo "==> Running Alembic migrations to head inside api container..."
compose exec -T api sh -lc "cd /app && alembic upgrade head"

echo "==> Checking API health endpoint..."
for i in {1..20}; do
  if curl --fail --silent --show-error --connect-timeout 3 --max-time "$HEALTH_TIMEOUT_SECONDS" "$API_URL/health" >/dev/null 2>&1; then
    echo "API health check passed."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "ERROR: API health check failed at $API_URL/health"
    exit 1
  fi
  sleep 1
done

echo "==> Checking worker process and Redis queue connectivity..."
compose exec -T api sh -lc "python - <<'PY'
from redis import Redis
from rq import Queue, Worker
from app.config import settings

conn = Redis.from_url(settings.REDIS_URL)
conn.ping()

queue = Queue('reconciliation', connection=conn)
workers = Worker.all(connection=conn)
recon_workers = [w for w in workers if 'reconciliation' in (w.queue_names() or [])]

print(f'Redis ping: OK')
print(f'Queue length: {len(queue)}')
print(f'Reconciliation workers: {len(recon_workers)}')

if not recon_workers:
    raise SystemExit('No reconciliation worker registered in Redis')
PY"

if [ "$SKIP_FRONTEND_CHECK" != "true" ]; then
  echo "==> Running frontend startup smoke check..."
  for i in {1..20}; do
    if curl --fail --silent --show-error --connect-timeout 3 --max-time "$HEALTH_TIMEOUT_SECONDS" "$FRONTEND_URL" >/dev/null 2>&1; then
      echo "Frontend smoke check passed."
      break
    fi
    if [ "$i" -eq 20 ]; then
      echo "ERROR: Frontend smoke check failed at $FRONTEND_URL"
      exit 1
    fi
    sleep 1
  done
else
  echo "==> SKIP_FRONTEND_CHECK=true, skipping frontend smoke check."
fi

echo "==> Pre-deploy checks passed."
