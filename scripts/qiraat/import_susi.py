#!/usr/bin/env python3
"""Add source-backed al-Susi records without changing canonical Mushaf text.

The input is intentionally external: the user-supplied JSON is not copied into the
repository.  Every emitted record is anchored through ``tokens.py`` and every source
row receives a terminal audit status.  Ambiguous, multi-face, and conflicting rows are
reported and skipped rather than guessed.

Usage:
  python3 scripts/qiraat/import_susi.py --source /path/farsh_susi_complete_quran.json
  python3 scripts/qiraat/import_susi.py --source ... --write

The default is a dry run. ``--write`` updates only fixture pages that gained a safe
record and writes ``docs/qiraat-susi-import-audit.json``.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tokens as T
from merge_faces import merge_variant as shared_merge_variant, merge_ruling as shared_merge_ruling, merge_face as shared_merge_face

ROOT = Path(__file__).resolve().parents[2]
VARIANT_DIR = ROOT / 'packages/qiraat-core/fixtures/pages'
RULING_DIR = ROOT / 'packages/qiraat-core/fixtures/rulings'
REPORT_PATH = ROOT / 'docs/qiraat-susi-import-audit.json'
READING = 'Q03-R02'
TS = '2026-09-23T12:00:00.000Z'

COLORS = {
    'IMALAH_TAQLIL': ('الممال والمقلل', '#C026D3'),
    'IDGHAM_KABIR': ('المدغم الكبير', '#15803D'),
    'IDGHAM_SAGHIR': ('المدغم الصغير', '#15803D'),
    'SAKT': ('السكت', '#7C3AED'),
    'TARK_GHUNNA': ('ترك الغنة', '#0891B2'),
    'IKHFA': ('الإخفاء', '#0891B2'),
    'SILAT_HA': ('صلة هاء الكناية', '#0D9488'),
    'MEEM_JAM': ('صلة ميم الجمع', '#DB2777'),
    'TARQIQ_RA': ('ترقيق الراءات', '#B45309'),
    'TAGHLIZ_LAM': ('تغليظ اللامات', '#B45309'),
    'WAQF_RASM': ('الوقف على مرسوم الخط', '#EA580C'),
    'WAQF_HAMZA': ('وقف حمزة', '#EA580C'),
}


def strip_source_marks(text: str) -> str:
    """A matching-only normalizer; never use it for stored Mushaf text."""
    text = text or ''
    text = re.sub(r'\([^)]*\)', ' ', text)
    text = text.replace('﴿', ' ').replace('﴾', ' ')
    text = text.replace('…', ' ').replace('...', ' ')
    text = re.sub(r'[،؛,:.]', ' ', text)
    return ' '.join(text.split())


def plain(text: str) -> str:
    text = text or ''
    text = text.replace('ۥ', '').replace('ۦ', '').replace('ۧ', '').replace('ٰ', '')
    text = re.sub('[ً-ٰۖ-ۭؐ-ؚ]', '', text)
    text = re.sub('[إأآٱ]', 'ا', text).replace('ى', 'ي').replace('ة', 'ه')
    text = text.replace('ؤ', 'و').replace('ئ', 'ي').replace('ـ', '')
    return ' '.join(text.split())


def plain_fold(text: str) -> str:
    return plain(text).replace('ي', 'ا')


def plain_skeleton(text: str) -> str:
    return plain(text).replace('ا', '').replace('ء', '')


def strict_form(text: str) -> str:
    """Compare candidate display forms without collapsing shadda distinctions."""
    text = text or ''
    text = unicodedata.normalize('NFC', text)
    text = text.replace('ۥ', 'و').replace('ۦ', 'ي').replace('ۧ', 'ي').replace('ٰ', 'ا')
    text = text.replace('ّ', '')
    text = re.sub('[ً-ٰۖ-ۭؐ-ؚ]', '', text)
    text = text.replace('', 'ّ')
    text = re.sub('[إأآٱ]', 'ا', text)
    text = text.replace('ى', 'ي').replace('ة', 'ه')
    text = text.replace('ؤ', 'و').replace('ئ', 'ي').replace('ـ', '')
    return ' '.join(text.split())


MATCHERS = (T.norm, T.fold, T.skeleton, plain, plain_fold, plain_skeleton)


def source_parts(text: str) -> list[str]:
    cleaned = strip_source_marks(text)
    return [part.strip() for part in cleaned.split('/') if part.strip()] or [cleaned]


def ayah_start(value: object) -> int:
    return int(str(value).split('-', 1)[0].strip())


def ayah_end(value: object) -> int:
    parts = str(value).split('-', 1)
    return int(parts[-1].strip())


def source_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def make_index() -> tuple[dict[int, list[dict]], dict[str, dict[str, list[tuple[int, int]]]]]:
    pages = {page: T.page_words(page) for page in range(1, 605)}
    first = {fn.__name__: collections.defaultdict(list) for fn in MATCHERS}
    for page, words in pages.items():
        for index, word in enumerate(words):
            for fn in MATCHERS:
                first[fn.__name__][fn(word['textUthmani'])].append((page, index))
    return pages, first


def find_hits(pages, first, surah: int, ayah: int, phrase: str) -> list[dict]:
    words = strip_source_marks(phrase).split()
    if not words:
        return []
    for fn in MATCHERS:
        want = [fn(word) for word in words]
        hits = []
        for page, index in first[fn.__name__].get(want[0], []):
            segment = pages[page][index:index + len(want)]
            if len(segment) != len(want):
                continue
            if segment[0]['surahNumber'] != surah or segment[0]['ayahNumber'] != ayah:
                continue
            if not all(fn(segment[offset]['textUthmani']) == want[offset]
                       for offset in range(len(want))):
                continue
            hits.append({
                'matcher': fn.__name__,
                'page': page,
                'words': segment,
            })
        if hits:
            return hits
    return []


def marker_is_all(text: str) -> bool:
    return bool(re.search(r'معاً|الموضعين|موضعين|مواضع|المواضع|\d+\s*مواضع', text or ''))


def resolve_anchor(row: dict, pages, first) -> dict:
    surah = int(row['surah_number'])
    ayah = ayah_start(row['ayah_number'])
    all_marker = marker_is_all(f"{row['word_hafs']} {row['rule_description']}")
    attempts = []
    for field in ('word_hafs', 'word_susi'):
        for part_index, part in enumerate(source_parts(row[field])):
            hits = find_hits(pages, first, surah, ayah, part)
            attempts.append({'field': field, 'part': part, 'hits': hits})
            if not hits:
                continue
            if len(hits) > 1 and not all_marker:
                return {'status': 'AMBIGUOUS', 'reason': 'multiple token matches without an all-occurrences marker',
                        'attempts': attempts}
            selected = hits if all_marker else hits[:1]
            return {'status': 'MATCHED', 'field': field, 'partIndex': part_index,
                    'anchorText': part, 'hits': selected, 'allOccurrences': all_marker,
                    'attempts': attempts}
    return {'status': 'UNRESOLVED', 'reason': 'no source anchor matched canonical Mushaf tokens',
            'attempts': attempts}


def source_text(row: dict) -> str:
    return f"{row['word_hafs']} → {row['word_susi']} | {row['rule_description']}"


def action_category(description: str) -> str | None:
    d = description or ''
    if 'إمالة' in d or 'تقليل' in d:
        return 'IMALAH_TAQLIL'
    if 'إدغام' in d:
        return 'IDGHAM_SAGHIR' if 'صغير' in d else 'IDGHAM_KABIR'
    if 'سكت' in d:
        return 'SAKT'
    if 'ترك الغنة' in d:
        return 'TARK_GHUNNA'
    if 'إخفاء' in d:
        return 'IKHFA'
    if 'صلة هاء' in d:
        return 'SILAT_HA'
    if 'صلة ميم' in d:
        return 'MEEM_JAM'
    if 'ترقيق الراء' in d or 'ترقيق الراءات' in d:
        return 'TARQIQ_RA'
    if 'تغليظ اللام' in d:
        return 'TAGHLIZ_LAM'
    if 'الوقف على مرسوم' in d:
        return 'WAQF_RASM'
    if 'وقف حمزة' in d:
        return 'WAQF_HAMZA'
    return None


def difference_type(description: str, hafs: str, susi: str) -> str:
    d = description or ''
    if 'إمالة' in d or 'تقليل' in d:
        return 'IMALAH'
    if 'إدغام' in d:
        return 'IDGHAM'
    if 'وقف' in d:
        return 'WAQF'
    if 'مد' in d:
        return 'MADD'
    if 'همز' in d or 'الهمزة' in d:
        return 'HAMZ'
    if 'حذف' in d or 'إسقاط' in d:
        return 'OMISSION'
    if 'إثبات' in d or 'زيادة' in d:
        return 'ADDITION'
    if plain(hafs) == plain(susi):
        return 'OTHER'
    if any(word in d for word in ('كسر', 'فتح', 'ضم', 'إسكان', 'تشديد', 'تخفيف')):
        return 'HARAKAH'
    return 'LETTER'


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


def source_ref(sha: str, row_index: int) -> dict:
    return {
        'sourceName': 'farsh_susi_complete_quran.json',
        'sourceType': 'other',
        'sourceReference': f'user-supplied JSON row {row_index + 1}; SHA-256 {sha}',
        'verificationNotes': 'Mapped additively to the canonical Mushaf-1441 token fixtures; source text retained verbatim.',
    }


def make_variant(row, row_index: int, span: dict, sha: str) -> dict:
    variant_text = strip_source_marks(row['word_susi'])
    description = row['rule_description']
    locus = f"SUSI-{int(row['surah_number']):03d}-{span['ayah']}-{span['startToken']}-{row_index + 1:04d}"
    variant_id = f'v-{locus}'
    return {
        'id': variant_id,
        'surah': span['surah'],
        'ayah': span['ayah'],
        'startToken': span['startToken'],
        'endToken': span['endToken'],
        'operation': 'REPLACE',
        'hafsText': span['baseText'],
        'variantText': variant_text,
        'differenceType': difference_type(description, row['word_hafs'], row['word_susi']),
        'verificationStatus': 'REVIEWED',
        'createdAt': TS,
        'updatedAt': TS,
        'readingIds': [READING],
        'locusId': locus,
        'locusType': 'multi_word_variant' if span['endToken'] > span['startToken'] else 'word_variant',
        'sources': [{
            'id': f's-{locus}',
            'variantId': variant_id,
            **source_ref(sha, row_index),
            'sourceText': source_text(row),
        }],
        'description': description,
    }


def make_performance_variant(row, row_index: int, span: dict, sha: str) -> dict:
    locus = f"SUSI-{int(row['surah_number']):03d}-{span['ayah']}-{span['startToken']}-{row_index + 1:04d}"
    variant_id = f'v-{locus}-performance'
    return {
        'id': variant_id,
        'surah': span['surah'],
        'ayah': span['ayah'],
        'startToken': span['startToken'],
        'endToken': span['endToken'],
        'operation': 'REPLACE',
        'hafsText': span['baseText'],
        'variantText': span['baseText'],
        'differenceType': difference_type(row['rule_description'], row['word_hafs'], row['word_susi']),
        'verificationStatus': 'REVIEWED',
        'createdAt': TS,
        'updatedAt': TS,
        'readingIds': [READING],
        'locusId': locus,
        'locusType': 'performance_variant',
        'performanceNote': row['rule_description'],
        'sources': [{
            'id': f's-{locus}',
            'variantId': variant_id,
            **source_ref(sha, row_index),
            'sourceText': source_text(row),
        }],
        'description': row['rule_description'],
    }


def make_ruling(row, row_index: int, span: dict, sha: str, category: str) -> dict:
    label, color = COLORS[category]
    locus = f"SUSI-{int(row['surah_number']):03d}-{span['ayah']}-{span['startToken']}-{row_index + 1:04d}"
    action = row['rule_description']
    return {
        'id': f'r-{locus}-{category}',
        'pageNumber': span['page'],
        'category': category,
        'categoryAr': label,
        'color': color,
        'wordAnchored': True,
        'surah': span['surah'],
        'ayah': span['ayah'],
        'startToken': span['startToken'],
        'endToken': span['endToken'],
        'endAyah': span['endAyah'],
        'baseText': span['baseText'],
        'verificationStatus': 'REVIEWED',
        'attribution': [{'authorityId': READING, 'action': action}],
        'readings': [{'readingId': READING, 'action': action, 'isDefault': True}],
        'hasAlternate': False,
        'notes': 'Imported from the user-supplied complete al-Susi source; source row retained verbatim.',
        'sourceNotes': [source_text(row)],
        'createdAt': TS,
        'updatedAt': TS,
        '_sourceRow': row_index,
    }


def same_form(existing: dict, candidate: dict) -> bool:
    return (existing.get('surah'), existing.get('ayah'), existing.get('startToken'),
            existing.get('endToken'), strict_form(existing.get('variantText', ''))) == (
            candidate.get('surah'), candidate.get('ayah'), candidate.get('startToken'),
            candidate.get('endToken'), strict_form(candidate.get('variantText', '')))


def spans_overlap(left: dict, right: dict) -> bool:
    return (
        left.get('surah') == right.get('surah') and
        left.get('ayah') == right.get('ayah') and
        left.get('startToken', 0) <= right.get('endToken', 0) and
        right.get('startToken', 0) <= left.get('endToken', 0)
    )


def merge_sources(target: dict, candidate: dict) -> bool:
    target_sources = target.setdefault('sources', [])
    known = {
        (item.get('sourceName'), item.get('sourceReference'), item.get('sourceText'))
        for item in target_sources
    }
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


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--write-report', action='store_true',
                        help='write the audit report while leaving fixtures unchanged')
    parser.add_argument('--report', type=Path, default=REPORT_PATH)
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not source.is_file():
        parser.error(f'source does not exist: {source}')
    rows = json.loads(source.read_text(encoding='utf-8'))
    if not isinstance(rows, list):
        raise SystemExit('source top level must be an array')
    sha = source_sha256(source)
    pages, first = make_index()
    variants = {page: json.loads((VARIANT_DIR / f'page-{page:03d}.json').read_text(encoding='utf-8'))
                for page in range(1, 605)}
    rulings = {page: json.loads((RULING_DIR / f'page-{page:03d}.json').read_text(encoding='utf-8'))
               for page in range(1, 605)}
    audit = []
    stats = collections.Counter()
    touched = set()

    for index, row in enumerate(rows):
        required = ('surah_number', 'ayah_number', 'word_hafs', 'word_susi', 'rule_description')
        if any(key not in row for key in required):
            audit.append({'row': index + 1, 'status': 'INVALID_SOURCE_ROW', 'reason': 'missing required field'})
            stats['INVALID_SOURCE_ROW'] += 1
            continue
        anchor = resolve_anchor(row, pages, first)
        if anchor['status'] != 'MATCHED':
            item = {'row': index + 1, 'surah': row['surah_number'], 'ayah': row['ayah_number'],
                    'wordHafs': row['word_hafs'], 'wordSusi': row['word_susi'],
                    'rule': row['rule_description'], **{k: v for k, v in anchor.items() if k != 'attempts'}}
            item['attempts'] = [{
                'field': attempt['field'], 'part': attempt['part'], 'hitCount': len(attempt['hits'])
            } for attempt in anchor.get('attempts', [])]
            audit.append(item)
            stats[anchor['status']] += 1
            continue

        description = row['rule_description'] or ''
        faces = source_parts(row['word_susi'])
        if len(faces) > 1:
            audit.append({'row': index + 1, 'status': 'MULTI_FACE_SKIPPED', 'surah': row['surah_number'],
                          'ayah': row['ayah_number'], 'reason': 'source contains slash-separated alternate faces',
                          'anchor': anchor['anchorText']})
            stats['MULTI_FACE_SKIPPED'] += 1
            continue
        source_hafs = strip_source_marks(row['word_hafs'])
        source_susi = strip_source_marks(row['word_susi'])
        span_results = []
        for hit in anchor['hits']:
            span = canonical_span(hit)
            cross_ayah = span['endAyah'] != span['ayah']
            lexical = plain(source_hafs) != plain(source_susi)
            compatible_phrase_lengths = len(source_hafs.split()) == len(source_susi.split())
            if lexical and not cross_ayah and compatible_phrase_lengths and anchor['field'] == 'word_hafs':
                candidate = make_variant(row, index, span, sha)
                result = merge_variant(variants[span['page']], candidate)
                kind = 'VARIANT_' + result
                touched.add(span['page']) if result in ('ADDED', 'READING_ADDED', 'SOURCE_ADDED') else None
            elif not lexical or cross_ayah:
                category = action_category(description)
                if category:
                    candidate = make_ruling(row, index, span, sha, category)
                    result = merge_ruling(rulings[span['page']], candidate)
                    kind = 'RULING_' + result
                    touched.add(span['page']) if result in ('ADDED', 'READING_ADDED', 'SOURCE_ADDED') else None
                elif not cross_ayah:
                    candidate = make_performance_variant(row, index, span, sha)
                    result = shared_merge_face(variants[span['page']], rulings[span['page']], candidate, READING, strict_form)
                    kind = 'PERFORMANCE_' + result
                    touched.add(span['page']) if result in ('ADDED', 'READING_ADDED', 'SOURCE_ADDED') else None
                else:
                    kind = 'UNSUPPORTED_CROSS_AYAH'
                    result = 'SKIPPED'
            else:
                kind = 'UNSAFE_SOURCE_FORM'
                result = 'SKIPPED'
            stats[kind] += 1
            span_results.append({'page': span['page'], 'surah': span['surah'], 'ayah': span['ayah'],
                                 'startToken': span['startToken'], 'endToken': span['endToken'],
                                 'matcher': hit['matcher'], 'result': result})
        audit.append({'row': index + 1, 'status': 'PROCESSED', 'surah': row['surah_number'],
                      'ayah': row['ayah_number'], 'anchor': anchor['anchorText'],
                      'anchorField': anchor['field'], 'spans': span_results})

    for page in variants:
        for record in variants[page]:
            for source_record in record.get('sources', []):
                source_record.pop('_sourceRow', None)
    report = {
        'source': source.name,
        'sourceSha256': sha,
        'sourceAbsolutePath': str(source),
        'generatedAt': TS,
        'policy': 'additive fixture-only; canonical Mushaf text comes from page-word fixtures; unresolved or conflicting rows are not guessed',
        'totalSourceRows': len(rows),
        'stats': dict(sorted(stats.items())),
        'touchedPages': sorted(touched),
        'rows': audit,
    }
    print(json.dumps({'sourceRows': len(rows), 'stats': dict(sorted(stats.items())),
                      'touchedPages': sorted(touched), 'dryRun': not args.write}, ensure_ascii=False, indent=2))
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
