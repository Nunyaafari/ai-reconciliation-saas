#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$OUT_DIR"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-reconciliation_db}"
POSTGRES_USER="${POSTGRES_USER:-dev}"
POSTGRES_DB="${POSTGRES_DB:-reconciliation}"

OUT_FILE="$OUT_DIR/postgres_${POSTGRES_DB}_${TS}.sql.gz"

echo "Creating postgres backup -> $OUT_FILE"
docker compose exec -T "$POSTGRES_CONTAINER" sh -lc \
  "pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" --no-owner --no-privileges" \
  | gzip > "$OUT_FILE"

echo "Done: $OUT_FILE"
