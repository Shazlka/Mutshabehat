# -*- coding: utf-8 -*-
"""Generate packages/qiraat-core/fixtures/pages/page-NNN.json from data_variants.py.

Invariants enforced here, loudly (the build fails rather than emitting bad data):
  - every locus resolves to REAL Mushaf-1441 tokens; baseText is never hand-typed;
  - every variant locus partitions the 20 Riwayat exactly once (no gap, no overlap),
    unless the locus is explicitly marked as a known source defect;
  - "خلف" is never resolved from a bare string (authorities.py refuses it).
"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T
import authorities as A
from data_variants import PAGES

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'packages/qiraat-core/fixtures/pages')
TS = '2026-09-17T12:00:00.000Z'

SOURCE_NOTE = ('استُخرجت هذه البيانات بصريًا من صور «مصحف القراءات العشر» بدقة ١٥٠ نقطة/بوصة '
               '(طبقة النص مشوّشة الترتيب، استُعملت للمقابلة فقط). لم تُراجع بعدُ على الأصل الورقي.')

# variant_type -> the app's DifferenceType enum
DIFF = {
    'orthography': 'ORTHOGRAPHY', 'vowel': 'HARAKAH', 'consonant': 'LETTER', 'hamza': 'HAMZ',
    'madd': 'MADD', 'idgham': 'IDGHAM', 'ishmam': 'HARAKAH', 'imalah': 'IMALAH',
    'taqlil': 'IMALAH', 'sakt': 'WAQF', 'naql': 'NAQL', 'ikhfa': 'OTHER', 'ghunnah': 'OTHER',
    'pronoun': 'HARAKAH', 'grammar': 'HARAKAH', 'addition': 'ADDITION', 'omission': 'OMISSION',
    'word_form': 'LETTER', 'other': 'OTHER',
}

errors, warnings, qa_flags = [], [], []


def resolve_attr(spec, claimed_so_far):
    if isinstance(spec, tuple) and spec and spec[0] == 'REST':
        return A.remainder(claimed_so_far)
    if isinstance(spec, tuple) and spec and spec[0] == 'EXCEPT':
        return A.all_except(spec[1])
    return A.expand(spec)


def build_page(page, spec):
    out = []
    for query, wujuh, kw in spec['variants']:
        occ_all = kw.get('all_occurrences', False)
        occ = kw.get('occurrence', 1)
        ayah = kw.get('ayah')
        try:
            first = T.find(page, query, occ, ayah)
        except T.NoMatch as e:
            errors.append(f'p{page}: {e}')
            continue
        n_occ = first['count'] if occ_all else 1
        for k in range(n_occ):
            idx = (k + 1) if occ_all else occ
            loc = T.find(page, query, idx, ayah)
            # A `locus_group` in the data means several DIFFERENT queries form one conceptual
            # locus (2:37 آدم + كلمات resolve together; 2:97/98 جبريل appears twice). They then
            # share one locusId so the detail panel can group them back together.
            locus_id = kw.get('locus_group') or f'L{page:03d}-{T.norm(query).replace(" ", "_")}-{idx}'
            claimed = []
            for vi, (text, desc, vtype, attr, is_base) in enumerate(wujuh, 1):
                readings = resolve_attr(attr, claimed)
                claimed += [r for r in readings if r not in claimed]
                if is_base:
                    continue  # the baseline وجه is what the Mushaf already prints
                if not readings:
                    errors.append(f'p{page} {query}: وجه {vi} resolved to zero readings')
                # A performance-only وجه is one the SOURCE describes as a manner of delivery
                # (إشمام / اختلاس / سكت) — it has no written form of its own.
                #
                # This must NOT be inferred from text equality after normalisation: normalisation
                # strips harakat, so عَلَيْهِمْ and عَلَيْهُمْ would compare equal and the real,
                # visible difference would be erased from the dataset.
                perf = any(k in desc for k in ('إشمام', 'اختلاس', 'السكت', 'بالسكت'))
                out.append({
                    'id': f'v-{locus_id}-w{vi}',
                    'surah': loc['surah'], 'ayah': loc['startAyah'],
                    'startToken': loc['startWord'], 'endToken': loc['endWord'],
                    'operation': 'REPLACE',
                    'hafsText': loc['baseText'],
                    'variantText': loc['baseText'] if perf else text,
                    'differenceType': DIFF[vtype],
                    'verificationStatus': kw.get('status', 'REVIEWED'),
                    'createdAt': TS, 'updatedAt': TS,
                    'readingIds': readings,
                    'locusId': locus_id,
                    'locusType': ('performance_variant' if perf else
                                  ('multi_word_variant'
                                   if (loc['endWord'] > loc['startWord'] or kw.get('locus_group'))
                                   else 'word_variant')),
                    **({'performanceNote': desc} if perf else {}),
                    **({'notes': kw['note']} if kw.get('note') else {}),
                    'sources': [{
                        'id': f's-{locus_id}-w{vi}',
                        'variantId': f'v-{locus_id}-w{vi}',
                        'sourceName': 'مصحف القراءات العشر',
                        'sourceType': 'pdf',
                        'pdfFilename': 'مصحف القراءات العشر-1.pdf',
                        'pdfPage': spec['source'],
                        'sourceReference': f"صفحة المصحف {page} · صفحة المصدر {spec['source']}",
                        'verificationNotes': SOURCE_NOTE,
                        **({'sourceText': ' — '.join(f'{s}: {t}' for s, t in kw['ev'])} if kw.get('ev') else {}),
                    }],
                    'description': desc,
                    'wajhIndex': vi,
                    'evidence': [{'source': s, 'text': t} for s, t in kw.get('ev', [])],
                    **({'alternateOf': A.expand(kw['alternate_of'])} if kw.get('alternate_of') else {}),
                })
            # Baseline invariant: the وجه marked is_base MUST be the one Hafs (Q05-R02) reads,
            # and its text MUST equal what the Mushaf-1441 fixture actually prints. This is what
            # catches an extraction whose two أوجه rows are swapped — the failure mode found at
            # 2:9 يخدعون, 2:81 خطيئته and 2:111 أمانيهم.
            bases = [w for w in wujuh if w[4]]
            if len(bases) != 1:
                errors.append(f'p{page} {query}: expected exactly 1 baseline وجه, got {len(bases)}')
            else:
                btext, _, _, battr, _ = bases[0]
                brd = resolve_attr(battr, [])
                if 'Q05-R02' not in brd:
                    errors.append(f'BASELINE p{page} {query}: the باقون/baseline وجه does not include '
                                  f'حفص (Q05-R02) — the أوجه rows are probably swapped')
                if T.norm(btext) != T.norm(loc['baseText']):
                    errors.append(f'BASELINE p{page} {query}: baseline text {btext!r} != mushaf '
                                  f'{loc["baseText"]!r}')
            # partition check
            counts = collections.Counter()
            cl = []
            for text, desc, vtype, attr, is_base in wujuh:
                rs = resolve_attr(attr, cl)
                cl += [r for r in rs if r not in cl]
                counts.update(rs)
            missing = sorted(set(A.ALL_READINGS) - set(counts))
            overlap = sorted(r for r, c in counts.items() if c > 1)
            if missing or overlap:
                msg = (f'p{page} {query} [{locus_id}]: '
                       f'missing={len(missing)} {missing} overlap={len(overlap)} {overlap}')
                if kw.get('status') == 'NEEDS_MANUAL_REVIEW':
                    qa_flags.append(msg)
                else:
                    errors.append('PARTITION ' + msg)
    return out


def main():
    total = 0
    for page in sorted(PAGES):
        rows = build_page(page, PAGES[page])
        total += len(rows)
        with open(os.path.join(OUT, f'page-{page:03d}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
            f.write('\n')
    print(f'wrote {total} variant records across {len(PAGES)} pages')
    for w in qa_flags:
        print('  QA (known source defect, flagged):', w)
    if errors:
        print(f'\n{len(errors)} ERRORS:')
        for e in errors:
            print('  -', e)
        sys.exit(1)
    print('all partitions clean')


if __name__ == '__main__':
    main()
