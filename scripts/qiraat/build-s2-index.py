#!/usr/bin/env python3
"""Build the second-source index (S2) from the per-reader book extractions (CSV) in the iCloud folder.

    python3 scripts/qiraat/build-s2-index.py "<folder>" artifacts/s2-index.json

The folder holds many duplicate copies of the same file under different names, so every CSV is hashed and read once.
Three layouts exist (the Arabic-column books, the Ibn Kathir English-column export, and warsh.csv); anything else
(page-range samples, tables without a word position) is ignored and listed in the report.
Nothing here guesses: a row without a surah, ayah and narrator id is skipped and counted.
"""
import csv
import glob
import hashlib
import json
import os
import re
import sys
from collections import defaultdict

MARKS = re.compile(r"[ً-ٰٟۖ-ۭـ]")


def skeleton(s: str) -> str:
    s = MARKS.sub("", s or "")
    for a, b in (("ٱ", "ا"), ("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ة", "ه")):
        s = s.replace(a, b)
    return re.sub(r"\s+", "", s)


def narrators(cell: str):
    return [x.strip() for x in re.split(r"[,/،]", cell or "") if x.strip().startswith("Q")]


def positions(cell: str):
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", cell or "")
    if m:
        return list(range(int(m.group(1)), int(m.group(2)) + 1))
    m = re.match(r"^\s*(\d+)\s*$", cell or "")
    return [int(m.group(1))] if m else []


def load_words():
    """(surah, ayah, word index) -> Hafs word, from the Mushaf page-word fixtures."""
    root = os.path.join(os.path.dirname(__file__), "..", "..", "packages", "quran-data", "mushaf1441", "fixtures", "page-words")
    words = {}
    for f in glob.glob(os.path.join(root, "page-*.json")):
        for line in json.load(open(f))["lines"]:
            for w in line["words"]:
                if w["charTypeName"] == "word":
                    words[(w["surahNumber"], w["ayahNumber"], w["wordIndexInAyah"])] = w["textUthmani"]
    return words


def main(folder: str, out: str):
    words = load_words()
    seen = {}
    for path in sorted(glob.glob(os.path.join(folder, "*.csv"))):
        digest = hashlib.md5(open(path, "rb").read()).hexdigest()
        seen.setdefault(digest, path)

    by_position = defaultdict(list)   # "s:a:w" -> records
    by_word = defaultdict(list)       # "s:a:skeleton(word)" -> records
    covers = set()
    report = []

    file_recs = []   # (key_pos, key_word, rec, hafs_first_word) for the file being read
    flat = []        # every record once, with its source file and row number

    def add(key_pos, key_word, rec, hafs_first=""):
        file_recs.append((key_pos, key_word, rec, hafs_first))

    def flush(name):
        """Word positions are used only when they line up with the Mushaf (>= 90 % of farsh rows); otherwise the
        file is matched by the Hafs word itself (Hamza.csv numbers its words differently)."""
        checked = ok = 0
        for key_pos, _, rec, hafs_first in file_recs:
            if rec["kind"] == "farsh" and key_pos and hafs_first:
                sa = key_pos[0].split(":")
                w = words.get((int(sa[0]), int(sa[1]), int(sa[2])))
                checked += 1
                ok += 1 if w and skeleton(w) == skeleton(hafs_first) else 0
        use_positions = checked == 0 or ok / checked >= 0.9
        for key_pos, key_word, rec, _ in file_recs:
            flat.append({**rec, "positions": [k for k in key_pos] if use_positions else [], "hafsWords": sorted({k.split(":", 2)[2] for k in key_word})})
            if use_positions:
                for k in key_pos:
                    by_position[k].append(rec)
            for k in key_word:
                by_word[k].append(rec)
            covers.update(rec["n"])
        report.append({"file": name, "positions": "used" if use_positions else f"ignored (aligned {ok}/{checked})"})
        file_recs.clear()

    for digest, path in seen.items():
        name = os.path.basename(path)
        rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
        if not rows:
            continue
        cols = set(rows[0].keys())
        used = skipped = 0
        if "رواة_القراءة" in cols and "رقم_السورة" in cols:           # Arabic-column books
            reader_col = next((c for c in cols if c.endswith("_أو_الحكم")), None)
            for r in rows:
                try:
                    s, a = int(r["رقم_السورة"]), int(r["رقم_الآية"])
                except (ValueError, KeyError):
                    skipped += 1
                    continue
                ns, ws = narrators(r["رواة_القراءة"]), positions(r["الموضع_من_الآية"])
                if not ns or not ws:
                    skipped += 1
                    continue
                kind = "farsh" if r["نوع_السجل"].startswith("فرش") else "usul"
                rec = {"n": ns, "kind": kind, "type": r["نوع_الخلاف_أو_الباب"], "text": r.get(reader_col, ""),
                       "explain": r.get("البيان_والشرح", ""), "note": r.get("ملاحظة_الأداء", ""), "wajh": r.get("رقم_الوجه", ""), "src": name,
                       "surah": s, "ayah": a, "w0": ws[0], "w1": ws[-1], "hafs": r["نص_حفص"], "page": r.get("رقم_الصفحة_بالمصحف") or r.get("رقم_الصفحة") or "", "srcPage": r.get("صفحة_المصدر") or r.get("صفحة_المصدر_pdf") or "", "row": len(file_recs) + 2}
                add([f"{s}:{a}:{w}" for w in ws], [f"{s}:{a}:{skeleton(t)}" for t in r["نص_حفص"].split()], rec, (r["نص_حفص"].split() or [""])[0])
                used += 1
        elif "readingIds" in cols and "startToken" in cols:           # Ibn Kathir export
            for r in rows:
                try:
                    s, a, w0, w1 = int(r["surah"]), int(r["ayah"]), int(r["startToken"]), int(r["endToken"])
                except (ValueError, KeyError):
                    skipped += 1
                    continue
                ns = narrators(r["readingIds"])
                if not ns:
                    skipped += 1
                    continue
                kind = "farsh" if r["recordType"].upper().startswith("VAR") else "usul"
                rec = {"n": ns, "kind": kind, "type": r.get("category") or r.get("differenceType", ""), "text": r.get("variantText", ""),
                       "explain": r.get("description", ""), "note": "", "wajh": "", "src": name,
                       "surah": s, "ayah": a, "w0": w0, "w1": w1, "hafs": r["hafsText"], "page": r.get("pageNumber", ""), "srcPage": r.get("pdfPage", ""), "row": len(file_recs) + 2}
                add([f"{s}:{a}:{w}" for w in range(w0, w1 + 1)], [f"{s}:{a}:{skeleton(t)}" for t in r["hafsText"].split()], rec, (r["hafsText"].split() or [""])[0])
                used += 1
        elif "رواية ورش" in cols:                                      # warsh.csv: no word position
            for r in rows:
                try:
                    s, a = int(r["رقم السورة"]), int(r["رقم الآية"])
                except (ValueError, KeyError):
                    skipped += 1
                    continue
                rec = {"n": ["Q01-R02"], "kind": "farsh", "type": r["نوع الاختلاف"], "text": r["رواية ورش"], "explain": r["البيان والتوجيه"], "note": "", "wajh": "", "src": name,
                       "surah": s, "ayah": a, "w0": None, "w1": None, "hafs": r["قراءة حفص"], "page": r.get("صفحة المصحف", ""), "srcPage": "", "row": len(file_recs) + 2}
                add([], [f"{s}:{a}:{skeleton(t)}" for t in r["قراءة حفص"].split()], rec)
                used += 1
        else:
            report.append({"file": name, "status": "ignored (layout without word position)", "rows": len(rows)})
            continue
        flush(name)
        report.append({"file": name, "status": "indexed", "rows": len(rows), "used": used, "skipped": skipped})

    json.dump({"byPosition": by_position, "byWord": by_word, "covers": sorted(covers), "report": report},
              open(out, "w"), ensure_ascii=False)
    flat_out = out.replace(".json", "-records.json")
    json.dump(flat, open(flat_out, "w"), ensure_ascii=False)
    print("flat records:", len(flat), "->", flat_out)
    for r in report:
        print(r)
    print("positions:", len(by_position), "words:", len(by_word), "narrators covered:", sorted(covers))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
