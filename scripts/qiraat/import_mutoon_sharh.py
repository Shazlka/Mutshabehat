#!/usr/bin/env python3
"""Prints SQL that loads the شرح of each متن verse into qiraat_mutoon_sharh.

The text is book text and lives only in the owner's private, git-ignored file
(apps/ios/Generated/QiraatMutoon/mutoon-sharh.json). Run it where that file is and pipe the SQL to the database:

    python3 scripts/qiraat/import_mutoon_sharh.py PATH/mutoon-sharh.json | docker exec -i mutshabehat-db psql -U postgres -d postgres -v ON_ERROR_STOP=1

Idempotent: a verse that already has a شرح (edited or not) is never overwritten. The load runs with triggers off
(session_replication_role = replica) so it does not flood the change log; only verses that exist are loaded.
"""
import json
import sys

TAG = "$sh$"


def lit(value: str) -> str:
    if TAG in value:
        raise SystemExit("text contains the dollar-quote tag")
    return f"{TAG}{value}{TAG}"


def main(path: str) -> None:
    data = json.load(open(path, encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise SystemExit("unsupported schemaVersion")
    rows = []
    for work, commentary in data["commentaries"].items():
        for verse, entry in commentary["verses"].items():
            text = entry["text"].strip()
            if not text:
                continue
            pages = "ARRAY[" + ",".join(lit(str(p)) for p in entry.get("pages", [])) + "]::text[]"
            rows.append(f"({lit(work)},{int(verse)},{lit(text)},{lit(commentary.get('title', ''))},{lit(commentary.get('author', ''))},{pages})")
    print("BEGIN;")
    print("SET LOCAL session_replication_role = replica;")
    for start in range(0, len(rows), 200):
        chunk = ",\n".join(rows[start:start + 200])
        print("INSERT INTO public.qiraat_mutoon_sharh (work, verse, text, title, author, pages)")
        print("SELECT x.work, x.verse, x.text, x.title, x.author, x.pages FROM (VALUES")
        print(chunk)
        print(") AS x(work, verse, text, title, author, pages)")
        print("JOIN public.qiraat_mutoon_verses v ON v.work = x.work AND v.verse = x.verse")
        print("ON CONFLICT DO NOTHING;")
    print("COMMIT;")
    print(f"-- {len(rows)} commentaries offered", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
