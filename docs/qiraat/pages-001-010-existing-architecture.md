# Pages 1–10 — existing architecture (Phase 1 of the pages-1-10 task)

Builds on `docs/qiraat/00-existing-architecture.md` (read that first — it covers the Mushaf-1441
fixture format, the token model, and why Qiraat data doesn't need its own Quran copy). This note
only records what's specific to extending the prototype from page 1 to pages 1–10.

## Word identity, verified against the actual fixtures

Every word this task's spec references was looked up directly in
`packages/quran-data/mushaf1441/fixtures/page-words/page-{001..010}.json` — never guessed from
screen coordinates. `python3 -c "..."` dumps of `(surahNumber, ayahNumber, wordIndexInAyah,
textUthmani)` for every real word (charTypeName `'word'`, i.e. excluding the ayah-end/pause/sajdah
glyphs) on each page gave an exact `surah:ayah:wordIndexInAyah → textUthmani` table, which is what
every locus in this task is anchored to (see `pages-001-010-word-mapping.md`).

**Page↔ayah range confirmation:** the task's own page mapping (page 2 = 2:1–5, page 3 = 2:6–16,
page 4 = 2:17–24, page 5 = 2:25–29, page 6 = 2:30–37, page 7 = 2:38–48, page 8 = 2:49–57,
page 9 = 2:58–61, page 10 = 2:62–69) matches the app's own existing, already-verified Mushaf-1441
fixture boundaries exactly (checked programmatically, not assumed) — one less thing needing the
source PDF to confirm.

## Decision: extend the existing qiraat-core model, not a parallel locus/target/attribution schema

The task's Part 2 proposes `qiraat_sources / qiraat_loci / qiraat_targets / qiraat_variants /
qiraat_attributions / qiraat_persons` as new tables, but also says explicitly: *"Use the existing
architecture if possible… Do NOT create a duplicate Quran dataset unless absolutely required."*
Following that instruction over the literal table list:

- **`qiraat_persons`** → already fully solved by `packages/qiraat-core/{readers,narrators,readings}.ts`
  from the page-1 prototype: 10 readers + 20 narrators with permanent IDs, already disambiguating
  exactly the case this task calls out as CRITICAL (`Q06-R01` "خلف عن حمزة" vs. the reader `Q10`
  "خلف العاشر", whose own two narrators are `Q10-R01` إسحاق / `Q10-R02` إدريس). No new person model
  needed — reusing it *is* the fix for the "do not reduce both to خلف" rule.
- **`qiraat_targets` / multi-word / multi-occurrence loci** → rather than a separate join table, a
  new optional `locusId` field groups multiple `QiraatVariant` records (one per affected word/token)
  that represent one conceptual location. A locus covering two *disjoint* words (2:37 آدم + كلمات,
  not adjacent) or the same word at two *different* ayahs (2:2 هدى + 2:5 هدى) becomes N variant
  records sharing one `locusId`, each independently resolvable by the existing per-token engine —
  no change to `resolveTokenForReading`'s single-token contract, and the detail panel groups them
  back together by `locusId` for display (Part 21's example popup).
- **`qiraat_variants` / `qiraat_attributions`** → already the existing `QiraatVariant.readingIds`
  mechanism; "attribution" *is* "which of the 20 `readingIds` read this variant." "الباقون"/"باقي
  الرواة" (the rest) are computed as the 20-reading set minus the union of the locus's other
  variants' `readingIds`, not stored as a literal person.
- **New, additive fields** (not new tables): `locusType: 'word_variant' | 'multi_word_variant' |
  'performance_variant'` and `performanceNote?: string` — Part 23's explicit requirement that a
  performance-only difference (e.g. إشمام, إمالة, اختلاس) must not be forced into a fake Unicode
  text change. When a variant is performance-only, `variantText === hafsText` (the QCF/Amiri
  rendering doesn't change) and `performanceNote` carries the phonetic description shown in the tap
  panel — this also means Riwayah-mode text substitution correctly stays a no-op for pure
  pronunciation differences, which is accurate (there is no different *spelling* to render).
- **`qiraat_rules` (general usul)**: not built as a separate table for this 10-page batch — none of
  the loci below needed a rule referenced by more than 2–3 records, so the existing per-variant
  `notes`/`performanceNote` fields cover it without premature abstraction. Flagged in the final
  report as a genuine future need once a rule (e.g. "ha' al-kinayah" across dozens of loci) actually
  repeats at Quran-wide scale.

## Verification status — this batch does **not** contain PDF-verified data

Task Part 3 requires every record to be visually checked against `مصحف القراءات العشر-1.pdf` before
`verification_status = verified`. That PDF was not available in this environment (checked — no
upload directory, no PDF anywhere on the filesystem). Per the user's explicit choice when asked,
this batch is built from the attribution/variant data the user typed directly into the task
prompt, at `REVIEWED` (not `VERIFIED`), and the five items the user's own Part 29 called out as
uncertain are `NEEDS_MANUAL_REVIEW` (a status added to `VerificationStatus` alongside the
page-1 prototype's existing `EXTRACTED/MAPPED/REVIEWED/VERIFIED/PUBLISHED`, matching the task's own
required "at least: extracted, reviewed, verified, needs_manual_review"). Every record's `sources[]`
says exactly this, honestly, rather than a generic citation. See
`06-verification-workflow.md` and this batch's own `pages-001-010-final-report.md`.
