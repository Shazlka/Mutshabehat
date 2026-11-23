"""Builds Generated/QiraatMutoon/mutoon-symbols.json: where the reader and narrator symbols sit in the متون.

Input: a list of marks, each naming a verse, a hemistich and the word that carries the symbol, checked by hand against
a شرح (the list carries the book text it quotes, so it lives in the git-ignored Generated/ folder):

    {"marks": [{"work": "shatibiyyah", "verse": 108, "line": 0, "word": "رَاوِيهِ", "occurrence": 1,
                "mode": "letter", "symbol": "ر", "kind": "reader", "readingIds": ["Q07"],
                "note": "...", "source": "...", "status": "verified"}]}

`method` says how a mark was checked: "hand" (read against the شرح; the default) or "match" (matched to it by script).
`mode` "letter" marks the word's first letter with its marks (the symbol letter of a word, as every متن defines it);
"word" marks the whole word (a word symbol such as صحبة، سما، كفى). The word is found by its exact spelling in the
hemistich, else by its letters alone; `occurrence` picks the n-th match. Positions are counted in characters as Swift
counts them (a letter and its marks are one character), so the app can colour exactly that letter. A word that is not
in the hemistich stops the build: nothing is guessed.

Run: python3 scripts/build_matn_symbols.py MARKS mutoon.json OUT   (or `make matn-symbols`).
"""
import json
import pathlib
import sys
import unicodedata

SCHEMA_VERSION = 1
KINDS = {"reader", "narrator", "group"}
STATUSES = {"verified", "extracted"}
METHODS = {"hand", "match"}


def characters(text):
    """Grapheme clusters as Swift's Character sees Arabic: a base letter followed by its combining marks."""
    out = []
    for ch in text:
        joins = unicodedata.category(ch) in ("Mn", "Me") or ch in "‌‍"
        if out and joins:
            out[-1] += ch
        else:
            out.append(ch)
    return out


def key(text):
    """Letters only: marks and tatweel dropped, ا for أ إ آ ٱ, ي for ى, ه for ة (as MatnSymbols.key in the app)."""
    fold = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه"}
    return "".join(fold.get(c, c) for c in unicodedata.normalize("NFC", text)
                   if unicodedata.category(c) not in ("Mn", "Me") and c != "ـ" and not c.isspace())


def words(chars):
    """(start, end) character spans of the words of a hemistich, punctuation trimmed from the end."""
    spans, start = [], None
    for i, c in enumerate(chars + [" "]):
        if c[0].isspace():  # a stray mark written before a word attaches to the space, as in Swift
            if start is not None:
                end = i
                while end > start and not any(unicodedata.category(x).startswith("L") for x in chars[end - 1]):
                    end -= 1
                spans.append((start, end))
                start = None
        elif start is None:
            start = i
    return spans


def locate(mark, verses):
    where = f'{mark["work"]} {mark["verse"]}:{mark["line"]} «{mark["word"]}»'
    lines = verses.get((mark["work"], mark["verse"]))
    if lines is None:
        raise ValueError(f"{where}: no such verse")
    if not 0 <= mark["line"] < len(lines):
        raise ValueError(f"{where}: no such hemistich")
    chars = characters(lines[mark["line"]])
    spans = words(chars)
    exact = [s for s in spans if "".join(chars[s[0]:s[1]]) == mark["word"]]
    found = exact or [s for s in spans if key("".join(chars[s[0]:s[1]])) == key(mark["word"])]
    occurrence = mark.get("occurrence", 1)
    if len(found) < occurrence:
        raise ValueError(f"{where}: word not in the hemistich")
    start, end = found[occurrence - 1]
    if mark["mode"] == "letter":
        end = start + 1
    elif mark["mode"] != "word":
        raise ValueError(f'{where}: mode must be "letter" or "word"')
    return start, end, "".join(chars[start:end])


def build(marks, mutoon):
    verses = {(w["work"], v["number"]): v["lines"] for w in mutoon["works"] for c in w["chapters"] for v in c["verses"]}
    out, seen = [], set()
    for mark in marks:
        if mark.get("kind") not in KINDS or mark.get("status") not in STATUSES or mark.get("method", "hand") not in METHODS:
            raise ValueError(f'{mark.get("work")} {mark.get("verse")}: kind, status or method missing')
        start, end, text = locate(mark, verses)
        slot = (mark["work"], mark["verse"], mark["line"], start)
        if slot in seen:
            raise ValueError(f"{slot}: marked twice")
        seen.add(slot)
        out.append({"work": mark["work"], "verse": mark["verse"], "line": mark["line"], "start": start, "end": end,
                    "text": text, "symbol": mark["symbol"], "kind": mark["kind"], "readingIds": mark["readingIds"],
                    "note": mark.get("note", ""), "source": mark.get("source", ""), "status": mark["status"],
                    "method": mark.get("method", "hand")})
    out.sort(key=lambda m: (m["work"], m["verse"], m["line"], m["start"]))
    return {"schemaVersion": SCHEMA_VERSION, "annotations": out}


def report(document):
    counts = {}
    for m in document["annotations"]:
        counts.setdefault(m["work"], {}).setdefault(m["status"], set()).add(m["verse"])
        counts[m["work"]].setdefault("marks", []).append(m)
    return [f'{work}: {len(c["marks"])} marks in {len(c.get("verified", set()) | c.get("extracted", set()))} verses '
            f'({len(c.get("verified", set()))} with verified marks)' for work, c in sorted(counts.items())]


def main(argv):
    if len(argv) != 4:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    marks_path, mutoon_path, out_path = map(pathlib.Path, argv[1:])
    for path in (marks_path, mutoon_path):
        if not path.is_file():
            print(f"missing input: {path}", file=sys.stderr)
            return 1
    document = build(json.loads(marks_path.read_text(encoding="utf-8"))["marks"],
                     json.loads(mutoon_path.read_text(encoding="utf-8")))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for line in report(document):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
