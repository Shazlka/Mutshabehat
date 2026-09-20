#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate per-page Qiraat JSON fixtures FROM PostgreSQL (task requirement #16).

    python3 scripts/qiraat/export_from_postgres.py --out packages/qiraat-core/fixtures/pages-from-db

Calls the existing `qiraat_export_page()` SQL function (supabase/migrations/
20260917120000_qiraat_v2_schema.sql §15) for every Mushaf page that has at least one
VERIFIED/PUBLISHED entry, and converts its JSON into the SAME shape the app's hand-authored
fixtures already use (`QiraatVariant[]` / `QiraatRuling[]`, packages/qiraat-core/types.ts) —
so the direction is now Postgres -> generated JSON, not Python dataset -> Postgres.

IMPORTANT — this writes to a SEPARATE output directory, never over
`packages/qiraat-core/fixtures/{pages,rulings}/`, and never touches
`packages/qiraat-core/repository.ts`'s loader tables. Wiring a page's DB-generated fixture
into the live app (replacing its hand-authored file, or adding a newly-published page) is a
deliberate, reviewed, one-page-at-a-time step — exactly like every existing page-batch import
in this project's changelog — never an automatic side effect of running this script. See
docs/qiraat/excel-import-system.md "How to regenerate fixtures".
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'qiraat'))
from build_rulings import CATEGORIES  # noqa: E402  (label, color, word_anchored) per category code

NOW = datetime.now(timezone.utc).isoformat()


def variant_from_entry(entry: dict, page_number: int) -> dict:
    locus = entry['locus']
    variant = entry.get('variant') or {}
    reading_text = variant.get('readingText', '')
    hafs_text = locus['baseText']
    out = {
        'id': entry['id'],
        'surah': locus['surah'],
        'ayah': locus['startAyah'],
        'startToken': locus['startWord'],
        'endToken': locus['endWord'],
        'operation': 'REPLACE' if reading_text != hafs_text else 'KEEP',
        'hafsText': hafs_text,
        'variantText': reading_text,
        'differenceType': 'OTHER',
        'verificationStatus': entry['status'],
        'createdAt': NOW,
        'updatedAt': NOW,
        'readingIds': entry.get('readingIds') or [],
    }
    if variant.get('uthmaniText'):
        out['uthmaniText'] = variant['uthmaniText']
    if variant.get('description'):
        out['notes'] = variant['description']
    if variant.get('performanceNote'):
        out['performanceNote'] = variant['performanceNote']
    if locus.get('endAyah') and locus['endAyah'] != locus['startAyah']:
        out['locusType'] = 'multi_word_variant'
    evidence = entry.get('evidence') or []
    if evidence:
        out['sources'] = [
            {
                'id': f"{entry['id']}-src{i}",
                'sourceName': 'استيراد جماعي (Excel)' if e.get('source') not in ('SH', 'D') else
                              ('حرز الأماني ووجه التهاني (الشاطبية)' if e['source'] == 'SH' else 'الدرة المضية'),
                'sourceType': 'other',
                'sourceReference': f"صفحة المصحف {page_number}",
                'sourceText': e.get('text'),
            }
            for i, e in enumerate(evidence)
        ]
    return out


def ruling_from_entry(entry: dict, page_number: int) -> dict:
    locus = entry['locus']
    ruling = entry.get('ruling') or {}
    category = ruling.get('category', 'AYAH_COUNT')
    label, color, word_anchored = CATEGORIES.get(category, (ruling.get('categoryAr', ''), '#64748B', True))
    attribution = entry.get('attribution') or []
    readings = []
    for a in attribution:
        for rid in (a.get('readingIds') or []):
            readings.append({'readingId': rid, 'action': a.get('action') or '', 'isDefault': a.get('isDefault', True)})
    # readingIds on the entry are already the fully-expanded set; fall back to that when the
    # per-authority breakdown isn't present in the export payload.
    if not readings and entry.get('readingIds'):
        readings = [{'readingId': r, 'action': '', 'isDefault': True} for r in entry['readingIds']]
    return {
        'id': entry['id'],
        'pageNumber': page_number,
        'category': category,
        'categoryAr': ruling.get('categoryAr', label),
        'color': color,
        'wordAnchored': ruling.get('wordAnchored', word_anchored),
        'surah': locus['surah'],
        'ayah': locus['startAyah'],
        'startToken': locus['startWord'],
        'endToken': locus['endWord'],
        'endAyah': locus.get('endAyah', locus['startAyah']),
        'baseText': locus['baseText'],
        'verificationStatus': entry['status'],
        'attribution': [
            {'authorityId': a['authorityId'], 'action': a.get('action') or '', 'condition': a.get('condition')}
            for a in attribution
        ],
        'readings': readings,
        'hasAlternate': bool(entry.get('alternates')),
        'text': ruling.get('text'),
        'countSchools': ruling.get('countSchools'),
        'createdAt': NOW,
        'updatedAt': NOW,
    }


def export_page(cur, page: int, include_unpublished: bool):
    cur.execute("SELECT qiraat_export_page(%s::smallint, %s) AS data", (page, include_unpublished))
    row = cur.fetchone()
    return row['data'] if row else None


def main():
    p = argparse.ArgumentParser(description='Generate Qiraat JSON fixtures from PostgreSQL.')
    p.add_argument('--out', default=os.path.join(ROOT, 'packages', 'qiraat-core', 'fixtures', 'pages-from-db'))
    p.add_argument('--pages', help='Comma-separated page list, default: every page with data.')
    p.add_argument('--include-unpublished', action='store_true',
                   help='Also export REVIEWED-tier entries (developer preview only — never for the live app).')
    p.add_argument('--db-url', default=os.environ.get('QIRAAT_DATABASE_URL') or os.environ.get('DATABASE_URL'))
    args = p.parse_args()
    if not args.db_url:
        print('QIRAAT_DATABASE_URL is required.', file=sys.stderr)
        sys.exit(2)

    variants_dir = os.path.join(args.out, 'pages')
    rulings_dir = os.path.join(args.out, 'rulings')
    os.makedirs(variants_dir, exist_ok=True)
    os.makedirs(rulings_dir, exist_ok=True)

    conn = psycopg2.connect(args.db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if args.pages:
                pages = [int(p) for p in args.pages.split(',')]
            else:
                cur.execute("SELECT DISTINCT mushaf_page_number FROM qiraat_pages WHERE mushaf_page_number IS NOT NULL ORDER BY 1")
                pages = [r['mushaf_page_number'] for r in cur.fetchall()]

            written = 0
            for page in pages:
                data = export_page(cur, page, args.include_unpublished)
                entries = (data or {}).get('entries', [])
                variants = [variant_from_entry(e, page) for e in entries if e['kind'] == 'variant']
                rulings = [ruling_from_entry(e, page) for e in entries if e['kind'] == 'ruling']
                if not variants and not rulings:
                    continue
                with open(os.path.join(variants_dir, f'page-{page:03d}.json'), 'w', encoding='utf-8') as f:
                    json.dump(variants, f, ensure_ascii=False, indent=2)
                with open(os.path.join(rulings_dir, f'page-{page:03d}.json'), 'w', encoding='utf-8') as f:
                    json.dump(rulings, f, ensure_ascii=False, indent=2)
                written += 1
                print(f'page {page}: {len(variants)} variants, {len(rulings)} rulings')
            print(f'Wrote {written} pages to {args.out}')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
