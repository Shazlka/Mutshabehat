# 03 — Database / data model

## Status: designed, NOT applied

`supabase/migrations/20260916120000_qiraat_ashr_schema.sql` implements the Part 8 schema in
Postgres, adapted to this project's existing conventions (RLS everywhere, `automated_groups`'s
"everyone reads, only service role writes" pattern for shared reference data — see that file's
`supabase-schema-automated.sql`). It has **not** been applied to the self-hosted backend: this
session has no Tailscale connectivity to the Mac Mini, and per `HANDOFF.md`/`CLAUDE.md`, production
DDL needs a `pg_dump` backup and the user's explicit go-ahead first regardless. The migration file
is idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO UPDATE` seeds) and safe to run
whenever that's ready.

## What actually powers the prototype right now

`packages/qiraat-core/repository.ts`'s `FixtureQiraatRepository`, reading
`packages/qiraat-core/fixtures/pages/page-NNN.json` — the exact same pattern the 604 Mushaf
page-word fixtures already use (`packages/quran-data/mushaf1441/pageWordsIndex.ts` +
`pageLoader.ts`). This was a deliberate choice, not a shortcut forced by missing time: Mushaf-1441
page data is *already* a build-time static asset, not a Supabase round trip, so a page-scoped
Qiraat endpoint naturally wants the same shape, and it means the prototype needs zero backend
connectivity to work end to end (see `00-existing-architecture.md`).

Swapping to Postgres later is exactly: implement `SupabaseQiraatRepository` against the
`QiraatRepository` interface (`getVariantsForPage(pageNumber, options)`), point
`src/app/api/mushaf-1441/qiraat/route.ts` at it instead of `defaultQiraatRepository`. Nothing above
that interface (the engine, the attribution logic, the UI) changes.

## Schema (mirrors Part 8, Postgres types)

| Table | Notes |
|---|---|
| `qiraat_readers` | 10 rows, seeded by the migration. `id` constrained to `Q01`–`Q10`. |
| `qiraat_narrators` | 20 rows, seeded. `id` constrained to `Q0N-R0[12]`, FK to `qiraat_readers`. |
| `qiraat_readings` | 20 rows, generated from `qiraat_narrators` × `qiraat_readers` by the seed `SELECT`, never hand-duplicated. Exactly one `is_baseline = true` row (`Q05-R02`), enforced by a partial unique index. |
| `quran_tokens` | Optional/future — see `01-qiraat-domain-model.md`. Not populated; the Mushaf-1441 fixtures serve this role today. |
| `qiraat_variants` | The core table. `operation`/`difference_type`/`verification_status` are Postgres enums matching `types.ts` exactly. `updated_at` auto-touched by trigger. |
| `qiraat_variant_readings` | Many-to-many, `(variant_id, reading_id)` composite PK — Part 8's explicit requirement, avoids duplicating a variant row per reading. |
| `qiraat_sources` | One-to-many from a variant; `source_type` CHECK-constrained. |

## RLS

Every table has RLS on. Readers/narrators/readings/tokens: `USING (true)` (public catalog data, no
reason to hide it). `qiraat_variants`/`qiraat_variant_readings`/`qiraat_sources`: `USING
(verification_status IN ('VERIFIED','PUBLISHED'))` — an EXTRACTED/MAPPED/REVIEWED row is
structurally invisible to the anon-key client, not just hidden by application logic. The app's
debug/admin view (`?debug=1` on the API route, Part 38) therefore has to run over the
service-role client once this is wired to Postgres, exactly like other server-only admin paths in
this app — never relax the RLS policy itself to "make debug mode work."

## Why not duplicate the Quran 20 times (Part 4)

`qiraat_variants` stores only what differs from Hafs, anchored to a token range, attributed to
however many of the 20 readings actually read it that way via `qiraat_variant_readings`. Rendering
a full Riwayah is "Hafs base text, with `qiraat_variants` swapped in wherever one exists for that
reading" (`04-rendering-engine.md`) — never a second copy of the Quran per Riwayah.
