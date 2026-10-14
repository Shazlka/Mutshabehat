#!/usr/bin/env bash
# usage: PGCONN=... scripts/qiraat/gate.sh <label>   -> artifacts/gate/<label>.txt (and stdout)
set -euo pipefail
LABEL="${1:-now}"
mkdir -p "$(dirname "$0")/../../artifacts/gate"
OUT="$(dirname "$0")/../../artifacts/gate/${LABEL}.txt"
psql "${PGCONN:?set PGCONN}" -tA -f "$(dirname "$0")/gate.sql" | sed '/^$/d' | tee "$OUT"
