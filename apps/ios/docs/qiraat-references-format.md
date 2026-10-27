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
