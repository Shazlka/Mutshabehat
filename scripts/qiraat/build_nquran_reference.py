#!/usr/bin/env python3
"""Split the nquran.com "فروقات القراء" page-section export into one compact JSON file per surah.

Input : the extracted `quran-qiraat-20-page-sections/` folder (section-NN-pages-*.json, 31 files).
Output: src/app/mushaf-1441/review/_lib/reference/nquran/surah-NNN.json  (array of ayah entries, the
        shape `NquranAyahEntry` in `_lib/nquranReference.ts` reads). `ayahText`, `sourceOption`,
        `pageNumber`, `noDifferences` are dropped -- the editor does not use them.
Usage : python3 scripts/qiraat/build_nquran_reference.py /path/to/quran-qiraat-20-page-sections
"""
import glob, json, os, sys

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'app', 'mushaf-1441', 'review', '_lib', 'reference', 'nquran')
out = os.path.normpath(out)
os.makedirs(out, exist_ok=True)

by_surah = {}
for f in sorted(glob.glob(os.path.join(src, 'section-*.json'))):
    for a in json.load(open(f, encoding='utf-8'))['ayahs']:
        by_surah.setdefault(a['surahNumber'], {})[a['ayah']] = {
            'surah': a['surah'],
            'surahNumber': a['surahNumber'],
            'ayah': a['ayah'],
            'sourceUrl': a['sourceUrl'],
            'differences': a['differences'],
        }

assert sorted(by_surah) == list(range(1, 115)), 'expected all 114 surahs'
total = 0
for n, ayahs in by_surah.items():
    rows = [ayahs[k] for k in sorted(ayahs)]
    assert [r['ayah'] for r in rows] == list(range(1, len(rows) + 1)), f'surah {n}: ayah gap'
    total += len(rows)
    with open(os.path.join(out, f'surah-{n:03d}.json'), 'w', encoding='utf-8') as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(',', ':'))
print(f'wrote 114 surah files, {total} ayahs -> {out}')
