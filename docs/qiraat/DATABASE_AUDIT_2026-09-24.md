# Qiraat Database Audit (Phase 4 Live Environment)

**Audit Date:** 2026-09-24  
**Auditor:** Antigravity (Advanced Agentic Pair Programmer)  
**Database:** PostgreSQL 17.10 on aarch64-unknown-linux-musl (`mutshabehat-db:5433`)  
**Access Mode:** Read-Only (`PGOPTIONS='-c default_transaction_read_only=on'`)  
**Context:** Full post-Phase 3 migration schema and data verification prior to Task 2 production promotion.

---

## 1. Executive Summary

This comprehensive, non-destructive audit inspects the live PostgreSQL 17 database supporting Mutshabehat V2 and its Ten Minor Readings (القراءات العشر الصغرى) system following the completion of Phase 3 bulk migration on 2026-09-23.

### Key Audit Findings:
1. **Core Hafs Corpus Integrity (D8 & Q3):**
   - `quran_words` contains exactly **77,429 rows** with MD5 checksum `52839d155fd0f90f999822a43e8198f5`.
   - **0** modifications have occurred; the table remains strictly read-only and unmutated.
2. **Loci Word Anchoring & Page Alignment:**
   - **14,270** total loci in `qiraat_loci` (13,255 active, 1,015 soft-deleted).
   - **0** unmatched start words against `quran_words`.
   - **0** unmatched end words against `quran_words`.
   - **0** page mismatches: every locus start word aligns 100.00% with `qiraat_pages.mushaf_page_number`.
3. **Orphan & Integrity Analysis:**
   - **0 active empty loci**: The 1,015 loci without entries are 100% soft-deleted (`deleted_at IS NOT NULL`), preserved from Phase 3 locus merges and drops for complete audit trail / undo fidelity in `edit_log`.
   - **0 entries without loci**: Referential integrity between entries and loci is 100%.
   - **0 variant entries without details**, **0 ruling entries without details**.
   - Exactly **51 entries** have no entries in `qiraat_entry_readings`: all 51 are `category_code = 'AYAH_COUNT'` (عد الآي), correctly anchored to `qiraat_entry_count_schools` (130 associations across 8 counting schools). Active entries without either a reading or a count school: **0**.
4. **Row Level Security (RLS) Coverage:**
   - **58 of 58** public tables have `rowsecurity = true` enabled.
   - **80** RLS policies are active.
   - 6 tables (`edit_log`, `qiraat_editors`, `qiraat_extraction_raw`, `qiraat_qa_flags`, `quiz_choices`, `quiz_questions`) have RLS enabled with 0 policies, intentionally restricting all operations to `service_role` and SECURITY DEFINER RPCs.
5. **Foreign Key Indexing & Performance:**
   - **32 foreign key constraints** lack indexing on child tables (including `qiraat_qa_flags.entry_id`, `qiraat_qa_flags.locus_id`, `qiraat_annotations.end_word_id`, and `edit_log.undo_of`).

---

## 2. Live Inventory & Row Counts

### 2.1 Qiraat Core & V2 Review Model (Store B)
| Table | Rows | Purpose / Status |
| :--- | :--- | :--- |
| `qiraat_pages` | **604** | Master Mushaf page registry (pages 1–604 contiguous) |
| `qiraat_loci` | **14,270** | Madani 1441 text loci (13,255 active; 1,015 soft-deleted) |
| `qiraat_entries` | **15,294** | Distinct readings/rulings (15,288 active; 6 soft-deleted) |
| `qiraat_variant_details` | **3,625** | Farsh details (reading text, variant type, baseline flag) |
| `qiraat_ruling_details` | **11,669** | Usul details (category code, rule id, action text, options) |
| `qiraat_entry_authorities` | **70,579** | Verbatim source attributions (readers, narrators, exceptions) |
| `qiraat_entry_readings` | **49,587** | Trigger-expanded narrator readings (`Q01-R01` … `Q10-R02`) |
| `qiraat_entry_count_schools` | **130** | Associations for the 51 `AYAH_COUNT` loci |
| `qiraat_authorities` | **30** | 10 canonical readers (`Q01`–`Q10`) + 20 narrators (`R01`, `R02`) |
| `qiraat_authority_closure` | **50** | Authority DAG transitive closure |
| `qiraat_authority_colors` | **30** | Canonical color assignments for all 30 authorities |
| `qiraat_categories` | **24** | Usul category definitions |
| `qiraat_count_schools` | **8** | Classical ayah-counting schools (Madani 1/2, Makki, Shami, etc.) |
| `qiraat_evidence_texts` | **1,221** | Poetic text lines (Matn Shatibiyya, Durra, Tayyiba) |
| `qiraat_evidence_links` | **2,402** | Evidence links tying poetic lines to pages and loci |
| `qiraat_qa_flags` | **934** | QA audit tracking flags (932 open, 2 verified/resolved) |
| `edit_log` | **109,608** | Transaction-level audit trail with JSON delta and undo capability |
| `qiraat_editors` | **1** | Authenticated review editors (`ec34e9cc-7c98-4180-86ce-2b80ac34646e`) |
| `qiraat_source_documents` | **21** | Source reference catalogue |
| `qiraat_rules` / `_rule_authorities` | **6** / **2** | Canonical rule definitions |
| `qiraat_taxonomies` | **40** | Hierarchical Usul taxonomy structure |
| `qiraat_notes` | **0** | Editorial notes (clean) |
| `qiraat_extraction_raw` | **0** | Intermediate staging storage (clean) |

### 2.2 Annotation Engine & Hafs Foundation (Store C)
| Table | Rows | Purpose / Status |
| :--- | :--- | :--- |
| `quran_words` | **77,429** | Verified word-level Hafs text base (MD5 verified) |
| `qiraat_corpora` | **1** | Master corpus metadata (`mushaf-1441`) |
| `qiraat_frameworks` | **2** | Framework definitions (Shatibiyya, Durra) |
| `qiraat_annotations` | **8** | In-Mushaf editor manual annotations |
| `qiraat_annotation_faces` | **4** | Annotation display faces |
| `qiraat_annotation_revisions`| **15** | Annotation versioning log |
| `resolved_qiraat_cache` | **1** | Cache entry for live indicator rendering |
| `qiraat_batches` / `_batch_changes` | **0** / **0** | Manual annotation batch staging (clean) |
| `qiraat_groups` / `_group_members` | **0** / **0** | Scholarly grouping catalogue (clean) |

### 2.3 Mutshabehat Core & Hifz Quiz System
| Table | Rows | Purpose / Status |
| :--- | :--- | :--- |
| `automated_groups` | **12,668** | Automated similarity group pairs |
| `personal_groups` | **199** | User-created group associations |
| `personal_verses` | **714** | User verse bookmarks |
| `parts` | **3,054** | Quran structural sections |
| `verses` | **943** | Verse master index |
| `quiz_sessions` | **4** | User quiz test sessions |
| `quiz_questions` | **52** | Generated quiz questions |
| `quiz_choices` | **208** | Multi-choice question options |
| `test_answers` | **152** | User response records |
| `user_ayah_performance` | **52** | User adaptive learning weights |
| `user_mutashabihat_performance` | **48** | Similarity retention metrics |

---

## 3. Data Consistency & Integrity Audits

### 3.1 Quran Words Verification
- **Count:** 77,429 rows
- **MD5 Checksum:** `52839d155fd0f90f999822a43e8198f5`
- **Result:** **100% IDENTICAL** to baseline dump `artifacts/scratch_baseline.dump`. Absolutely zero drift or accidental edits.

### 3.2 Loci Word Anchoring
- **Start Word Anchoring:** `SELECT count(*) FROM qiraat_loci l WHERE l.start_word IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quran_words qw WHERE qw.surah = l.surah_number AND qw.ayah = l.start_ayah AND qw.word_position = l.start_word);`
  - Result: **0** unmatched start words.
- **End Word Anchoring:** `SELECT count(*) FROM qiraat_loci l WHERE l.end_word IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quran_words qw WHERE qw.surah = l.surah_number AND qw.ayah = l.end_ayah AND qw.word_position = l.end_word);`
  - Result: **0** unmatched end words.
- **Page Alignment:** `SELECT count(*) FROM qiraat_loci l JOIN qiraat_pages p ON p.id = l.page_id JOIN quran_words qw ON qw.surah = l.surah_number AND qw.ayah = l.start_ayah AND qw.word_position = l.start_word WHERE p.mushaf_page_number != qw.page_number;`
  - Result: **0** mismatches. Every locus is positioned on its true Mushaf page.

### 3.3 Entries Breakdown & Review Status
- **Kind Distribution:**
  - `variant` (فرش): **3,625** total (3,052 unreviewed, 573 flagged)
  - `ruling` (أصول): **11,669** total (11,361 unreviewed, 308 flagged)
- **Soft Deletions:** Exactly 6 soft-deleted entries exist (`deleted_at IS NOT NULL`), correctly preserved for undo operations.
- **Review Status:**
  - `unreviewed`: 14,413 entries
  - `flagged`: 881 entries (matching the open flags requiring review queue triage)
  - `reviewed`: 0 entries (review phase pending UI rollout)

### 3.4 D8 Baseline Hafs Rule Audit
Under architectural decision D8, Hafs (`Q05-R02`) represents the base text (`quran_words`). Differences from Hafs are recorded as variants.
- Entries in `qiraat_entry_readings` listing Hafs: **126** total.
- Of these 126 records:
  - **119** are flagged with `D8_HAFS_KEPT` (explicitly highlighting that the record states Hafs at wajh 1).
  - **7** are flagged with `ATTRIBUTION_MISMATCH` where narrator lists disagree with authority strings.
- **Conclusion:** No unflagged Hafs baseline violations exist in the database.

---

## 4. Foreign Keys, Constraints, and Index Coverage

### 4.1 Missing Foreign Key Indexes (32 Unindexed FKs)
PostgreSQL does not automatically index the columns of a foreign key on the referencing table. Without an index, cascade operations (`ON DELETE CASCADE`) or queries filtering on the foreign key perform full sequential scans.

The audit identified 32 unindexed foreign keys in `public`:
1. `qiraat_qa_flags(entry_id)` — FK: `qiraat_qa_flags_entry_id_fkey`
2. `qiraat_qa_flags(locus_id)` — FK: `qiraat_qa_flags_locus_id_fkey`
3. `qiraat_notes(entry_id)` — FK: `qiraat_notes_entry_id_fkey`
4. `qiraat_notes(authority_id)` — FK: `qiraat_notes_authority_id_fkey`
5. `qiraat_entry_count_schools(count_school_id)` — FK: `qiraat_entry_count_schools_count_school_id_fkey`
6. `qiraat_rule_authorities(authority_id)` — FK: `qiraat_rule_authorities_authority_id_fkey`
7. `qiraat_source_documents(framework_id)` — FK: `qiraat_source_documents_framework_id_fkey`
8. `qiraat_group_members(authority_id)` — FK: `qiraat_group_members_authority_id_fkey`
9. `qiraat_groups(corpus_id)` — FK: `qiraat_groups_corpus_id_fkey`
10. `qiraat_groups(framework_id)` — FK: `qiraat_groups_framework_id_fkey`
11. `qiraat_framework_authorities(authority_id)` — FK: `qiraat_framework_authorities_authority_id_fkey`
12. `qiraat_annotations(end_word_id)` — FK: `qiraat_annotations_end_word_id_fkey`
13. `qiraat_annotations(corpus_id)` — FK: `qiraat_annotations_corpus_id_fkey`
14. `qiraat_annotations(framework_id)` — FK: `qiraat_annotations_framework_id_fkey`
15. `qiraat_annotations(taxonomy_id)` — FK: `qiraat_annotations_taxonomy_id_fkey`
16. `qiraat_annotations(created_by)` / `(updated_by)`
17. `qiraat_annotation_faces(annotation_id)`
18. `qiraat_annotation_variants(annotation_id)` / `(face_id)`
19. `qiraat_annotation_sources(source_id)`
20. `qiraat_annotation_revisions(changed_by)`
21. `resolved_qiraat_cache(corpus_id)` / `(framework_id)` / `(resolved_annotation_id)` / `(target_authority_id)` / `(word_id)`
22. `edit_log(undo_of)` — FK: `edit_log_undo_of_fkey`
23. `groups(source_automated_id)`
24. `personal_verses(group_id)` / `(user_id)`
25. `test_answers(group_id)`

**Recommendation:** Add indexes on high-traffic FK columns (`qiraat_qa_flags.entry_id`, `qiraat_qa_flags.locus_id`, `edit_log.undo_of`) in an upcoming maintenance migration.

---

## 5. Security & Row Level Security (RLS) Audit

### 5.1 RLS Coverage
- **100% of tables (58/58)** have RLS enabled (`rowsecurity = true`).
- Core user-facing tables (`qiraat_loci`, `qiraat_entries`, `qiraat_entry_readings`, `quran_words`) allow public read access via permissive SELECT policies (`USING (true)` or `verification_status IN ('VERIFIED', 'PUBLISHED', 'REVIEWED')`).

### 5.2 Server-Only Tables (0 Policies)
Six tables have RLS enabled but **zero policies** defined:
- `edit_log`
- `qiraat_editors`
- `qiraat_extraction_raw`
- `qiraat_qa_flags`
- `quiz_choices`
- `quiz_questions`

**Security Assessment:**  
This is a secure design pattern. Tables without policies deny all direct queries from `anon` and `authenticated` roles by default. They can only be accessed by the backend service role or via `SECURITY DEFINER` functions with strict authorization checks (such as `qiraat_require_editor()`).

---

## 6. Functions & Views Audit

### 6.1 Review RPCs (`qiraat_review_*`)
The database contains 14 specialized review procedures:
- `qiraat_review_overview()`: Corpus-wide progress by page.
- `qiraat_review_page(p_page, p_include_deleted)`: Full page review bundle.
- `qiraat_review_row(p_entry_id)`: Single entry review state.
- `qiraat_review_set_status(p_entry_id, p_status, p_expected, p_note, p_device_id)`: Atomic status transitions.
- `qiraat_review_set_narrators(...)`: Narrator set overrides with trigger sync.
- `qiraat_review_update_entry(...)`: Entry metadata edits.
- `qiraat_review_delete_entry(...)` / `restore_entry(...)`: Soft deletion and recovery.
- `qiraat_review_undo(p_txid, p_device_id)`: Multi-table rollback of any review transaction.
- `qiraat_review_history(...)`: Audit log query.

All review mutating functions:
- Enforce `qiraat_require_editor()`.
- Record full before/after JSON deltas into `edit_log`.
- Enforce optimistic concurrency control via `p_expected` timestamp.

### 6.2 QA Views Status
- `qiraat_qa_partition`: 3,134 rows (active partition audit).
- `qiraat_qa_alternates`: 15,425 rows.
- `qiraat_qa_phase2_violations`: 663 rows.
- `qiraat_qa_blocking`: **0** rows.
- `qiraat_qa_rule_divergence`: **0** rows.

Zero blocking QA violations exist in the active schema.

---

## 7. Audit Conclusion & Sign-Off

The live database at `mutshabehat-db:5433` is in **exemplary health**:
- Zero orphaned or dangling data rows.
- Complete alignment with the 604-page Quran corpus.
- Protected by active RLS and transaction logging.
- Read-only integrity verified for `quran_words`.
- Ready for Task 2 migration application upon user approval.
