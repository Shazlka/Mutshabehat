#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/../.." && pwd)"
output_file="$(mktemp)"
trap 'rm -f "$output_file"' EXIT

if docker exec -i mutshabehat-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres --single-transaction < "$root_dir/tests/qiraat/batch-rollback.test.sql" >"$output_file" 2>&1; then
  cat "$output_file"
  echo "expected isolated rollback test to terminate with its sentinel" >&2
  exit 1
fi
if ! grep -q 'phase4 batch rollback test complete: intentional rollback' "$output_file"; then
  cat "$output_file"
  exit 1
fi
if [ "$(docker exec mutshabehat-db psql -U postgres -d postgres -Atc "select count(*) from qiraat_annotations where notes like 'phase4 %';")" != "0" ]; then
  echo "synthetic Phase 4 annotations escaped the test transaction" >&2
  exit 1
fi
echo "Phase 4 batch rollback regression passed with no synthetic residue."
