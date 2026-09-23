# Qiraat audit: Phase 1 of the database restructure (read-only)

**Date:** 2026-09-23 · **Base commit:** `5fca1df` (`origin/main`) · **Status:** STOP GATE 1, waiting for Amr's answers

Nothing was changed for this audit: no code, no fixture, no schema and no database row. The only new file is this document.

---

## 0. Limits of this audit (read first)

1. **The database was not queried live.** This audit ran in a Claude Code cloud container, not on the Mac mini. The self-hosted Postgres sits behind Tailscale and can't be reached from here. Every database number below comes from **the last count recorded in the repo** (changelog entries dated 2026-09-23 and `artifacts/qiraat-postgres-reconciliation.json`), and each one is labelled that way. Fixture numbers were computed directly from the files in this commit and are exact.
2. **Branch.** The prompt names `feature/mushaf-1441-module` → `feature/qiraat-db-v2`. That branch was merged into `main` on 2026-09-15 and no longer exists on the remote. This session is required to work on `claude/qiraat-db-mushaf-review-avf11e`, which is cut from current `main`. See question Q12.
3. **Scope creep warning.** The prompt assumes the qiraat data is "legacy" and needs a new schema. In fact the repo already holds a large, working Qiraat system (§1). Several D-decisions conflict with how that system stores data (mainly D8, see §3.1). The most important question in this document is **Q1: replace it or evolve it.**

---

## 1. What exists today

There are **three separate stores** of qiraat data, and they do not agree with each other.

| Store | What reads it | State |
|---|---|---|
| **A. JSON fixtures** `packages/qiraat-core/fixtures/{pages,rulings,rules}/page-NNN.json` | The live Mushaf reader (`FixtureQiraatRepository`) and `GET /api/mushaf-1441/qiraat` | **The source of truth in production.** 3,915 variants + 11,318 rulings on all 604 pages. Updated as recently as today. |
| **B. Postgres "V2 entries" model** (`qiraat_pages`, `qiraat_loci`, `qiraat_entries`, …) | Nothing in the running app. Loaded by `scripts/qiraat/import_to_postgres.py`; audited by `audit_postgres_reconciliation.py` | **Stale.** Last recorded: 12,788 entries (2,889 variants + 9,899 rulings), pages 1–239 and 245–584. It has no Susi/Duri imports and no pages 585–604, and pages 240–244 are mis-paged. |
| **C. Postgres "annotation engine"** (`quran_words`, `qiraat_annotations`, faces, variants, sources, revisions, `resolved_qiraat_cache`, batches) | The in-Mushaf editor (`/api/mushaf-1441/qiraat-editor`) and the indicator dots (`/api/mushaf-1441/qiraat-resolved`) | Live, but holds **manually entered** annotations only. The row count is not recorded in the repo. |

### 1.1 Tables and views touching qiraat

Row counts marked † are the last recorded values, not live. "?" means no count is recorded in the repo.

**Store B: V2 entries model** (`20260917120000_qiraat_v2_schema.sql`, applied 2026-09-19)

| Table / view | Purpose | Rows |
|---|---|---|
| `qiraat_authorities` | Readers + narrators (+ optional `-Tnn` routes) in one tree. IDs `Q01`…`Q10`, `Q01-R01`… | 30 (10 + 20)† |
| `qiraat_source_documents` | Source catalogue | ? (≥1: `SRC-MUSHAF-10`) |
| `qiraat_pages` | One row per **source** page, with `mushaf_page_number` | 579† |
| `qiraat_loci` | Word span: surah, start/end ayah+word, `base_text` (Hafs) | ?† (7,038 at page 244; more since) |
| `qiraat_entries` | One وجه (variant) or ruling at a locus. `kind`, `verification_status`, `attribution_mode` | **12,788†** |
| `qiraat_variant_details` | reading_text, description, `variant_type`, **`is_baseline_reading`**, performance_note | 2,889† |
| `qiraat_ruling_details` | category_code, rule_id, text_ar, options[] | 9,899† |
| `qiraat_entry_authorities` | Verbatim attribution (may be reader-level, `is_exception` for «عدا») | 38,266† |
| `qiraat_entry_readings` | Resolved narrator list (entry, narrator, action, is_default) | 44,843† |
| `qiraat_categories` | 24 category codes (§6) | 24 |
| `qiraat_rules`, `qiraat_rule_authorities` | Canonical/global أصول statements | ? |
| `qiraat_count_schools`, `qiraat_entry_count_schools` | عد الآي schools (not readers) | 7† |
| `qiraat_evidence_texts`, `qiraat_evidence_links` | الشواهد (Shatibiyya/Durra lines) | 752† / 2,374† |
| `qiraat_notes`, `qiraat_qa_flags`, `qiraat_extraction_raw` | Notes, QA flags, raw payload | 0† / ? / ? |
| Views `qiraat_readings`, `qiraat_qa_partition`, `qiraat_qa_alternates`, `qiraat_qa_blocking`, `qiraat_qa_rule_divergence` | QA | — |
| Function `qiraat_export_page(page, include_unpublished)` | Page export as fixture JSON | — |

**Store C: annotation engine** (`20260921*` migrations, applied 2026-09-21)

| Table | Purpose | Rows |
|---|---|---|
| **`quran_words`** | **Verified word-level Hafs table** (§4) | **77,429** |
| `qiraat_corpora`, `qiraat_frameworks`, `qiraat_framework_authorities` | Framework catalogues (Shatibiyya/Durra/…) | ? |
| `qiraat_authority_closure`, `qiraat_authority_colors` | Ancestor closure, default colours | ? |
| `qiraat_taxonomies` | Hierarchical taxonomy (USUL → groups → leaf rules) | ? |
| `qiraat_groups`, `qiraat_group_members` | Scholarly reader groups (intentionally empty until verified) | 0 |
| `qiraat_annotations` | Manual overlay: WORD/RANGE/BOUNDARY, target authority, INHERIT/OVERRIDE/EXCLUDE, `deleted_at`, `version` | ? |
| `qiraat_annotation_faces` / `_variants` / `_sources` / `_revisions` | Faces, per-word forms, citations, full revision history | ? |
| `resolved_qiraat_cache` | Page-indexed resolved projection | ? |
| `qiraat_batches`, `qiraat_batch_changes` | Reversible batch ledger + `rollback_qiraat_batch()` | ? |

**Superseded, never applied:** `20260916120000_qiraat_ashr_schema.sql` (`qiraat_readers`, `qiraat_narrators`, `qiraat_variants`, …). On 2026-09-19 an older prototype set (`qiraat_attributions, qiraat_targets, qiraat_variants, qiraat_loci, qiraat_sources, qiraat_persons`) was dropped from the live DB after a `pg_dump`. **Name clash:** the prompt's new `qiraat_readers`, `qiraat_narrators` and `qiraat_sources` reuse these historical names. That is harmless, but worth knowing.

**Not present:** `mushaf_pages`, `usul_categories`, `variant_locations`, `variant_readings`, `variant_reading_narrators` and `edit_log` do not exist. Page boundaries can be derived from `quran_words.page_number`. Edit history exists only for annotations (`qiraat_annotation_revisions`).

### 1.2 Code paths that read or write them

| Layer | Files | Reads / writes |
|---|---|---|
| Domain package | `packages/qiraat-core/{types,readers,narrators,readings,attribution,engine,colors,usulRegistry,symbols}.ts` | Types, the canonical 10/20 IDs + colours, rendering engine |
| Repository | `packages/qiraat-core/repository.ts` (`FixtureQiraatRepository`, `PAGE_VARIANT_LOADERS`, `PAGE_RULING_LOADERS`, `getVariantsForPage/getRulingsForPage/getRulesForPage`) | **Reads fixtures (store A)** |
| API | `src/app/api/mushaf-1441/qiraat/route.ts` | Store A |
| API | `src/app/api/mushaf-1441/qiraat-editor/route.ts` → RPCs `qiraat_editor_catalog`, `qiraat_editor_annotations`, `qiraat_editor_create/update/soft_delete_annotation` | **Writes store C** |
| API | `src/app/api/mushaf-1441/qiraat-resolved/route.ts` → `resolved_qiraat_cache` | Reads store C |
| UI | `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `qiraat/{QiraatEditor,QiraatLegend,QiraatToolbar,QiraatReferenceSheet,qiraatWordMarker,types}.tsx/ts` | Render + editor |
| Importers (write fixtures) | `scripts/qiraat/{build_variants,build_rulings,data_variants,data_rulings,import_doc_tables,import_surah_tables,import_susi,import_duri,merge_faces}.py`, `tokens.py`, `authorities.py`, `repair-q04-*.mjs`, `repair-q10-*.mjs` | Store A |
| DB loaders | `scripts/qiraat/import_to_postgres.py` (store B), `seed-canonical-words.ts` (`quran_words`), `audit_postgres_reconciliation.py` (read-only) | Stores B/C |
| Validators | `scripts/validate-qiraat-data.mjs`, `packages/qiraat-core/{validate.mjs,engine.test.mjs}`, `scripts/qiraat/validate-qiraat-frontend.mts`, `audit-qiraat-pages.mjs` | Store A |

---

## 2. Fixture data profile (store A, exact)

| Measure | Value |
|---|---|
| Variant records (فرش-type text/performance faces) | **3,915** on 601 pages |
| Ruling records (أصول occurrences) | **11,318** on 604 pages |
| Pages with no data | 0 |
| Verification status | variants: 3,911 REVIEWED, 4 NEEDS_MANUAL_REVIEW · rulings: 11,317 REVIEWED, 1 NEEDS_MANUAL_REVIEW. **Nothing is VERIFIED.** |
| Variant shapes | 2,271 single word · 815 multi-word · 829 performance-only (820 have `variantText == hafsText`) |
| Variant difference types | HARAKAH 1,526 · LETTER 1,084 · HAMZ 549 · OTHER 420 · ORTHOGRAPHY 82 · WAQF 72 · IDGHAM 46 · IMALAH 46 · MADD 41 · 11 minor types |
| Rulings spanning two ayat | 39 (e.g. الإدغام الكبير across an ayah end) |
| Max per page | 25 variants · 55 rulings |
| Narrator IDs | All 20 are valid `Qnn-R0n` codes. **No free-text narrator names** exist in the data. |
| Citations | Variants carry 7+ source families (مصحف القراءات العشر 1,276 · Susi JSON 1,203 · page-by-page DOCX 1,163 · Duri sheet 646 · surah tables …). **Only 3 rulings carry a citation.** |

---

## 3. Problems found

### 3.1 Records that list Hafs, which violates D8 (the biggest structural problem)

The current model deliberately stores **every** وجه at a locus, including the Hafs-matching group, so that the 20 narrators can be checked as a full partition. D8 forbids exactly that.

- **Store B:** every variant locus has an `is_baseline_reading = true` entry whose narrator set includes `Q05-R02`. The number of those entries isn't recorded, but it is roughly one per variant locus.
- **Store A:** 82 variant records and 44 ruling records list `Q05-R02`:
  - **Baseline-group rows** (most of the 82). `variantText == hafsText`, and the narrators are "everyone who reads like Hafs". Examples: p269 16:26 ﴿عَلَيْهِمُ﴾ (18 narrators), p422 33:33 ﴿وَقَرْنَ﴾ (18), p457 38:63 ﴿سِخْرِيًّا﴾ (18), p310 19:66 ﴿أَءِذَا﴾ (19). **D8 says drop these.**
  - **Rows that mix Hafs with non-Hafs narrators for a real difference.** Examples: p525 52:37 ﴿ٱلْمُصَيْطِرُونَ﴾ → بالسين (4 incl. Hafs), p578 76:4 ﴿سَلَاسِلَا﴾ (7 incl. Hafs), p578 75:27 ﴿مَنْ ۜ رَاقٍ﴾ (Hafs alone). These are **Hafs's own خلف/وجهان** (§5).
  - **أصول rows where Hafs genuinely performs the rule.** 29 ياءات الإضافة (e.g. ﴿بَيْتِىَ﴾ with فتح), 3 السكت (﴿عِوَجَاۜ﴾, ﴿بَلْ ۜ﴾, ﴿هِيَهْ﴾), ﴿يَلْهَث ذَّٰلِكَ﴾ and ﴿ٱرْكَب مَّعَنَا﴾ إدغام, ﴿ءَا۬عْجَمِىٌّ﴾ تسهيل. Under D8 Hafs is the baseline, so these become implied. But the narrators who **differ** from Hafs at those spots are often not stored at all. The rows describe who does the rule, not who differs from Hafs, so dropping Hafs leaves a record that no longer says what the difference is. The mapping for these needs a rule (Q4).
  - **Suspected data errors:** p588 83:14 ﴿بَلْ ۜ رَانَ﴾ is tagged `IDGHAM_KABIR` with **all 20 narrators**. Hafs does سكت there, so the record is wrong or mis-categorised. Six rulings list all 20 narrators, which means nobody differs from Hafs and, under D8, they are not variants at all.

### 3.2 Two diverging copies (fixtures vs DB)

`artifacts/qiraat-postgres-reconciliation.json` (at 12,788 fixture records) already classified: 23 fixture-only, 25 duplicate import keys, 173 key conflicts (pages 240–244 were stored under page 245, plus p564), 191 category-normalisation mismatches (pages 129–359), 62 reader-assignment mismatches (pages 19–244), and 48 DB-only entries. Since then the fixtures have grown by about 2,445 records (the Susi and Duri imports and pages 585–604) that were never loaded into the DB. **Migrating from the DB would lose data. Migrating from the fixtures would ignore 48 DB-only rows.** See Q2.

### 3.3 Duplicates and overlaps

| Check | Count | Examples |
|---|---|---|
| Exact duplicate variant (same span, text and narrators) | 1 | — |
| Same span + same form, >1 record (different notes/narrators, kept apart on purpose by today's full-key dedupe) | 12 groups | p48, p261, p522 (documented in the changelog) |
| **Same narrator in two readings at one span** (a D2 constraint violation unless it is a separate wajh) | **19 spans** | p272 16:43 (Q06-R01/R02), p536 56:58 (Q01-R01/R02), p542 58:2 (Q02-R01, Q03-R01/R02), p546 59:7 (Q04-R01), p579 76:14 and 76:15 (Q01-R01) |
| Same token + same أصول category, >1 record | 18 | p115 5:43 إمالة, p321 20:127, p597 96:7 (3 records), p323 21:16 سكت |
| Documented unresolved conflicts | 82 | `docs/qiraat-reader-dedupe-audit.json` (same-reader/action conflicts) |

### 3.4 Anchoring, labels and paging

- **Anchors:** every fixture record has surah, ayah and token, validated against the real Mushaf-1441 tokens by `npm run qiraat:validate`. **No unanchored rows** exist in the fixtures. The exceptions are the **51 rulings with `wordAnchored: false` and no narrators**: 51 `AYAH_COUNT` records attributed to counting schools (المكي/الكوفي/…), not narrators. These don't fit the proposed schema (Q7).
- **Token ≠ `quran_words` word:** fixture `startToken` counts page tokens, while `quran_words.word_position` counts words in the ayah. They are equal for normal words, but the importer must map through `current_mushaf_word_id`. Any record that can't be mapped goes to `migration_exceptions`, as the prompt says.
- **Mislabelled readers/narrators:** the systematic error was the bare «خلف» (Q06-R01) being read as خلف العاشر (Q10). It was corrected across pages 225–584 (792 assignments) on 2026-09-22. Of the 62 reader mismatches in store B (§3.2), some are pre-correction leftovers in the DB. Reader-level attributions (`Q06`, `Q07`, …; 3,953 of them in `attribution`) are always expanded to both narrators in `readings`. The new schema should store only the narrator-level list.
- **Page numbers:** the fixture page equals the Madani 1441 page, validated. Store B has the pages 240–244 → 245 error (§3.2). Source-PDF page numbers are kept separately (`pdfPage`, offset about +5) and are not Mushaf pages.
- **Mixed فرش/أصول:** 829 "performance variants" sit in the variants (فرش) store but describe أصول phenomena (إشمام, إمالة, إدغام, سكت, تسهيل), with `differenceType` IMALAH 46, IDGHAM 46, MADD 41, HAMZ 549 (many), WAQF 72. Store B has 191 category-normalisation mismatches. Classifying these needs a rule (Q6).

### 3.5 Other gaps against the prompt

- **Biographical fields** (kunya, death year, city, chain): none exist anywhere in the repo. They will be NULL, as instructed (Q11).
- **Sync columns** (`updated_at`, `deleted_at`, `device_id`): only `qiraat_annotations` has `updated_at` + `deleted_at`, and nothing has `device_id`.
- **Edit log:** only for annotations (`qiraat_annotation_revisions`). Nothing exists for loci or entries.
- **Routes (turuq):** the `qiraat_authorities` ID check allows `-Tnn` route IDs. No route rows are known to exist (count them on the Mac mini before Gate 2).

---

## 4. Verified word-level Hafs table: **it exists** (no stop needed)

`quran_words` (store C) holds 77,429 rows with `surah, ayah, word_position, canonical_key (SSS:AAA:WWW), current_mushaf_word_id, page_number (1–604), line_number (1–15), text_uthmani`, plus `source_revision = 'mushaf1441-page-fixtures-v1'`.

- **Origin:** `packages/quran-data/mushaf1441/fixtures/page-words/page-NNN.json`, imported from the quran.com v4 `verses/by_page` API (King Fahd Complex 1441 Madani layout, QCF V2 glyphs). It was re-placed by each word's own page/line on 2026-09-15 and is checked by the 7 `npm run mushaf:validate` validators.
- **Text form:** Uthmani with small alef-wasla and pause marks. Some tokens carry a trailing waqf sign (e.g. `بَلْ ۜ`), so text comparisons must use `normalizeArabic`.
- **Checksum for gate 5:** compute `md5(string_agg(canonical_key||text_uthmani, '|' ORDER BY canonical_key))` on the Mac mini before and after the migration. It can't be computed here.
- **Confirmation needed (Q3):** that this quran.com-sourced table is the "approved verified Hafs source" in the sense of the prompt.

---

## 5. Hafs's own multiple wujuh (min al-Shatibiyya)

These were found in, or are missing from, the data. **No modelling decision was made.**

| Locus | Hafs's wujuh | Current data |
|---|---|---|
| الروم 30:54 ﴿ضَعْفٍ﴾ ×3 | فتح الضاد / ضمّها | **Missing** (no variant or ruling on those tokens) |
| الطور 52:37 ﴿ٱلْمُصَيْطِرُونَ﴾ | صاد / سين | Variant «بالسين» lists Hafs (4 narrators) + a second صاد variant |
| الغاشية 88:22 ﴿بِمُصَيْطِرٍ﴾ | صاد (Hafs has one wajh here) | 4 variant records, overlapping |
| يوسف 12:11 ﴿تَأْمَنَّا﴾ | إشمام / روم (اختلاس) | 2 records, **Hafs not listed** |
| الأنعام 6:143–144 ﴿ءَآلذَّكَرَيْنِ﴾, يونس 10:51, 91 ﴿ءَآلْـَٔـٰنَ﴾, 10:59 / النمل 27:59 ﴿ءَآللَّهُ﴾ | إبدال مع المد / تسهيل (all readers) | **Missing** as HAMZATAN; only مد البدل tagged |
| الإنسان 76:4 ﴿سَلَـٰسِلَا۟﴾ (وقفًا) | إثبات الألف / حذفها | Variant lists Hafs among 7 |
| القيامة 75:27 ﴿مَنْ ۜ رَاقٍ﴾, المطففين 83:14 ﴿بَلْ ۜ رَانَ﴾, الكهف 18:1 ﴿عِوَجَاۜ﴾, يس 36:52 ﴿مَّرْقَدِنَا ۜ﴾ | السكت (Hafs obligatory, others differ) | Stored as Hafs-positive rows; 83:14 also mis-tagged إدغام ×20 |
| الحاقة 69:28–29 ﴿مَالِيَهْ ۜ هَلَكَ﴾ | سكت / إدغام | Only an IDGHAM_KABIR row (1 narrator) |
| الأعراف 7:176 ﴿يَلْهَث ذَّٰلِكَ﴾, هود 11:42 ﴿ٱرْكَب مَّعَنَا﴾ | إدغام (Hafs) vs إظهار (others with خلف) | Stored as Hafs-positive إدغام rows |
| فصلت 41:44 ﴿ءَا۬عْجَمِىٌّ﴾ | تسهيل (Hafs's only wajh) | Hafs-positive row (17 narrators) |
| البقرة 2:245 ﴿وَيَبْصُۜطُ﴾, الأعراف 7:69 ﴿بَصْۜطَةً﴾ | سين / صاد per Hafs's turuq | Variant "بالصاد" without Hafs |

---

## 6. أصول categories: existing vs prompt

| Existing code (count in fixtures) | Prompt category |
|---|---|
| IMALAH_TAQLIL (2,864) | الإمالة والتقليل |
| TAGHYIR_HAMZ (1,373) | الهمز المفرد |
| IDGHAM_KABIR (1,236) | الإدغام الكبير |
| MADD_BADAL (1,142), MADD_LIN (193) | المد والقصر |
| TARK_GHUNNA (916), IKHFA (263) | *(not listed)* |
| TARQIQ_RA (857) | الراءات |
| WAQF_HAMZA (659) | *(not listed; closest is الهمز المفرد)* |
| SILAT_HA (413) | هاء الكناية |
| IDGHAM_SAGHIR (285) | الإدغام الصغير |
| SAKT (206) | السكت |
| YAAT_IDAFA (205) | ياءات الإضافة |
| TAGHLIZ_LAM (204) | اللامات |
| YAAT_ZAWAID (122) | ياءات الزوائد |
| WAQF_RASM (121) | الوقف على المرسوم |
| HAMZATAN_KALIMATAYN (110), HAMZATAN_KALIMA (40) | الهمزتان (one category or two?) |
| MEEM_JAM (57) | ميم الجمع |
| NAQL (1) | *(not listed; النقل is usually under الهمز المفرد)* |
| AYAH_COUNT (51) | *(not a reader difference: counting schools)* |
| (store B only) BAYN_SURATAYN, MADD_QABL_IDGHAM, USUL_* | *(page/global rules)* |

---

## 7. Proposed old → new column mapping

This assumes the prompt's schema as written, migrating **from the fixtures** (store A), with store B used only to recover its 48 DB-only rows. Items marked **Q** depend on a question.

| New column | From | Notes |
|---|---|---|
| `qiraat_readers.code` | `Q01`…`Q10` | **Q5:** keep `Q01` or switch to `NAF`. `Q01` is baked into 15k records, CSS tokens `--q01-*`, tests and colours. |
| `qiraat_narrators.code` | `Q01-R01`…`Q10-R02` | Same (Q5). The two الدوري are already distinct: `Q03-R01` / `Q07-R02`. |
| `qiraat_narrators.source_id` | Q01–Q07 → الشاطبية, Q08–Q10 → الدرة | — |
| `variant_locations.word_start_id/word_end_id` | (`surah`,`ayah`,`startToken`) / (`endAyah`,`endToken`) → `quran_words.id` via `current_mushaf_word_id` | Unmappable → `migration_exceptions` |
| `…surah/ayah/page` | `surah`, `ayah`, file page | Denormalised |
| `…kind` | variants → `farsh`, rulings → `usul` | **Q6:** 829 performance variants |
| `…usul_category_id` | `category` → `usul_categories` | **Q6/Q7** |
| `…hafs_form` | `hafsText` / `baseText` | Verbatim from the Mushaf tokens already, never retyped |
| `…note` | `notes`, `sourceNotes`, `verificationNotes`, `performanceNote` | Concatenate or keep separate? (prompt has one field) |
| `…review_status` | all → `unreviewed`; NEEDS_MANUAL_REVIEW (5) → **`flagged`?** (Q8) | — |
| `…legacy_ref` | fixture `id` (+ page file) | e.g. `v-L011-فهي-1-w2` |
| `variant_readings.text` | `variantText` (farsh) · for rulings: the distinct `action` values | One ruling with إمالة for some narrators and تقليل for others → **two readings** |
| `variant_readings.description` | `differenceType` label + `performanceNote` / `action` | — |
| `variant_reading_narrators` | `readingIds` · rulings `readings[].readingId` | Drop `Q05-R02` (D8, Q4). `isDefault=false` / `hasAlternate` → `wajh_order` 2 + `wajh_note` |
| *(none)* | `sources[]` (citations) | **Q9:** the prompt has no sources table, so citations would be lost |
| *(none)* | الشواهد (`sourceText`, store B evidence tables) | Q9 |
| *(none)* | store C annotations | **Q10** |

---

## 8. Numbered questions for Amr

These block Gate 2. The first four are also asked in the chat popup.

- **Q1: Strategy.** Build the prompt's new tables (`variant_locations` …) and retire today's qiraat tables, or **evolve the existing V2 model**, adding D8 enforcement, `edit_log`, `review_status`, sync columns and the review screen? *Recommendation: evolve. Renaming the live `qiraat_*` tables to `_legacy` would break the in-Mushaf editor and the indicator dots, which call RPCs on them.*
- **Q2: Source of truth for the migration.** Fixtures (complete, used by production), the DB (stale), or fixtures plus the 48 DB-only rows sent for review? *Recommendation: fixtures + DB-only rows as `flagged`.*
- **Q3:** Is `quran_words` (quran.com v4 / KFGQPC 1441 import, 77,429 words) the approved verified Hafs source?
- **Q4: D8 on existing rows.** Drop the pure baseline-group rows (e.g. 16:26 ﴿عليهم﴾ 18 narrators) automatically, and send the 44 Hafs-positive أصول rows plus the mixed rows to `flagged` for manual rewriting? Or flag everything, or drop everything?
- **Q5: Codes.** Keep `Q01`/`Q01-R01`, or introduce `NAF`/`NAF-QAL` (as the display code only, or as the key)?
- **Q6:** Classify the 829 performance-only variants as `usul` (with a category inferred from the description, flagged when unsure), or keep them as `farsh`?
- **Q7:** `AYAH_COUNT` (51, counting schools) and page-level rules (بين السورتين, global أصول): a separate table, keep in the legacy tables, or send to `migration_exceptions`?
- **Q8:** `NEEDS_MANUAL_REVIEW` → `flagged`? Same question for the 82 documented reader conflicts and the 19 same-narrator overlaps.
- **Q9:** Add a `variant_sources` table (citation plus شاهد) so the 4,800+ citations survive, or drop citations?
- **Q10:** The annotation engine (store C): keep it as is, migrate its annotations into the new model, or retire it?
- **Q11:** Biographical fields: which source should supply them (e.g. غاية النهاية لابن الجزري via the Shamela library tool), or leave them NULL until you supply them?
- **Q12: Where to work.** This session can't reach the DB. Should Phases 2–3 SQL be written here and applied later on the Mac mini, or should the work move to a Mac mini session? Which branch name?
- **Q13:** Model Hafs's wujuh (§5). Options: (a) allow `ASM-HAF` in `variant_reading_narrators` only with `wajh_order ≥ 2`, (b) a separate `hafs_wujuh` table, or (c) ignore them (Hafs = the printed wajh only).
- **Q14:** Usul category list (§6): keep TARK_GHUNNA/IKHFA/WAQF_HAMZA/NAQL as their own categories? Merge the two الهمزتان categories?

---

## 9. Decisions recorded at Gate 1 (2026-09-23)

| Q | Answer from Amr |
|---|---|
| Q1 | **Build on the existing V2 model** (`qiraat_loci` / `qiraat_entries` / `qiraat_entry_readings` …), not a parallel set of new tables. Add D8 enforcement, `edit_log`, `review_status`, sync columns and the review screen. New names such as `variant_locations` may be exposed as views. No `_legacy` renames. |
| Q2 | **Migrate from the JSON fixtures, plus the ~48 rows that exist only in Postgres**, which go in as `flagged`. |
| Q4 | **Drop the pure agrees-with-Hafs group rows automatically** and log each drop in the migration report. Hafs-positive أصول rows and mixed rows go to `flagged` for manual rewrite. |
| Q5 | **Keep `Q01` / `Q01-R01` as the keys.** Add a display-code column (`NAF`, `NAF-QAL`, …). |

Consequences of Q1 (these no longer need separate answers):

- **Q9:** the existing `qiraat_evidence_texts`/`qiraat_evidence_links` and source tables stay, so citations and الشواهد are kept.
- **Q10:** the annotation engine stays as it is.
- **Q7:** `AYAH_COUNT` stays in the existing count-school tables and is outside the review table.

Defaults I'll use unless told otherwise: **Q8** `NEEDS_MANUAL_REVIEW` → `flagged`; **Q11** biographical fields stay NULL; **Q14** keep the existing category codes and add the display grouping from §6.
