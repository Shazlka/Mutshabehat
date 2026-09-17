# 10 — Qiraat V2: the permanent architecture for all 604 pages

**Status:** schema written and **executed against a real PostgreSQL 16** (see §7 for the test
results). Not yet applied to the self-hosted backend — that needs a `pg_dump` backup and an
explicit go-ahead per `CLAUDE.md`.

**Supersedes:** `supabase/migrations/20260916120000_qiraat_ashr_schema.sql` (never applied).
**Migration file:** `supabase/migrations/20260917120000_qiraat_v2_schema.sql`.

---

## 1. Decisions approved by the user (2026-09-17)

| # | Decision | Consequence |
|---|---|---|
| 1 | **Every occurrence is checked and stored individually.** The rule is written once as a canonical statement, but it is *never* auto-applied — "sometimes the rule does not apply in some locations, so deal with it one by one; checking each word is mandatory." | `qiraat_rules` holds reference text only and renders nothing. Every rendered mark is a `qiraat_entries` row anchored to a real, hand-verified locus. The `rule_id` link exists solely so `qiraat_qa_rule_divergence` can raise a *question*, never an automatic correction. |
| 2 | **Postgres is the source of truth; fixtures are generated from it.** | Authoring, review and QA happen in SQL. `qiraat_export_page()` emits the per-page JSON the app already serves, so a page turn stays a zero-round-trip render and the reader keeps working when the Mac Mini is unreachable. |
| 3 | **الأصول render as word markers on the page, plus a side panel.** | Rulings need real token anchors and per-attribution actions. This is why `qiraat_loci` and the shared `qiraat_entries` parent exist. |
| 4 | **«بخلف عنه» renders one default وجه and marks the word ذو وجهين**, listing both on tap. | `option_group` / `is_default` on the attribution row; `qiraat_qa_alternates` enforces exactly one default per (locus, authority). |

---

## 2. Review of the proposed design — what was adopted and what was not

### Adopted (genuine improvements over what is currently shipped)

- **Splitting the location from the variant.** Today `QiraatVariant` conflates them: every variant
  row re-states `surah/ayah/startToken/hafsText`, so two أوجه of the same word can silently
  disagree about the span they cover. One locus → N entries removes that bug class entirely.
- **One self-referencing authority tree instead of separate reader/narrator tables.** The source
  constantly mixes levels inside a single row — page 13 reads «أبو عمرو، ابن عامر، **حفص**، حمزة،
  الكسائي، أبو جعفر» (three readers and one narrator). Flattening to ten readers would lose real
  information; splitting into two tables would make that row unrepresentable.
- **`source_page_number` separate from `mushaf_page_number`.** Measured across the shipped
  fixtures the offset is a constant +5 (Mushaf 1 = PDF 6), but that is an observation about 20
  pages, not a guarantee about 604. The mapping is data, not arithmetic.
- **الشواهد and notes as first-class tables.** The current implementation discards الشواهد
  entirely — real data loss.
- **A QA-flag table with its own resolution workflow.** Necessary and distinct from
  `verification_status` (see §6).
- **Patch-not-copy rendering.** Correct, and already how the engine works.

### Rejected, with the reason

- **The `nafi` / `hamza_khalaf` ID scheme.** It would discard the shipped `Q01` / `Q01-R01` space
  already baked into 79 fixture records, the TypeScript types, the `--q01-*` CSS tokens, the colour
  system and the tests — and it is *weaker* on the exact hazard it was introduced to solve. Verified
  in the test database: `Q06-R01` (narrator خلف عن حمزة) expands to itself alone, while `Q10`
  (خلف العاشر) expands to `Q10-R01, Q10-R02`. The two cannot be confused structurally. A
  name-derived scheme relies on everyone spelling the suffix correctly, forever.
- **Rules without a token anchor.** This was the fatal defect. Counting the categories across the
  20-page extraction, **roughly 15 of 17 are word- or span-anchored** — ترقيق الراءات ﴿وَبِٱلْآخِرَةِ﴾,
  تغليظ اللامات ﴿ٱلصَّلَوٰةَ﴾, مدّ البدل ﴿ءَامَنُوا﴾, الممال والمقلل ﴿هُدًى﴾, المدغم الكبير ﴿فِيهِ هُدًى﴾,
  وقف حمزة ﴿مُسْتَهْزِءُونَ﴾, ياءات الإضافة ﴿إِنِّىٓ أَعْلَمُ﴾. Only عد الآي and the inter-surah notes are
  genuinely page-level. Unanchored, none of these could ever be drawn on the word the user is
  reading — which is the single highest-value feature this app has.
- **Runtime inheritance (`route → narrator → reader → base`) plus an unexpanded `all_except`.**
  Resolving "الباقون" per query is both slow and error-prone: it is only computable if the complete
  partition of that locus is known. `qiraat_rebuild_entry_readings()` resolves it **once at write
  time** into `qiraat_entry_readings`, and a trigger keeps the two from drifting. Verified: at 1:4
  the explicit وجه expands to 12 Riwayat and the `remainder` وجه to the remaining 8 — عاصم،
  الكسائي، يعقوب، خلف العاشر — computed from the word «الباقون» alone.
- **Flat per-occurrence storage of الشواهد.** The Shatibiyyah line for عليهم appears verbatim
  **8 times in the first 20 pages**. Across 604 it would be stored thousands of times, and one
  transcription fix would mean editing every copy. Canonical text + link table instead.

### Missing from the proposal, added here

- **A global أصول layer.** Page 2's notes carry المد المنفصل/المتصل, ميم الجمع, نقل ورش and سكت
  حمزة — Quran-wide conventions stated once, which govern how *any* page renders for *any* riwayah.
  Filed as a page-2 note they are buried. They are now `qiraat_rules` rows with `scope='global'`.
- **Multi-ayah loci.** الإدغام الكبير ﴿ٱلرَّحِيمِ ۝ مَٰلِكِ﴾ spans 1:3 → 1:4. Neither the proposal nor
  the current TypeScript engine can express that; `qiraat_loci` carries `start_ayah`/`end_ayah`.
- **A separate ayah-counting taxonomy.** عد الآي attributes to المكي/الكوفي/المدنيان/البصري/الشامي —
  ayah-numbering schools with no relation to the ten readers. Modelling them as authorities would
  silently corrupt every "which riwayah reads this" query. `qiraat_count_schools` keeps them apart.
- **A verbatim extraction archive.** `qiraat_extraction_raw` stores the payload as received, before
  normalisation, so every later correction is auditable against what was actually read.

---

## 3. Table map

```
qiraat_authorities ──┐  (30 rows: 10 readers + 20 narrators; routes later)
qiraat_count_schools │  (6 — a separate taxonomy, never mixed in)
qiraat_source_documents  (المصحف / الشاطبية / الدرة / طيبة)
qiraat_categories        (the 24 أصول categories; is_word_anchored drives the UI)
qiraat_rules ────────────  canonical statements, global | page | locus
   └─ qiraat_rule_authorities   default attribution (reference only)

qiraat_pages ─── source_page ↔ mushaf_page
   ├─ qiraat_extraction_raw     verbatim payload, pre-normalisation
   └─ qiraat_loci ───────────── one Quran position (multi-word, multi-ayah)
         └─ qiraat_entries ──── kind = variant | ruling   ← the only thing that renders
               ├─ qiraat_variant_details    (changes the rasm)
               ├─ qiraat_ruling_details     (does not)
               ├─ qiraat_entry_count_schools
               ├─ qiraat_entry_authorities  ← VERBATIM, at the level the book printed it
               └─ qiraat_entry_readings     ← DERIVED, the 20 Riwayat, for rendering

qiraat_evidence_texts ── qiraat_evidence_links   (الشواهد, deduplicated)
qiraat_notes
qiraat_qa_flags
```

**Why one `qiraat_entries` parent for both variants and rulings:** they differ only in whether the
printed rasm changes. Locus, attribution, verification, evidence and flags are identical. Unified,
"everything marked on this page for riwayah X" is one join and there is exactly one place where
"who reads this" lives — which is what makes the dataset maintainable at 604 pages.

---

## 4. Migrating the 79 records already shipped

The existing fixtures are not thrown away. `scripts/migrate-qiraat-v1-to-v2.mjs` (to be written):

1. For each of the 79 `QiraatVariant` records, create the `qiraat_loci` row from
   `surah/ayah/startToken/endToken/hafsText`, reusing `locusId` where the record already has one
   (the multi-word loci from the pages 1–10 batch).
2. Create one `qiraat_entries` row of `kind='variant'`, carrying `verificationStatus` across
   unchanged — **nothing is promoted by the migration.**
3. Expand `readingIds` back into `qiraat_entry_authorities` at **reader level where both narrators
   of a reader are present**, narrator level otherwise. This recovers the source's own granularity,
   which the current flat `readingIds` array has lost.
4. Move `performanceNote` to `qiraat_variant_details.performance_note`; move the 8 page-1
   `QiraatRule` records into `qiraat_entries` of `kind='ruling'`.
5. Re-point every `QiraatSource` at the `qiraat_pages` row instead of repeating the PDF page.
6. Run `qiraat_qa_partition` and open a flag for every locus that does not partition the 20.

Reversibility: `qiraat_export_page()` regenerates the fixtures, so the app can run off either side
during the transition.

---

## 5. Import pipeline for a page

```
PDF page image
   ↓ 1. extract verbatim            → qiraat_extraction_raw (never edited afterwards)
   ↓ 2. resolve authority names     → Q-IDs, at the level the source used
   ↓ 3. map every locus to a token  → against the real Mushaf-1441 word fixtures
   ↓ 4. split variants vs rulings   → changes the rasm, or does not
   ↓ 5. attribution mode            → explicit | all_except | remainder
   ↓ 6. dedupe الشواهد              → canonical text + link
   ↓ 7. notes, عد الآي, QA flags
   ↓ 8. qiraat_rebuild_locus_readings()
   ↓ 9. run the QA views            → partition, alternates, divergence, blocking
   ↓ 10. human review               → REVIEWED → VERIFIED
   ↓ 11. qiraat_export_page()       → fixture JSON, committed
```

**Non-negotiable at step 3:** `base_text` must be derived from the real Mushaf-1441 word fixtures,
never hand-typed. Hand-typing silently reorders combining marks and produces spans that match
nothing at render time — this has already been caught once in this project.

---

## 6. Verification policy

`EXTRACTED → MAPPED → REVIEWED → VERIFIED → PUBLISHED`, plus `NEEDS_MANUAL_REVIEW` (could not be
resolved from the source at all) and `REJECTED` (proven wrong, kept for audit, never rendered).

RLS enforces this structurally, not by application logic. Verified in the test database: with every
entry at `REVIEWED`, the anon role sees **0** entries, **0** attributions, **0** QA flags and **0**
raw extractions. Promoting one locus to `PUBLISHED` makes exactly that locus and its 6 attributions
visible, nothing else. The developer "include reviewed" view must therefore run over the
service-role client — never by relaxing the policy.

### Known defects in the current 20-page extraction

These import as `NEEDS_MANUAL_REVIEW` with an open `error` flag, never as trusted data:

| Page | Issue |
|---|---|
| 12, موضع ٤ ﴿لا تعبدون﴾ | حمزة and الكسائي appear under **both** أوجه. Confirmed by `qiraat_qa_partition`: 4 overlapping Riwayat, and يعقوب missing entirely. |
| 14, موضع ٥ ﴿قلوبهم العجل﴾ | خلف appears under two of the three أوجه. |
| 8, موضع ١ | The locus header reads ﴿وَعَٰدْنَا﴾ but Hafs 2:51 is ﴿وَوَٰعَدْنَا﴾ — the base-text cell looks corrupted. |
| 9, 11, 16, 19 | ~15 `؟` markers in the ترقيق الراءات and مدّ البدل cells — small print the extractor could read two ways. Flagged `source_ambiguous`. |

The extraction was made visually at 150 dpi with a scrambled text layer used only for
cross-checking. **Nothing from it should reach `VERIFIED` without a second look at the paper
original.** That is a statement about the source, not about the schema.

---

## 7. Validation already performed

The migration was executed against PostgreSQL 16.13 in this session, not merely written:

- Applies clean, and **re-applies clean** (idempotent).
- Authority expansion: `Q06` → both its narrators; `Q06-R01` → itself alone; `Q10` → its two.
- `remainder`: 1:4 مالك/ملك resolves 12 + 8 = 20 from the word «الباقون» alone, and the 8 are
  exactly عاصم، الكسائي، يعقوب، خلف العاشر.
- Mixed reader/narrator levels: 2:67 هزوا resolves 1 (حفص alone) + 15 + 4 = 20.
- `qiraat_qa_partition` flags the page-12 contradiction (2 missing, 4 overlapping) and leaves the
  two correct loci clean.
- One word, two actions: ﴿بِٱلْهُدَىٰ﴾ gives إمالة to حمزة/الكسائي/خلف العاشر and تقليل to ورش, with
  ورش's second وجه (الفتح) stored as a non-default alternate.
- `qiraat_qa_alternates` correctly ignores the legitimate ورش بخلف عنه and flags only the page-12
  defect — a second, independent detection of the same bug.
- Multi-ayah locus 1:3 → 1:4 round-trips.
- `qiraat_export_page()` emits usable fixture JSON including deduplicated الشواهد.
- RLS: anon sees nothing until `PUBLISHED` (§6).

---

## 8. Phasing to 604 pages

| Phase | Scope | Exit condition |
|---|---|---|
| **A** | Apply the migration; migrate the 79 shipped records; `SupabaseQiraatRepository` + export script. | The app renders identically off generated fixtures. Zero visual diff. |
| **B** | Re-import pages 1–20 **fully**: variants, all 24 أصول categories, الشواهد, notes, QA flags. | Every page-table row from the extraction is represented. All QA views clean or flagged. |
| **C** | Word markers for rulings + the ذو وجهين affordance; the أصول side panel. | Pages 1–20 reviewed against the paper original by the user. |
| **D** | Pages 21–604, in batches of 20, same pipeline. | Per batch: QA views clean, spot-check against the original. |

**Gate between B and C, and between C and D: the user reviews the batch against the paper original.**
Volume is not the bottleneck — attribution correctness is, and the 20-page sample already contains
two hard contradictions and ~15 ambiguous readings.

## 9. Open items

- Whether to give `route` authorities (طرق) real rows. The schema supports them (`Q0N-R0M-Txx`);
  the first 20 pages never need them. Defer until a page does.
- The current TypeScript engine cannot express a multi-ayah span or a non-default وجه. Both are
  Phase C engine work, tracked here rather than silently designed around.
- Whether a second classical source (النشر, a printed Shatibiyyah edition) becomes a required
  cross-check before `VERIFIED`, given the defect rate found in the 20-page sample.
