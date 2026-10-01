# Qiraat annotation engine — Phase 0 audit and migration map

**Audited:** 2026-09-21 on `feature/qiraat-annotation-engine-v2`, based on the checked-out application and read-only inspection of the local self-hosted Postgres database. This document is an engineering map, not a scholarly source.

## Current architecture

- **Application:** Next.js 16.2.6 App Router, React 19.2, TypeScript, Tailwind v4, RTL.
- **Persistence:** self-hosted Supabase/Postgres 17 through `@supabase/ssr` / PostgREST with RLS. Route handlers use the server client; the app is single-user but still has a real session.
- **Migrations:** additive SQL files in `supabase/migrations/`; production DDL requires explicit user approval and a `pg_dump -Fc` backup. The local development environment targets the real self-hosted database, so Phase 1 must use an isolated test schema/database strategy before any write test is allowed to touch that instance.
- **Deployment:** Git-connected Vercel; a feature branch receives a preview and only `main` deploys production. Vercel functions must remain pinned to `bom1` and use `resilientFetch` for the Tailscale backend.

## Quran word identity and rendering

`packages/quran-data/mushaf1441/fixtures/page-words/page-NNN.json` is the page-accurate source used by the reader. A `MushafWord` already contains `id` (current external/render ID), page/line index, `surahNumber`, `ayahNumber`, `wordIndexInAyah`, `ayahKey`, `textUthmani`, `textQpcHafs`, `glyph`, and `charTypeName`.

Thus `(surahNumber, ayahNumber, wordIndexInAyah)` is available for every real word token and is the correct basis for the new deterministic natural key:

```text
%03d:%03d:%03d  ->  002:255:003
```

The fixture `id` is useful for current DOM interaction and existing `mushaf_annotations`, but it is not a durable semantic key. There is **no `quran_words` table** in the current database. Phase 1 must add one additively, with a surrogate UUID/identity key and `UNIQUE (surah, ayah, word_position)`, then import/validate it from the committed immutable page-word fixtures. It must retain `current_mushaf_word_id` as an optional render mapping, not semantic identity.

The renderer is not ordinary DOM Arabic text. `Mushaf1441Viewer.tsx` renders each token as a `<button>` and uses page-specific QCF V2 private-use glyphs only after that exact page font loads. Otherwise it falls back to Uthmani Unicode in Amiri Quran. A glyph is therefore a rendering token, not a Quran word. Alternate reading text cannot safely overwrite the QCF glyph or canonical fixture; the existing proven fallback is Unicode display for a selected variant. The future editor must initially display author-entered variants in its editor/detail presentation and only request in-page alternate rendering through the current guarded fallback path after dedicated layout tests.

## Current Qiraat capability

The app already has a mature fixture-backed Qiraat Ashr layer:

- domain and colours: `packages/qiraat-core/`;
- per-page variants, word-level rulings and page rules: `fixtures/{pages,rulings,rules}`;
- direct fixture repository: `packages/qiraat-core/repository.ts`;
- reader integration: `Mushaf1441Viewer.tsx`, `qiraat/qiraatWordMarker.ts`, toolbar/legend/reference components; and
- external API: `GET /api/mushaf-1441/qiraat`.

It prefetches immutable page fixtures for the currently mounted page/spread and neighbours. This is performance-critical: normal turns must remain fixture/local-cache reads, with no per-word API or recursive SQL work. Existing reader/narrator data has 10 readers and 20 narrators, and their colours are identity metadata in `readers.ts`, `narrators.ts`, and `colors.ts`.

The existing details panel is a viewing/review experience, not a persistent visual authoring editor. Word presses in the active Qiraat layer currently open Qiraat information rather than a write model.

## Existing database state (observed)

Contrary to older documentation that says the V2 schema is unapplied, the local self-hosted database currently contains the tables from `supabase/migrations/20260917120000_qiraat_v2_schema.sql`: `qiraat_authorities`, categories, sources, pages, loci, entries, details, authority/readings projections, evidence, notes and QA tables. At audit time it held 30 authorities (10 readers, 20 narrators), 24 categories, 244 pages, 7,038 loci and 7,247 entries. There are no routes/Turuq currently stored.

This pre-existing schema has valuable compatible concepts (`qiraat_authorities`, source documents, categories, loci and a write-time reading projection), but lacks the requested canonical Quran word identity, corpus/framework separation, closure table, groups, explicit authoring annotations, structured faces, annotation revisions, OCC, batch audit/rollback and resolved cache. It must be **extended**, not re-run, renamed, dropped, or replaced. The old `qiraat_entries` pipeline remains the verified fixture-import/provenance model until an explicit migration bridge is implemented.

## Integration points and compatibility constraints

| Concern | Existing seam | Phase 1+ approach |
|---|---|---|
| Word click | `renderQcfWord` and `liveRef` in `Mushaf1441Viewer.tsx` | Add editor-open state without changing canonical word text or the current Qiraat peek path until the editor is ready. |
| Slot performance | `MushafPageSlot` custom comparator and `qiraat` prop | Pass only a stable page-level resolved indicator map through a compared prop; never close over mutable editor state. |
| Page data | `loadMushaf1441Page`, static per-page fixtures | Seed/map canonical words from fixtures and use page as an accelerator only. |
| Existing Qiraat data | V2 tables and fixture generators | Preserve them; add an adapter/bridge later, never auto-convert uncertain scholarly records. |
| Colours | `qiraat_authorities.color_hex` and qiraat-core palettes | Use entity defaults; annotation override is separate and never mutates a default accidentally. |
| API style | Next route handlers + Supabase server client | Add authenticated `api/mushaf-1441/qiraat-editor/*` handlers with server validation and meaningful errors. |

## Risks and migration safety

1. **Live data:** local development points at the self-hosted production database. No DDL or seed may be applied without backup and explicit approval; no test may leave rows behind.
2. **Schema overlap:** do not create another conflicting `qiraat_*` source-of-truth vocabulary. New authoring tables will be named `qiraat_annotation_*` where a generic name would collide.
3. **Typography:** page-specific glyphs cannot represent arbitrary variants. Canonical QCF glyph rendering stays untouched in the first authoring release.
4. **Reading speed:** the resolved cache must be updated transactionally with writes, then loaded by page in one query/API payload. Normal turns cannot recurse through authorities.
5. **Scholarly safety:** current sources/corpus associations, framework applicability, routes, groups and taxonomy hierarchy require explicit verified source data. Missing records stay empty and are listed in `SEED_DATA_GAPS.md`.

## Required migration sequence

1. Before Phase 1 DDL: capture schema/data validation queries and take a named `pg_dump -Fc` backup after receiving approval.
2. Add canonical-word, corpus/framework, extensible entity/closure, framework membership, taxonomy, group, source-alias and entity-colour tables. Do not populate unverified scholarly facts.
3. Add the normalized annotation write model, its faces/variants/sources/revisions and server-side validation/RPC boundary.
4. Add the resolver projection/cache and same-transaction invalidation.
5. Add batch audit/rollback functions and only then the UI.

Every migration will be additive/idempotent where PostgreSQL permits it, run in one transaction, document a recovery query, and keep `mushaf_annotations`, all canonical fixture files, and existing Qiraat V2 rows intact.
