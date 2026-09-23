#!/usr/bin/env python3
"""Import the user-supplied al-Duri 'an Abi Amr spreadsheet additively.

The Google Sheet itself is never edited and its contents are not copied into the
repository.  The importer consumes a read-only CSV/TSV export, anchors every safe
record through the canonical Mushaf-1441 page-word fixtures, and writes an audit
report for every source row.  Its default mode is a dry run.

Usage:
  python3 scripts/qiraat/import_duri.py --source /tmp/duri_source.tsv
  python3 scripts/qiraat/import_duri.py --source /tmp/duri_source.tsv --write
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tokens as T
from merge_faces import merge_variant as shared_merge_variant, merge_ruling as shared_merge_ruling, merge_face as shared_merge_face

from import_susi import find_hits, plain, strict_form, MATCHERS, write_json

ROOT = Path(__file__).resolve().parents[2]
VARIANT_DIR = ROOT / 'packages/qiraat-core/fixtures/pages'
RULING_DIR = ROOT / 'packages/qiraat-core/fixtures/rulings'
REPORT_PATH = ROOT / 'docs/qiraat-duri-import-audit.json'
READING = 'Q03-R01'
TS = '2026-09-23T12:00:00.000Z'
SOURCE_NAME = 'رواية_الدوري_عن_أبي_عمرو_مستخرجة (1).gsheet'
SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1yqf72YZqqUJBHs16cgp74dyGOkdbabzGgtsS-Vcx7tQ/edit'

COLORS = {
    'IDGHAM_KABIR': ('المدغم الكبير', '#15803D'),
    'IDGHAM_SAGHIR': ('المدغم الصغير', '#15803D'),
    'SAKT': ('السكت', '#7C3AED'),
    'MEEM_JAM': ('MEEM_JAM', '#DB2777'),
    'IMALAH_TAQLIL': ('الممال والمقلل', '#C026D3'),
    'TAGHYIR_HAMZ': ('تغيير الهمز', '#DC2626'),
    'WAQF_RASM': ('الوقف على مرسوم الخط', '#EA580C'),
    'WAQF_HAMZA': ('وقف حمزة', '#EA580C'),
}


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def read_rows(path: Path) -> list[dict[str, str]]:
    sample = path.read_text(encoding='utf-8-sig')[:4096]
    dialect = csv.excel_tab if '\t' in sample else csv.excel
    with path.open('r', encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle, dialect=dialect))
    return [{str(k).strip(): (v or '').strip() for k, v in row.items()} for row in rows]


def source_text(row: dict[str, str]) -> str:
    return f"{row.get('hafs', '')} → {row.get('duri', '')} | {row.get('bayan', '')}"


def clean_surah_name(value: str) -> str:
    value = re.sub(r'^\s*سورة\s*', '', value or '')
    value = value.replace('صلى الله عليه وسلم', ' ')
    return plain(value).strip()


def parse_ayah(value: str, surah: int | None) -> int | None:
    numbers = re.findall(r'\d+', value or '')
    if len(numbers) != 1:
        return None
    # The sheet numbers al-Fatihah without its basmalah row; the canonical
    # Mushaf-1441 fixture stores that basmalah as ayah 1.
    number = int(numbers[0])
    return number + 1 if surah == 1 else number


def split_source_parts(value: str) -> list[str]:
    value = re.sub(r'\([^)]*\)', ' ', value or '')
    value = value.replace('؛', '|').replace('|', '|')
    value = re.sub(r'\s*[–—−]\s*', '|', value)
    value = re.sub(r'\s+[-_]\s+', '|', value)
    value = re.sub(r'\s+ـ+\s+', '|', value)
    parts = []
    for part in value.split('|'):
        part = re.sub(r'[,،:;]+', ' ', part)
        part = re.sub(r'\s+', ' ', part).strip()
        if part and part != '-':
            parts.append(part)
    return parts


def marker_is_all(text: str) -> bool:
    return bool(re.search(r'معاً|الثلاثة|الثمانية|الموضعين|موضعين|مواضع|المواضع', text or ''))


def hamza_seat_normalize(value: str) -> str:
    """Matching-only fallback for source spellings that use hamza seats."""
    return (value or '').replace('ؤ', 'ء').replace('ئ', 'ء')


def find_source_hits(pages: dict, first: dict, surah: int, ayah: int, phrase: str) -> tuple[list[dict], str]:
    """Try source spacing first, then one-token joined spacing and hamza seats."""
    candidates = [phrase]
    joined = ''.join(phrase.split())
    if joined != phrase.replace(' ', ''):
        candidates.append(joined)
    for candidate in candidates:
        hits = find_hits(pages, first, surah, ayah, candidate)
        if hits:
            return hits, candidate
        seated = hamza_seat_normalize(candidate)
        if seated != candidate:
            hits = find_hits(pages, first, surah, ayah, seated)
            if hits:
                return hits, seated
    return [], phrase


def action_category(description: str) -> str | None:
    d = description or ''
    if 'إمال' in d or 'أمال' in d or 'قلل' in d:
        return 'IMALAH_TAQLIL'
    if 'إدغام' in d or 'أدغم' in d:
        return 'IDGHAM_SAGHIR' if 'صغير' in d else 'IDGHAM_KABIR'
    if 'سكت' in d:
        return 'SAKT'
    if 'ميم' in d and 'وص' in d:
        return 'MEEM_JAM'
    if 'وقف' in d and ('همز' in d or 'الهمز' in d):
        return 'WAQF_HAMZA'
    if 'وقف' in d:
        return 'WAQF_RASM'
    if any(word in d for word in ('همز', 'الهمزة', 'سهل', 'أبدل', 'أسقط', 'نقل')):
        return 'TAGHYIR_HAMZ'
    return None


def source_ref(sha: str, row_number: int) -> dict:
    return {
        'sourceName': SOURCE_NAME,
        'sourceType': 'other',
        'sourceReference': f'{SOURCE_URL} · exported TSV row {row_number}; SHA-256 {sha}',
        'verificationNotes': 'Mapped additively to canonical Mushaf-1441 token fixtures; source text retained verbatim.',
    }


def canonical_span(hit: dict) -> dict:
    segment = hit['words']
    first_word, last_word = segment[0], segment[-1]
    return {
        'surah': first_word['surahNumber'],
        'ayah': first_word['ayahNumber'],
        'startToken': first_word['wordIndexInAyah'],
        'endToken': last_word['wordIndexInAyah'],
        'endAyah': last_word['ayahNumber'],
        'baseText': ' '.join(word['textUthmani'] for word in segment),
        'page': hit['page'],
    }


def locus(row_number: int, span: dict) -> str:
    return f"DURI-{span['surah']:03d}-{span['ayah']}-{span['startToken']}-r{row_number:04d}"


def make_variant(row: dict[str, str], row_number: int, span: dict, hafs: str, duri: str, sha: str) -> dict:
    key = locus(row_number, span)
    variant_id = f'v-{key}'
    return {
        'id': variant_id,
        'surah': span['surah'],
        'ayah': span['ayah'],
        'startToken': span['startToken'],
        'endToken': span['endToken'],
        'operation': 'REPLACE',
        'hafsText': span['baseText'],
        'variantText': duri,
        'differenceType': difference_type(row.get('bayan', ''), hafs, duri),
        'verificationStatus': 'REVIEWED',
        'createdAt': TS,
        'updatedAt': TS,
        'readingIds': [READING],
        'locusId': key,
        'locusType': 'multi_word_variant' if span['endToken'] > span['startToken'] else 'word_variant',
        'sources': [{
            'id': f's-{key}', 'variantId': variant_id,
            **source_ref(sha, row_number), 'sourceText': source_text(row),
        }],
        'description': row.get('bayan', ''),
    }


def make_performance_variant(row: dict[str, str], row_number: int, span: dict, sha: str) -> dict:
    key = locus(row_number, span)
    variant_id = f'v-{key}-performance'
    return {
        'id': variant_id,
        'surah': span['surah'],
        'ayah': span['ayah'],
        'startToken': span['startToken'],
        'endToken': span['endToken'],
        'operation': 'REPLACE',
        'hafsText': span['baseText'],
        'variantText': span['baseText'],
        'differenceType': difference_type(row.get('bayan', ''), row.get('hafs', ''), row.get('duri', '')),
        'verificationStatus': 'REVIEWED',
        'createdAt': TS,
        'updatedAt': TS,
        'readingIds': [READING],
        'locusId': key,
        'locusType': 'performance_variant',
        'performanceNote': row.get('bayan', ''),
        'sources': [{
            'id': f's-{key}', 'variantId': variant_id,
            **source_ref(sha, row_number), 'sourceText': source_text(row),
        }],
        'description': row.get('bayan', ''),
    }


def make_ruling(row: dict[str, str], row_number: int, span: dict, sha: str, category: str) -> dict:
    label, color = COLORS[category]
    key = locus(row_number, span)
    action = row.get('bayan', '')
    return {
        'id': f'r-{key}-{category}',
        'pageNumber': span['page'], 'category': category,
        'categoryAr': label, 'color': color, 'wordAnchored': True,
        'surah': span['surah'], 'ayah': span['ayah'],
        'startToken': span['startToken'], 'endToken': span['endToken'],
        'endAyah': span['endAyah'], 'baseText': span['baseText'],
        'verificationStatus': 'REVIEWED',
        'attribution': [{'authorityId': READING, 'action': action}],
        'readings': [{'readingId': READING, 'action': action, 'isDefault': True}],
        'hasAlternate': False,
        'notes': 'Imported from the user-supplied al-Duri source; source row retained verbatim.',
        'sourceNotes': [source_text(row)],
        'createdAt': TS, 'updatedAt': TS,
        '_sourceRow': row_number,
    }


def difference_type(description: str, hafs: str, duri: str) -> str:
    d = description or ''
    if 'إمال' in d or 'أمال' in d or 'قلل' in d:
        return 'IMALAH'
    if 'إدغام' in d or 'أدغم' in d:
        return 'IDGHAM'
    if 'وقف' in d:
        return 'WAQF'
    if 'همز' in d or 'الهمزة' in d or 'سهل' in d or 'أبدل' in d or 'أسقط' in d:
        return 'HAMZ'
    if 'حذف' in d or 'إسقاط' in d:
        return 'OMISSION'
    if 'إثبات' in d or 'زيادة' in d or 'أثبت' in d:
        return 'ADDITION'
    if plain(hafs) == plain(duri):
        return 'OTHER'
    if any(word in d for word in ('كسر', 'فتح', 'ضم', 'إسكان', 'تشديد', 'تخفيف', 'رفع', 'نصب', 'جر', 'جزم')):
        return 'HARAKAH'
    return 'LETTER'


def same_form(existing: dict, candidate: dict) -> bool:
    return (existing.get('surah'), existing.get('ayah'), existing.get('startToken'), existing.get('endToken'),
            strict_form(existing.get('variantText', ''))) == (
            candidate.get('surah'), candidate.get('ayah'), candidate.get('startToken'), candidate.get('endToken'),
            strict_form(candidate.get('variantText', '')))


def spans_overlap(left: dict, right: dict) -> bool:
    try:
        left_start, left_end = int(left.get('startToken', 0)), int(left.get('endToken', 0))
        right_start, right_end = int(right.get('startToken', 0)), int(right.get('endToken', 0))
    except (TypeError, ValueError):
        return False
    return (left.get('surah') == right.get('surah') and left.get('ayah') == right.get('ayah') and
            left_start <= right_end and right_start <= left_end)


def merge_sources(target: dict, candidate: dict) -> bool:
    target_sources = target.setdefault('sources', [])
    known = {(s.get('sourceName'), s.get('sourceReference'), s.get('sourceText')) for s in target_sources}
    changed = False
    for source in candidate.get('sources', []):
        key = (source.get('sourceName'), source.get('sourceReference'), source.get('sourceText'))
        if key not in known:
            attached = dict(source)
            attached['variantId'] = target.get('id', attached.get('variantId'))
            target_sources.append(attached)
            known.add(key)
            changed = True
    return changed


def merge_variant(existing: list[dict], candidate: dict) -> str:
    return shared_merge_variant(existing, candidate, READING, strict_form)


def merge_ruling(existing: list[dict], candidate: dict) -> str:
    return shared_merge_ruling(existing, candidate, READING)


def remove_prior_unsafe_variants(variants: dict[int, list[dict]]) -> set[int]:
    """Remove only importer-owned records whose replacement span is malformed."""
    removed_pages = set()
    for page, records in variants.items():
        kept = []
        for record in records:
            source_owned = record.get('id', '').startswith('v-DURI-') and any(
                source.get('sourceName') == SOURCE_NAME for source in record.get('sources', []))
            span_length = int(record.get('endToken', 0)) - int(record.get('startToken', 0)) + 1
            replacement_length = len(str(record.get('variantText', '')).split())
            source_shape_bad = False
            if source_owned and record.get('locusType') != 'performance_variant':
                for source in record.get('sources', []):
                    source_text_value = source.get('sourceText', '')
                    if ' → ' not in source_text_value:
                        continue
                    raw_hafs, raw_duri = source_text_value.split(' → ', 1)
                    raw_duri = raw_duri.split(' | ', 1)[0]
                    source_shape_bad = (
                        len(split_source_parts(raw_hafs)) == len(split_source_parts(raw_duri)) == 1 and
                        len(raw_hafs.split()) != len(raw_duri.split())
                    )
                    if source_shape_bad:
                        break
            if source_owned and record.get('locusType') != 'performance_variant' and (replacement_length != span_length or source_shape_bad):
                removed_pages.add(page)
                continue
            kept.append(record)
        variants[page] = kept
    return removed_pages


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--write-report', action='store_true')
    parser.add_argument('--report', type=Path, default=REPORT_PATH)
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not source.is_file():
        parser.error(f'source does not exist: {source}')

    rows = read_rows(source)
    required = {'surah', 'ayah', 'hafs', 'duri', 'bayan'}
    metadata = json.loads((ROOT / 'packages/quran-data/mushaf1441/fixtures/page-metadata.json').read_text(encoding='utf-8'))
    surahs = {plain(item['name']): item['surahNumber'] for item in metadata['surahs']}
    sha = source_sha256(source)
    pages = {page: T.page_words(page) for page in range(1, 605)}
    first = {fn.__name__: collections.defaultdict(list) for fn in MATCHERS}
    for page, words in pages.items():
        for index, word in enumerate(words):
            for fn in MATCHERS:
                first[fn.__name__][fn(word['textUthmani'])].append((page, index))
    variants = {page: json.loads((VARIANT_DIR / f'page-{page:03d}.json').read_text(encoding='utf-8')) for page in range(1, 605)}
    rulings = {page: json.loads((RULING_DIR / f'page-{page:03d}.json').read_text(encoding='utf-8')) for page in range(1, 605)}
    audit = []
    stats = collections.Counter()
    touched = set()
    if args.write:
        touched.update(remove_prior_unsafe_variants(variants))
        if touched:
            stats['REMOVED_PRIOR_UNSAFE'] += len(touched)

    for row_index, row in enumerate(rows, start=2):
        if not required.issubset(row):
            audit.append({'row': row_index, 'status': 'INVALID_SOURCE_ROW', 'reason': 'missing required column'})
            stats['INVALID_SOURCE_ROW'] += 1
            continue
        surah = surahs.get(clean_surah_name(row['surah']))
        ayah = parse_ayah(row['ayah'], surah)
        hafs_parts = split_source_parts(row['hafs'])
        duri_parts = split_source_parts(row['duri'])
        if not surah or not ayah:
            audit.append({'row': row_index, 'status': 'UNRESOLVED', 'reason': 'surah or ayah is not a single canonical locus', 'source': source_text(row)})
            stats['UNRESOLVED'] += 1
            continue
        if not hafs_parts or not duri_parts or len(hafs_parts) != len(duri_parts):
            audit.append({'row': row_index, 'status': 'MULTI_FACE_SKIPPED', 'reason': 'source has no one-to-one Hafs/Duri phrase pairing', 'source': source_text(row)})
            stats['MULTI_FACE_SKIPPED'] += 1
            continue

        row_spans = []
        row_failed = False
        all_marker = marker_is_all(source_text(row))
        for hafs, duri in zip(hafs_parts, duri_parts):
            if len(hafs.split()) != len(duri.split()) and len(hafs_parts) == len(duri_parts) == 1:
                row_failed = True
                audit.append({'row': row_index, 'status': 'UNSAFE_SOURCE_FORM', 'reason': 'one-to-one source phrase has different word counts', 'surah': surah, 'ayah': ayah, 'hafs': hafs, 'duri': duri, 'bayan': row['bayan']})
                stats['UNSAFE_SOURCE_FORM'] += 1
                break
            hits, matched_hafs = find_source_hits(pages, first, surah, ayah, hafs)
            if not hits:
                row_failed = True
                audit.append({'row': row_index, 'status': 'UNRESOLVED', 'reason': 'Hafs anchor did not match canonical tokens', 'surah': surah, 'ayah': ayah, 'hafs': hafs, 'duri': duri, 'bayan': row['bayan']})
                stats['UNRESOLVED'] += 1
                break
            if len(hits) > 1 and not all_marker:
                row_failed = True
                audit.append({'row': row_index, 'status': 'AMBIGUOUS', 'reason': 'multiple canonical token matches without an all-occurrences marker', 'surah': surah, 'ayah': ayah, 'hafs': hafs, 'hitCount': len(hits), 'bayan': row['bayan']})
                stats['AMBIGUOUS'] += 1
                break
            for hit in hits if all_marker else hits[:1]:
                span = canonical_span(hit)
                matched_duri = ''.join(duri.split()) if matched_hafs != hafs and span['endToken'] == span['startToken'] else duri
                row_spans.append((matched_hafs, matched_duri, span))
        if row_failed:
            continue

        results = []
        for hafs, duri, span in row_spans:
            if span['endAyah'] != span['ayah']:
                results.append({'page': span['page'], 'result': 'SKIPPED', 'reason': 'cross-ayah span'})
                stats['UNSUPPORTED_CROSS_AYAH'] += 1
                continue
            lexical = plain(hafs) != plain(duri)
            same_word_count = len(hafs.split()) == len(duri.split())
            if lexical and not same_word_count:
                results.append({'page': span['page'], 'result': 'SKIPPED', 'reason': 'Hafs/Duri phrase lengths differ'})
                stats['UNSAFE_SOURCE_FORM'] += 1
                continue
            if lexical:
                candidate = make_variant(row, row_index, span, hafs, duri, sha)
                result = merge_variant(variants[span['page']], candidate)
                kind = 'VARIANT_' + result
            else:
                category = action_category(row['bayan'])
                if category:
                    candidate = make_ruling(row, row_index, span, sha, category)
                    result = merge_ruling(rulings[span['page']], candidate)
                    kind = 'RULING_' + result
                else:
                    candidate = make_performance_variant(row, row_index, span, sha)
                    result = shared_merge_face(variants[span['page']], rulings[span['page']], candidate, READING, strict_form)
                    kind = 'PERFORMANCE_' + result
            stats[kind] += 1
            if result in ('ADDED', 'READING_ADDED', 'SOURCE_ADDED'):
                touched.add(span['page'])
            results.append({'page': span['page'], 'surah': span['surah'], 'ayah': span['ayah'], 'startToken': span['startToken'], 'endToken': span['endToken'], 'result': result})
        audit.append({'row': row_index, 'status': 'PROCESSED', 'surah': surah, 'ayah': ayah, 'spans': results, 'source': source_text(row)})

    report = {
        'source': SOURCE_NAME, 'sourceUrl': SOURCE_URL, 'sourceExport': source.name,
        'sourceSha256': sha, 'generatedAt': TS,
        'policy': 'additive fixture-only; canonical Mushaf text comes from page-word fixtures; unresolved, ambiguous, and multi-face rows are not guessed',
        'readingId': READING, 'totalSourceRows': len(rows), 'stats': dict(sorted(stats.items())),
        'touchedPages': sorted(touched), 'rows': audit,
    }
    print(json.dumps({'sourceRows': len(rows), 'stats': dict(sorted(stats.items())), 'touchedPages': sorted(touched), 'dryRun': not args.write}, ensure_ascii=False, indent=2))
    if args.write:
        for page in sorted(touched):
            write_json(VARIANT_DIR / f'page-{page:03d}.json', variants[page])
            write_json(RULING_DIR / f'page-{page:03d}.json', rulings[page])
        write_json(args.report, report)
        print(f'WROTE {len(touched)} touched fixture pages and {args.report}')
    elif args.write_report:
        write_json(args.report, report)
        print(f'WROTE audit report only: {args.report}')
    else:
        print('DRY RUN: no fixture or report files changed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
