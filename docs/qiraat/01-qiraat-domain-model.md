# 01 — Qiraat domain model

Implemented in `packages/qiraat-core/` (framework-agnostic, no dependency on `src/` or on the other
`packages/*` modules — the Mushaf viewer depends on this package, never the reverse).

## IDs (Part 1/35)

Fixed forever, never derived from an Arabic name:

- `ReaderId`: `'Q01'` … `'Q10'` (`packages/qiraat-core/readers.ts`)
- `NarratorId`: `'Q01-R01' | 'Q01-R02' | … | 'Q10-R02'` (`narrators.ts`) — 20 total, 2 per reader
- `ReadingId = NarratorId` (`types.ts`) — a Riwayah (a fully renderable reading) IS a narrator's
  transmission of a reader's Qiraah; there is no separate ID space for it (`readings.ts` derives
  the 20 `QiraatReading` display records from `narrators.ts` so they can never drift apart)
- `BASE_READING: ReadingId = 'Q05-R02'` (Hafs 'an Asim) — defined exactly once (Part 36), imported
  everywhere else that needs the baseline, never re-typed as a literal.

**The two narrators named "الدوري"** are unrelated people and are never conflated:
`Q03-R01` = "الدوري عن أبي عمرو" (reader Q03, Abu Amr al-Basri), `Q07-R02` = "الدوري عن الكسائي"
(reader Q07, Al-Kisai). Every lookup in this codebase is keyed by the full ID, never by the bare
Arabic string "الدوري" — `packages/qiraat-core/validate.mjs` and `engine.test.mjs` both assert this.

## Canonical token identity (Part 7)

A variant anchors to `(surah, ayah, startToken, endToken)`, where `startToken`/`endToken` are
1-based `wordIndexInAyah` values (the same field the Mushaf-1441 `MushafWord` fixtures already
carry — see `docs/qiraat/00-existing-architecture.md`). `tokenKey(surah, ayah, token)` in
`engine.ts` produces the `"surah:ayah:token"` string form when one is needed as a map key.
`pageNumber`/`lineNumber` are carried on the word itself for convenience, never as part of a
variant's identity — a variant is a Quran-position fact, not a Mushaf-1441-page fact.

## `QiraatVariant` (Part 6/8)

```ts
interface QiraatVariant {
  id: string
  surah: number; ayah: number; startToken: number; endToken: number
  operation: VariantOperation        // KEEP | REPLACE | INSERT | DELETE | MERGE | SPLIT | DIACRITIC_CHANGE | ORTHOGRAPHIC_CHANGE
  hafsText: string; variantText: string; uthmaniText?: string
  differenceType: DifferenceType     // HARAKAH | LETTER | ADDITION | OMISSION | MADD | HAMZ | IMALAH | IDGHAM | WAQF | NAQL | SILAH | ORTHOGRAPHY | OTHER
  notes?: string
  verificationStatus: VerificationStatus   // EXTRACTED → MAPPED → REVIEWED → VERIFIED → PUBLISHED
  synthetic?: boolean                // true only in test fixtures, never in fixtures/pages/
  readingIds: ReadingId[]            // many-to-many attribution — never duplicated per reading
  sources?: QiraatSource[]
}
```

Only the readings that actually differ from Hafs need a row: if Shu'bah ('an Asim) or both Kisai
narrators happen to read the same as Hafs, they are simply absent from every variant's
`readingIds` at that token — `resolveTokenForReading` (Part 37) returns the Hafs text for them by
default, with no storage cost (Part 4's "don't store 20 full Qurans").

## `QuranToken` (Part 8)

Not a new table/type in this codebase: the existing `MushafWord` (from
`packages/quran-data/mushaf1441/types.ts`) already has every field the spec's `quran_tokens` table
asks for (`surahNumber`, `ayahNumber`, `wordIndexInAyah`, `textUthmani`, `pageNumber`,
`lineNumber`). The (unapplied) `quran_tokens` Postgres table in
`03-database-schema.md`/the migration file exists only for a future non-Mushaf-1441 consumer of
this same engine — see Part 42.F.

## Operations and difference types

`VariantOperation` and `DifferenceType` are exactly the sets from Part 6/12, defined once in
`types.ts` (`DIFFERENCE_TYPE_LABELS_AR` gives the Arabic UI label for each difference type — see
`05-ui-ux.md` for why color never encodes this). See `04-rendering-engine.md` for how each
operation is applied.

## Verification lifecycle (Part 9)

`VerificationStatus = 'EXTRACTED' | 'MAPPED' | 'REVIEWED' | 'VERIFIED' | 'PUBLISHED'`.
`PUBLIC_VERIFICATION_STATUSES = ['VERIFIED', 'PUBLISHED']` is the single filter every read path
(the engine, the repository, the API route) applies before an ordinary user ever sees a record —
see `06-verification-workflow.md`.
