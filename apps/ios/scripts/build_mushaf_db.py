#!/usr/bin/env python3
"""Build the read-only Mushaf 1441 database bundled into the iOS app.

Source of truth: packages/quran-data/mushaf1441/fixtures (the same fixtures the web reader
serves). Output: one SQLite file with pages, lines, words, surahs and the surah-header /
basmala decorations precomputed exactly as pageDecorations.ts computes them at request time.

Usage: python3 apps/ios/scripts/build_mushaf_db.py <repo_root> <output.sqlite>
Idempotent: the output is deleted and rebuilt on every run.
"""
import json
import os
import sqlite3
import sys
import unicodedata

PAGE_COUNT = 604
LINES_PER_PAGE = 15
SCHEMA_VERSION = 2

ORTHOGRAPHY_RULES = (
    ("الصلوه", "الصلاه", "uthmani-imlai", 100, "الصلاة family"),
    ("صلوه", "صلاه", "uthmani-imlai", 100, "صلاة family"),
    ("الزكوه", "الزكاه", "uthmani-imlai", 100, "الزكاة family"),
    ("زكوه", "زكاه", "uthmani-imlai", 100, "زكاة family"),
    ("الحيوه", "الحياه", "uthmani-imlai", 100, "الحياة family"),
    ("حيوه", "حياه", "uthmani-imlai", 100, "حياة family"),
    ("الربوا", "الربا", "uthmani-imlai", 95, "الربا family"),
    ("الربو", "الربا", "uthmani-imlai", 95, "الربا family"),
    ("ايمن", "ايمان", "uthmani-imlai", 95, "إيمان with omitted dagger alif"),
    ("الكتب", "الكتاب", "uthmani-imlai", 90, "الكتاب with omitted dagger alif"),
    ("قراان", "قران", "uthmani-imlai", 95, "Quranic hamza spelling"),
    ("اامن", "امن", "uthmani-imlai", 95, "standalone hamza plus alif"),
    ("اادم", "ادم", "uthmani-imlai", 95, "آدم"),
    ("يبني", "بني", "uthmani-imlai", 90, "joined vocative يا بني"),
    ("اسراييل", "اسرايل", "uthmani-imlai", 95, "إسرائيل hamza seat"),
    ("العلمين", "العالمين", "uthmani-imlai", 95, "العالمين dagger alif"),
    ("الانهر", "الانهار", "uthmani-imlai", 95, "الأنهار dagger alif"),
    ("رجعون", "راجعون", "uthmani-imlai", 95, "راجعون dagger alif"),
    ("جنت", "جنات", "uthmani-imlai", 90, "جنات dagger alif"),
    ("مشكوه", "مشكاه", "uthmani-imlai", 95, "مشكاة"),
    ("نجوه", "نجاه", "uthmani-imlai", 90, "نجاة"),
    ("منوه", "مناه", "uthmani-imlai", 90, "مناة"),
    ("الغدوه", "الغداه", "uthmani-imlai", 90, "الغداة"),
)

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
CREATE TABLE quran_search_orthography_rules (
  source_form TEXT NOT NULL, target_form TEXT NOT NULL, rule_type TEXT NOT NULL,
  confidence INTEGER NOT NULL, notes TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (source_form, target_form));
CREATE TABLE quran_word_search (
  word_id TEXT PRIMARY KEY REFERENCES words(id), token_position INTEGER NOT NULL UNIQUE,
  surah INTEGER NOT NULL, ayah INTEGER NOT NULL, page INTEGER NOT NULL, word_index INTEGER NOT NULL,
  uthmani_text TEXT NOT NULL, plain_text TEXT NOT NULL, canonical_text TEXT NOT NULL,
  imlai_text TEXT NOT NULL, rasm_key TEXT NOT NULL);
CREATE TABLE quran_ayah_search (
  surah INTEGER NOT NULL, ayah INTEGER NOT NULL, ayah_text TEXT NOT NULL,
  PRIMARY KEY (surah, ayah));
CREATE TABLE quran_search_aliases (
  word_id TEXT NOT NULL REFERENCES quran_word_search(word_id), alias TEXT NOT NULL,
  alias_type TEXT NOT NULL, confidence INTEGER NOT NULL,
  PRIMARY KEY (word_id, alias, alias_type));
CREATE INDEX quran_search_plain ON quran_word_search(plain_text);
CREATE INDEX quran_search_canonical ON quran_word_search(canonical_text);
CREATE INDEX quran_search_imlai ON quran_word_search(imlai_text);
CREATE INDEX quran_search_rasm ON quran_word_search(rasm_key);
CREATE INDEX quran_search_location ON quran_word_search(surah, ayah, word_index);
CREATE INDEX quran_search_page ON quran_word_search(page);
CREATE INDEX quran_search_alias ON quran_search_aliases(alias);
"""


def cleanup_arabic(text):
    value = unicodedata.normalize("NFC", text)
    return " ".join("".join(
        ch for ch in value
        if ch != "ـ" and ch not in "\u200b\u200c\u200d\ufeff"
        and not (0x06D6 <= ord(ch) <= 0x06ED)
        and unicodedata.category(ch) not in ("Mn", "Me", "Cf", "Cc")
    ).split())


def plain_arabic(text):
    return cleanup_arabic(text).replace("ٱ", "ا")


def canonical_arabic(text):
    return plain_arabic(text).translate(str.maketrans({
        "ء": "ا", "آ": "ا", "أ": "ا", "إ": "ا", "ٱ": "ا", "ى": "ي",
        "ة": "ه", "ؤ": "و", "ئ": "ي",
    }))


def imlai_arabic(canonical):
    value = canonical
    for source, target, _kind, _confidence, _notes in ORTHOGRAPHY_RULES:
        value = value.replace(source, target)
    return value


def rasm_key(canonical):
    return canonical.translate(str.maketrans("", "", "اويه"))


def aliases_for(plain, canonical, imlai):
    aliases = {(plain, "plain", 95), (canonical, "canonical", 85), (imlai, "imlai", 90)}
    for value in (canonical, imlai):
        forms = {value}
        stem = value
        for _ in range(2):
            if len(stem) <= 4 or stem[0] not in "وفبكل":
                break
            stem = stem[1:]
            forms.add(stem)
            aliases.add((stem, "prefix", 80))
        if value.startswith("لل") and len(value) > 4:
            forms.add("ال" + value[2:])
            aliases.add(("ال" + value[2:], "contracted-article", 80))
        for form in forms:
            if len(form) > 4 and form.startswith("ال"):
                aliases.add((form[2:], "article", 80))
    return {(value, kind, confidence) for value, kind, confidence in aliases if value}


def write_collision_report(db, path):
    def collisions(column):
        return [{"key": row[0], "occurrences": row[1], "distinctUthmani": row[2], "examples": row[3]}
                for row in db.execute(f"""
                    SELECT {column},COUNT(*),COUNT(DISTINCT uthmani_text),GROUP_CONCAT(DISTINCT uthmani_text)
                    FROM quran_word_search GROUP BY {column}
                    HAVING COUNT(DISTINCT uthmani_text)>1 ORDER BY COUNT(*) DESC LIMIT 200
                """)]

    unexpected = sorted({f"U+{ord(ch):04X} {unicodedata.name(ch, 'UNKNOWN')}"
                         for canonical, imlai in db.execute("SELECT DISTINCT canonical_text,imlai_text FROM quran_word_search")
                         for text in (canonical, imlai) for ch in text
                         if unicodedata.category(ch) in ("Mn", "Me", "Cf", "Cc")})
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "wordOccurrences": db.execute("SELECT COUNT(*) FROM quran_word_search").fetchone()[0],
        "uniqueUthmaniWords": db.execute("SELECT COUNT(DISTINCT uthmani_text) FROM quran_word_search").fetchone()[0],
        "emptyNormalizedWords": db.execute("SELECT COUNT(*) FROM quran_word_search WHERE canonical_text='' OR imlai_text='' ").fetchone()[0],
        "canonicalCollisionGroupCount": db.execute("SELECT COUNT(*) FROM (SELECT canonical_text FROM quran_word_search GROUP BY canonical_text HAVING COUNT(DISTINCT uthmani_text)>1)").fetchone()[0],
        "rasmCollisionGroupCount": db.execute("SELECT COUNT(*) FROM (SELECT rasm_key FROM quran_word_search GROUP BY rasm_key HAVING COUNT(DISTINCT canonical_text)>1)").fetchone()[0],
        "canonicalCollisionExamples": collisions("canonical_text"),
        "rasmCollisionExamples": collisions("rasm_key"),
        "unexpectedSearchInsensitiveUnicodeMarks": unexpected,
        "wordsWithExcessiveAliases": db.execute("SELECT COUNT(*) FROM (SELECT word_id FROM quran_search_aliases GROUP BY word_id HAVING COUNT(*)>6)").fetchone()[0],
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as output:
        json.dump(report, output, ensure_ascii=False, indent=2, sort_keys=True)


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


def build(repo_root, out_path, report_path=None):
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
    db.executemany("INSERT INTO quran_search_orthography_rules VALUES (?,?,?,?,?,1)", ORTHOGRAPHY_RULES)

    for s in metadata["surahs"]:
        db.execute("INSERT INTO surahs VALUES (?,?,?,?,?)",
                   (s["surahNumber"], s["name"], s["ayahCount"], s["firstPage"], s["lastPage"]))
    for p in metadata["pages"]:
        db.execute("INSERT INTO pages VALUES (?,?,?,?,?,?,?,?)",
                   (p["pageNumber"], p["firstAyahKey"], p["lastAyahKey"], "|".join(p["surahNames"]),
                    p["juzNumber"], p["hizbNumber"], p["rubElHizbNumber"], p["rubInJuz"]))

    token_count = 0
    searchable_words = []
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
                if (w.get("charTypeName") or "word") == "word":
                    searchable_words.append(w)
        for line_no, deco in compute_decorations(page, pages.get(n + 1)).items():
            db.execute("INSERT INTO decorations VALUES (?,?,?,?)",
                       (n, line_no, deco.get("surahHeader"), 1 if deco.get("basmala") else 0))

    ayah_text = {}
    for word in searchable_words:
        key = (word["surahNumber"], word["ayahNumber"])
        ayah_text.setdefault(key, []).append(word["textUthmani"])
    for position, word in enumerate(searchable_words, 1):
        uthmani = word["textUthmani"]
        plain = plain_arabic(uthmani)
        canonical = canonical_arabic(plain)
        imlai = imlai_arabic(canonical)
        db.execute("INSERT INTO quran_word_search VALUES (?,?,?,?,?,?,?,?,?,?,?)", (
            word["id"], position, word["surahNumber"], word["ayahNumber"], word["pageNumber"],
            word["wordIndexInAyah"], uthmani, plain, canonical, imlai, rasm_key(canonical)))
        db.executemany("INSERT OR IGNORE INTO quran_search_aliases VALUES (?,?,?,?)", (
            (word["id"], alias, kind, confidence) for alias, kind, confidence in aliases_for(plain, canonical, imlai)))
    db.executemany("INSERT INTO quran_ayah_search VALUES (?,?,?)", (
        (surah, ayah, " ".join(words)) for (surah, ayah), words in ayah_text.items()))

    db.execute("INSERT INTO meta VALUES ('token_count', ?)", (str(token_count),))
    db.execute("INSERT INTO meta VALUES ('search_word_count', ?)", (str(len(searchable_words)),))
    db.commit()
    if report_path:
        write_collision_report(db, report_path)
    db.execute("VACUUM")
    db.close()
    return token_count


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    count = build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None)
    print(f"wrote {sys.argv[2]}: {count} tokens, {os.path.getsize(sys.argv[2]) / 1048576:.1f} MB")
