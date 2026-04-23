#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$OUT_DIR"

API_SERVICE="${API_SERVICE:-${API_CONTAINER:-api}}"
UPLOAD_PATH="${UPLOAD_STORAGE_PATH:-/app/storage/uploads}"
OUT_FILE="$OUT_DIR/uploads_${TS}.tar.gz"

echo "Creating upload storage snapshot -> $OUT_FILE"
docker compose exec -T "$API_SERVICE" sh -lc \
  "tar -czf - -C \"$UPLOAD_PATH\" ." > "$OUT_FILE"

echo "Done: $OUT_FILE"
