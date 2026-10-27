# Qiraat references file (`references.json`)

The scholarly references (الشاطبية، الدرة، طيبة النشر) a Qiraat card shows per variant. The file is **your own data**:
it is never committed. `make references REFERENCES_SRC=<folder holding references.json>` copies it, unchanged, to
`Generated/QiraatReferences/references.json`, which the build bundles when present. Without it the card shows no references row.

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-26T00:00:00Z",
  "entries": [
    {
      "variantId": "…",
      "variantKey": "1:4:1-1:مَلِكِ",
      "work": "shatibiyyah",
      "verse": 123,
      "lines": ["…the verse as the book prints it…"],
      "symbolText": "…",
      "side": "complement",
      "readingIds": ["Q05-R01", "Q05-R02", "Q07-R01", "Q07-R02"],
      "printedPage": "…",
      "sourceBookId": 7754,
      "sourceUrl": "…",
      "status": "extracted",
      "note": "…"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `variantId` | The variant's id in the Qiraat data. Optional; tried first. |
| `variantKey` | `surah:ayah:startToken-endToken:variantText` (variantText in NFC). Used when the id has changed. A variant whose text equals Hafs's (performance only) is matched by id only. |
| `work` | `shatibiyyah`, `durrah` or `tayyibah`. |
| `verse`, `printedPage` | Position in the book (printed page, not the Shamela running number). Optional. |
| `lines` | The verse as printed. A quotation, not Quran text: shown in a plain Arabic face. |
| `symbolText` | The symbol letters, kept with their work (the same letter means different readers in each matn). |
| `side` | `variant`: the named readers read the variant's text. `complement`: they read the Hafs-side text, so the variant is read by the rest of the work's scope. |
| `readingIds` | Narrator ids (`Q01-R01`) or reader ids (`Q01`, standing for both narrators) the verse names. |
| `status` | `extracted` (machine), `reviewed`, `verified` (a person checked it against the book). |

**Scope per work:** shatibiyyah = Q01–Q07; durrah = Q08–Q10; tayyibah = Q01–Q10. The Durrah names only the readers who leave their أصل («فإن خالفوا أذكر وإلا فأهملا»), so a Durrah entry may
name part of a side: it matches when every reader it names is on the right side. The app compares the readers a reference
names with the variant's own readers inside that scope; a difference shows a visible warning, never hidden.

**Loading:** a missing, unreadable or `schemaVersion` ≠ 1 file gives an empty store (nothing shown). One broken entry is
skipped; the others load.

**Bundling:** a pre-build step copies `Generated/QiraatReferences/references.json` into the app when it is present and
removes the bundled copy when it is not. A debug build launched with `-qiraat-references-fixture` uses a synthetic set
(«نص تجريبي») for every variant on page 1 instead; UI tests use it.

## The متون file (`mutoon.json`)

The «المتون» page (المزيد) shows الشاطبية، الدرة and طيبة النشر in full. Like the references, the text is your own
data and is never committed: `make mutoon` builds `Generated/QiraatMutoon/mutoon.json` from the locally parsed Shamela
verses (`MUTOON_SRC`, default `Generated/QiraatReferences-full/verses.json`) with `scripts/build_mutoon.py`, and a
pre-build step bundles it when present (`make clean` leaves `Generated/` alone).

```json
{ "schemaVersion": 1,
  "works": [ { "work": "shatibiyyah", "title": "…", "author": "…", "bookId": 7754,
               "chapters": [ { "title": "…", "farsh": false,
                               "verses": [ { "number": 108, "lines": ["…", "…"], "printedPage": "9", "pageId": 15 } ] } ] } ] }
```

A missing, unreadable or `schemaVersion` ≠ 1 file gives an empty page with a note; a book with an unknown `work` is
skipped. Search ignores marks and alef forms; a number finds that verse in each book.

## The symbol layer (`mutoon-symbols.json`)

On the «المتون» page a letter or word that stands for a reader or narrator is red, and a tap opens a card: the symbol,
whom it names (a narrator with his reader), what it marks in that verse, the verse of the متن's introduction that
defines it, the شرح it was checked against, and its status. A switch on the page («تمييز الرموز», kept per device as
`mutoon:symbols:v1`) turns the colour off; a key line explains it.

**Dictionaries (committed, `MushafCore/MatnSymbols.swift`).** One per متن, each from its own introduction, because the
same letter names different people: الشاطبية ٤٥–٥٥ (أبجد on the seven, ثخذ ظغش, and the eight word symbols), الدرة ٥–٨
(أبج، حطي، فضق for أبو جعفر، يعقوب، خلف العاشر), طيبة النشر ٣٦–٤٨ (أبجد … ظغش on the ten, no letter for خلف العاشر, and
the word symbols كفى، شفا، صحب، صحبة، صفا، فتى، رضى، روى، ثوى، مدا، حما، سما، حق، حرم، عم، حبر، كنز).

**Marks (your data, never committed).** The verse text is never changed: the marks are a layer beside it.

```json
{ "schemaVersion": 1,
  "annotations": [ { "work": "shatibiyyah", "verse": 108, "line": 0, "start": 16, "end": 17, "text": "رَ",
                     "symbol": "ر", "kind": "reader", "readingIds": ["Q07"], "note": "«مالك» بالألف",
                     "source": "الوافي في شرح الشاطبية (عبد الفتاح القاضي)، ص ٥٠", "status": "verified" } ] }
```

`line` is the hemistich (0 or 1). `start..<end` counts characters as Swift does: a letter and its marks are one
character, so a letter is coloured with its marks and the words keep their joining. `kind` is `reader`, `narrator` or
`group`. Only `verified` marks are shown; `extracted` ones stay plain until checked.

The app shows a mark only when it sits on exactly its `text`, begins with its symbol's letter (a letter symbol) or
spells the whole symbol (a word symbol), and names the same readers as its متن's dictionary; anything else is dropped.
A letter is never coloured because of what it is, only because a checked mark puts it there.

`make matn-symbols` builds the file from a hand-checked list (`MATN_SYMBOLS_SRC`, default
`Generated/QiraatMutoon/symbols-sample.json`) with `scripts/build_matn_symbols.py`: each entry names the verse, the
hemistich and the word, and whether its first letter or the whole word is the symbol; a word that is not in the
hemistich stops the build. The pre-build step bundles the file next to `mutoon.json`.

`method` says how a verified mark was checked: `hand` (read against the شرح; the default when the field is missing) or
`match` (matched to it by script). The card says «محقَّق من الشرح» or «مطابق لقول الشارح (آليًّا)». A word symbol matches
either spelling of its last letter («رضى/رضا»).

The current file holds 3,693 marks in 1,358 verses (الشاطبية 1,482 in 594، طيبة النشر 2,092 in 679، الدرة 119 in 85).
77 were checked by hand against الوافي في شرح الشاطبية and الهادي شرح طيبة النشر (`symbols-sample.json`); the rest were
matched to the same شرحين by `Generated/QiraatMutoon/sharh_symbols.py` (`symbols-all.json`, which also carries the
hand-checked ones). The match accepts a run of neighbouring symbol words only when the readers it stands for are exactly
the readers the شرح names together for that verse, or a word the شرح cites by name as a symbol («بالحاء من «حلا»»); see
the script for the words that are never symbols. الدرة, which has no شرح in the library, is read against الهادي's
explanation of the طيبة verses on the same Quran word, narrowed to its three readers. Verses the شرح does not confirm
stay plain. A second copy of the متون with its own marks was compared (`second_copy.py`): where both mark a place the
readers agree, and its marks that pass the same checks were added (300). `Generated/QiraatMutoon/review-symbols.html`
lists every mark for review.
