"""Build Generated/QiraatMutoon/mutoon-sharh.json from downloaded Shamela sharh HTML pages.

Extracts verse-by-verse commentary from:
- الوافي في شرح الشاطبية (Shamela book 38075) for الشاطبية
- الهادي شرح طيبة النشر (Shamela book 8650) for طيبة النشر

Usage: python3 scripts/build_matn_sharh.py <sharh-html folder> <mutoon.json> <mutoon-sharh.json>
"""
import html
import json
import pathlib
import re
import sys
import unicodedata

SCHEMA_VERSION = 1
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
MARKS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")

COMMENTARY_METADATA = {
    "shatibiyyah": {
        "title": "الوافي في شرح الشاطبية",
        "author": "عبد الفتاح بن عبد الغني القاضي",
        "bookId": 38075,
    },
    "tayyibah": {
        "title": "الهادي شرح طيبة النشر",
        "author": "محمد سالم محيسن",
        "bookId": 8650,
    },
}


def key(text):
    text = MARKS.sub("", unicodedata.normalize("NFC", text))
    return re.sub(r"[أإآٱ]", "ا", text).replace("ى", "ي").replace("ة", "ه")


def page_lines(raw):
    printed = re.search(r'id="fld_goto_top" value="([^"]*)"', raw)
    start = raw.find('<div class="nass')
    end = raw.find('id="appended_pages"', start)
    if start < 0:
        return None, []
    body = raw[start:end if end > 0 else None]
    body = re.sub(r"<br\s*/?>", "\n", body)
    body = re.sub(r"</p>", "\n", body)
    text = html.unescape(re.sub(r"<[^>]+>", "", body))
    lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n") if l.strip()]
    return (printed.group(1) if printed else None), lines


def page_key(printed):
    return tuple(int(n) for n in re.findall(r"\d+", (printed or "").translate(DIGITS))) or (0,)


def book_lines(folder):
    out = []
    if not folder.is_dir():
        return out
    for path in sorted(folder.glob("*.html"), key=lambda p: int(p.stem) if p.stem.isdigit() else 999999):
        printed, lines = page_lines(path.read_text(encoding="utf-8", errors="replace"))
        out += [(printed, line) for line in lines]
    return out


def wafi_blocks(lines):
    verse_line = re.compile(r"^([٠-٩0-9]+)\s*-\s*\S")
    blocks, current, pages, text = {}, [], set(), []
    for printed, line in lines:
        m = verse_line.match(line)
        if m and "..." in line:
            if text and current:
                body = "\n".join(text).strip()
                sorted_pages = sorted(pages, key=page_key)
                for v in current:
                    blocks[v] = (body, sorted_pages)
                current, text, pages = [], [], set()
            current.append(int(m.group(1).translate(DIGITS)))
            if printed:
                pages.add(printed)
            continue
        if current:
            text.append(line)
            if printed:
                pages.add(printed)
    if text and current:
        body = "\n".join(text).strip()
        sorted_pages = sorted(pages, key=page_key)
        for v in current:
            blocks[v] = (body, sorted_pages)
    return blocks


def hadi_blocks(lines, verses):
    hemis = {}
    for number, hemistichs in verses.items():
        for h in hemistichs:
            hemis.setdefault(" ".join(key(h).split()), set()).add(number)

    blocks, quoted, text, pages, state = {}, [], [], set(), None

    def close():
        found = set()
        for q in quoted:
            for part in re.split(r"\.{3,}|…", q):
                words = key(part).split()
                if len(words) < 2:
                    continue
                fragment = " ".join(words)
                for h, numbers in hemis.items():
                    if fragment in h and (len(words) >= 3 or len(words) * 2 >= len(h.split())
                                          or h.startswith(fragment + " ") or h.endswith(" " + fragment)):
                        found |= numbers
        if found and text:
            body = "\n".join(text).strip()
            for v in found:
                old = blocks.get(v)
                new_text = (old[0] + "\n\n" if old else "") + body
                new_pages = sorted(set(old[1] if old else []) | pages, key=page_key)
                blocks[v] = (new_text, new_pages)

    for printed, line in lines:
        is_quote_start = (
            line.startswith("قال ابن الجزري")
            or line.startswith("قال الناظم")
            or ("..." in line and any(k in line for k in ("ابن الجزري", "محمد هو ابن الجزري")))
        )
        if is_quote_start:
            close()
            quoted, text, pages, state = [], [], {printed} if printed else set(), "quote"
            if "..." in line:
                quoted.append(line)
            continue
        if state == "quote":
            if line.startswith("المعنى"):
                state = "text"
                text.append(line)
            else:
                quoted.append(line)
            if printed:
                pages.add(printed)
        elif state == "text":
            text.append(line)
            if printed:
                pages.add(printed)
    close()
    return blocks


def build_document(sharh_dir, mutoon_dict):
    works_verses = {}
    for w in mutoon_dict.get("works", []):
        works_verses[w["work"]] = {v["number"]: v["lines"] for c in w["chapters"] for v in c["verses"]}

    commentaries = {}

    # 1. Shatibiyyah
    wafi_folder = sharh_dir / "38075"
    if wafi_folder.is_dir():
        lines = book_lines(wafi_folder)
        blocks = wafi_blocks(lines)
        meta = COMMENTARY_METADATA["shatibiyyah"]
        verses_json = {}
        for verse_num, (text, pages) in sorted(blocks.items()):
            verses_json[str(verse_num)] = {"text": text, "pages": pages}
        commentaries["shatibiyyah"] = {
            "title": meta["title"],
            "author": meta["author"],
            "bookId": meta["bookId"],
            "verses": verses_json,
        }

    # 2. Tayyibah
    hadi_folder = sharh_dir / "8650"
    if hadi_folder.is_dir():
        tayy_verses = works_verses.get("tayyibah", {})
        lines = book_lines(hadi_folder)
        blocks = hadi_blocks(lines, tayy_verses)
        meta = COMMENTARY_METADATA["tayyibah"]
        verses_json = {}
        for verse_num, (text, pages) in sorted(blocks.items()):
            verses_json[str(verse_num)] = {"text": text, "pages": pages}
        commentaries["tayyibah"] = {
            "title": meta["title"],
            "author": meta["author"],
            "bookId": meta["bookId"],
            "verses": verses_json,
        }

    return {"schemaVersion": SCHEMA_VERSION, "commentaries": commentaries}


def main(argv):
    if len(argv) != 4:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    sharh_dir = pathlib.Path(argv[1])
    mutoon_path = pathlib.Path(argv[2])
    out_path = pathlib.Path(argv[3])

    if not sharh_dir.is_dir():
        print(f"error: {sharh_dir} is not a directory", file=sys.stderr)
        return 1
    if not mutoon_path.is_file():
        print(f"error: {mutoon_path} not found", file=sys.stderr)
        return 1

    mutoon = json.loads(mutoon_path.read_text(encoding="utf-8"))
    doc = build_document(sharh_dir, mutoon)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    for work, data in doc.get("commentaries", {}).items():
        print(f"{work}: {len(data.get('verses', {}))} verses with commentary ({data.get('title')})")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
