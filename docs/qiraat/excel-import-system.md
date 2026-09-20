# Qiraat bulk Excel import system

**Status:** the pipeline (parse → stage → validate → review → approve → publish → export) is
built and passes an end-to-end test on a local PostgreSQL instance (§ "Sample end-to-end test
results" below). It has **not** been run against the self-hosted production database — that
backend is reachable only via PostgREST over the Tailscale Funnel from this environment, and a
direct `psycopg2`/`pg_dump` connection (which staging, publishing and export all need) is only
possible from a machine with real network access to the Mac Mini. See "What still needs to
happen before a real 604-page import" at the end of this document.

## 0. Architecture inspection (Phase 1) — what already existed

Before writing anything, the existing Qiraat pipeline was read in full:

- `scripts/qiraat/{data_variants,data_rulings,build_variants,build_rulings}.py` — the
  hand-authored Python datasets that generate the fixtures currently shipped (1,615 variants,
  7,272 rulings across 318 pages, per `CHANGELOG.md`). This is the "old" direction: Python →
  fixtures, sometimes Python → PostgreSQL (`import_to_postgres.py`, pages 1–244 only).
- `scripts/qiraat/{tokens,authorities}.py` — the two modules every batch already goes through:
  `tokens.py` anchors text to a real Mushaf-1441 word via 3-tier normalization (never text
  search alone), `authorities.py` resolves reader/narrator names to canonical `Q0N`/`Q0N-R0M`
  IDs and refuses to guess the two structurally-ambiguous bare names ("خلف", "الدوري").
- `packages/qiraat-core/{types,repository,readers,narrators,symbols,colors}.ts` — the
  TypeScript domain model the app actually renders from: `QiraatVariant`, `QiraatRuling`,
  `QiraatRule`, the 20-reading ID space, and `packages/qiraat-core/symbols.ts`'s group-symbol
  dictionary (رموز الشاطبية/الدرة) — reused directly rather than re-invented (§6 below).
- `supabase/migrations/20260917120000_qiraat_v2_schema.sql` — the **permanent V2 schema**,
  written and validated against PostgreSQL 16 (`docs/qiraat/10-v2-architecture-plan.md`), but
  **not yet applied** to the self-hosted backend. It already has almost everything a bulk
  import needs: a locus/entry split, a self-referencing authority tree, an
  `EXTRACTED → MAPPED → REVIEWED → NEEDS_MANUAL_REVIEW → VERIFIED → PUBLISHED` lifecycle, QA
  views (`qiraat_qa_partition`, `qiraat_qa_alternates`, `qiraat_qa_rule_divergence`,
  `qiraat_qa_blocking`) and a `qiraat_export_page()` function that is the fixture generator.
  **This import system builds on that schema rather than inventing a second one** — the whole
  point of the exercise per the task brief.
- `scripts/qiraat/import_to_postgres.py` — the existing bulk loader for the hand-authored
  fixtures. Found a hard-coded database password here (see § Security).
- No admin UI, no staging tables, and no Excel importer of any kind existed before this work.

### The two-gate model this import system relies on

The V2 schema already gates visibility twice — a fact this whole design leans on instead of
re-implementing:

1. `qiraat_export_page()` only ever serves entries at `verification_status IN ('VERIFIED',
   'PUBLISHED')` **unless** called with `p_include_unpublished := true` (the admin/dev path).
2. Nothing in this bulk-import system ever sets a published record's status past `REVIEWED`.

So "publish a batch" (moving staging rows into `qiraat_pages`/`qiraat_loci`/`qiraat_entries`)
and "make it render on the live Mushaf" (promoting `REVIEWED → VERIFIED → PUBLISHED`) are two
separate, independently-gated actions — exactly the "nothing reaches the Mushaf without
approval" requirement, enforced by the schema itself rather than by application discipline
alone. Verified directly: after publishing the sample batch below,
`qiraat_export_page(1, false)` (the default, live-app call) returns `entries: []`.

## 1. Pipeline

```
Excel files (data/qiraat/import/)
     ↓  scripts/qiraat/import_excel.py --dry-run   (report only, no DB write)
     ↓  scripts/qiraat/import_excel.py --stage      (writes qiraat_import_batches/rows)
STAGING TABLES (qiraat_import_*)                    — no RLS for anon/authenticated, service-role only
     ↓  review + approve/reject in /admin/qiraat-import (or bulk-approve)
     ↓  scripts/qiraat/publish_import.py --batch <id>   (ONE transaction; rolls back on any error)
V2 SCHEMA (qiraat_pages/loci/entries/...) at verification_status = 'REVIEWED'
     ↓  a SEPARATE, later, explicit action promotes REVIEWED → VERIFIED → PUBLISHED
     ↓  scripts/qiraat/export_from_postgres.py
Generated JSON fixtures (packages/qiraat-core/fixtures/pages-from-db/)
     ↓  manual, reviewed, one-page-at-a-time wiring into repository.ts (unchanged from today's process)
Mutshabehat Mushaf app
```

## 2. Folder structure

```
data/qiraat/import/               ← put your .xlsx/.xls/.csv files here (git-ignored, see README.md there)
scripts/qiraat/
  excel_mapping.yaml               ← configurable column-header aliases
  group_symbols.py                 ← group-name → reader-list, mirrors packages/qiraat-core/symbols.ts
  attribution_parser.py            ← splits + resolves an attribution cell using authorities.py + group_symbols.py
  import_excel.py                  ← the importer (--dry-run / --stage)
  publish_import.py                ← staging → V2 schema, one transaction
  export_from_postgres.py          ← V2 schema → JSON fixtures (existing QiraatVariant/QiraatRuling shape)
  validate_qiraat_db.py            ← runs the V2 schema's own QA views, exits non-zero on a blocking issue
  backup_db.sh                     ← pg_dump before a bulk publish
  make_sample_import.py            ← builds the sample workbook used by the pipeline test
supabase/migrations/
  20260920120000_qiraat_import_staging.sql   ← the staging schema (this system's only new schema)
src/lib/qiraat-admin.ts            ← server-only repository for the admin UI (service-role client)
src/app/(app)/admin/qiraat-import/         ← batch dashboard, row table, row detail + review actions
src/app/(app)/admin/qiraat-database/       ← browse the published V2 data page by page
tests/test_qiraat_import_pipeline.py       ← pytest: pure-Python + DB-backed round-trip tests
```

## 3. Excel format expected

One or more `.xlsx`/`.xls`/`.csv` files, any number of sheets, any header order. A header is
matched against `scripts/qiraat/excel_mapping.yaml` after normalization (tashkeel/tatweel
stripped, alef/ة/ى folded, case-folded for Latin). A header that matches nothing is left
**unmapped** and reported — never guessed. To support a new spreadsheet layout, add the header
spelling to the relevant field's alias list in that YAML file.

Canonical fields (see the YAML for every recognized spelling of each):

| Field | Meaning |
|---|---|
| `mushaf_page` | 1–604 |
| `surah_number`, `ayah_from`, `ayah_to` | Quran position |
| `base_text` | the Hafs/Mushaf-1441 text — anchored against the real word fixtures, never trusted as typed |
| `variant_text` | the وجه's reading, when this row is a Farsh variant |
| `category` | usul category (Arabic name or code) — `"فرش"`/`"variant"` marks "this is not a ruling" and is never treated as an unknown category |
| `attribution` | free text: reader/narrator names, or a group symbol ("صحبة", "الأخوان", "الكوفيون"...), or "الباقون" |
| `evidence_shatibiyyah` / `evidence_durrah` / `evidence_generic` | الشواهد |
| `verification_status`, `source_note`, `occurrence_note` | metadata |

## 4. Validation rules (what makes a row VALID / WARNING / ERROR)

Implemented in `import_excel.py: normalize_row()`:

- **Page** must be an integer in 1–604 (`INVALID_PAGE`).
- **Surah** must be 1–114 (`INVALID_SURAH`).
- **Ayah** must exist in that surah, checked against `public/quran/ayahs.json` (`INVALID_AYAH`,
  `INVALID_AYAH_RANGE`).
- **Base text** is required and is anchored against the real Mushaf-1441 word fixtures for that
  page via `tokens.py` (3-tier: exact → alef-maqsura fold → rasm skeleton), at the given ayah
  when known, so a repeated word cannot silently anchor to the wrong occurrence. A miss is
  `NEEDS_MANUAL_MAPPING` and the row can never reach `valid` (`import_excel.py` never guesses a
  position for it).
- **Attribution** is required and is resolved through `attribution_parser.py`, which is a thin
  splitter over the **existing** `authorities.py` (readers/narrators) and `group_symbols.py`
  (group symbols, transcribed verbatim from `packages/qiraat-core/symbols.ts`, never a second
  model). A token that resolves to neither — including the two names the project already knows
  are structurally ambiguous, bare "خلف" and bare "الدوري" — is `UNRESOLVED_AUTHORITY`, never
  guessed. "الباقون" and its unfixed-membership siblings ("غيره", "سواهم", "الجميع") are flagged
  the same way, per `packages/qiraat-core/symbols.ts`'s own `REMAINDER_CAVEAT` — except literal
  "الباقون", which the schema can resolve deterministically (remainder = 20 minus every sibling
  entry at the same locus) and is accepted as `attribution_is_remainder`.
- **Category** is matched against the 24 codes seeded by the V2 migration
  (`CATEGORY_ALIASES`); an unmatched non-"فرش" value is a `warning`, not an error — it still
  stages, so a reviewer can map it, but it will not resolve into a real
  `qiraat_ruling_details.category_code` until it does.
- A row with **any** `error`-level message is `validation_status = 'error'` and can never be
  approved-for-publish; `warning` only rows can be approved but are worth a human glance;
  everything else is `valid`.

## 5. Authority / category normalization

`attribution_parser.py` reuses, in this order: `authorities.py` (individual reader/narrator
name → `Q0N`/`Q0N-R0M`), then `group_symbols.py` (group name → the reader list it denotes,
expanded to narrator level exactly like `readingsOfGroupSymbol()` in `symbols.ts`). Nothing
here invents a new naming scheme; `group_symbols.py`'s own docstring records exactly which
`symbols.ts` tables each entry was transcribed from, so it can be diffed against that file if it
is ever extended.

## 6. Token anchoring

`tokens.py` (already existed, unmodified) is the only thing allowed to produce a `baseText`. A
row's resolved anchor is `{surah, startAyah, startWord, endAyah, endWord, baseText}`, and
`publish_import.py` derives the **locus id** from that tuple
(`IMP-S{surah}-A{ayah}-W{word}-E{endAyah}-{endWord}`) rather than from the source row. This
means two different Excel rows anchored to the *same* Quran position land on the same locus as
two entries (`entry_order` 1, 2, ...) automatically, without a separate grouping column — the
same shape multiple أوجه of one word already take in the hand-authored dataset.

## 7. Idempotency / duplicate detection

Every row gets a `fingerprint` (`import_excel.py: row_fingerprint()`) — a SHA-256 of the fields
that describe *the reported fact itself* (page, surah, ayah span, base text, variant/ruling
text, category, resolved reading set) — deliberately excluding batch id, timestamp, and source
file/sheet/row, so the same fact imported twice fingerprints identically. `import_excel.py
--stage` checks every new row's fingerprint against **every prior row ever staged** (not just
the current run) and marks a match `duplicate_status = 'exact_duplicate'`. The row is still
inserted (raw source is never discarded — task requirement #27), but `publish_import.py` refuses
to publish any row whose `duplicate_status <> 'none'`, whatever its `review_status` says.

`PRODUCTION_CONFLICT` is a separate, stronger check, done at publish time (not staging time,
since it needs the current state of the live schema): before writing a row, `publish_import.py`
checks whether a `VERIFIED`/`PUBLISHED` entry already exists at that exact locus with a
*different* base text. If so, the row is skipped, moved to `review_status = 'needs_correction'`,
and the conflict (existing locus id + existing text) is recorded on the row for the reviewer —
never silently overwritten.

## 8. Admin review UI

- **`/admin/qiraat-import`** — every batch, with the same summary counters section 20 of the
  task spec asks for (total/valid/warning/error/duplicate/unresolved/needs-mapping/approved/
  rejected/published).
- **`/admin/qiraat-import/[batchId]`** — the row table, filterable by validation status, review
  status, duplicate status, page and surah via query parameters (so a filtered view is a
  shareable URL); paginated at 50 rows/page (never loads the whole batch into the browser); a
  bulk-approve button for every `valid`, non-duplicate, still-`pending` row; and the exact
  `npm run qiraat:publish -- --batch <id>` command to run locally.
- **`/admin/qiraat-import/[batchId]/rows/[rowId]`** — the record detail panel: raw Excel row,
  normalized record, and the resolved Mushaf-1441 anchor side by side (the "EXCEL SOURCE vs
  NORMALIZED DB RECORD vs MUSHAF TOKEN" comparison from the task spec), a link that opens the
  real page in `/mushaf-1441?page=N` for visual confirmation (reusing the existing Mushaf
  renderer rather than building a second one), and the approve/reject/needs-correction/
  needs-mapping/reset actions with an optional reviewer note.
- **`/admin/qiraat-database`** — browses the *published* V2 data page by page via
  `qiraat_export_page()`, with a page-coverage count, the `qiraat_qa_blocking` count (should be
  zero), and per-entry status/flag indicators. This doubles as the page-review mode from the
  task spec: filtering to one page and reading its variant/ruling list top to bottom.

Why not a button that runs `publish_import.py`/`export_from_postgres.py` from the web app: this
app is deployed to Vercel, and the self-hosted PostgreSQL is reachable from Vercel only through
PostgREST over the Tailscale Funnel (HTTPS), never a raw `psycopg2`/`pg_dump` TCP connection —
the exact same constraint `CLAUDE.md` already documents for applying DDL ("the Management API no
longer applies... run from the Mac Mini"). Approve/reject/bulk-approve/edit all go through
PostgREST (the same path every other table read/write in this app already uses) and work from
the web UI; publish and export need a direct database connection and stay CLI commands run
where that connection exists — the UI surfaces the exact command rather than silently failing.

## 9. Publish workflow

`scripts/qiraat/publish_import.py --batch <id>` processes only rows where
`validation_status = 'valid' AND review_status = 'approved' AND duplicate_status = 'none'`, in
**one** `psycopg2` transaction (`with conn:` — any exception rolls back everything and marks the
batch `FAILED` with the error recorded). For each row it: ensures the `qiraat_pages`/
`qiraat_loci` rows exist, inserts one `qiraat_entries` row at `verification_status = 'REVIEWED'`
(never higher — see the two-gate model above), inserts its `qiraat_variant_details` or
`qiraat_ruling_details`, inserts `qiraat_entry_authorities` for an explicit attribution (a
`remainder` attribution needs none — `qiraat_rebuild_locus_readings()` computes it from
siblings), links any evidence, and marks the staging row `published` with the new locus/entry
id. `ERROR`/`REJECTED`/`NEEDS_MANUAL_MAPPING`/duplicate rows are never processed, even if
mistakenly marked `approved` (tested explicitly — see § Test results).

## 10. Regenerating fixtures

`scripts/qiraat/export_from_postgres.py` calls `qiraat_export_page()` for every page with data
and writes `QiraatVariant[]`/`QiraatRuling[]` JSON in the **exact shape** the app's hand-authored
fixtures already use, into `packages/qiraat-core/fixtures/pages-from-db/` — a **separate**
directory from the wired `packages/qiraat-core/fixtures/{pages,rulings}/`. Wiring a page's
generated fixture into `repository.ts`'s loader tables (replacing a hand-authored file, or
adding a newly-published page) stays a deliberate, one-page-at-a-time, reviewed step — exactly
like every existing page-batch import already recorded in `CHANGELOG.md` — never an automatic
side effect of running the export.

## 11. Rollback

- **Batch-level:** `publish_import.py`'s single transaction means a mid-batch failure leaves the
  V2 schema exactly as it was before the run; the batch is marked `FAILED` with the SQL error
  attached, and every staging row keeps its pre-publish `review_status` untouched (nothing is
  marked `published`).
- **A whole batch already staged but not yet published:** delete its `qiraat_import_batches` row
  (cascades to its rows/events) — nothing outside staging was ever touched.
- **A whole batch already published:** every locus it created has `id LIKE 'IMP-%'`; the rows it
  wrote are also linked back from `qiraat_import_rows.published_locus_id`/`published_entry_id`
  for that batch, so a targeted `DELETE ... WHERE locus_id IN (SELECT published_locus_id FROM
  qiraat_import_rows WHERE batch_id = ...)` (inside a transaction, after a fresh backup) reverses
  it precisely. No automatic "unpublish" command was built — this is rare enough, and
  consequential enough, to stay a reviewed manual step.

## 12. Backing up before a full publish

`npm run qiraat:backup-db` (`scripts/qiraat/backup_db.sh`) runs `pg_dump -Fc` against
`QIRAAT_DATABASE_URL` into `backups/pre-qiraat-publish-<timestamp>.dump` and refuses to
overwrite an existing file. Run it before any publish that isn't a small, already-reviewed
sample.

## 13. Security

- `scripts/qiraat/import_to_postgres.py` had a **hard-coded PostgreSQL password** (host
  `127.0.0.1:5433`, user `postgres`) committed to git history. It now reads
  `QIRAAT_DATABASE_URL`/`DATABASE_URL` from the environment (`.env.example` documents the
  variable) and refuses to run without it. **The exposed password should be rotated** — it is
  already in git history and cannot be un-committed by editing the file; rotating it was not
  attempted here since it requires access to the self-hosted Postgres instance this session
  cannot reach.
- The new staging tables (`qiraat_import_*`) have RLS enabled with **no policy at all** for
  `anon`/`authenticated` — default deny. Only the service-role key (used by the Python scripts
  directly, and by the admin UI's server-only `qiraatAdmin()` client) can read or write them.
- The admin routes require a signed-in session (`getUser()`), matching how the rest of this
  single-user self-hosted app already gates everything else.

## 14. How to add a new Excel column alias

Open `scripts/qiraat/excel_mapping.yaml`, find the canonical field the new header should map
to, and add the exact header spelling (as it appears in the spreadsheet) to that field's list.
Re-run `npm run qiraat:import:dry` — the header should disappear from the dry-run report's
"unmapped columns" line.

## 15. Sample end-to-end test results (task requirement #24)

`tests/test_qiraat_import_pipeline.py`, run against a local PostgreSQL 16 instance with both
migrations applied (V2 schema, then the staging schema):

```
18 passed in 0.78s
```

covering: file/sheet discovery (skips an empty sheet), reading every data row, a clean valid
row, a group-symbol attribution ("الأخوان") resolving correctly, "الباقون" flagged as
remainder, an out-of-range ayah rejected, a bare "خلف" and an unknown reader name both
unresolved (never guessed), a base-text that doesn't exist on its page flagged
`NEEDS_MANUAL_MAPPING`, an intentional duplicate row detected within one run, fingerprint
stability/sensitivity, the narrator→reader relationship holding structurally (Q06-R01 never
claims Q07's readings), report files actually written, `--dry-run` never touching
`psycopg2.connect` at all, and — the full round trip — **stage → approve → publish → export**:
4 rows published in one transaction, `qiraat_qa_partition` showing zero *overlaps* (some
*gaps* are expected — the sample intentionally reports only one وجه per locus), the default
(`p_include_unpublished = false`) export returning zero entries (confirming the live app still
sees nothing), and a re-import of the identical files immediately afterward marking all 8 rows
`exact_duplicate`. A fourth test approves *every* row including the error ones and confirms
`publish_import.py` still refuses to mark any non-`valid` row as published.

Run it yourself:

```bash
createdb qiraat_test
psql qiraat_test -f supabase/migrations/20260917120000_qiraat_v2_schema.sql
psql qiraat_test -f supabase/migrations/20260920120000_qiraat_import_staging.sql
QIRAAT_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/qiraat_test \
  python3 -m pytest -q tests/test_qiraat_import_pipeline.py
```

## 16. What still needs to happen before a real 604-page import

- **Apply both migrations to the self-hosted backend** (V2 schema, then the staging schema),
  from the Mac Mini, after a `pg_dump` backup — this was never done in this session because the
  backend is unreachable from here. Neither has ever been applied to production.
- **Reconciliation pass (task requirement #28):** before treating Postgres as canonical, run
  `scripts/qiraat/import_to_postgres.py` (or confirm the existing pages 1–244 population) and
  diff it against the hand-authored fixtures — this system does not replace that step, and no
  such diff was run here (no reachable production database to diff against).
- **A first real page's worth of your actual Excel files**, run through
  `qiraat:import:dry` → review the report → `qiraat:import` → `/admin/qiraat-import` → approve →
  `qiraat:publish` → `qiraat:validate-db` → `qiraat:export`, before trusting the pipeline at
  volume. The sample workbook proves the mechanism; it does not prove your real spreadsheets'
  layout matches every alias already in `excel_mapping.yaml`.
- **The admin UI has not been exercised in a running browser** — this sandbox has no network
  path to a live Supabase/PostgREST instance to point `NEXT_PUBLIC_SUPABASE_URL` at, so
  `npm run dev` plus manual clicking was not possible here. `npx tsc --noEmit` was run instead;
  see the top-level summary for its result.

**Verdict: the pipeline mechanism is proven end-to-end on a local database. It is not yet
proven against the production self-hosted backend, and the admin UI has not been visually
verified in a browser. Do not start a full 604-page import before both of those happen.**
