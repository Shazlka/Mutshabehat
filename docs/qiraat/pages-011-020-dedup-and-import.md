# Qiraat Ashr — pages 1-20 batch: dedup check + pages 11-20 import

Source: task-prompt-provided `qiraat-extraction-v2.0` JSON covering Mushaf pages 1-20 (PDF pages
6-25 of `مصحف القراءات العشر-1.pdf`), with an explicit `import_policy`:

```
allowed_status: ["reviewed"]
blocked_status: ["needs_manual_review", "needs_high_resolution_transcription"]
```

## 1. Pages 1-10 — dedup check (no changes made)

Every `QIRAAT_VARIANTS_REGION` locus for mushaf pages 1-10 in the new payload was cross-checked
against the existing fixtures (`packages/qiraat-core/fixtures/pages/page-{001..010}.json`, built in
the 2026-09-16 session from the same source). All 24 loci (P001-L001 … P010-L004) are already
present, with matching surah/ayah anchors, readings and attribution. **Nothing was re-added or
duplicated for pages 1-10.**

Two things are worth recording, not fixing (out of scope for this task, which is additive only):
- The five loci the new payload flags `needs_manual_review` (P004-L001 شاء الله, P008-L002 بارئكم,
  P009-L003 عليهم+النبيين¹, P009-L004, P010-L003 يأمركم) are already present in the pages 1-10
  fixtures at the matching tier — four as `NEEDS_MANUAL_REVIEW`, one (`v-p008-l002-bariikum-*`) at
  `REVIEWED` despite the 2026-09-16 changelog describing it as flagged uncertain. This pre-dates
  this task and existing pages 1-10 data was not touched here.
- `RULES_TABLE_REGION` (عد الآي, الإدغام الكبير, أوجه البسملة بين السور, …) and `FAWAID_REGION`
  (poetic شواهد) on page 1 were **not imported** — see §3.

¹ P009-L003 عليهم in the new payload additionally provides finer per-narrator detail (splits
الكسائي/خلف العاشر from حمزة/يعقوب) than the existing `NEEDS_MANUAL_REVIEW` placeholder captures,
but since the whole locus stays blocked either way (`needs_manual_review`), this finer detail was
not merged in — it would change a blocked record's content without changing its (still-blocked)
status. Left for a future manual-review pass against the actual PDF.

## 2. Pages 11-20 — new import

`scripts/build-qiraat-pages-011-020.py` (idempotent, no external state) derives 39 new
`QiraatVariant` records across 31 conceptual loci, wired into
`packages/qiraat-core/fixtures/pages/page-{011..020}.json` and
`packages/qiraat-core/repository.ts`. Every record is `REVIEWED` — the import policy's
`allowed_status` — with real attribution (no empty `readingIds` placeholders, unlike the pages
1-10 batch's handling of `needs_manual_review`).

Per the payload's own **`blocked_status`**, the following loci were read but **not imported at
all** (no fixture record, not even a placeholder):

| Locus | Page | Reason |
|---|---|---|
| P012-L003 (تعبدون) | 12 | `needs_manual_review` |
| P012-L004 (حسنا) | 12 | `needs_manual_review` |
| P014-L004 (يأمركم) | 14 | `needs_manual_review` |
| P019-L001 (إبراهيم/إبراهام + ابن ذكوان's separate وجه) | 19 | `needs_manual_review` |
| P020-L001 (إبراهيم/إبراهام + ابن ذكوان's separate وجه) | 20 | `needs_manual_review` |
| P020-L002 (وأرنا — اختلاس) | 20 | `needs_manual_review` |

As in the pages 1-10 batch, `hafsText` is always derived from the real, unmodified Mushaf-1441
word fixtures (`packages/quran-data/mushaf1441/fixtures/page-words/*.json`), never hand-typed —
the generator's `variant()` helper cross-checks any hand-typed literal against the real word and
warns on drift. For the three loci where a Quran-orthography compound token carries an attached
prefix inseparable from the differing root (2:97/2:98 جبريل within `لِّجِبْرِيلَ`/`وَجِبْرِيلَ`, and 2:98
ميكال within `وَمِيكَىٰلَ`), a `splice()` helper substitutes only the alternate reading's own spelling
of the root into the real prefix-bearing token — the prefix itself is never retyped.

**Baseline-matching groups are never encoded as variants** (same rule as pages 1-10): when a
payload "variant" group's reading is identical to the real Hafs text (e.g. page 11's فهي: the
group reading "فَهِيَ" is already what Hafs reads), it is left implicit — only the *documented
difference* group(s) get a `QiraatVariant` record. Two identical-spelling groups differing only in
a performance nuance (e.g. page 17's وهو: يعقوب's own group reads the same "وَهُوَ" as the ordinary
baseline but carries an extra وقف-bهاء-السكت note) are still encoded, as a `performanceNote`-only
record, never silently dropped.

Reconciliation invariants (checked, not just asserted): 0 base-Quran-fixture changes (script only
reads `packages/quran-data/...`, never writes it); 0 empty-`readingIds` records (every kept locus
has confident attribution, since the ambiguous ones were dropped rather than flagged); attribution
counts sum to 20 readings per locus with no double-counting, verified per-locus while writing the
generator (see script comments) and spot-checked via `packages/qiraat-core/engine.test.mjs`.

## 3. RULES_TABLE_REGION / FAWAID_REGION — out of scope

Both regions document a structurally different kind of information — waqf/الإدغام الكبير/عدّ الآي
procedural rules and poetic شواهد citations — not a per-word Qiraat difference anchored to a single
Quran token, which is what `QiraatVariant`/the comparison-mode engine models. Importing them would
need a new domain type, not a `QiraatVariant` record. They are also, independently, still
`needs_high_resolution_transcription` for every page in this batch (the one page-1 `RULES_TABLE_REGION`
that isn't literally marked that way is still not a per-word variant), so the import policy would
block them regardless. Left for a future task if/when this becomes an explicit requirement.

## Verification

`npx tsc --noEmit -p .` (clean), `npm run test:qiraat` (24/24 — 2 new regression tests added:
REVIEWED-only enforcement for this batch, and the جبريل/ميكال multi-occurrence splice),
`npm run mushaf:validate` (all 7 validators), `node scripts/validate-mushaf1441-phase5.mjs`,
`env -u __NEXT_PROCESSED_ENV npm run build` (clean), and a local `next start` + Playwright check
confirming comparison-mode markers render correctly on pages 11, 15 and 20 (فهي, تعملون, يعملون,
جبريل ×2, ميكال, ووصى) with `qiraatIncludeReviewed` defaulted on and no console errors beyond the
sandbox's expected unreachable-dummy-backend noise.
