#!/usr/bin/env bash
# Database backup script (Linux/macOS)
# Usage: ./scripts/backup-db.sh

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${OUTPUT_DIR}/mrh-academy-${TIMESTAMP}.sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL environment variable is required" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
echo "Backing up database to ${OUTPUT_FILE} ..."
pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$OUTPUT_FILE"
echo "Backup completed: ${OUTPUT_FILE}"
