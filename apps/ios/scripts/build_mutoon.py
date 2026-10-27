"""Build Generated/QiraatMutoon/mutoon.json (الشاطبية، الدرة، طيبة النشر) from a parsed verses file.

The input is a JSON list of verses, each {work, book, verse, pageId, printedPage, lines, chapter, farsh}, in the
books' order (as written by the local Shamela parser). The output groups them by book and chapter for the app's
«المتون» page. The book text is the person's own data and is never committed; this script holds none of it.

Usage: python3 scripts/build_mutoon.py <verses.json> <mutoon.json>
"""
import json
import sys
from pathlib import Path

WORKS = {
    "shatibiyyah": ("حرز الأماني ووجه التهاني (الشاطبية)", "الإمام الشاطبي"),
    "durrah": ("الدرة المضية في القراءات الثلاث المتممة للعشر", "الإمام ابن الجزري"),
    "tayyibah": ("طيبة النشر في القراءات العشر", "الإمام ابن الجزري"),
}


def build(verses):
    """The mutoon document for a list of parsed verses. Raises ValueError on input the app could not show."""
    works = []
    for work, (title, author) in WORKS.items():
        mine = [v for v in verses if v.get("work") == work]
        if not mine:
            raise ValueError(f"no verses for {work}")
        chapters = []
        for v in mine:
            lines = [line for line in v.get("lines", []) if line.strip()]
            if not lines:
                raise ValueError(f"{work} verse {v.get('verse')} has no text")
            title_of = v.get("chapter") or ""
            if not chapters or chapters[-1]["title"] != title_of:
                chapters.append({"title": title_of, "farsh": bool(v.get("farsh")), "verses": []})
            chapters[-1]["verses"].append({"number": int(v["verse"]), "lines": lines,
                                           "printedPage": v.get("printedPage"), "pageId": v.get("pageId")})
        works.append({"work": work, "title": title, "author": author, "bookId": mine[0].get("book"),
                      "chapters": chapters})
    return {"schemaVersion": 1, "works": works}


def report(document):
    """One line per book: verses, chapters, and verse numbers missing from 1..last."""
    out = []
    for work in document["works"]:
        numbers = [v["number"] for c in work["chapters"] for v in c["verses"]]
        missing = sorted(set(range(1, max(numbers) + 1)) - set(numbers))
        out.append(f"{work['work']}: {len(numbers)} verses, {len(work['chapters'])} chapters, last {max(numbers)}"
                   + (f", missing {missing[:10]}" if missing else ""))
    return out


def main(argv):
    if len(argv) != 3:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target = Path(argv[1]), Path(argv[2])
    if not source.is_file():
        print(f"error: {source} not found (it is written by the local Shamela parser)", file=sys.stderr)
        return 1
    document = build(json.loads(source.read_text(encoding="utf-8")))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    for line in report(document):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
