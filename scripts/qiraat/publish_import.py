#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Publish APPROVED + VALID staging rows into the permanent Qiraat V2 schema.

    python3 scripts/qiraat/publish_import.py --batch <batch-uuid>

Never processes ERROR, REJECTED, NEEDS_MANUAL_MAPPING or duplicate rows (task requirement
#13). Runs as ONE database transaction: if anything fails, the whole publish is rolled back
and nothing is left half-written (task requirement #13, "If publication fails: ROLL BACK
THE ENTIRE PUBLICATION TRANSACTION.").

"Publish" here means: copy the row's normalized data into the real `qiraat_pages` /
`qiraat_loci` / `qiraat_entries` / ... tables (the same ones the hand-authored Python
datasets already populate) at verification_status = 'REVIEWED'. This is a SEPARATE gate
from that status reaching VERIFIED/PUBLISHED — `qiraat_export_page()` only ever serves
VERIFIED/PUBLISHED rows to the live Mushaf (see supabase/migrations/20260917120000_
qiraat_v2_schema.sql §15), so a bulk-published Excel batch still cannot reach a reader
without a second, later, explicit promotion — exactly the "nothing reaches the Mushaf
without approval" requirement, enforced twice rather than once.

Locus identity is derived from the resolved token anchor (surah/start_ayah/start_word/
end_ayah/end_word), NOT from the source row. Two different Excel rows anchored to the same
Quran position therefore land on the SAME locus as two different entries (entry_order 1, 2,
...) automatically — this is what lets "one word has two أوجه, reported on two spreadsheet
rows" behave correctly without a separate grouping column.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import psycopg2
import psycopg2.extras

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'qiraat'))

XLSX_SOURCE_DOC = 'XLSX-IMPORT'

VARIANT_TYPE_BY_CATEGORY = {
    'TARQIQ_RA': 'other', 'TAGHLIZ_LAM': 'other', 'MADD_BADAL': 'madd', 'MADD_LIN': 'madd',
    'IMALAH_TAQLIL': 'imalah', 'IDGHAM_SAGHIR': 'idgham', 'IDGHAM_KABIR': 'idgham',
    'TAGHYIR_HAMZ': 'hamza', 'HAMZATAN_KALIMA': 'hamza', 'HAMZATAN_KALIMATAYN': 'hamza',
}


def locus_id_for(anchor: dict) -> str:
    return (f"IMP-S{anchor['surah']}-A{anchor['startAyah']}-W{anchor['startWord']}"
            f"-E{anchor['endAyah']}-{anchor['endWord']}")


def ensure_source_document(cur):
    cur.execute(
        """INSERT INTO qiraat_source_documents (id, name_ar, document_type, notes)
           VALUES (%s, %s, 'other', %s)
           ON CONFLICT (id) DO NOTHING""",
        (XLSX_SOURCE_DOC, 'استيراد جماعي من ملفات إكسل', 'Created by scripts/qiraat/publish_import.py'),
    )


def ensure_page(cur, page: int, surah: int, surah_name: str, ayah: int):
    cur.execute(
        """INSERT INTO qiraat_pages
             (source_document_id, source_page_number, mushaf_page_number, surah_number,
              surah_name_ar, ayah_from, ayah_to, extraction_status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, 'REVIEWED')
           ON CONFLICT (source_document_id, source_page_number) DO UPDATE SET
             ayah_from = LEAST(qiraat_pages.ayah_from, EXCLUDED.ayah_from),
             ayah_to   = GREATEST(qiraat_pages.ayah_to, EXCLUDED.ayah_to)
           RETURNING id""",
        (XLSX_SOURCE_DOC, page, page, surah, surah_name, ayah, ayah),
    )
    return cur.fetchone()['id']


def check_production_conflict(cur, anchor: dict, base_text_normalized: str):
    """A PUBLISHED/VERIFIED locus already sits at this exact Quran position with a
    DIFFERENT base text — never silently overwritten (task requirement #15)."""
    lid = locus_id_for(anchor)
    cur.execute(
        """SELECT l.base_text_normalized FROM qiraat_loci l
           JOIN qiraat_entries e ON e.locus_id = l.id
          WHERE l.id = %s AND e.verification_status IN ('VERIFIED', 'PUBLISHED')
          LIMIT 1""",
        (lid,),
    )
    row = cur.fetchone()
    if row and row['base_text_normalized'] != base_text_normalized:
        return {'existingLocusId': lid, 'existingBaseText': row['base_text_normalized']}
    return None


def next_entry_order(cur, locus_id: str, kind: str) -> int:
    cur.execute(
        "SELECT COALESCE(MAX(entry_order), 0) AS n FROM qiraat_entries WHERE locus_id = %s AND kind = %s",
        (locus_id, kind),
    )
    return cur.fetchone()['n'] + 1


def ensure_locus(cur, page_id, anchor, occurrence_note):
    lid = locus_id_for(anchor)
    cur.execute(
        """INSERT INTO qiraat_loci
             (id, page_id, surah_number, start_ayah, start_word, end_ayah, end_word,
              base_text, base_text_normalized, occurrence_note, mapping_status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'verified')
           ON CONFLICT (id) DO NOTHING""",
        (lid, page_id, anchor['surah'], anchor['startAyah'], anchor['startWord'],
         anchor['endAyah'], anchor['endWord'], anchor['baseText'],
         normalize_for_storage(anchor['baseText']), occurrence_note),
    )
    return lid


def normalize_for_storage(text: str) -> str:
    import tokens as T
    return T.norm(text)


def publish_row(cur, row) -> dict:
    normalized = row['normalized']
    anchor = normalized.get('anchor')
    if not anchor:
        raise RuntimeError(f"row {row['id']} has no token anchor — should never reach publish")

    conflict = check_production_conflict(cur, anchor, normalize_for_storage(anchor['baseText']))
    if conflict:
        return {'skipped': True, 'reason': 'PRODUCTION_CONFLICT', 'detail': conflict}

    page_id = ensure_page(cur, normalized['mushaf_page'], normalized['surah_number'],
                           normalized.get('surah_name') or '', normalized['ayah_from'])
    locus_id = ensure_locus(cur, page_id, anchor, normalized.get('occurrence_note'))

    is_variant = bool(normalized.get('variant_text'))
    kind = 'variant' if is_variant else 'ruling'
    entry_order = next_entry_order(cur, locus_id, kind)
    entry_id = f"{locus_id}-{'V' if is_variant else 'R'}{entry_order}"
    attribution_mode = 'remainder' if normalized.get('attribution_is_remainder') else 'explicit'

    cur.execute(
        """INSERT INTO qiraat_entries
             (id, locus_id, page_id, kind, entry_order, attribution_mode,
              verification_status, notes)
           VALUES (%s, %s, %s, %s, %s, %s, 'REVIEWED', %s)""",
        (entry_id, locus_id, page_id, kind, entry_order, attribution_mode,
         normalized.get('source_note')),
    )

    if is_variant:
        cur.execute(
            """INSERT INTO qiraat_variant_details
                 (entry_id, reading_text, reading_text_normalized, description_ar, variant_type)
               VALUES (%s, %s, %s, %s, %s)""",
            (entry_id, normalized['variant_text'], normalize_for_storage(normalized['variant_text']),
             normalized.get('description'), 'other'),
        )
    else:
        category_code = normalized.get('category_code')
        cur.execute(
            """INSERT INTO qiraat_ruling_details (entry_id, category_code, text_ar)
               VALUES (%s, %s, %s)""",
            (entry_id, category_code, normalized.get('description') or normalized.get('attribution_raw')),
        )

    if attribution_mode == 'explicit':
        for reading_id in normalized.get('attribution_readings', []):
            cur.execute(
                """INSERT INTO qiraat_entry_authorities (entry_id, authority_id, is_default)
                   VALUES (%s, %s, true)
                   ON CONFLICT (entry_id, authority_id, COALESCE(action_ar, '')) DO NOTHING""",
                (entry_id, reading_id),
            )
    cur.execute("SELECT qiraat_rebuild_locus_readings(%s)", (locus_id,))

    evidence = normalized.get('evidence') or {}
    for source_id, text in evidence.items():
        sd = source_id if source_id in ('SH', 'D') else None
        if not sd or not text:
            continue
        cur.execute(
            """INSERT INTO qiraat_evidence_texts (source_document_id, text_ar, text_normalized)
               VALUES (%s, %s, %s)
               ON CONFLICT (source_document_id, text_normalized) DO UPDATE SET text_ar = EXCLUDED.text_ar
               RETURNING id""",
            (sd, text, normalize_for_storage(text)),
        )
        evidence_id = cur.fetchone()['id']
        cur.execute(
            """INSERT INTO qiraat_evidence_links (evidence_text_id, page_id, locus_id)
               VALUES (%s, %s, %s)
               ON CONFLICT (evidence_text_id, page_id, locus_id) DO NOTHING""",
            (evidence_id, page_id, locus_id),
        )

    return {'skipped': False, 'locusId': locus_id, 'entryId': entry_id}


def main():
    p = argparse.ArgumentParser(description='Publish approved Qiraat import rows into the V2 schema.')
    p.add_argument('--batch', required=True)
    p.add_argument('--db-url', default=os.environ.get('QIRAAT_DATABASE_URL') or os.environ.get('DATABASE_URL'))
    args = p.parse_args()
    if not args.db_url:
        print('QIRAAT_DATABASE_URL is required.', file=sys.stderr)
        sys.exit(2)

    conn = psycopg2.connect(args.db_url)
    published, skipped, errors = 0, 0, 0
    try:
        with conn:  # one transaction; any exception rolls EVERYTHING back
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                ensure_source_document(cur)
                cur.execute(
                    """SELECT id, normalized FROM qiraat_import_rows
                        WHERE batch_id = %s AND validation_status = 'valid'
                          AND review_status = 'approved' AND duplicate_status = 'none'
                        ORDER BY id""",
                    (args.batch,),
                )
                rows = cur.fetchall()
                if not rows:
                    print('No approved+valid+non-duplicate rows to publish in this batch.')
                    return
                for row in rows:
                    result = publish_row(cur, row)
                    if result['skipped']:
                        skipped += 1
                        cur.execute(
                            """UPDATE qiraat_import_rows
                                 SET review_status = 'needs_correction',
                                     production_conflict = %s
                               WHERE id = %s""",
                            (json.dumps(result['detail'], ensure_ascii=False), row['id']),
                        )
                        cur.execute(
                            """INSERT INTO qiraat_import_row_events (row_id, event_type, note)
                               VALUES (%s, 'needs_correction', %s)""",
                            (row['id'], f"production conflict: {result['detail']}"),
                        )
                    else:
                        published += 1
                        cur.execute(
                            """UPDATE qiraat_import_rows
                                 SET review_status = 'published', published_locus_id = %s,
                                     published_entry_id = %s, published_at = now()
                               WHERE id = %s""",
                            (result['locusId'], result['entryId'], row['id']),
                        )
                        cur.execute(
                            """INSERT INTO qiraat_import_row_events (row_id, event_type, after_value)
                               VALUES (%s, 'published', %s)""",
                            (row['id'], json.dumps(result, ensure_ascii=False)),
                        )
                cur.execute(
                    """UPDATE qiraat_import_batches
                         SET status = 'PUBLISHED', rows_published = %s, published_at = now()
                       WHERE id = %s""",
                    (published, args.batch),
                )
    except Exception as e:
        import traceback
        errors += 1
        print(f'PUBLISH FAILED, transaction rolled back: {e}', file=sys.stderr)
        traceback.print_exc()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE qiraat_import_batches SET status = 'FAILED', error_message = %s WHERE id = %s",
                    (str(e), args.batch),
                )
            conn.commit()
        except Exception:
            pass
        sys.exit(1)
    finally:
        conn.close()

    print(f'Published: {published}')
    print(f'Skipped (production conflict, needs manual correction): {skipped}')


if __name__ == '__main__':
    main()
