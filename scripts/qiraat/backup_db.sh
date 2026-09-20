#!/usr/bin/env bash
# Back up the Qiraat database before a bulk publish (task requirement #30).
#
#   QIRAAT_DATABASE_URL=postgresql://... bash scripts/qiraat/backup_db.sh
#
# Writes a timestamped pg_dump (custom format, -Fc) into backups/. Never overwrites or
# deletes an existing backup — every run gets its own filename. This mirrors the backup
# convention already used elsewhere in this project (CLAUDE.md "Applying DB DDL"): back up,
# then act, never the other way around.
set -euo pipefail

: "${QIRAAT_DATABASE_URL:?Set QIRAAT_DATABASE_URL first (see .env.example).}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/pre-qiraat-publish-${STAMP}.dump"

if [ -e "$OUT" ]; then
  echo "Refusing to overwrite existing backup: $OUT" >&2
  exit 1
fi

echo "Backing up to ${OUT} ..."
pg_dump -Fc "$QIRAAT_DATABASE_URL" > "$OUT"
echo "Backup complete: ${OUT} ($(du -h "$OUT" | cut -f1))"
echo "Publishing is safe to proceed. Restore with: pg_restore -d <target> ${OUT}"
