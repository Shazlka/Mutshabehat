#!/usr/bin/env python3
"""Split «الشامل في قراءات الأئمة العشر» JSON extracts into one compact JSON file per surah.

Input : one or more extracts (keys: entries, records, ...). Files are merged by id; a later file wins
        on a conflict and the conflicting ids are printed. Overlapping page ranges are fine.
Output: <out>/surah-NNN.json  (array of entries, the shape `ShamilEntry` in `_lib/shamilReference.ts`
        reads) and <out>/index.json  ({"surahs": {"2": {"pages": [min, max], "entries": n, "records": n}}}).
        Dropped: justification, type_basis, poetry, indexes, the reader/narrator tables.
Usage : python3 scripts/qiraat/build_shamil_reference.py [--out DIR] FILE [FILE ...]
Exit 1 (message on stderr) on: an unknown narrator id, a record whose entry is missing, an entry with
no records, a record with no narrators.
"""
import argparse, collections, json, os, sys

NARRATORS = {
    'qalun', 'warsh', 'bazzi', 'qunbul', 'duri_abuamr', 'susi', 'hisham', 'ibn_dhakwan', 'shubah', 'hafs',
    'khalaf_hamzah', 'khallad', 'abulharith', 'duri_kisai', 'ibn_wardan', 'ibn_jammaz', 'ruways', 'rawh',
    'ishaq', 'idris',
}

DEFAULT_OUT = os.path.normpath(os.path.join(
    os.path.dirname(__file__), '..', '..', 'src', 'app', 'mushaf-1441', 'review', '_lib', 'reference', 'shamil'))


def fail(message):
    print(f'error: {message}', file=sys.stderr)
    sys.exit(1)


def merge(files):
    entries, records = {}, {}
    for path in files:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
        for e in data['entries']:
            if e['entry_id'] in entries and entries[e['entry_id']] != e:
                print(f"conflict: entry {e['entry_id']} replaced by {path}")
            entries[e['entry_id']] = e
        for r in data['records']:
            if r['id'] in records and records[r['id']] != r:
                print(f"conflict: record {r['id']} replaced by {path}")
            records[r['id']] = r
    return entries, records


def validate(entries, records):
    for r in records.values():
        if r['entry_id'] not in entries:
            fail(f"record {r['id']} refers to missing entry {r['entry_id']}")
        if not r['narrators']:
            fail(f"record {r['id']} has no narrators")
        unknown = [n for n in r['narrators'] if n not in NARRATORS]
        if unknown:
            fail(f"record {r['id']} has unknown narrator id(s): {', '.join(unknown)}")
    with_records = {r['entry_id'] for r in records.values()}
    for entry_id in entries:
        if entry_id not in with_records:
            fail(f'entry {entry_id} has no records')


def wajh_of(r):
    return {
        'id': r['id'],
        'wajh': r['wajh'],
        'description': r['description'],
        'readingText': r.get('reading_text'),
        'condition': r['condition'],
        'conditionBasis': r['condition_basis'],
        'narrators': r['narrators'],
        'type': r['type'],
        'category': r['category'],
    }


def entry_of(e, wajhs):
    return {
        'entryId': e['entry_id'],
        'page': e['page'],
        'ayahs': e['ayahs'],
        'words': [w['text'] for w in e['words']],
        'type': e['type'],
        'category': e['category'],
        'scope': e['scope'],
        'sourceText': e['source_text'],
        'flags': e.get('flags') or [],
        'wajhs': sorted(wajhs, key=lambda w: (w['wajh'], w['id'])),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('files', nargs='+')
    args = ap.parse_args()

    entries, records = merge(args.files)
    validate(entries, records)

    by_entry = collections.defaultdict(list)
    for r in records.values():
        by_entry[r['entry_id']].append(wajh_of(r))
    by_surah = collections.defaultdict(list)
    for e in entries.values():
        by_surah[e['surah']].append(entry_of(e, by_entry[e['entry_id']]))

    os.makedirs(args.out, exist_ok=True)
    index = {}
    for surah, items in sorted(by_surah.items()):
        items.sort(key=lambda x: (x['page'], x['entryId']))
        with open(os.path.join(args.out, f'surah-{surah:03d}.json'), 'w', encoding='utf-8') as fh:
            json.dump(items, fh, ensure_ascii=False, separators=(',', ':'))
        pages = [x['page'] for x in items]
        index[str(surah)] = {'pages': [min(pages), max(pages)], 'entries': len(items),
                             'records': sum(len(x['wajhs']) for x in items)}
        print(f"surah {surah}: {len(items)} entries, {index[str(surah)]['records']} records")
    with open(os.path.join(args.out, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'surahs': index}, fh, ensure_ascii=False, indent=1, sort_keys=True)

    print('categories:', dict(collections.Counter((e['type'], e['category']) for e in entries.values())))
    print('condition_basis=default records:', sum(1 for r in records.values() if r['condition_basis'] == 'default'))
    print('multi-ayah entries:', sum(1 for e in entries.values() if len(e['ayahs']) > 1))


if __name__ == '__main__':
    main()
