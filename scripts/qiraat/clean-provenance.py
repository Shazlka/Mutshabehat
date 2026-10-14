#!/usr/bin/env python3
"""Move source mentions out of descriptions into the sources table, and clean the descriptions.

    python3 scripts/qiraat/clean-provenance.py artifacts/prov-entries.json artifacts/clean-provenance

Input: JSON array of entries that mention a source: {id, kind, description, perf, ruling_text, notes}.
Output (one SQL file per block of entries, each its own transaction):
  * source documents (idempotent) for nquran.com and each reader's book,
  * one `qiraat_entry_sources` row per source mentioned (guarded: never duplicated),
  * the description / ruling text / performance note / notes without any source mention (guarded by the old value).
Nothing is invented: every source row is parsed from the text it removes.
"""
import json
import os
import re
import sys

BOOKS = {  # reader name as written in the provenance -> (document id, Arabic name)
    "قالون": "قالون", "ورش": "ورش", "قالون، ورش": "نافع (قالون وورش)", "نافع": "نافع (قالون وورش)", "ابن كثير": "ابن كثير",
    "الدوري": "الدوري", "السوسي": "السوسي", "ابن عامر": "ابن عامر", "شعبة": "شعبة", "حمزة": "حمزة", "الكسائي": "الكسائي",
    "أبو جعفر": "أبو جعفر", "يعقوب": "يعقوب", "خلف العاشر": "خلف العاشر",
}
FILES = {  # csv file name in the provenance -> reader name
    "Nafe3.csv": "نافع (قالون وورش)", "ebn katheer.csv": "ابن كثير", "Abu Jafer.csv": "أبو جعفر", "Yaqoob Al-Hadramy.csv": "يعقوب",
    "Al-Kisa'i.csv": "الكسائي", "Ebn Amer.csv": "ابن عامر", "Shu'bah.csv": "شعبة", "Al-Khalaf.csv": "خلف العاشر", "qaloon.csv": "قالون",
    "Al Soosy.csv": "السوسي", "Al Doory.csv": "الدوري", "warsh.csv": "ورش", "Hamza.csv": "حمزة",
}
NQURAN_ID, EDITORIAL_ID = "SRC-NQURAN-COM", "SRC-EDITORIAL-NOTES"


def doc_id(name: str) -> str:
    return "SRC-BOOK-" + re.sub(r"[^0-9A-Za-zء-ي]+", "-", name).strip("-")


def q(value) -> str:
    return "NULL" if value is None else "'" + str(value).replace("'", "''") + "'"


BLOCK = re.compile(r"\s*\[المصدر:\s*([^\]]*)\]")
PHRASES = [(re.compile(r"\s*(حسب|كما في|في) المصدر(?!ية)"), "")]


def parse_block(block: str):
    out = []
    for part in [p.strip() for p in block.split("؛") if p.strip()]:
        if part == "nquran.com":
            out.append((NQURAN_ID, None, "nquran.com — فروقات القراء"))
            continue
        m = re.match(r"^كتاب\s+(.+?)(?:\s+ص(\d+))?$", part)
        if m and m.group(1) in BOOKS:
            name = BOOKS[m.group(1)]
            page = int(m.group(2)) if m.group(2) else None
            out.append((doc_id(name), page, f"كتاب {name}" + (f" ص{page}" if page else ""), name))
            continue
        m = re.match(r"^(.+\.csv):(\d+)$", part)
        if m and m.group(1) in FILES:
            name = FILES[m.group(1)]
            out.append((doc_id(name), None, f"كتاب {name} — سطر {m.group(2)} من ملف الاستخراج", name))
            continue
        out.append((EDITORIAL_ID, None, part, None))
    return out


def clean(text):
    if text is None:
        return None, []
    sources = []
    for m in BLOCK.finditer(text):
        sources += parse_block(m.group(1))
    new = BLOCK.sub("", text)
    for pattern, repl in PHRASES:
        new = pattern.sub(repl, new)
    new = re.sub(r"[ \t]+\n", "\n", new).strip()
    return new, sources


def clean_notes(notes):
    """notes: 'sources: A.csv:12 | B.csv:3 | https://www.nquran.com/...' or an editorial/English import note."""
    if not notes:
        return None, []
    if notes.startswith("sources:"):
        out = []
        for part in [p.strip() for p in notes[len("sources:"):].split("|") if p.strip()]:
            for sub in [s.strip() for s in part.split(";") if s.strip()]:
                if sub.startswith("http"):
                    out.append((NQURAN_ID, None, sub, None))
                else:
                    out += parse_block(sub)
        return None, out
    if re.search(r"(المصدر|nquran|\.csv|sources:)|[A-Za-z]{3,}", notes):
        return None, [(EDITORIAL_ID, None, "ملاحظة الاستيراد", None, notes)]
    return notes, []


def main(src, prefix, block_size=2500):
    entries = json.load(open(src))
    docs = {NQURAN_ID: ("موقع nquran.com — فروقات القراء", "other"), EDITORIAL_ID: ("ملاحظات المراجعة والاستيراد", "other")}
    blocks, current, count = [], [], 0
    stats = {"entries": 0, "sources": 0, "descriptions": 0, "rulings": 0, "perf": 0, "notes_cleared": 0}
    for e in entries:
        stmts, sources = [], []
        if e["kind"] == "variant":
            new, s = clean(e.get("description"))
            if e.get("description") and new != e["description"]:
                stmts.append(f"UPDATE qiraat_variant_details SET description_ar = {q(new)} WHERE entry_id = {q(e['id'])} AND description_ar = {q(e['description'])};")
                stats["descriptions"] += 1
            sources += s
            newp, sp = clean(e.get("perf"))
            if e.get("perf") and newp != e["perf"]:
                stmts.append(f"UPDATE qiraat_variant_details SET performance_note = {q(newp or None)} WHERE entry_id = {q(e['id'])} AND performance_note = {q(e['perf'])};")
                stats["perf"] += 1
            sources += sp
        else:
            new, s = clean(e.get("ruling_text"))
            if e.get("ruling_text") and new != e["ruling_text"]:
                stmts.append(f"UPDATE qiraat_ruling_details SET text_ar = {q(new or None)} WHERE entry_id = {q(e['id'])} AND text_ar = {q(e['ruling_text'])};")
                stats["rulings"] += 1
            sources += s
        newn, sn = clean_notes(e.get("notes"))
        if e.get("notes") and newn != e["notes"]:
            stmts.append(f"UPDATE qiraat_entries SET notes = {q(newn)} WHERE id = {q(e['id'])} AND notes = {q(e['notes'])};")
            stats["notes_cleared"] += 1
        sources += sn
        merged = {}   # one row per (entry, document): the table has a unique key on it
        for item in sources:
            did, page, ref = item[0], item[1], item[2]
            name = item[3] if len(item) > 3 else None
            text = item[4] if len(item) > 4 else None
            if did.startswith("SRC-BOOK-") and name:
                docs[did] = (f"كتاب قراءة {name}", "printed-book")
            cur = merged.setdefault(did, {"page": page, "refs": [], "texts": []})
            if cur["page"] is None:
                cur["page"] = page
            if ref not in cur["refs"]:
                cur["refs"].append(ref)
            if text and text not in cur["texts"]:
                cur["texts"].append(text)
        for did, m in merged.items():
            ref = " ؛ ".join(m["refs"])
            text = "\n".join(m["texts"]) or None
            stmts.append("INSERT INTO qiraat_entry_sources (entry_id, source_document_id, pdf_page, source_reference, source_text, is_primary) "
                         f"VALUES ({q(e['id'])}, {q(did)}, {'NULL' if m['page'] is None else m['page']}, {q(ref)}, {q(text)}, false) "
                         "ON CONFLICT (entry_id, source_document_id) DO NOTHING;")
            stats["sources"] += 1
        if not stmts:
            continue
        stats["entries"] += 1
        current += stmts
        count += 1
        if count >= block_size:
            blocks.append(current); current, count = [], 0
    if current:
        blocks.append(current)
    doc_sql = ["INSERT INTO qiraat_source_documents (id, name_ar, document_type, notes) VALUES"]
    doc_sql.append(",\n".join(f"  ({q(i)}, {q(n)}, {q(t)}, 'مرجع مضاف عند تنظيف الشروح؛ لا يظهر في الوصف')" for i, (n, t) in sorted(docs.items())))
    doc_sql.append("ON CONFLICT (id) DO NOTHING;")
    os.makedirs(os.path.dirname(prefix) or ".", exist_ok=True)
    for i, blk in enumerate(blocks, 1):
        header = ["BEGIN;", "SELECT set_config('app.device_id','auto-review',true);"] + (doc_sql if i == 1 else [])
        open(f"{prefix}-{i:02d}.sql", "w").write("\n".join(header + blk + ["COMMIT;", ""]))
    print(json.dumps({**stats, "blocks": len(blocks), "documents": len(docs)}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
