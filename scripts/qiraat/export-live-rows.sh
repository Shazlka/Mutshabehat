#!/usr/bin/env bash
set -euo pipefail

# Export live qiraat rows for a page range as JSON.
# Usage:
#   scripts/qiraat/export-live-rows.sh <fromPage> <toPage> <out.json>
#
# Connects via psql "$PGCONN" using PGHOST/PGPORT/PGUSER/PGDATABASE env vars.
# Only live rows (deleted_at IS NULL on entries and loci).

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <fromPage> <toPage> <out.json>" >&2
  exit 1
fi

FROM_PAGE="$1"
TO_PAGE="$2"
OUT_FILE="$3"

if [ -z "${PGCONN:-}" ]; then
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5432}"
  PGUSER="${PGUSER:-postgres}"
  PGDATABASE="${PGDATABASE:-postgres}"
  PGCONN="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
fi

mkdir -p "$(dirname "$OUT_FILE")"

QUERY=$(cat <<EOF
SELECT coalesce(json_agg(item), '[]'::json)
FROM (
  SELECT json_build_object(
    'id', e.id,
    'kind', e.kind,
    'status', e.review_status,
    'device_id', e.device_id,
    'page', p.mushaf_page_number,
    'surah', l.surah_number,
    'ayah', l.start_ayah,
    'word', l.start_word,
    'end_word', coalesce(l.end_word, l.start_word),
    'base_text', l.base_text,
    'reading_text', vd.reading_text,
    'variant_type', vd.variant_type,
    'category_code', rd.category_code,
    'narrators', coalesce((
      SELECT json_agg(ea.authority_id ORDER BY ea.authority_id)
      FROM qiraat_entry_authorities ea
      WHERE ea.entry_id = e.id AND ea.deleted_at IS NULL
    ), '[]'::json)
  ) AS item
  FROM qiraat_entries e
  JOIN qiraat_loci l ON l.id = e.locus_id
  JOIN qiraat_pages p ON p.id = e.page_id
  LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
  LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
  WHERE e.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND p.mushaf_page_number BETWEEN ${FROM_PAGE} AND ${TO_PAGE}
  ORDER BY p.mushaf_page_number, l.surah_number, l.start_ayah, l.start_word, e.entry_order, e.id
) q;
EOF
)

psql "$PGCONN" -At -v ON_ERROR_STOP=1 -c "$QUERY" > "$OUT_FILE"
