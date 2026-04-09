#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/uploads_snapshot.tar.gz"
  exit 1
fi

SNAPSHOT_FILE="$1"
if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  echo "Snapshot file not found: $SNAPSHOT_FILE"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_CONTAINER="${API_CONTAINER:-reconciliation_api}"
UPLOAD_PATH="${UPLOAD_STORAGE_PATH:-/app/storage/uploads}"

echo "Restoring uploads into $UPLOAD_PATH from $SNAPSHOT_FILE"
echo "WARNING: Existing files under upload storage will be replaced."

docker compose exec -T "$API_CONTAINER" sh -lc \
  "rm -rf \"$UPLOAD_PATH\"/* && mkdir -p \"$UPLOAD_PATH\""
cat "$SNAPSHOT_FILE" | docker compose exec -T "$API_CONTAINER" sh -lc \
  "tar -xzf - -C \"$UPLOAD_PATH\""

echo "Restore complete."
