# Qiraat Database & New Source Discovery Report (Milestone M0)

**Date:** 2026-09-24  
**Auditor / Agent:** Antigravity (Advanced Agentic Pair Programmer)  
**Project:** Mutshabehat V2 — Ten Minor Qiraat Subsystem (القراءات العشر الصغرى)  
**Repository Working Copy:** `/Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2`  
**Git Branch & Commit:** `feature/qiraat-db-v2` at `fe22394` (clean working tree)  
**Database:** PostgreSQL 17.10 on aarch64 (`mutshabehat-db:5433`)  
**Production URL:** https://mutshabehat-v2.vercel.app  
**External Volume:** `/Volumes/External Mini` (1.7 TiB available, 8% used)  

---

## 1. Repository Map

The Qiraat architecture adheres strictly to Clean Architecture principles with clear separation of Domain, Application, Adapter, and Infrastructure layers.

### 1.1 Domain Layer (`packages/qiraat-core`)
Located in [packages/qiraat-core/](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/):
- **[types.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/types.ts)**: Core type system defining `ReaderId` (`Q01`–`Q10`), `NarratorId` (`Q01-R01`–`Q10-R02`), `QiraatVariant`, `QiraatLocus`, `QiraatEntry`, `UsulCategoryCode`, and verification statuses.
- **[readers.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/readers.ts)**: Immutable registry of the 10 canonical readers with permanent IDs, Arabic names, slugs, and color codes.
- **[narrators.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/narrators.ts)**: Immutable registry of the 20 narrators (two per reader) with distinct IDs preventing collision (e.g. `Q03-R01` الدوري عن أبي عمرو vs `Q07-R02` الدوري عن الكسائي).
- **[readings.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/readings.ts)**: Reading authority resolution helpers and attribution expansion.
- **[colors.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/colors.ts)**: Canonical hex colors for all 30 authorities; derived programmatically from domain constants, never parsed ad-hoc.
- **[symbols.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/symbols.ts)**: Comprehensive dictionary of Matn Shatibiyyah and Durrah individual and group symbols (أ, ج, د, صحبة, سما, etc.) with matn-aware disambiguation.
- **[usulRegistry.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/usulRegistry.ts)**: Controlled registry mapping raw source labels and categories to 22 standardized Usul rule definitions (e.g. `IMALAH_TAQLIL`, `USUL_NAQL`, `SILAT_HA`, `YAAT_IDAFA`).
- **[engine.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/engine.ts)**: Pure, deterministic Qiraat Rendering Engine. Evaluates variants and rulings per token without DOM dependencies.
- **[repository.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/repository.ts)**: Abstract repository interface and in-memory/database implementations.
- **[qiraatAdapter.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/qiraatAdapter.ts)**: Data translation between database schemas and rendering engine domain structures.

### 1.2 Loaders, Validators & Test Suites
- **[packages/qiraat-core/validate.mjs](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/validate.mjs)**: Schema validator verifying fixture JSON integrity.
- **[packages/qiraat-core/engine.test.mjs](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/packages/qiraat-core/engine.test.mjs)**: 42KB comprehensive test suite covering rendering engine logic, symbol resolution, and authority expansion.
- **[scripts/qiraat/validate-qiraat-frontend.mts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/scripts/qiraat/validate-qiraat-frontend.mts)**: Frontend verification script checking client rendering contracts.
- **[scripts/validate-qiraat-data.mjs](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/scripts/validate-qiraat-data.mjs)**: Cross-corpus integrity validator.
- **[tests/qiraat/review-workstation.test.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/tests/qiraat/review-workstation.test.ts)**: 19 unit & component test suites verifying workstation state machine and 1-click actions.
- **[tests/qiraat/review-http.test.ts](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/tests/qiraat/review-http.test.ts)**: Integration tests verifying HTTP RPC endpoints and security guards.

### 1.3 Ingestion & Build Scripts (`scripts/qiraat/`)
Located in [scripts/qiraat/](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/scripts/qiraat/):
- **`import_to_postgres.py`**: Legacy reconciliation and database importer. Contains normalization and deduplication routines (`consolidate_duplicate_variant_faces`, `disambiguated_variant_id`, `DIFF_INV`, `CATEGORY_INV`).
- **`tokens.py`**: Unicode Arabic text normalization and token comparison utilities (`norm`).
- **`authorities.py`**: Python mappings of Qiraat authority DAG and codes.
- **`build_variants.py` & `build_rulings.py`**: Extractors parsing raw fixtures into structured tables.
- **`phase3/`**:
  - `plan.py`: Computes minimal atomic SQL diffs for loci merging and rule reclassification.
  - `emit_sql.py`: Emits deterministic, single-transaction SQL scripts with `edit_log` fidelity.
  - `snapshot.py`: Read-only database snapshot utility.

### 1.4 User Interfaces & API Endpoints
- **Mushaf Viewer**: [src/app/mushaf-1441/](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/src/app/mushaf-1441/) (Page viewer displaying Hafs text with interactive Qiraat markers).
- **Review Workstation**: [src/app/mushaf-1441/review/page.tsx](file:///Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2/src/app/mushaf-1441/review/page.tsx) (Redesigned high-speed review interface with 1-click triage, status transitions, narrator overrides, and atomic undo).
- **API Routes**:
  - `/api/mushaf-1441/qiraat`: Fetches raw loci and entry bundles.
  - `/api/mushaf-1441/qiraat-resolved`: Returns resolved markers for the active reader/narrator.
  - `/api/mushaf-1441/qiraat-review`: Authenticated RPC proxy routing review actions (`overview`, `page`, `row`, `set_status`, `set_narrators`, `update_entry`, `delete_entry`, `restore_entry`, `undo`, `history`).

---

## 2. Database Map (`mutshabehat-db:5433`)

The live PostgreSQL 17 database contains 35 specialized `qiraat_*` tables and the immutable Hafs baseline.

### 2.1 Core Schema & Constraints
```
quran_words (77,429 rows, read-only)
     │
     ▼ (surah, ayah, word_position)
qiraat_loci (14,270 rows) ──◄ qiraat_pages (604 rows)
     │
     ▼ (locus_id)
qiraat_entries (15,294 rows)
     ├──► qiraat_variant_details (3,625 rows) [kind = 'variant' / فرش]
     ├──► qiraat_ruling_details (11,669 rows) [kind = 'ruling' / أصول]
     ├──► qiraat_entry_authorities (70,579 rows) [verbatim attributions]
     ├──► qiraat_entry_readings (49,587 rows) [narrator-expanded Q01-R01..Q10-R02]
     └──► qiraat_entry_count_schools (130 rows) [AYAH_COUNT only]
```

### 2.2 Table Inventory & Row Counts
| Table Name | Live Rows | Status & Notes |
| :--- | :--- | :--- |
| `quran_words` | **77,429** | Immutable Hafs baseline (MD5: `52839d155fd0f90f999822a43e8198f5`). Zero edits permitted. |
| `qiraat_pages` | **604** | Master Mushaf pages (1 to 604 contiguous). |
| `qiraat_loci` | **14,270** | Madani 1441 text loci (13,255 active, 1,015 soft-deleted with `deleted_at IS NOT NULL`). |
| `qiraat_entries` | **15,294** | 15,288 active entries, 6 soft-deleted entries. |
| `qiraat_variant_details` | **3,625** | Farsh details (`reading_text`, `uthmani_text`, `variant_type`). |
| `qiraat_ruling_details` | **11,669** | Usul details (`category_code`, `rule_id`, `text_ar`, `options`). |
| `qiraat_entry_authorities` | **70,579** | Verbatim attributions (`authority_id`, `action_ar`, `is_exception`, `is_default`, `wajh_order`). |
| `qiraat_entry_readings` | **49,587** | Trigger-expanded narrator readings (`entry_id`, `reading_id`, `action_ar`, `wajh_order`). |
| `qiraat_authorities` | **30** | 10 readers (`Q01`–`Q10`) + 20 narrators (`Q01-R01`–`Q10-R02`). |
| `qiraat_authority_closure` | **50** | DAG transitive closure for authority hierarchy. |
| `qiraat_authority_colors` | **30** | Canonical color hex definitions for all 30 authorities. |
| `qiraat_categories` | **24** | Controlled Usul categories. |
| `qiraat_count_schools` | **8** | Classical ayah-counting schools (Madani 1/2, Makki, Shami, etc.). |
| `qiraat_entry_count_schools`| **130** | Associations for the 51 `AYAH_COUNT` loci. |
| `qiraat_evidence_texts` | **1,221** | Poetic text lines (Matn Shatibiyyah, Durrah, Tayyibah). |
| `qiraat_evidence_links` | **2,402** | Evidence links binding poetic lines to pages and loci. |
| `qiraat_qa_flags` | **934** | QA audit tracking flags (932 open, 2 resolved). |
| `edit_log` | **109,608** | Transaction audit trail with before/after JSON deltas and undo support. |
| `qiraat_source_documents` | **21** | Catalog of scholarly reference sources (`SRC-MUSHAF-10`, etc.). |
| `resolved_qiraat_cache` | **1** | Cached resolved indicators. |

### 2.3 Key Database Triggers & Business Rules
1. **Rule D8 Trigger (`trg_enforce_rule_d8`)**:
   - Hafs (`Q05-R02`) represents the baseline `quran_words`. Differences from Hafs are recorded as variants.
   - Non-flagged entries must **never** list Hafs with `wajh_order = 1`.
   - If Hafs is present at a locus, it must have `wajh_order >= 2` accompanied by an explicit `wajh_note`.
2. **Duplicate Narrator Prevention (`trg_prevent_duplicate_narrator_per_locus`)**:
   - Enforces narrator uniqueness per locus to eliminate conflicting duplicate faces.
3. **Soft-Delete Architecture**:
   - Records are never physically deleted (`DELETE`); they are soft-deleted via `deleted_at = now()`.
   - Every mutation records a reversible JSON diff in `edit_log`.
4. **Security & RLS**:
   - 100% of tables (58/58) have `rowsecurity = true`.
   - User-facing tables have public `SELECT` policies.
   - Admin tables (`edit_log`, `qiraat_editors`, `qiraat_qa_flags`) have 0 policies, restricting mutations exclusively to `SECURITY DEFINER` RPCs requiring `qiraat_require_editor()`.

---

## 3. Existing DB Profile vs. New Source Comparison

### 3.1 Existing Data Profile
- **Corpus Coverage**: 604 pages, 114 surahs (113 containing loci; Surah 112/Al-Ikhlas has no differences in the ten minor readings).
- **Variant Breakdown**: 3,625 Farsh variants vs 11,669 Usul rulings (total 15,294 entries).
- **Quality Status**: 14,413 unreviewed, 881 flagged for editorial triage, 0 confirmed reviewed.
- **Anchoring Accuracy**: 100.00% of start and end words match `quran_words` exactly (0 orphaned words, 0 page mismatches).

### 3.2 What the New Source Brings vs Existing DB
The new source ("مصحف القراءات العشر المتواترة بالألوان الميسرة", `BOOK_27159_1.pdf`) and the existing database complete each other; neither is master:

| Capability / Dimension | New Source (`BOOK_27159_1.pdf`) | Existing Database (`mutshabehat-db`) | Combined Synergy |
| :--- | :--- | :--- | :--- |
| **Farsh Variants** | Complete marginal notes with clear reading attributions | 3,625 entries, with 881 flagged conflicts | Reconciles ambiguous readings and fills missing variants |
| **Usul Rules** | Systematically color-coded text for all major Usul (Imalah, Naql, Idgham, Madd, Silah) | 11,669 rulings, 829 classified performance variants | Validates classified performance variants against visual ground truth |
| **Hafs Token Anchoring** | Word tokens are visual / unnumbered (token numbers in source are unreliable) | 77,429 canonical Madani 1441 tokens strictly indexed in `quran_words` | New source readings anchor to existing DB tokens by text matching (`norm(hafsText)`) |
| **Scholarly Evidence** | Concise margins without poetic Matn citations | 1,221 Matn Shatibiyyah, Durrah, and Tayyibah lines linked via 2,402 evidence links | Preserves deep poetic grounding while updating entry clarity |
| **Audit & Versioning** | Static printed text | 109,608 transaction logs in `edit_log` with 1-click rollback | Keeps full history; additions from new source will be logged additively |

### 3.3 Authority Identifier Mapping Matrix (Old ↔ New)

Both systems use identical canonical structures for the 10 readers and 20 narrators:

| Reader ID | Canonical Reader | Narrator 1 ID | Narrator 1 Name | Narrator 2 ID | Narrator 2 Name | Shatibiyyah / Durrah Symbols | Canonical Color |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Q01** | نافع المدني | `Q01-R01` | قالون | `Q01-R02` | ورش | أ (نافع), ب (قالون), ج (ورش) | `#2563EB` |
| **Q02** | ابن كثير المكي | `Q02-R01` | البزي | `Q02-R02` | قنبل | د (ابن كثير), هـ (البزي), ز (قنبل) | `#16A34A` |
| **Q03** | أبو عمرو البصري | `Q03-R01` | الدوري عن أبي عمرو | `Q03-R02` | السوسي | ح (أبو عمرو), ط (الدوري), ي (السوسي) | `#0891B2` |
| **Q04** | ابن عامر الشامي | `Q04-R01` | هشام | `Q04-R02` | ابن ذكوان | ك (ابن عامر), ل (هشام), م (ابن ذكوان) | `#7C3AED` |
| **Q05** | عاصم الكوفي | `Q05-R01` | شعبة | `Q05-R02` | حفص | ن (عاصم), ص (شعبة), ع (حفص) | `#EA580C` |
| **Q06** | حمزة الكوفي | `Q06-R01` | خلف عن حمزة | `Q06-R02` | خلاد | ف (حمزة), ض (خلف), ق (خلاد) | `#DC2626` |
| **Q07** | الكسائي الكوفي | `Q07-R01` | أبو الحارث | `Q07-R02` | الدوري عن الكسائي | ر (الكسائي), س (أبو الحارث), ت (الدوري) | `#DB2777` |
| **Q08** | أبو جعفر المدني | `Q08-R01` | ابن وردان | `Q08-R02` | ابن جماز | أ (أبو جعفر - درة), ب (ابن وردان), ج (ابن جماز) | `#CA8A04` |
| **Q09** | يعقوب الحضرمي | `Q09-R01` | رويس | `Q09-R02` | روح | ح (يعقوب - درة), ط (رويس), ي (روح) | `#B45309` |
| **Q10** | خلف العاشر | `Q10-R01` | إسحاق | `Q10-R02` | إدريس | ف (خلف - درة), ض (إسحاق), ق (إدريس) | `#475569` |

---

## 4. Query & Highlighting Architecture

### 4.1 Viewer Application (`/mushaf-1441`)
1. **Data Hydration**:
   - The client fetches page data via `/api/mushaf-1441/qiraat?page=NNN` (fetching active loci and entries) and `/api/mushaf-1441/qiraat-resolved?page=NNN`.
   - Data is pre-cached in `resolved_qiraat_cache` for sub-millisecond response.
2. **Deterministic Evaluation (`engine.ts`)**:
   - For every word token `(surah, ayah, word_position)`, the engine calls `variantsForToken(variants, surah, ayah, token)`.
   - When a reader or narrator is selected in the UI dropdown, `resolveTokenForReading()` calculates the display text and operation (`KEEP`, `REPLACE`, `DIACRITIC_CHANGE`, etc.).
   - Rulings are resolved via `rulingMarkerForWord()` querying `USUL_RULE_REGISTRY`.
   - Tokens with active differences receive CSS highlight classes styled with canonical authority colors.

### 4.2 Review Workstation (`/mushaf-1441/review`)
1. **Atomic Data Fetching**:
   - Calls PostgreSQL procedure `qiraat_review_page(p_page, p_include_deleted)`.
   - Returns all words for the page joined with loci, entries, readings, flags, and authorities in a single payload.
2. **High-Speed Word-Centric Interaction**:
   - Words are rendered as clickable buttons. Tokens containing differences display badge counts and color markers.
   - Clicking a word immediately populates the side panel with only the entries anchored to that specific word.
   - Reviewers can change status (`VERIFIED`, `REJECTED`, `FLAGGED`), modify narrator sets, soft-delete or restore entries, and trigger instant undo (`qiraat_review_undo`) in 1 click without modals or multi-step menus.

---

## 5. Environment, Storage & Git Status

### 5.1 Storage & Computing Environment
- **Host**: Mac mini (Apple Silicon M-series, aarch64), Hostname `amr-Mac-mini.local`.
- **Primary Storage**: `/Volumes/External Mini` (2.0 TB physical APFS volume, **1.7 TiB free**, ~8% utilized).
- **Storage Strategy**: All heavy data processing, raw PDF extractions, test databases, and intermediate staging JSON files will reside on `/Volumes/External Mini/` to preserve internal SSD health.

### 5.2 Git Status & Working Copy of Record
- **Working Tree**: `/Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2`
- **Branch**: `feature/qiraat-db-v2` at commit `fe22394` (`feat(qiraat-review): redesign review page as high-speed workstation`).
- **Working Copy State**: Clean working tree, fully synced with `origin/main`.

### 5.3 Live Production & Staging Isolation
- **Production URL**: `https://mutshabehat-v2.vercel.app` (Tailscale Funnel to `mutshabehat-db:5433`).
- **Safety Directive**: Strict read-only during discovery. Zero direct writes or schema alterations to production. All ingestion pipeline tests will run in an isolated STAGING environment first.

### 5.4 Fixture Inbox Status
- **Directory**: `~/qiraat-inbox/fixtures/`
- **Status**: Directory pending rsync transfer from MacBook Air (`/Users/amrelshazly/.gemini/users/user1/packages/qiraat-core/fixtures/`).
- **Action Plan**: Once transferred, the ingestion pipeline will consume fixtures into staging without modifying source files.

---

## Milestone M0 Completion Summary
Milestone M0 Discovery is complete. All existing tables, triggers, constraints, codebase structures, and storage parameters have been inspected in read-only mode without modifying production data or application code.
