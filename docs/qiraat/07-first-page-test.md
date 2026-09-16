# 07 — First page prototype

## Page chosen: Mushaf-1441 page 1 (Al-Fatihah, ayat 1–7)

Chosen because it is the one page for which this session could respons ibly source real, widely
corroborated classical Qiraat differences without inventing Quranic text (Part 25/28's "never
create unattributed Quran reading data"), and because it is already an edge case in the existing
Mushaf-1441 layout (surah header + basmala decorations, page 1's centred-block special-case
justification) — proving Qiraat doesn't break that path is a more useful test than picking an
"easy" plain page.

## What it actually demonstrates (mapped to Part 29's requested case list)

| Requested case | Present on page 1? | Where |
|---|---|---|
| Simple replacement | ✅ | Both real variants (`REPLACE`) |
| Multiple-reader shared difference | ✅ | 1:4 مالك/ملك — 8 readers / 16 narrators (Case C, segmented marker) |
| Reader-level (both narrators) difference | ✅ | 1:6/1:7 الصراط→السراط — Hamzah, both narrators (Case B) |
| Narrator-specific (single narrator only) difference | ❌ — not naturally present in Al-Fatihah's well-documented textual (non-phonetic) differences | Covered by a synthetic fixture instead (`06-verification-workflow.md`) |
| Diacritic difference | ❌ — same reason | Synthetic fixture (`DIACRITIC_CHANGE`) |
| A more complex mapping (INSERT/DELETE/MERGE/SPLIT) | ❌ | Synthetic fixtures |

Per Part 29's own instruction ("If the provided source page does not include all cases, test
synthetic fixtures separately without presenting synthetic text as Quran source data"), the missing
cases are exercised by `packages/qiraat-core/fixtures/synthetic/engine-fixtures.json` and asserted
in `packages/qiraat-core/engine.test.mjs`, never rendered in the live app.

## Data used

`packages/qiraat-core/fixtures/pages/page-001.json` — 3 records:

1. `v-1-4-1-malik-melik` — VERIFIED, REPLACE, LETTER, 16 `readingIds` (every reader except Asim and
   Al-Kisai).
2. `v-1-6-2-sirat-hamzah-sin` — REVIEWED, REPLACE, LETTER, `["Q06-R01", "Q06-R02"]`.
3. `v-1-7-1-sirat-hamzah-sin` — REVIEWED, REPLACE, LETTER, `["Q06-R01", "Q06-R02"]` (second
   occurrence of "صراط" on the same page).

## What manual verification checked

See `08-test-results.md` for the actual run — this section records what was *planned* to check,
before running it:

- Normal mode renders identically to before this feature (Test A).
- Comparison mode (default filter, VERIFIED-only) shows exactly one segmented 8-reader marker under
  "مَلِكِ" (1:4) and no marker anywhere else; toggling the debug "قيد المراجعة" checkbox additionally
  reveals one reader-colored (Hamzah) marker at each "صراط" occurrence (1:6, 1:7).
- Filtering by reader (e.g. "نافع") narrows the 1:4 marker's presence correctly (Nafi is one of the
  16 attributed narrators); filtering by a Riwayah not attributed to that token (e.g. حفص عن عاصم)
  shows nothing at 1:4.
- Selecting "ورش عن نافع" in Riwayah mode re-renders 1:4 as "مَلِكِ" in flowing Amiri text (not the
  QCF glyph) while every other word on the page keeps its QCF glyph.
- Switching directly from "ورش عن نافع" to "حفص عن عاصم" (no navigation) restores the QCF-glyph
  "مَـٰلِكِ" instantly (a local state change, no network).
- Selecting a reading of a different reader entirely (e.g. "شعبة عن عاصم", within the debug-visible
  Hamzah variant's non-affected words) renders independently and correctly leaves 1:4 unaffected
  (Shu'bah reads مالك, same as Hafs).
- Enabling "إظهار الاختلاف عن حفص" while reading Warsh marks only 1:4 (the one token where Warsh
  actually differs from Hafs on this page) with Warsh's own narrator color.
- Study Mode: the same markers thicken (2px → 4px) and the word gets a light background tint,
  tashkeel remains legible.
- Data integrity: the Mushaf-1441 page-word fixtures (`packages/quran-data/mushaf1441/fixtures/`)
  are untouched by this branch's diff; Qiraat data lives entirely under `packages/qiraat-core/`;
  toggling back to normal mode reproduces the exact pre-existing Mushaf rendering.
