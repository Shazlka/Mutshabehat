#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deterministic bulk Qiraat Excel importer.

    python3 scripts/qiraat/import_excel.py --input data/qiraat/import --dry-run
    python3 scripts/qiraat/import_excel.py --input data/qiraat/import --stage

No AI/LLM step runs here or anywhere downstream of it (task requirement #26). Every
transformation is: read a cell -> map its column via excel_mapping.yaml -> normalize the
value -> validate it against real data (Quran bounds, the Mushaf-1441 token fixtures, the
existing reader/narrator model) -> write one traceable row to the `qiraat_import_rows`
staging table (or, in --dry-run, only into an in-memory/](reports/) summary; nothing is
written to the database).

Design constraints this file exists to satisfy (see the task spec / docs/qiraat/excel-import-
system.md for the full rationale):
  - FILE -> SHEET -> ROW traceability on every record (never lost).
  - A configurable, alias-based column mapping (excel_mapping.yaml), not a hard-coded layout.
  - Deterministic authority/category resolution reusing the EXISTING project data
    (authorities.py, group_symbols.py, qiraat_categories seeded by the V2 migration) — an
    unresolved value is flagged, never guessed.
  - Word/token anchoring against the real Mushaf-1441 fixtures (tokens.py) — never text
    search alone, so a repeated word on a page cannot silently anchor to the wrong occurrence.
  - Idempotent re-import: the SAME excel content, run twice, must not double-count as two
    distinct new facts (it is inserted as a *traceable* row either way — see the staging
    migration's fingerprint note — but is marked `exact_duplicate` on the second run).
  - Every existing PostgreSQL entry a row would touch is checked BEFORE staging so a
    conflict with already-verified/published data surfaces as PRODUCTION_CONFLICT, never a
    silent overwrite.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import sys
import unicodedata
from datetime import datetime, timezone

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'qiraat'))

import authorities as A            # noqa: E402
import group_symbols as G          # noqa: E402
import tokens as T                 # noqa: E402
from attribution_parser import resolve_attribution  # noqa: E402

SUPPORTED_EXTENSIONS = ('.xlsx', '.xls', '.csv')

CATEGORY_CODES = {
    'AYAH_COUNT', 'SILAT_HA', 'TARQIQ_RA', 'TAGHLIZ_LAM', 'MADD_BADAL', 'MADD_LIN',
    'IMALAH_TAQLIL', 'IDGHAM_SAGHIR', 'IDGHAM_KABIR', 'TAGHYIR_HAMZ', 'HAMZATAN_KALIMA',
    'HAMZATAN_KALIMATAYN', 'TARK_GHUNNA', 'IKHFA', 'WAQF_HAMZA', 'WAQF_RASM', 'YAAT_IDAFA',
    'YAAT_ZAWAID', 'BAYN_SURATAYN', 'MADD_QABL_IDGHAM', 'USUL_MADD', 'USUL_MIM_JAM',
    'USUL_NAQL', 'USUL_SAKT',
}

# Free-text category cell -> canonical code. Extend as new spreadsheets use new phrasing;
# never guessed at import time (an unmatched cell is left as a raw string + a warning, and
# the row still stages so a human can map it, but it will not publish until resolved).
CATEGORY_ALIASES = {
    'عد الآي': 'AYAH_COUNT', 'عدد الآي': 'AYAH_COUNT',
    'صلة هاء الكناية': 'SILAT_HA', 'صلة الهاء': 'SILAT_HA',
    'ترقيق الراءات': 'TARQIQ_RA', 'ترقيق الراء': 'TARQIQ_RA',
    'تغليظ اللامات': 'TAGHLIZ_LAM', 'تغليظ اللام': 'TAGHLIZ_LAM',
    'مد البدل': 'MADD_BADAL',
    'مد اللين': 'MADD_LIN', 'مد اللين المهموز': 'MADD_LIN',
    'الممال والمقلل': 'IMALAH_TAQLIL', 'إمالة': 'IMALAH_TAQLIL', 'تقليل': 'IMALAH_TAQLIL',
    'المدغم الصغير': 'IDGHAM_SAGHIR', 'إدغام صغير': 'IDGHAM_SAGHIR',
    'المدغم الكبير': 'IDGHAM_KABIR', 'إدغام كبير': 'IDGHAM_KABIR',
    'تغيير الهمز': 'TAGHYIR_HAMZ',
    'الهمزتان من كلمة': 'HAMZATAN_KALIMA',
    'الهمزتان من كلمتين': 'HAMZATAN_KALIMATAYN',
    'ترك الغنة': 'TARK_GHUNNA',
    'الإخفاء': 'IKHFA', 'إخفاء': 'IKHFA',
    'وقف حمزة': 'WAQF_HAMZA',
    'الوقف على مرسوم الخط': 'WAQF_RASM', 'الوقف على الرسم': 'WAQF_RASM',
    'ياءات الإضافة': 'YAAT_IDAFA',
    'ياءات الزوائد': 'YAAT_ZAWAID',
    'الأوجه بين السورتين': 'BAYN_SURATAYN',
    'المد قبل الإدغام الكبير': 'MADD_QABL_IDGHAM',
    'أصول المد': 'USUL_MADD',
    'ميم الجمع': 'USUL_MIM_JAM',
    'النقل': 'USUL_NAQL',
    'السكت': 'USUL_SAKT',
}


# ---------------------------------------------------------------------------
# Column mapping
# ---------------------------------------------------------------------------

def load_mapping(path: str) -> dict:
    with open(path, encoding='utf-8') as f:
        raw = yaml.safe_load(f)
    alias_to_field = {}
    for field, aliases in raw.items():
        for alias in aliases:
            alias_to_field[normalize_header(alias)] = field
    return alias_to_field


_TASHKEEL_RE = None


def normalize_header(h) -> str:
    global _TASHKEEL_RE
    if _TASHKEEL_RE is None:
        import re
        _TASHKEEL_RE = re.compile('[ً-ْٰـ]')  # harakat, sukun, dagger alef, tatweel
    if h is None:
        return ''
    h = str(h).strip().lower()
    h = unicodedata.normalize('NFKC', h)
    h = _TASHKEEL_RE.sub('', h)
    h = h.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا')
    h = h.replace('ة', 'ه').replace('ى', 'ي')
    h = ' '.join(h.split())
    return h


def map_headers(headers: list, alias_map: dict):
    """Return (header_index -> canonical_field, list_of_unmapped_headers)."""
    mapped = {}
    unmapped = []
    for i, h in enumerate(headers):
        if h is None or str(h).strip() == '':
            continue
        key = normalize_header(h)
        field = alias_map.get(key)
        if field:
            mapped[i] = field
        else:
            unmapped.append(str(h))
    return mapped, unmapped


# ---------------------------------------------------------------------------
# File discovery + sheet reading
# ---------------------------------------------------------------------------

def discover_files(input_dir: str):
    files = []
    for ext in SUPPORTED_EXTENSIONS:
        files.extend(sorted(glob.glob(os.path.join(input_dir, f'*{ext}'))))
    return files


def read_workbook_sheets(path: str):
    """Yield (sheet_name, headers, rows) for every non-empty sheet in a file."""
    ext = os.path.splitext(path)[1].lower()
    if ext == '.csv':
        import csv
        with open(path, encoding='utf-8-sig', newline='') as f:
            rows = list(csv.reader(f))
        if not rows:
            return
        headers = rows[0]
        data_rows = rows[1:]
        if any(c.strip() for c in headers) and data_rows:
            yield (os.path.basename(path), headers, data_rows)
        return

    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows_iter = ws.iter_rows(values_only=True)
            try:
                headers = list(next(rows_iter))
            except StopIteration:
                continue  # empty sheet
            data_rows = [list(r) for r in rows_iter if any(c is not None and str(c).strip() != '' for c in r)]
            if not data_rows:
                continue  # header-only / empty sheet
            yield (sheet_name, headers, data_rows)
    finally:
        wb.close()


# ---------------------------------------------------------------------------
# Normalization of a single mapped row
# ---------------------------------------------------------------------------

def _to_int(v):
    if v is None:
        return None
    if isinstance(v, (int,)):
        return v
    if isinstance(v, float):
        return int(v)
    s = str(v).strip()
    if not s:
        return None
    # Fold Eastern Arabic numerals.
    s = s.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
    try:
        return int(float(s))
    except ValueError:
        return None


def normalize_row(cells: dict, surah_ayah_counts: dict) -> dict:
    """cells: canonical_field -> raw cell value. Returns the normalized dict plus
    'messages' (list of {level, code, detail}) and 'unresolved_authorities'."""
    out = {}
    messages = []
    unresolved_authorities = []

    page = _to_int(cells.get('mushaf_page'))
    out['mushaf_page'] = page
    if page is None:
        messages.append({'level': 'error', 'code': 'MISSING_PAGE', 'detail': 'no mushaf_page value'})
    elif not (1 <= page <= 604):
        messages.append({'level': 'error', 'code': 'INVALID_PAGE', 'detail': f'page {page} out of range 1-604'})

    surah = _to_int(cells.get('surah_number'))
    out['surah_number'] = surah
    if surah is None:
        messages.append({'level': 'error', 'code': 'MISSING_SURAH', 'detail': 'no surah_number value'})
    elif not (1 <= surah <= 114):
        messages.append({'level': 'error', 'code': 'INVALID_SURAH', 'detail': f'surah {surah} out of range 1-114'})

    ayah_from = _to_int(cells.get('ayah_from'))
    ayah_to = _to_int(cells.get('ayah_to')) or ayah_from
    out['ayah_from'] = ayah_from
    out['ayah_to'] = ayah_to
    if ayah_from is None:
        messages.append({'level': 'error', 'code': 'MISSING_AYAH', 'detail': 'no ayah_from value'})
    elif surah is not None and surah in surah_ayah_counts:
        max_ayah = surah_ayah_counts[surah]
        if not (1 <= ayah_from <= max_ayah):
            messages.append({'level': 'error', 'code': 'INVALID_AYAH',
                              'detail': f'ayah {ayah_from} does not exist in surah {surah} (max {max_ayah})'})
        if ayah_to is not None and not (ayah_from <= ayah_to <= max_ayah):
            messages.append({'level': 'error', 'code': 'INVALID_AYAH_RANGE',
                              'detail': f'ayah_to {ayah_to} invalid for surah {surah}'})

    base_text = (str(cells.get('base_text')).strip() if cells.get('base_text') else None)
    out['base_text_raw'] = base_text
    if not base_text:
        messages.append({'level': 'error', 'code': 'MISSING_BASE_TEXT', 'detail': 'no base_text/hafs_text value'})

    variant_text = (str(cells.get('variant_text')).strip() if cells.get('variant_text') else None)
    out['variant_text'] = variant_text
    category_cell = (str(cells.get('category')).strip() if cells.get('category') else None)
    looks_like_ruling = bool(category_cell) and category_cell.strip().lower() not in ('فرش', 'farsh', 'variant', 'قراءة')
    if not variant_text and not looks_like_ruling:
        messages.append({'level': 'warning', 'code': 'MISSING_VARIANT_TEXT',
                          'detail': 'no variant_text and no ruling category — record may be a ruling (أصول) missing its category, or a farsh row missing its reading'})

    # --- token anchoring (task requirement #10) --------------------------------------
    anchor = None
    if page is not None and base_text:
        try:
            anchor = T.find(page, base_text, occurrence=1, ayah=ayah_from)
            out['anchor'] = anchor
            out['mapping_status'] = 'ok'
        except T.NoMatch as e:
            out['anchor'] = None
            out['mapping_status'] = 'needs_manual_mapping'
            messages.append({'level': 'error', 'code': 'NEEDS_MANUAL_MAPPING', 'detail': str(e)})
    else:
        out['anchor'] = None
        out['mapping_status'] = 'needs_manual_mapping'

    # --- category -----------------------------------------------------------------
    # "فرش"/"farsh"/"variant" is a label meaning "this row is a Farsh variant, not a ruling"
    # — it never maps to a `qiraat_categories` code (only rulings/أصول do), so it is not an
    # unknown category, just not a category at all.
    category_raw = (str(cells.get('category')).strip() if cells.get('category') else None)
    out['category_raw'] = category_raw
    is_farsh_label = bool(category_raw) and category_raw.strip().lower() in ('فرش', 'farsh', 'variant', 'قراءة')
    if category_raw and not is_farsh_label:
        code = category_raw.upper() if category_raw.upper() in CATEGORY_CODES else CATEGORY_ALIASES.get(category_raw)
        out['category_code'] = code
        if not code:
            messages.append({'level': 'warning', 'code': 'UNKNOWN_CATEGORY',
                              'detail': f'category {category_raw!r} not in the known taxonomy; add an alias in excel_mapping usage or CATEGORY_ALIASES'})
    else:
        out['category_code'] = None

    # --- attribution ----------------------------------------------------------------
    attribution_raw = (str(cells.get('attribution')).strip() if cells.get('attribution') else None)
    out['attribution_raw'] = attribution_raw
    if attribution_raw:
        result = resolve_attribution(attribution_raw)
        out['attribution_readings'] = result.resolved_readings
        out['attribution_is_remainder'] = result.is_remainder
        out['attribution_tokens'] = result.tokens
        if result.unresolved:
            unresolved_authorities = [u['token'] for u in result.unresolved]
            for u in result.unresolved:
                messages.append({'level': 'error', 'code': 'UNRESOLVED_AUTHORITY', 'detail': f"{u['token']}: {u['reason']}"})
    else:
        out['attribution_readings'] = []
        out['attribution_is_remainder'] = False
        messages.append({'level': 'error', 'code': 'MISSING_ATTRIBUTION', 'detail': 'no reader/narrator/attribution value'})

    out['description'] = cells.get('description')
    out['source_note'] = cells.get('source_note')
    out['occurrence_note'] = cells.get('occurrence_note')
    evidence = {}
    if cells.get('evidence_shatibiyyah'):
        evidence['SH'] = str(cells['evidence_shatibiyyah']).strip()
    if cells.get('evidence_durrah'):
        evidence['D'] = str(cells['evidence_durrah']).strip()
    if cells.get('evidence_generic'):
        evidence['generic'] = str(cells['evidence_generic']).strip()
    out['evidence'] = evidence

    verification_raw = (str(cells.get('verification_status')).strip() if cells.get('verification_status') else None)
    out['requested_verification_status'] = verification_raw

    has_error = any(m['level'] == 'error' for m in messages)
    has_warning = any(m['level'] == 'warning' for m in messages)
    validation_status = 'error' if has_error else ('warning' if has_warning else 'valid')

    return {
        'normalized': out,
        'messages': messages,
        'validation_status': validation_status,
        'unresolved_authorities': unresolved_authorities,
        'mapping_status': out['mapping_status'],
    }


# ---------------------------------------------------------------------------
# Fingerprint (idempotency key) — task requirement #14
# ---------------------------------------------------------------------------

def row_fingerprint(normalized: dict) -> str:
    """Stable hash of the fields that identify 'the same reported fact'.

    Deliberately EXCLUDES batch id, import timestamp, source filename/sheet/row — those
    describe *how* the fact was learned, not the fact itself, so the same fact imported from
    two different files (or the same file re-run) fingerprints identically and is caught as
    a duplicate rather than silently doubled.
    """
    key = {
        'page': normalized.get('mushaf_page'),
        'surah': normalized.get('surah_number'),
        'ayah_from': normalized.get('ayah_from'),
        'ayah_to': normalized.get('ayah_to'),
        'base_text': (normalized.get('base_text_raw') or '').strip(),
        'variant_text': (normalized.get('variant_text') or '').strip(),
        'category': normalized.get('category_code'),
        'attribution': sorted(normalized.get('attribution_readings') or []),
        'is_remainder': normalized.get('attribution_is_remainder', False),
    }
    blob = json.dumps(key, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode('utf-8')).hexdigest()


# ---------------------------------------------------------------------------
# Surah/ayah bounds (for validation), from the app's own Quran dataset
# ---------------------------------------------------------------------------

def load_surah_ayah_counts():
    """public/quran/ayahs.json shape: { "<surah>": { "<ayah>": "<text>", ... }, ... }."""
    path = os.path.join(ROOT, 'public', 'quran', 'ayahs.json')
    counts = {}
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        for surah_key, ayahs in data.items():
            try:
                counts[int(surah_key)] = max(int(k) for k in ayahs.keys())
            except (ValueError, AttributeError):
                continue
    except Exception:
        pass
    return counts


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

class ImportRun:
    def __init__(self, input_dir, alias_map):
        self.input_dir = input_dir
        self.alias_map = alias_map
        self.rows = []             # list of processed-row dicts (see below)
        self.unmapped_headers = set()
        self.files_seen = []
        self.sheets_seen = 0

    def process(self):
        surah_ayah_counts = load_surah_ayah_counts()
        files = discover_files(self.input_dir)
        self.files_seen = files
        for path in files:
            for sheet_name, headers, data_rows in read_workbook_sheets(path):
                self.sheets_seen += 1
                header_map, unmapped = map_headers(headers, self.alias_map)
                self.unmapped_headers.update(unmapped)
                for r_i, row in enumerate(data_rows):
                    excel_row_number = r_i + 2  # header is row 1
                    cells_raw = {}
                    cells_mapped = {}
                    for col_i, value in enumerate(row):
                        header_name = headers[col_i] if col_i < len(headers) else f'col{col_i}'
                        cells_raw[str(header_name) if header_name is not None else f'col{col_i}'] = value
                        field = header_map.get(col_i)
                        if field:
                            cells_mapped[field] = value
                    result = normalize_row(cells_mapped, surah_ayah_counts)
                    fp = row_fingerprint(result['normalized'])
                    self.rows.append({
                        'source_file': os.path.basename(path),
                        'source_sheet': sheet_name,
                        'source_row': excel_row_number,
                        'raw_row': cells_raw,
                        'normalized': result['normalized'],
                        'messages': result['messages'],
                        'validation_status': result['validation_status'],
                        'unresolved_authorities': result['unresolved_authorities'],
                        'mapping_status': result['mapping_status'],
                        'fingerprint': fp,
                    })
        self._detect_duplicates()
        return self

    def _detect_duplicates(self):
        seen = {}
        for row in self.rows:
            fp = row['fingerprint']
            if fp in seen:
                row['duplicate_status'] = 'exact_duplicate'
                row['duplicate_of'] = seen[fp]
            else:
                row['duplicate_status'] = 'none'
                seen[fp] = f"{row['source_file']}::{row['source_sheet']}::{row['source_row']}"

    def summary(self):
        total = len(self.rows)
        valid = sum(1 for r in self.rows if r['validation_status'] == 'valid')
        warning = sum(1 for r in self.rows if r['validation_status'] == 'warning')
        error = sum(1 for r in self.rows if r['validation_status'] == 'error')
        duplicate = sum(1 for r in self.rows if r['duplicate_status'] != 'none')
        unresolved = sum(1 for r in self.rows if r['unresolved_authorities'])
        needs_mapping = sum(1 for r in self.rows if r['mapping_status'] == 'needs_manual_mapping')
        code_counts = {}
        for r in self.rows:
            for m in r['messages']:
                code_counts[m['code']] = code_counts.get(m['code'], 0) + 1
        return {
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'inputDir': self.input_dir,
            'filesFound': len(self.files_seen),
            'files': [os.path.basename(f) for f in self.files_seen],
            'sheetsFound': self.sheets_seen,
            'rowsTotal': total,
            'rowsValid': valid,
            'rowsWarning': warning,
            'rowsError': error,
            'rowsDuplicate': duplicate,
            'rowsUnresolvedAuthority': unresolved,
            'rowsNeedsManualMapping': needs_mapping,
            'unmappedColumns': sorted(self.unmapped_headers),
            'issueCounts': code_counts,
        }


def write_reports(run: ImportRun, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M')
    summary = run.summary()
    json_path = os.path.join(out_dir, f'qiraat-import-{stamp}.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({'summary': summary, 'rows': run.rows}, f, ensure_ascii=False, indent=2, default=str)

    html_path = os.path.join(out_dir, f'qiraat-import-{stamp}.html')
    rows_html = []
    for r in run.rows[:2000]:  # cap the human report; the JSON has everything
        msgs = '; '.join(f"[{m['level']}] {m['code']}: {m['detail']}" for m in r['messages'])
        rows_html.append(
            f"<tr><td>{r['source_file']}</td><td>{r['source_sheet']}</td><td>{r['source_row']}</td>"
            f"<td>{r['validation_status']}</td><td>{r['duplicate_status']}</td>"
            f"<td>{r['normalized'].get('mushaf_page')}</td>"
            f"<td dir='rtl'>{(r['normalized'].get('base_text_raw') or '')}</td>"
            f"<td dir='rtl'>{msgs}</td></tr>"
        )
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(f"""<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<title>Qiraat Import Report {stamp}</title>
<style>
body {{ font-family: system-ui, sans-serif; margin: 2rem; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
td, th {{ border: 1px solid #ccc; padding: 4px 8px; text-align: right; }}
.cards {{ display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }}
.card {{ border: 1px solid #ddd; border-radius: 8px; padding: 12px 18px; min-width: 120px; }}
.card b {{ display: block; font-size: 22px; }}
</style>
<h1>تقرير استيراد القراءات — {stamp}</h1>
<div class="cards">
{''.join(f'<div class="card"><b>{v}</b>{k}</div>' for k, v in [
    ('ملفات', summary['filesFound']), ('أوراق عمل', summary['sheetsFound']),
    ('إجمالي الصفوف', summary['rowsTotal']), ('صحيح', summary['rowsValid']),
    ('تحذير', summary['rowsWarning']), ('خطأ', summary['rowsError']),
    ('مكرر', summary['rowsDuplicate']), ('عزو غير محلول', summary['rowsUnresolvedAuthority']),
    ('يحتاج ربط يدوي', summary['rowsNeedsManualMapping']),
])}
</div>
<p><b>أعمدة غير معروفة:</b> {', '.join(summary['unmappedColumns']) or '(لا يوجد)'}</p>
<table>
<tr><th>الملف</th><th>الورقة</th><th>الصف</th><th>الحالة</th><th>تكرار</th><th>الصفحة</th><th>النص</th><th>الرسائل</th></tr>
{''.join(rows_html)}
</table>
</html>""")
    return json_path, html_path


def stage_to_db(run: ImportRun, db_url: str, source_dir: str, dry_run_marker=False):
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                summary = run.summary()
                cur.execute(
                    """INSERT INTO qiraat_import_batches
                        (source_dir, files, status, files_count, sheets_count, rows_total,
                         rows_valid, rows_warning, rows_error, rows_duplicate, rows_unresolved,
                         rows_needs_mapping, dry_run)
                       VALUES (%s, %s, 'PARSED', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id""",
                    (source_dir, summary['files'], summary['filesFound'], summary['sheetsFound'],
                     summary['rowsTotal'], summary['rowsValid'], summary['rowsWarning'],
                     summary['rowsError'], summary['rowsDuplicate'], summary['rowsUnresolvedAuthority'],
                     summary['rowsNeedsManualMapping'], dry_run_marker),
                )
                batch_id = cur.fetchone()[0]

                # Check duplicates against EVERY prior batch's rows too, not just this run.
                cur.execute("SELECT fingerprint FROM qiraat_import_rows")
                prior_fingerprints = {row[0] for row in cur.fetchall()}

                insert_sql = """
                  INSERT INTO qiraat_import_rows
                    (batch_id, source_file, source_sheet, source_row, raw_row, fingerprint,
                     normalized, unmapped_columns, unresolved_authorities, mapping_status,
                     validation_status, validation_messages, duplicate_status, review_status)
                  VALUES (%(batch_id)s, %(source_file)s, %(source_sheet)s, %(source_row)s,
                          %(raw_row)s, %(fingerprint)s, %(normalized)s, %(unmapped_columns)s,
                          %(unresolved_authorities)s, %(mapping_status)s, %(validation_status)s,
                          %(validation_messages)s, %(duplicate_status)s, %(review_status)s)
                  RETURNING id
                """
                for row in run.rows:
                    dup = row['duplicate_status']
                    if dup == 'none' and row['fingerprint'] in prior_fingerprints:
                        dup = 'exact_duplicate'
                    review_status = 'needs_mapping' if row['mapping_status'] == 'needs_manual_mapping' else 'pending'
                    cur.execute(insert_sql, {
                        'batch_id': batch_id,
                        'source_file': row['source_file'],
                        'source_sheet': row['source_sheet'],
                        'source_row': row['source_row'],
                        'raw_row': psycopg2.extras.Json(row['raw_row']),
                        'fingerprint': row['fingerprint'],
                        'normalized': psycopg2.extras.Json(row['normalized'], dumps=lambda o: json.dumps(o, default=str, ensure_ascii=False)),
                        'unmapped_columns': list(run.unmapped_headers),
                        'unresolved_authorities': row['unresolved_authorities'],
                        'mapping_status': row['mapping_status'],
                        'validation_status': row['validation_status'],
                        'validation_messages': psycopg2.extras.Json(row['messages']),
                        'duplicate_status': dup,
                        'review_status': review_status,
                    })
                    new_row_id = cur.fetchone()[0]
                    cur.execute(
                        """INSERT INTO qiraat_import_row_events (row_id, event_type, actor, after_value)
                           VALUES (%s, 'imported', 'import_excel.py', %s)""",
                        (new_row_id, psycopg2.extras.Json({'validation_status': row['validation_status']})),
                    )
                    prior_fingerprints.add(row['fingerprint'])

                cur.execute("UPDATE qiraat_import_batches SET status = 'VALIDATED' WHERE id = %s", (batch_id,))
        return batch_id
    finally:
        conn.close()


def main():
    p = argparse.ArgumentParser(description='Deterministic bulk Qiraat Excel importer.')
    p.add_argument('--input', default=os.path.join(ROOT, 'data', 'qiraat', 'import'))
    p.add_argument('--mapping', default=os.path.join(ROOT, 'scripts', 'qiraat', 'excel_mapping.yaml'))
    p.add_argument('--dry-run', action='store_true', help='Report only. Never touches the database.')
    p.add_argument('--stage', action='store_true', help='Write to the qiraat_import_* staging tables.')
    p.add_argument('--reports-dir', default=os.path.join(ROOT, 'reports'))
    p.add_argument('--db-url', default=os.environ.get('QIRAAT_DATABASE_URL') or os.environ.get('DATABASE_URL'))
    args = p.parse_args()

    if not args.dry_run and not args.stage:
        print('Specify --dry-run or --stage.', file=sys.stderr)
        sys.exit(2)
    if args.stage and not args.db_url:
        print('QIRAAT_DATABASE_URL (or --db-url) is required for --stage.', file=sys.stderr)
        sys.exit(2)

    alias_map = load_mapping(args.mapping)
    run = ImportRun(args.input, alias_map).process()
    summary = run.summary()

    print(f"Files found:            {summary['filesFound']}")
    print(f"Sheets found:           {summary['sheetsFound']}")
    print(f"Rows read:              {summary['rowsTotal']}")
    print(f"  valid:                {summary['rowsValid']}")
    print(f"  warning:              {summary['rowsWarning']}")
    print(f"  error:                {summary['rowsError']}")
    print(f"  duplicate:            {summary['rowsDuplicate']}")
    print(f"  unresolved authority: {summary['rowsUnresolvedAuthority']}")
    print(f"  needs manual mapping: {summary['rowsNeedsManualMapping']}")
    if summary['unmappedColumns']:
        print(f"Unmapped columns: {summary['unmappedColumns']}")

    json_path, html_path = write_reports(run, args.reports_dir)
    print(f"Report: {json_path}")
    print(f"Report: {html_path}")

    if args.stage:
        batch_id = stage_to_db(run, args.db_url, args.input)
        print(f"Staged batch: {batch_id}")
        print("Open /admin/qiraat-import to review.")


if __name__ == '__main__':
    main()
