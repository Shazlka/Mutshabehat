# Pages 1–10 — reconciliation report (Phase 3 of the pages-1-10 task)

Required by the task before acceptance: **base Quran changes = 0, duplicate loci = 0, unresolved
word IDs = 0.** All three checked programmatically against the real fixtures (never by inspection
alone) — reproducible with the snippets below.

## 1. Base Quran text: zero changes

```
$ git status --porcelain packages/quran-data/mushaf1441/fixtures/page-words/
(no output)
```

Nothing under `packages/quran-data/mushaf1441/` (the 604-page word fixtures, surah/ayah/page IDs)
was touched. Every file this batch adds or modifies lives under `packages/qiraat-core/`,
`data/qiraat/`, `docs/qiraat/`, or the Mushaf viewer/marker components — never the Quran data
itself, per the task's own rule.

## 2. Unresolved word IDs: 0 / 40

Every `(surah, ayah, token)` referenced by any of the 40 variant records in
`data/qiraat/raw/pages-001-010.json` was looked up against a fresh index built from
`packages/quran-data/mushaf1441/fixtures/page-words/page-*.json` (real `charTypeName: 'word'`
tokens only — never the ayah-end/pause/sajdah glyphs). All 40 resolved; 0 missing.

This is enforced at generation time, not just checked after the fact: the build script's
`real_hafs_text()` helper raises immediately if a locus references a token that does not exist in
the real fixtures, so a wrong ayah/token typo fails loudly instead of silently producing bad data.

## 3. Duplicate loci: 0

Checked two ways:
- **Duplicate record ids** — 0 of 40 ids repeat.
- **Overlapping attribution at one exact position** — for every `(surah, ayah, startToken,
  endToken)` shared by more than one record (this legitimately happens: e.g. 2:58's `نغفر` has two
  competing REPLACE variants, `يُغْفَرْ` and `تُغْفَرْ`, and 2:67's `هزوا` has three), no two records at
  the same position share a `readingId`. A reading id appearing twice at one locus would mean two
  records both claim the same narrator reads two different texts at the same word — a genuine data
  error — and none exist.

## 4. `hafsText` fidelity — found and fixed during this reconciliation

The first generation pass hand-typed `hafsText` literals from the task prompt. Diffing them against
the real fixture text turned up two real classes of drift, both now eliminated by making the build
script derive `hafsText` (and, for performance-only records, `variantText`) **directly from the
real per-page word fixtures** rather than from the hand-typed literal, which is now used only as a
sanity check (a normalized-comparison mismatch would abort the build):

- **Combining-mark ordering**: the real fixtures order some diacritics differently from how they
  were hand-typed (e.g. shadda-before-kasra vs. kasra-before-shadda) — visually identical, not
  byte-identical. 5 records affected.
- **Incomplete multi-token span**: `v-p004-l001-shaa-allah` spans two tokens (`شَآءَ` at 2:20:15 and
  `ٱللَّهُ` at 2:20:16) but the hand-typed `hafsText` only captured the first word. Now derived as
  the full space-joined span, `شَآءَ ٱللَّهُ`.
- One false-positive the sanity check itself needed a fix for: the real fixtures store the
  decomposed alef-madda (`U+0627 U+0653`, two codepoints) where a hand-typed literal normally uses
  the precomposed `U+0622` (one codepoint) — same letter, different Unicode form. The sanity check
  now applies NFC normalization before comparing, so this canonical-equivalence case no longer
  false-flags.

Post-fix, a full-span exact-match check (`hafsText === ' '.join(real fixture words for every token
in the span)`) passes for all 40 records — 0 mismatches.

## 5. Empty-`readingIds` placeholders never reach a crash path

6 records (all 4 `NEEDS_MANUAL_REVIEW` loci with more than one uncertain target) have `readingIds:
[]` — deliberately: the task says "do not guess," and no reader/narrator attribution was confident
enough for these. This is safe by construction in the normal (non-debug) UI, since
`NEEDS_MANUAL_REVIEW` is not in `PUBLIC_VERIFICATION_STATUSES`. It was **not** safe in the
debug/admin "include reviewed" view: `comparisonMarkerForWord()` (the comparison-mode marker
builder) called `computeAttribution([])`, which throws (`computeAttribution requires at least one
reading id`) — a real crash reachable by a reviewer opening exactly the records they're meant to be
reviewing. Fixed in `src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts`: an empty
`readingIds` after filtering now returns a neutral `unresolved: true` marker (never a guessed
reader/narrator color) instead of calling `computeAttribution`. The equivalent detail-panel display
(`Mushaf1441Viewer.tsx`'s قراءات tab) also no longer computes a misleading "N رواية بلا تغيير" line
for these records (that would have implied 20 readings are confirmed unchanged, when the truth is
simply "not yet determined"). Covered by a new regression test,
`packages/qiraat-core/engine.test.mjs`'s *"a NEEDS_MANUAL_REVIEW placeholder with no confident
attribution never crashes computeAttribution"*.

## Verdict

All three required invariants hold: **base Quran changes = 0, duplicate loci = 0, unresolved word
IDs = 0.** See `pages-001-010-final-report.md` for the overall acceptance verdict.
