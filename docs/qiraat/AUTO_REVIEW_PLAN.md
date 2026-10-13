# Automatic Qiraat review («معتمد آليًا»): execution plan

Owner request (2026-10-13): review every Qiraat entry word by word against trusted sources, approve what the sources
confirm, fix what they contradict, and make sure every entry has a **category** (فرش / أصول) and a **sub-category**.
Approved-by-agent entries must be distinguishable from entries the owner approved by hand: **«معتمد آليًا»**.

This file is the brief for the implementing agent. Read `CLAUDE.md` and `PROJECT_MASTER.md` first.
Work on branch `feat/qiraat-auto-review`. Never push to `main` (a push to `main` deploys the web app).

## 0. Hard rules (do not break)

1. **Never write a reading, a reader attribution, an explanation or a Shatibiyya line from memory.** Every value
   written comes from a source file below, quoted or mapped by code. If the sources do not say it, leave it for a human.
2. **Never touch** `quran_words`, the QCF fonts, `Generated/`, or any Quran text.
3. **Never change an entry a human approved** (`review_status = 'reviewed'` and `review_source` is empty/`human`).
   A disagreement with it goes to the human queue (tier C), never to an overwrite.
4. Rules that must stay true after every write (database triggers enforce them; do not bypass): Hafs (`Q05-R02`) only as
   `wajh_order >= 2` with a note; one narrator once per word unless it is a separate wajh; no empty location.
5. Back up before any write: `docker compose exec -T db pg_dump -Fc ...` (see `PROJECT_MASTER.md` §8). Apply SQL with
   `--single-transaction -v ON_ERROR_STOP=1`, then `NOTIFY pgrst, 'reload schema'`.
6. Every write goes through the editor-gated review RPCs so it lands in `edit_log` with `device_id = 'auto-review'`
   and can be undone by transaction (`edit_log_undo_tx`).
7. Log each batch in `CHANGELOG.md` **and** the `# Changelog` section of `CLAUDE.md` (mandatory in this repo).
8. Do not hammer nquran.com. The comparison runs on the already-imported files; the live site is for a few spot checks only.

## 1. Sources (in trust order for arbitration)

| id | source | where | form |
|---|---|---|---|
| S1 | nquran.com «فروقات القراء» | `src/app/mushaf-1441/review/_lib/reference/nquran/surah-001..114.json` | structured, all 114 surahs |
| S2 | per-reader extractions from the printed books | iCloud folder `القراءات العشر/` : `Hamza.{csv,json}`, `ebn_katheer.{csv,json}`, `qaloon.{csv,json}`, `warsh.{csv,json}` | structured: page, surah, ayah, word position, Hafs text, reader text, `HARAKAH/LETTER/...`, narrators, source page |
| S3 | the same books as PDF (no structured file yet) | `abu_jaffar.pdf`, `al_doory.pdf`, `alsoosy.pdf`, `ebn_amer.pdf`, `kasa2e.pdf`, `khalaf10.pdf`, `yaqoob_alhadramy.pdf`, `Warsh_book.pdf`, `elktab.pdf` (83 MB) and the nine single-reader books named `الإستبرق…`, `الثمر اليانع…`, `الرياش…`, `السنا الزاهر…`, `القمر المنير…`, `أزكى التحيات…`, `حسن الجلاء…`, `رحيق الأزهار…`, `فوح العطر…` | PDF, needs extraction (WP2) |
| S4 | «الشامل في قراءات الأئمة العشر» | `…/القراءات العشر/الشامل/*.pdf` (one per surah) and `review/_lib/reference/shamil/` (Baqarah only so far) | PDF + partial JSON |

Reader ids: `Q01` Nafi (`Q01-R01` Qalun, `Q01-R02` Warsh), `Q02` Ibn Kathir, `Q03` Abu Amr, `Q04` Ibn Amir, `Q05` Asim
(`Q05-R02` Hafs), `Q06` Hamza, `Q07` Kisai, `Q08` Abu Jaafar, `Q09` Yaqub, `Q10` Khalaf al-Ashir. Bare «خلف» = `Q06-R01`.

## 2. Pilot result (pages 1–10, dry-run, nothing written)

Script: `scripts/qiraat/auto-review-pilot.ts` (`npx tsx scripts/qiraat/auto-review-pilot.ts 1 10`), output
`artifacts/qiraat-auto-review-pilot-p1-10.json`. Input is the fixture snapshot, because the live database was
unreachable when this was written, so **the first job of WP5 is to re-run it against the live database rows**.

* 246 entries: 50 farsh, 196 usul.
* Tier A (sources agree exactly): **169**. Tier B (sources partly disagree): **71**. Tier C (not documented): **6**.
* Farsh sub-categories derived from the two spellings: تشكيل 33, زيادة 8, حرف 6, حذف 3.
* The tier-B cases are mostly «the entry lists more narrators than S1» (49 of 71). Checked one by hand: S2
  (`Hamza.csv`, 1:7 عليهم, narrators `Q06-R01, Q06-R02`) agrees with the entry and S1 simply lists Hamza in another group.
  So **S2/S3/S4 are the arbiters for tier B**.

## 3. Decision table (implement exactly this)

For one entry at one word, collect what each available source says about its narrator set and reading.

| Case | Verdict | Action |
|---|---|---|
| S1 matches the entry (set of narrators equals one source group or a union of groups) and at least one more source (S2/S3/S4) that covers the reader does not contradict it | **A** | approve as «معتمد آليًا» |
| S1 and the entry differ, and a second source agrees with S1 | **B-fix** | correct narrators/text to the sources, record before/after, approve as «معتمد آليًا» |
| S1 and the entry differ, and a second source agrees with the entry | **A** | approve (S1 under-reports); note which source confirmed |
| Sources disagree with each other, only one source covers the word, or a reader label is unresolved | **C** | do not approve; add to the human queue with the reason |
| Entry already approved by a human | **skip** | never changed; a disagreement is listed in the queue |

Coverage rule: a source only counts as «covering» a narrator if it documents that reader at that word or says the reader
follows the default. Silence is not agreement.

## 4. Category and sub-category (every entry must end with both)

* **الفرش** (`kind = 'farsh'`): sub-category = `variant_type`, one of `تشكيل` (vowels), `حرف` (letter replaced),
  `زيادة`, `حذف`, `تقديم وتأخير`, `أخرى` (mapped to the DB enum by `CANONICAL_VARIANT_TYPES` in
  `review/_components/FarshFields.tsx`). Derive it from the two spellings with `farshSubCategory()` in the pilot script
  (letters only, vowels stripped). If the derived value conflicts with S2's `نوع_الخلاف`, use S2 when it maps cleanly,
  otherwise `أخرى` and queue it.
* **الأصول** (`kind = 'usul'`): sub-category = one of the 23 `category_code`s (الممال والمقلل, ترك الغنة, ترقيق الراءات,
  تغليظ اللامات, صلة ميم الجمع, …). Take it from S2's `نوع_الخلاف_أو_الباب` / S4's category; if only S1 prose exists,
  use the keyword mapping already written in `shamilReference.ts` (`suggestShamilCategory`) and mark confidence low (tier C).
* For every word whose spelling differs (e.g. تعملون/يعملون) store: the variant text, a short explanation of the change
  **taken from the source text**, and the narrators. The explanation field is `description` (farsh) or the narrator
  `action` («الأداء»); never invent wording.

## 5. Work packages

### WP1. Database: mark and show «معتمد آليًا»
* Migration `supabase/migrations/<ts>_qiraat_review_source.sql` + rollback in `supabase/rollbacks/`:
  `ALTER TABLE qiraat_entries ADD COLUMN review_source text` (`NULL` = human; `'auto:nquran+<sources>'` = agent) and
  `review_note text` (what confirmed it, one line). Add both to `qiraat_review_page` output and `qiraat_export_page`.
* New RPC `qiraat_review_auto_approve(p jsonb)`: editor-gated, optimistic-version checked, refuses entries whose
  `review_source` is NULL and `review_status = 'reviewed'`, sets `review_status='reviewed'`, `review_source`, `review_note`,
  records `edit_log` with `device_id='auto-review'`. Batch variant taking up to 200 ids, all-or-nothing per call.
* Test it on a scratch copy first (pattern: `scripts/qiraat/phase4_scratch_tests.sql`).
* Acceptance: apply, re-apply (idempotent), rollback gives an identical schema, `quran_words` checksum unchanged.

### WP2. Turn S3 and S4 PDFs into structured files
* For each PDF produce `data/qiraat/sources/<id>.json` with the same columns as the S2 CSVs
  (surah, ayah, word position, Hafs text, reader text, difference type or باب, explanation, narrators, source page).
  Reuse the extraction approach in `scripts/qiraat/import_doc_tables.py`. Keep the raw text next to each row.
* Rows that cannot be read with certainty are **dropped and listed** in `data/qiraat/sources/<id>.dropped.md`.
* Do not commit the PDFs or their text if the licence is unclear: commit only the structured rows we need and cite the
  book and page. (The repo is private to the owner but treat the data as sensitive.)
* Acceptance: row counts per book recorded; 20 random rows per book spot-checked against the PDF page image.

### WP3. The reviewer (library + CLI)
* Promote `scripts/qiraat/auto-review-pilot.ts` to `scripts/qiraat/auto-review.ts` using the decision table (§3) and all
  sources through one `SourceReader` interface per source. Reuse `nquranReference.ts`, `shamilReference.ts`,
  `referenceGroup.ts` (do not re-implement reader-label resolution).
* Output per entry: tier, verdict, category, sub-category, sources that confirmed, before/after diff, reason for C.
* Tests in `tests/qiraat/auto-review.test.ts` (node test runner, same style as `tests/qiraat/nquran-reference.test.ts`):
  one case per row of the decision table, per sub-category rule, and the human-approved skip.

### WP4. Dry-run report on the live rows
* Read entries from the database (read-only) instead of the fixtures. Write `docs/qiraat/AUTO_REVIEW_P1-10.md` and a JSON
  next to it. Stop and show the owner the A/B/C counts and 20 sampled before/after diffs.

### WP5. Pilot write: pages 1–10
* Backup, then write tier A and B-fix for pages 1–10 only. Verify: every entry on those pages has a category and
  sub-category; zero rule violations in `qiraat_qa_phase2_violations`; `quran_words` checksum unchanged; the page renders at
  `/mushaf-1441?page=N` and the review screen shows «معتمد آليًا» (WP6).
* Undo test: `edit_log_undo_tx` on the batch transaction restores the previous state.

### WP6. Show it in the editor and the Mushaf
* Review screen (`/mushaf-1441/review`): a distinct badge «معتمد آليًا» (not green «معتمد»), the confirming sources in
  the tooltip, filter «الكل / معتمد يدويًا / معتمد آليًا / يحتاج مراجعة», and one-click «اعتماد يدوي» that clears
  `review_source`. Keep colour-independent cues.
* Mushaf reader: treat «معتمد آليًا» as reviewed (visible to everyone). iOS reads the same export, so add the field to the
  export and mention it in `apps/ios` only as a follow-up task (do not edit iOS here).

### WP7. Roll out
* Batches of 50 pages (11–60, 61–110, …), each: backup → dry-run report → owner-visible counts → write → verify →
  changelog entry. Stop at the first batch whose tier C share is above 40% and report.
* The human queue (tier C and conflicts) is exported to `docs/qiraat/AUTO_REVIEW_QUEUE.md` with direct links to
  `/mushaf-1441/review?page=N`.

### WP8. Final report
* Counts per tier and per page range, number of corrections (with examples), remaining queue, known limits,
  what was spot-checked against nquran.com live.

## 6. Pilot gate (owner approves before WP7)
Pages 1–10 written, verified, undo tested, badge visible, queue produced. Only then continue.

## 7. Known limits to report honestly
* The pilot ran on the fixture snapshot, not the live rows.
* S1 covers every ayah but groups readers coarsely; S2 covers four readers; the rest depend on WP2 extraction quality.
* S4 JSON exists for Baqarah only.
* An automatic approval is a statement that independent sources agree, not a scholarly ruling; the human queue stays human.
