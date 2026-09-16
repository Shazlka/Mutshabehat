# 09 — Full-Quran rollout plan (not started — prototype-only per the task's own sequencing rule)

The task is explicit: "Do not bulk-import or modify all pages before the prototype passes all
tests." Nothing below has been executed. This is the plan for *after* the page-1 prototype is
reviewed and accepted by the user.

## 1. Data acquisition (the actual blocker)

The single biggest gap is verified Qiraat source data beyond Al-Fatihah's near-universally-cited
مالك/ملك difference. Needed, in order:

- A concrete source: the PDF the task references ("Future import of Qiraat data from PDF") was not
  supplied to this session. Part 26's ingestion pipeline (`PDF → Extraction → Normalization → Map
  to Surah/Ayah/Tokens → Map to Reader/Riwayah → Human/Rule Verification → Publish`) is designed
  into the `verificationStatus` lifecycle already (`06-verification-workflow.md`) but has no
  extraction step implemented yet — there is nothing to extract from.
- A decision from the user on which classical reference(s) to treat as authoritative for
  attribution (Al-Shatibiyyah + Al-Durrah for the eight + two, and/or a specific printed Nashr
  edition with page numbers) so every `qiraat_sources.source_reference` can cite something concrete
  instead of "classical Qiraat literature generally."
- A review pass: per `06-verification-workflow.md`, nothing skips REVIEWED before a second look —
  at Quran-wide scale this means either the user personally reviews each variant, or a second
  independent source is required before promoting past REVIEWED.

## 2. Engine work

- Upgrade from token-granular to a variable-arity token model so `INSERT`/`SPLIT` can each get
  their own DOM word slot (see the "known simplification" in `04-rendering-engine.md`) — needed
  once real INSERT/SPLIT data exists; not needed for REPLACE-only content.
- Multi-ayah variant spans, if any real Qiraat difference turns out to cross an ayah boundary
  (none of the page-1 data does; the current model only spans tokens within one ayah).

## 3. Data layer

- Apply `supabase/migrations/20260916120000_qiraat_ashr_schema.sql` (after a `pg_dump` backup and
  the user's go-ahead, per `HANDOFF.md`) and implement `SupabaseQiraatRepository` against the
  existing `QiraatRepository` interface — the fixture-backed prototype was built specifically so
  this is the *only* change needed to move off fixtures (`03-database-schema.md`).
- Bulk-load 604 pages' worth of variants once real data exists, mirroring how
  `scripts/import-mushaf1441-page-words.mjs` populates the Mushaf-1441 fixtures today — a new
  `scripts/import-qiraat-variants.mjs` reading from whatever the PDF pipeline produces.
- Generate `globals.css`'s `--q0N-*` block from `packages/qiraat-core/colors.ts` at build/lint time
  instead of hand-mirroring the 30 hex values (flagged as a manual-sync risk in
  `02-color-system.md`).

## 4. Testing at scale

- Extend `engine.test.mjs`'s pattern to a data-driven test that loads every seeded page's
  fixture/DB rows and asserts structural invariants (no reading duplicated across two variants at
  the same token, every VERIFIED/PUBLISHED row has at least one source, etc.) — a linter for the
  dataset itself, not just the engine logic.
- Re-run `07-first-page-test.md`'s manual checklist against a sample of pages per surah (not all
  604) before declaring the rollout done, per the same "prototype first, then scale" discipline.

## 5. Explicitly out of scope for this task

- Phonetic/pronunciation-only differences (imalah gradients, madd length, ishmam) that don't change
  the *written* token — the current engine is a text-substitution engine, not a phonetic one. The
  page-1 REVIEWED سين/صاد variants were deliberately simplified to a plain letter swap rather than
  modeling ishmam as a third character; a true phonetic layer is future work, not a bug to fix now.
- A full admin/CMS UI for the verification workflow — Part 38's debug view is one checkbox, not a
  review dashboard. Worth building once there is enough data for a checkbox to be unwieldy.
