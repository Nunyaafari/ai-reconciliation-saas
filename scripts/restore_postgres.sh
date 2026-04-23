#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/postgres_dump.sql.gz"
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Backup file not found: $DUMP_FILE"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_SERVICE="${POSTGRES_SERVICE:-${POSTGRES_CONTAINER:-postgres}}"
POSTGRES_USER="${POSTGRES_USER:-dev}"
POSTGRES_DB="${POSTGRES_DB:-reconciliation}"

echo "Restoring postgres database '$POSTGRES_DB' from $DUMP_FILE"
echo "WARNING: This will replace schema contents in target database."

zcat "$DUMP_FILE" | docker compose exec -T "$POSTGRES_SERVICE" sh -lc \
  "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -v ON_ERROR_STOP=1"

echo "Restore complete."
