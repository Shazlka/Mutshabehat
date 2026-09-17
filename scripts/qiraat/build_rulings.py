# -*- coding: utf-8 -*-
"""Generate packages/qiraat-core/fixtures/rulings/page-NNN.json from data_rulings.py."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T
import authorities as A
from data_rulings import RULINGS

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'packages/qiraat-core/fixtures/rulings')
os.makedirs(OUT, exist_ok=True)
TS = '2026-09-17T12:00:00.000Z'

# Each أصول family gets ONE colour so a reader can tell at a glance which kind of ruling
# applies to a word. Requested grouping: إمالة/تقليل one colour, الإدغام one, الترقيق/التغليظ
# one, السكت one, and so on.
CATEGORIES = {
    'AYAH_COUNT':          ('عد الآي',                 '#64748B', False),
    'SILAT_HA':            ('صلة هاء الكناية',         '#0D9488', True),
    'TARQIQ_RA':           ('ترقيق الراءات',           '#B45309', True),
    'TAGHLIZ_LAM':         ('تغليظ اللامات',           '#B45309', True),
    'MADD_BADAL':          ('مد البدل',                '#2563EB', True),
    'MADD_LIN':            ('مد اللين المهموز',        '#2563EB', True),
    'MADD_QABL_IDGHAM':    ('المد قبل الإدغام',        '#2563EB', True),
    'IMALAH_TAQLIL':       ('الممال والمقلل',          '#C026D3', True),
    'IDGHAM_SAGHIR':       ('المدغم الصغير',           '#15803D', True),
    'IDGHAM_KABIR':        ('المدغم الكبير',           '#15803D', True),
    'TAGHYIR_HAMZ':        ('تغيير الهمز',             '#DC2626', True),
    'HAMZATAN_KALIMA':     ('الهمزتان من كلمة',        '#DC2626', True),
    'HAMZATAN_KALIMATAYN': ('الهمزتان من كلمتين',      '#DC2626', True),
    'TARK_GHUNNA':         ('ترك الغنة',               '#0891B2', True),
    'IKHFA':               ('الإخفاء',                 '#0891B2', True),
    'SAKT':                ('السكت',                   '#7C3AED', True),
    'WAQF_HAMZA':          ('وقف حمزة',                '#EA580C', True),
    'WAQF_RASM':           ('الوقف على مرسوم الخط',    '#EA580C', True),
    'YAAT_IDAFA':          ('ياءات الإضافة',           '#CA8A04', True),
    'YAAT_ZAWAID':         ('ياءات الزوائد',           '#CA8A04', True),
    'BAYN_SURATAYN':       ('الأوجه بين السورتين',     '#64748B', False),
}

errors = []


def build_page(page, rows):
    out = []
    for i, (cat, query, attrs, kw) in enumerate(rows, 1):
        if cat not in CATEGORIES:
            errors.append(f'p{page}: unknown category {cat}')
            continue
        label, color, word_anchored = CATEGORIES[cat]
        try:
            first = T.find(page, query, 1, kw.get('ayah'))
        except T.NoMatch as e:
            errors.append(f'p{page} [{cat}]: {e}')
            continue
        n = first['count'] if kw.get('all_occurrences') else 1
        for k in range(n):
            idx = k + 1 if kw.get('all_occurrences') else kw.get('occurrence', 1)
            try:
                loc = T.find(page, query, idx, kw.get('ayah'))
            except T.NoMatch as e:
                errors.append(f'p{page} [{cat}]: {e}')
                continue
            alt = set()
            for a in kw.get('alternate', []):
                alt.update(A.readings_of(A.resolve(a)))
            attribution, readings = [], []
            for name, action in attrs:
                try:
                    aid = A.resolve(name)
                except A.BadAuthority as e:
                    errors.append(f'p{page} [{cat}] {query}: {e}')
                    continue
                attribution.append({'authorityId': aid, 'action': action,
                                    **({'condition': kw['condition']} if kw.get('condition') else {})})
                for r in A.readings_of(aid):
                    readings.append({'readingId': r, 'action': action, 'isDefault': r not in alt})
            out.append({
                'id': f'r-p{page:03d}-{i:03d}-{idx}',
                'pageNumber': page,
                'category': cat,
                'categoryAr': label,
                'color': color,
                'wordAnchored': word_anchored,
                'surah': loc['surah'],
                'ayah': loc['startAyah'],
                'startToken': loc['startWord'],
                'endToken': loc['endWord'],
                'endAyah': loc['endAyah'],
                'baseText': loc['baseText'],
                'verificationStatus': kw.get('status', 'REVIEWED'),
                'attribution': attribution,
                'readings': readings,
                'hasAlternate': bool(alt),
                **({'text': kw['text']} if kw.get('text') else {}),
                **({'condition': kw['condition']} if kw.get('condition') else {}),
                **({'countSchools': kw['schools']} if kw.get('schools') else {}),
                **({'notes': kw['note']} if kw.get('note') else {}),
                'createdAt': TS, 'updatedAt': TS,
            })
    return out


def main():
    total = 0
    for page in range(1, 21):
        rows = build_page(page, RULINGS.get(page, []))
        total += len(rows)
        with open(os.path.join(OUT, f'page-{page:03d}.json'), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
            f.write('\n')
    print(f'wrote {total} ruling records')
    if errors:
        print(f'\n{len(errors)} ERRORS:')
        for e in errors:
            print('  -', e)
        sys.exit(1)
    print('all rulings anchored to real tokens')


if __name__ == '__main__':
    main()
