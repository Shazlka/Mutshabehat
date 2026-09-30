#!/usr/bin/env python3
"""Build the read-only Mushaf 1441 database bundled into the iOS app.

Source of truth: packages/quran-data/mushaf1441/fixtures (the same fixtures the web reader
serves). Output: one SQLite file with pages, lines, words, surahs and the surah-header /
basmala decorations precomputed exactly as pageDecorations.ts computes them at request time.

Usage: python3 scripts/ios/build_mushaf_db.py <repo_root> <output.sqlite>
Idempotent: the output is deleted and rebuilt on every run.
"""
import json
import os
import sqlite3
import sys

PAGE_COUNT = 604
LINES_PER_PAGE = 15
SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE surahs (
  number INTEGER PRIMARY KEY, name TEXT NOT NULL, ayah_count INTEGER NOT NULL,
  first_page INTEGER NOT NULL, last_page INTEGER NOT NULL);
CREATE TABLE pages (
  number INTEGER PRIMARY KEY, first_ayah_key TEXT NOT NULL, last_ayah_key TEXT NOT NULL,
  surah_names TEXT NOT NULL, juz INTEGER NOT NULL, hizb INTEGER NOT NULL,
  rub_el_hizb INTEGER NOT NULL, rub_in_juz INTEGER NOT NULL);
CREATE TABLE decorations (
  page INTEGER NOT NULL, line INTEGER NOT NULL, surah_header INTEGER, basmala INTEGER NOT NULL,
  PRIMARY KEY (page, line));
CREATE TABLE words (
  id TEXT PRIMARY KEY, page INTEGER NOT NULL, line INTEGER NOT NULL,
  index_in_line INTEGER NOT NULL, surah INTEGER NOT NULL, ayah INTEGER NOT NULL,
  index_in_ayah INTEGER NOT NULL, char_type TEXT NOT NULL, glyph TEXT NOT NULL,
  text_uthmani TEXT NOT NULL);
CREATE INDEX words_page_line ON words(page, line, index_in_line);
CREATE INDEX words_ayah ON words(surah, ayah);
"""


def load_pages(fixtures):
    pages = {}
    for n in range(1, PAGE_COUNT + 1):
        with open(os.path.join(fixtures, "page-words", f"page-{n:03d}.json"), encoding="utf-8") as f:
            pages[n] = json.load(f)
    return pages


def compute_decorations(page, next_page):
    """Port of computeMushaf1441PageDecorations (pageDecorations.ts). Keep in lockstep."""
    by_number = {page["pageNumber"]: page}
    if next_page:
        by_number[next_page["pageNumber"]] = next_page
    decorations = {}
    for source in (page, next_page):
        if not source:
            continue
        for line in source["lines"]:
            words = line["words"]
            if not words:
                continue
            first = words[0]
            if first["ayahNumber"] != 1 or first["wordIndexInAyah"] != 1:
                continue
            slots = ["surahHeader"] if first["surahNumber"] in (1, 9) else ["basmala", "surahHeader"]
            slot_page = source["pageNumber"]
            slot_line = line["lineNumber"] - 1
            for kind in slots:
                if slot_line < 1:
                    slot_page -= 1
                    slot_line = LINES_PER_PAGE
                slot_source = by_number.get(slot_page)
                slot = None
                if slot_source:
                    slot = next((l for l in slot_source["lines"] if l["lineNumber"] == slot_line), None)
                if not slot or slot["words"]:
                    break
                if slot_page == page["pageNumber"]:
                    entry = decorations.setdefault(slot_line, {})
                    if kind == "surahHeader":
                        entry["surahHeader"] = first["surahNumber"]
                    else:
                        entry["basmala"] = True
                slot_line -= 1
    return decorations


def build(repo_root, out_path):
    fixtures = os.path.join(repo_root, "packages", "quran-data", "mushaf1441", "fixtures")
    with open(os.path.join(fixtures, "page-metadata.json"), encoding="utf-8") as f:
        metadata = json.load(f)
    pages = load_pages(fixtures)

    if os.path.exists(out_path):
        os.remove(out_path)
    db = sqlite3.connect(out_path)
    db.executescript(SCHEMA)
    db.execute("INSERT INTO meta VALUES ('schema_version', ?)", (str(SCHEMA_VERSION),))
    db.execute("INSERT INTO meta VALUES ('source', ?)", (metadata["source"]["name"],))

    for s in metadata["surahs"]:
        db.execute("INSERT INTO surahs VALUES (?,?,?,?,?)",
                   (s["surahNumber"], s["name"], s["ayahCount"], s["firstPage"], s["lastPage"]))
    for p in metadata["pages"]:
        db.execute("INSERT INTO pages VALUES (?,?,?,?,?,?,?,?)",
                   (p["pageNumber"], p["firstAyahKey"], p["lastAyahKey"], "|".join(p["surahNames"]),
                    p["juzNumber"], p["hizbNumber"], p["rubElHizbNumber"], p["rubInJuz"]))

    token_count = 0
    for n in range(1, PAGE_COUNT + 1):
        page = pages[n]
        for line in page["lines"]:
            for w in line["words"]:
                if not w.get("glyph"):
                    raise SystemExit(f"page {n} word {w['id']} has no QCF glyph")
                if w["pageNumber"] != n or w["lineNumber"] != line["lineNumber"]:
                    raise SystemExit(f"page {n} word {w['id']} is filed under the wrong line")
                db.execute("INSERT INTO words VALUES (?,?,?,?,?,?,?,?,?,?)",
                           (w["id"], n, w["lineNumber"], w["wordIndexInLine"], w["surahNumber"],
                            w["ayahNumber"], w["wordIndexInAyah"], w.get("charTypeName") or "word",
                            w["glyph"], w["textUthmani"]))
                token_count += 1
        for line_no, deco in compute_decorations(page, pages.get(n + 1)).items():
            db.execute("INSERT INTO decorations VALUES (?,?,?,?)",
                       (n, line_no, deco.get("surahHeader"), 1 if deco.get("basmala") else 0))

    db.execute("INSERT INTO meta VALUES ('token_count', ?)", (str(token_count),))
    db.commit()
    db.execute("VACUUM")
    db.close()
    return token_count


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    count = build(sys.argv[1], sys.argv[2])
    print(f"wrote {sys.argv[2]}: {count} tokens, {os.path.getsize(sys.argv[2]) / 1048576:.1f} MB")
