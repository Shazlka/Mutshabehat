"""Shared conservative face merging for reader importers and fixture cleanup.

New per-reader importers must use ``merge_variant`` and ``merge_ruling`` rather
than maintaining local merge logic.  ``dedupe_fixture_corpus`` applies the same
equivalence policy to existing page fixtures and writes a verbatim audit.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VARIANT_DIR = ROOT / 'packages/qiraat-core/fixtures/pages'
RULING_DIR = ROOT / 'packages/qiraat-core/fixtures/rulings'
AUDIT_PATH = ROOT / 'docs/qiraat-reader-dedupe-audit.json'

# Explicit source-action/category correspondences; unsupported wording stays separate.
ACTION_CATEGORIES = {
    'HAMZ': {'TAGHYIR_HAMZ'}, 'IMALAH': {'IMALAH_TAQLIL'},
    'IDGHAM': {'IDGHAM_KABIR', 'IDGHAM_SAGHIR'},
    'SAKT': {'SAKT'}, 'SILAT_HA': {'SILAT_HA'}, 'MEEM_JAM': {'MEEM_JAM'},
    'GHUNNA': {'TARK_GHUNNA'}, 'IKHFA': {'IKHFA'},
    'TARQIQ_RA': {'TARQIQ_RA'}, 'TAGHLIZ_LAM': {'TAGHLIZ_LAM'},
    'WAQF': {'WAQF_RASM', 'WAQF_HAMZA'}, 'MADD': {'MADD_BADAL'},
    'YAAT_IDAFA': {'YAAT_IDAFA'}, 'TASHIL': {'HAMZATAN_KALIMA', 'HAMZATAN_KALIMATAYN'},
}

def action_key(text: str) -> str | None:
    s = (text or '').replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
    # Conservative: hamza replacement is not facilitation; imalah and taqlil remain distinct.
    if 'ابدال' in s and ('همز' in s or 'همزة' in s): return 'HAMZ'
    if 'تسهيل' in s or 'سهل' in s: return 'TASHIL'
    if 'تقليل' in s or 'قلل' in s: return 'TAQLIL'
    if 'امالة' in s or 'امال' in s: return 'IMALAH'
    if 'فتح الياء' in s or 'اسكان الياء' in s or 'تسكين الياء' in s: return 'YAAT_IDAFA'
    if 'ادغام' in s: return 'IDGHAM'
    if 'سكت' in s: return 'SAKT'
    if ('صلة' in s and 'ميم' in s) or 'كسر الميم' in s: return 'MEEM_JAM'
    if 'صلة' in s and ('هاء' in s or 'كناي' in s): return 'SILAT_HA'
    if 'غنة' in s: return 'GHUNNA'
    if 'اخفاء' in s: return 'IKHFA'
    if 'ترقيق الراء' in s or 'ترقيق الراءات' in s: return 'TARQIQ_RA'
    if 'تغليظ اللام' in s: return 'TAGHLIZ_LAM'
    if 'وقف' in s: return 'WAQF'
    if 'مد' in s: return 'MADD'
    return None

def merge_sources(target: dict, candidate: dict) -> bool:
    sources = target.setdefault('sources', [])
    keys = {(x.get('sourceName'), x.get('sourceReference'), x.get('sourceText')) for x in sources}
    changed = False
    for source in candidate.get('sources', []):
        key = (source.get('sourceName'), source.get('sourceReference'), source.get('sourceText'))
        if key not in keys:
            attached = dict(source); attached['variantId'] = target.get('id', attached.get('variantId'))
            sources.append(attached); keys.add(key); changed = True
    return changed

def merge_variant(existing: list[dict], candidate: dict, reading: str, strict_form) -> str:
    same = [v for v in existing if (v.get('surah'), v.get('ayah'), v.get('startToken'), v.get('endToken'),
            strict_form(v.get('variantText', '')), v.get('differenceType')) ==
            (candidate.get('surah'), candidate.get('ayah'), candidate.get('startToken'), candidate.get('endToken'),
            strict_form(candidate.get('variantText', '')), candidate.get('differenceType'))]
    if same:
        target = next((v for v in same if reading in v.get('readingIds', [])), same[0])
        if reading in target.get('readingIds', []): return 'SOURCE_ADDED' if merge_sources(target, candidate) else 'DEDUPLICATED'
        # Only equivalent records are merged; preserve differently-described performance faces.
        if target.get('locusType') != candidate.get('locusType') or (
            candidate.get('locusType') == 'performance_variant' and
            action_key(target.get('performanceNote', '')) != action_key(candidate.get('performanceNote', ''))):
            return 'CONFLICT_SKIPPED'
        target.setdefault('readingIds', []).append(reading); target['readingIds'] = sorted(set(target['readingIds']))
        merge_sources(target, candidate); return 'READING_ADDED'
    existing.append(candidate); return 'ADDED'

def merge_ruling(existing: list[dict], candidate: dict, reading: str) -> str:
    category = candidate['category']
    action = candidate['readings'][0]['action']
    same = [r for r in existing if r.get('surah') == candidate['surah'] and r.get('ayah') == candidate['ayah']
            and r.get('startToken') == candidate['startToken'] and r.get('category') == category]
    if same:
        target = same[0]
        old = next((x for x in target.get('readings', []) if x.get('readingId') == reading), None)
        if old:
            if old.get('action') != action: return 'CONFLICT_SKIPPED'
            notes = target.setdefault('sourceNotes', [])
            added = False
            for note in candidate.get('sourceNotes', []):
                if note not in notes: notes.append(note); added = True
            return 'SOURCE_ADDED' if added else 'DEDUPLICATED'
        target.setdefault('readings', []).append(dict(candidate['readings'][0]))
        target.setdefault('attribution', []).append(dict(candidate['attribution'][0]))
        target.setdefault('sourceNotes', []).extend(x for x in candidate.get('sourceNotes', []) if x not in target.get('sourceNotes', []))
        target['readings'].sort(key=lambda x: x['readingId']); target['attribution'].sort(key=lambda x: x['authorityId'])
        target['hasAlternate'] = any(not x.get('isDefault', False) for x in target['readings'])
        return 'READING_ADDED'
    candidate.pop('_sourceRow', None); existing.append(candidate); return 'ADDED'

def spans_cover(ruling: dict, variant: dict) -> bool:
    return ruling.get('surah') == variant.get('surah') and ruling.get('ayah') == variant.get('ayah') and \
        int(ruling.get('startToken', 0)) <= int(variant.get('startToken', 0)) and \
        int(ruling.get('endToken', 0)) >= int(variant.get('endToken', 0))

def merge_face(variants: list[dict], rulings: list[dict], candidate: dict, reading: str, strict_form) -> str:
    """Merge a performance-only candidate into a compatible ruling when safe."""
    if candidate.get('locusType') == 'performance_variant' and candidate.get('variantText') == candidate.get('hafsText'):
        family = action_key(candidate.get('performanceNote', ''))
        matches = [r for r in rulings if spans_cover(r, candidate) and
                   r.get('category') in ACTION_CATEGORIES.get(family, set())]
        if family in ('IMALAH', 'TAQLIL'):
            matches = [r for r in matches if any(action_key(x.get('action', '')) == family for x in r.get('readings', []))]
        for target in matches:
            old = next((x for x in target.get('readings', []) if x.get('readingId') == reading), None)
            peer = next((x for x in target.get('readings', []) if action_key(x.get('action', '')) == family), None)
            if old and action_key(old.get('action', '')) != family: continue
            if not old and not peer: continue
            result = 'DEDUPLICATED'
            if not old:
                target.setdefault('readings', []).append({'readingId': reading, 'action': peer['action'], 'isDefault': True})
                target.setdefault('attribution', []).append({'authorityId': reading, 'action': peer['action']})
                target['readings'].sort(key=lambda x: x['readingId']); target['attribution'].sort(key=lambda x: x['authorityId'])
                target['hasAlternate'] = any(not x.get('isDefault', False) for x in target['readings'])
                result = 'READING_ADDED'
            notes = target.setdefault('sourceNotes', [])
            for source in candidate.get('sources', []):
                note = ' | '.join(x for x in (source.get('sourceText'), source.get('sourceReference')) if x)
                if note and note not in notes:
                    notes.append(note)
                    if result == 'DEDUPLICATED': result = 'SOURCE_ADDED'
            return result
    return merge_variant(variants, candidate, reading, strict_form)

def dedupe_fixture_corpus() -> dict:
    audit = {'generatedAt': '2026-09-23', 'policy': 'conservative category/action equivalence; removed records preserved verbatim',
             'equivalenceMapping': {k: sorted(v) for k, v in ACTION_CATEGORIES.items()}, 'merges': [], 'conflicts': []}
    counts = {'performance_variant_ruling_covered': 0, 'performance_variant_ruling_reader_added': 0,
              'variant_variant': 0, 'records_removed': 0, 'readers_added': 0}
    for page in range(1, 605):
        vp, rp = VARIANT_DIR / f'page-{page:03d}.json', RULING_DIR / f'page-{page:03d}.json'
        variants, rulings = json.loads(vp.read_text()), json.loads(rp.read_text())
        remove = set()
        # Performance action -> compatible ruling category and same action for existing reader.
        for v in variants:
            if v.get('locusType') != 'performance_variant' or v.get('variantText') != v.get('hafsText'): continue
            action = action_key(v.get('performanceNote', ''))
            candidates = [r for r in rulings if spans_cover(r, v) and r.get('category') in ACTION_CATEGORIES.get(action, set())]
            # Exact family distinction: do not conflate imalah and taqlil.
            if action in ('IMALAH', 'TAQLIL'):
                candidates = [r for r in candidates if any(action_key(x.get('action', '')) == action for x in r.get('readings', []))]
            if not candidates: continue
            target = candidates[0]
            conflicts = [rd for rd in target.get('readings', []) if rd.get('readingId') in v.get('readingIds', []) and
                         action_key(rd.get('action', '')) != action]
            if conflicts:
                audit['conflicts'].append({'page': page, 'duplicate': v, 'candidateRulingId': target['id'], 'reason': 'same reader has a different or unrecognized action'})
                continue
            missing = [rid for rid in v.get('readingIds', []) if not any(rd.get('readingId') == rid for rd in target.get('readings', []))]
            if missing:
                for rid in missing:
                    # Source note carries exact action; canonical action follows the equivalent existing ruling action.
                    sample = next((x.get('action') for x in target.get('readings', []) if action_key(x.get('action', '')) == action), None)
                    if sample is None: break
                    # Prefer the reader's own source wording; peer actions can name another rawi.
                    own = v.get('performanceNote') or sample
                    target.setdefault('readings', []).append({'readingId': rid, 'action': own, 'isDefault': True})
                    target.setdefault('attribution', []).append({'authorityId': rid, 'action': own})
                    counts['readers_added'] += 1
                target['readings'].sort(key=lambda x: x['readingId']); target['attribution'].sort(key=lambda x: x['authorityId'])
                target['hasAlternate'] = any(not x.get('isDefault', False) for x in target['readings'])
                counts['performance_variant_ruling_reader_added'] += 1
            else: counts['performance_variant_ruling_covered'] += 1
            notes = target.setdefault('sourceNotes', [])
            for s in v.get('sources', []):
                note = ' | '.join(x for x in (s.get('sourceText'), s.get('sourceReference')) if x)
                if note and note not in notes: notes.append(note)
            remove.add(v['id']); counts['records_removed'] += 1
            audit['merges'].append({'page': page, 'mergedInto': target['id'], 'removedRecord': v})
        # Same exact span + diacritized text + differenceType; union readers and provenance.
        groups = {}
        for v in variants:
            if v['id'] in remove: continue
            key = (v.get('surah'), v.get('ayah'), v.get('startToken'), v.get('endToken'), v.get('variantText'), v.get('differenceType'))
            groups.setdefault(key, []).append(v)
        for group in groups.values():
            if len(group) < 2: continue
            target = group[0]
            for dup in group[1:]:
                if target.get('locusType') != dup.get('locusType'):
                    audit['conflicts'].append({'page': page, 'duplicate': dup, 'candidateId': target['id'], 'reason': 'locusType differs'}); continue
                if target.get('locusType') == 'performance_variant' and (
                    action_key(target.get('performanceNote', '')) != action_key(dup.get('performanceNote', '')) or
                    target.get('performanceNote') != dup.get('performanceNote')
                ):
                    audit['conflicts'].append({'page': page, 'duplicate': dup, 'candidateId': target['id'], 'reason': 'performance actions differ'}); continue
                if target.get('description') != dup.get('description'):
                    audit['conflicts'].append({'page': page, 'duplicate': dup, 'candidateId': target['id'], 'reason': 'face descriptions differ'}); continue
                readers = set(target.get('readingIds', [])); incoming = dup.get('readingIds', [])
                if readers.intersection(incoming):
                    audit['conflicts'].append({'page': page, 'duplicate': dup, 'candidateId': target['id'], 'reason': 'reader already assigned'}); continue
                target['readingIds'] = sorted(readers.union(incoming))
                known = {(s.get('sourceName'), s.get('sourceReference'), s.get('sourceText')) for s in target.get('sources', [])}
                for s in dup.get('sources', []):
                    key_s = (s.get('sourceName'), s.get('sourceReference'), s.get('sourceText'))
                    if key_s not in known:
                        copy = dict(s); copy['variantId'] = target['id']; target.setdefault('sources', []).append(copy); known.add(key_s)
                remove.add(dup['id']); counts['records_removed'] += 1; counts['readers_added'] += len(incoming)
                counts['variant_variant'] += 1
                audit['merges'].append({'page': page, 'mergedInto': target['id'], 'removedRecord': dup})
        if remove:
            vp.write_text(json.dumps([v for v in variants if v['id'] not in remove], ensure_ascii=False, indent=2)+'\n')
            rp.write_text(json.dumps(rulings, ensure_ascii=False, indent=2)+'\n')
    audit['counts'] = counts
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
    return audit
