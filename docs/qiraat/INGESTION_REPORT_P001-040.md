# Ingestion Report: Pilot Pages 001–040 (Milestone M2)
**Project:** Mutshabehat V2 — Ten-Qiraat Multi-Source Integration  
**Date:** 2026-09-24  
**Target Environment:** `mutshabehat_staging` (Container `mutshabehat-db`, PostgreSQL 17 on port 5433)  
**Source Document:** «مصحف القراءات العشر المتواترة بالألوان الميسرة» (`BOOK_27159_1.pdf`)  
**Status:** M2 COMPLETED — PENDING USER REVIEW & PILOT PROMOTION SIGN-OFF

---

## 1. Executive Summary & KPIs

| Metric | Result | Target / Baseline | Status |
| :--- | :---: | :---: | :---: |
| **Pages Processed** | **40** | Pages 001–040 (Al-Fatihah & Al-Baqarah 1–248) | ✅ Complete |
| **Farsh Variants Ingested** | **225** | 225 source variants | ✅ 100% Extracted |
| **Usul Rulings Ingested** | **901** | 901 source rules | ✅ 100% Extracted |
| **Corroborated Records** | **3,123** | Corroborated with existing DB loci | ✅ Matched & Cited |
| **Gap-Filled Records (New)** | **397** | Additive gap-fill insertions | ✅ Inserted |
| **Source Conflicts** | **4** | Preserved both rows; flagged with diff | ✅ Handled via Q3 |
| **Unmatched Records** | **0** | All tokens anchored against `quran_words` | 🎯 100% Match Rate |
| **Idempotency Guarantee** | **0 new mutations** | Second pass: 3,520 corroborated, 0 gap-fills | 🔒 Verified |
| **Production Impact** | **ZERO writes** | Production DB (`postgres`) 100% untouched | 🛡️ Preserved |

---

## 2. Technical Decisions & Root-Cause Fixes

### 2.1 Rule D8 Trigger Exemption (`qiraat_assert_entry_hafs_rule`)
- **Trigger Rule:** In the Madinah 1441 Mushaf, Hafs (`Q05-R02`) is the baseline. The trigger prevents inserting Hafs with `wajh_order = 1` unless `review_status = 'flagged'`.
- **Occurrence:** On Page 19, Yaa'at Al-Idafa rulings (`r-p019-028-1` at 2:124 and `r-p019-029-1` at 2:125) list Hafs alongside other readers.
- **Pipeline Implementation:**
  - For GAP_FILL / CONFLICT items with `it.narratorId === 'Q05-R02'`:
    - Entry is inserted with `review_status = 'flagged'`.
    - QA flag is inserted into `qiraat_qa_flags` with `flag_type = 'D8_HAFS_KEPT'`, severity `'info'`, and explanatory text:
      `حفص مدرج في المصدر الجديد مع رواة آخرين - تم تعليمه للمراجعة وفق القاعدة D8`.
    - Both `qiraat_assert_entry_hafs_rule` and `qiraat_assert_locus_unique_narrators` skip flagged entries, ensuring clean commit.

### 2.2 Quranic Diacritics & Waqf Punctuation Isolation
- **Defect Discovered:** `ISOLATED_PUNCTUATION_REGEX` previously included `[\u06D6-\u06ED]`. Characters such as `\u06ED` (small low meem `ۭ` for Iqlab), `\u06E5` (small waw `ۥ`), `\u06E6` / `\u06E7` (small ya `ۦ` / `ۧ`), `\u06E2` (small meem `ۢ`), and `\u06DC` (small seen `ۜ`) are internal letter-diacritics, not word separators. Replacing them with `' '` caused single words (e.g. `هُدًۭى`, `إِنَّهُۥ`, `وَيَبْصُۜطُ`) to split into two words, resulting in 115 unmatched tokens in earlier runs.
- **Permanent Solution:**
  - Restricted `ISOLATED_PUNCTUATION_REGEX` strictly to standalone Quranic waqf marks and punctuation:
    `/[ۖۗۘۙۚۛ۞۩،؛؟,\.\-—]/g`
  - Internal diacritics are preserved intact for `norm()`, `fold()`, and `skeleton()`.
  - Result: Unmatched records plummeted from **115 down to ZERO (0)** across all 40 pages.
  - Added regression unit tests to `tests/qiraat/ingest-pipeline.test.ts` (15/15 tests passing).

### 2.3 Conflict Foreign Key Resolution
- **Defect Discovered:** On Page 21, the CONFLICT branch in `pipeline.ts` constructed a synthetic locus key instead of using `item.existingRecord.locusId`, causing a foreign key violation (`qiraat_entries_locus_id_fkey`).
- **Solution:** Updated `pipeline.ts` to bind conflict entries directly to `item.existingRecord.locusId`, ensure locus presence, and record full JSON diff in `conflict_diff` while setting `is_conflict = true` and `review_status = 'flagged'`.

---

## 3. Pilot Scope Breakdown & Conflict Details

### Conflict Registry (Page 21 — Surah Al-Baqarah)
All 4 conflicts occurred on Page 21 and were handled according to approved Decision Q3 (Option 1):
1. **Locus `r-p021-013-1` (2:140:14 "ءَأَنتُمْ") — Rawi Q01-R02 (Warsh):**
   - Existing DB: `"التسهيل بدون إدخال"`
   - New Source: `"الإبدال ألفًا مع المد المشبع"`
   - Action: Both rows preserved; new entry `ent-conflict-r-p021-013-1-w14-Q01-R02` inserted with `is_conflict = true`, flagged for manual review.
2. **Locus `r-p021-013-1` (2:140:14 "ءَأَنتُمْ") — Rawi Q04-R01 (Hisham):**
   - Existing DB: `"التسهيل مع الإدخال"`
   - New Source: `"التحقيق مع الإدخال"`
   - Action: Preserved; new entry `ent-conflict-r-p021-013-1-w14-Q04-R01` inserted with `is_conflict = true`.
3. **Locus `r-p021-007-1` (2:135:5 "هُودًا") — Rawi Q03-R01 (Al-Duri an Abi Amr):**
   - Existing DB: `"إمالة"`
   - New Source: `"أمالها الدوري"`
   - Action: Preserved; wording variance captured in `conflict_diff`.
4. **Locus `r-p021-007-2` (2:140:12 "هُودًا") — Rawi Q03-R01 (Al-Duri an Abi Amr):**
   - Existing DB: `"إمالة"`
   - New Source: `"أمالها الدوري"`
   - Action: Preserved; wording variance captured in `conflict_diff`.

---

## 4. Verification Gate Results

1. **TypeScript Typecheck:** Clean (0 errors) via `npm run typecheck`.
2. **Next.js Production Build:** Clean (0 errors, 35/35 static pages compiled in 14.3s) via `npm run build`.
3. **Unit Tests (Ingestion Pipeline):** 15/15 passed via `npx tsx --test tests/qiraat/ingest-pipeline.test.ts`.
4. **Unit Tests (Review HTTP & Workstation):** 19/19 passed via `npm run test:qiraat:review`.
5. **Qiraat Domain Core & Frontend Suite:** 44/44 passed via `npm run test:qiraat`.
6. **Playwright Headless Browser Verification:**
   - Evaluated `REVIEW_PILOT.html`:
     - Rendered cards: 1,487 loci.
     - Conflict filter: 3 cards (4 conflict entries).
     - Page filter: 8 cards on Page 1.
     - Arabic normalized search: "مالك" returned 6 cards; "ابراهيم" returned 83 cards.
     - `pageerror` count: 0.
     - `console.error` count: 0.
7. **Database Health & Idempotency:**
   - 1st Pass: Ingested 397 gap fills, 3,123 corroborated, 4 conflicts.
   - 2nd Pass: 0 new gap fills, exactly 3,520 corroborated, 0 errors.

---

## 5. Artifacts Generated

- `REVIEW_PILOT.html` (1.9 MB): Standalone, offline-capable review tool with Dark & Gold design system, Amiri/Cairo Arabic typography, live filters, search normalization, and side-by-side conflict diffs.
- `scripts/qiraat/generate-pilot-review-html.ts`: Reproducible review report generator.
- `VALIDATION_REPORT.md` & `MERGE_PLAN.md`: Updated automatically with final pilot tallies.
- Database Staging: `mutshabehat_staging` on `127.0.0.1:5433` populated with all 40 pilot pages.
