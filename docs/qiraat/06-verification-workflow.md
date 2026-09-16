# 06 — Verification workflow

## Lifecycle (Part 9)

```
EXTRACTED → MAPPED → REVIEWED → VERIFIED → PUBLISHED
```

- **EXTRACTED** — raw text pulled from a source (OCR, manual transcription, a future PDF importer),
  not yet anchored to a Quran position.
- **MAPPED** — anchored to `(surah, ayah, startToken, endToken)` and attributed to `readingIds`,
  not yet reviewed for accuracy.
- **REVIEWED** — a human has read it against the source and believes it's right, but it hasn't
  been cross-checked against a second/primary reference yet.
- **VERIFIED** — cross-checked against a primary classical reference (Al-Shatibiyyah, Al-Nashr, or
  equivalent) with that reference named in `qiraat_sources`.
- **PUBLISHED** — VERIFIED and deliberately promoted for wider display (this prototype treats
  VERIFIED and PUBLISHED identically for display purposes — see `PUBLIC_VERIFICATION_STATUSES` in
  `engine.ts` — since this app has one user and no separate "draft vs. live" audience yet; a future
  multi-user rollout could split them, e.g. PUBLISHED = visible without the debug flag even to a
  second reviewer account, VERIFIED = visible only to the person who verified it).

**Only VERIFIED/PUBLISHED ever reaches an ordinary read** — enforced in exactly one place,
`engine.ts`'s `isVisible()` / `PUBLIC_VERIFICATION_STATUSES`, used by every read path
(`variantsForToken`, `resolveTokenForReading`, `FixtureQiraatRepository.getVariantsForPage`, the API
route's default). There is no second code path that forgets the filter — `engine.test.mjs`'s
"verification-status filtering" test asserts an EXTRACTED record is invisible by default and only
appears with `includeUnpublished: true`.

## What's actually in the page-1 prototype, and why

| Variant | Status | Why |
|---|---|---|
| 1:4 مالك/ملك (16 narrators, 8 readers) | **VERIFIED** | One of the most universally documented Qiraat differences in the literature (cited in essentially every introductory Qiraat/tajweed source); this session could not pin an exact paginated edition to cite, but the fact itself is not in serious doubt. |
| 1:6 و1:7 الصراط→السراط (Hamzah, both narrators) | **REVIEWED**, not VERIFIED | The general attribution (Hamzah's narrators read a sin-like sound in "صراط") is well known, but this session could not confirm the precise narrator scope or whether it's a pure letter swap vs. an ishmam (a sound between sin and sad) against a primary Shatibiyyah/Nashr text. Held back a stage rather than asserted with unearned confidence — see `verificationNotes` on both fixture records. |

Both real records carry a `sources[]` entry naming what grounds them
(`qiraat_sources`/`QiraatSource`) and an honest `verificationNotes` string — never an
unattributed claim about Quranic reading data (Part 25/28).

## Why the engine/unit tests use separate synthetic fixtures (Part 29)

The page-1 prototype's real content only exercises `REPLACE` and the reader-level (Case B) /
multi-reader (Case C) attribution shapes — because that's what Al-Fatihah's actual, well-documented
differences happen to be. It does not naturally contain an `INSERT`, `DELETE`, `MERGE`, `SPLIT`,
`DIACRITIC_CHANGE`, a lone single-narrator (Case A) marker, or all ten readers sharing one variant.
Rather than invent Quranic text to force those cases into "real" data,
`packages/qiraat-core/fixtures/synthetic/engine-fixtures.json` covers them with clearly-labeled
fake data (surah `999`, which doesn't exist; every string prefixed `SYN-`; a top-level `"source":
"SYNTHETIC — …"` field identical in spirit to the empty fixture this package originally shipped
with). This file is wired only into `engine.test.mjs`, never into `repository.ts`'s page loaders —
it can never reach the live UI.

## Never automatically entering production (Part 9/28)

There is no code path that inserts extracted/OCR text directly into `fixtures/pages/` or a
`VERIFIED` row. Adding real data is a manual, reviewed act: someone (today, the developer; later,
a PDF-import pipeline per `09-full-rollout-plan.md`) writes a `QiraatVariant` record by hand, chooses
its `verificationStatus` honestly, and cites its `sources`. The Hafs Mushaf-1441 source data itself
(`packages/quran-data/mushaf1441/fixtures/`) is never touched by anything in `qiraat-core` — no
code in this package writes to those files, and `packages/qiraat-core/README.md` states this as a
policy, not just an accident of the current implementation (Part 28).
