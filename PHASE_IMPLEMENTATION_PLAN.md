# Qiraat annotation engine — implementation plan

## Guardrails for every phase

- Work on `feature/qiraat-annotation-engine-v2`; never alter canonical page-word fixtures or Quran text for an annotation.
- Re-run `git status` before each mutation. Preserve unrelated work.
- Run `npm run test:qiraat`, `npm run mushaf:validate`, `npm run typecheck`, and `env -u __NEXT_PROCESSED_ENV npm run build` at each relevant exit gate. Add focused Node/TS and Playwright coverage before claiming UI behavior.
- A live DDL apply requires explicit user approval and a fresh named `pg_dump -Fc`; migration files can be authored and tested in an isolated database/schema first. Push each completed phase; merge to `main` only after preview verification.

## Phase 0 — complete with this commit

Files created: this plan, `AUDIT_AND_MIGRATION_MAP.md`, `QIRAAT_ENGINE_DATA_MODEL.md`, and `SEED_DATA_GAPS.md`. No functional code or database mutation.

## Phase 1 — canonical identity and master schema

Likely files:

- `supabase/migrations/20260921120000_qiraat_annotation_master.sql`
- `src/types/database.ts`
- `src/lib/qiraat-editor/{canonical-words,master-data,validation}.ts`
- `packages/qiraat-core/` adapter/types only where shared reader compatibility requires it
- `tests/qiraat/master-schema.test.ts` and isolated SQL migration tests
- `CHANGELOG.md`, `CLAUDE.md`, developer docs.

Add `quran_words`; corpus/framework; additive entity/closure/framework-membership; taxonomy, groups, sources and default colours. Use a fixture-derived canonical-word seeder/checker that asserts uniqueness and never changes fixtures. Adapt existing authorities by an explicit, verifiable mapping rather than duplicating them. Tests: reader ancestor lookup, narrator descendants, Tariq ancestry (once verified test fixtures supply one), closure depth, framework association, canonical uniqueness, taxonomy parentage and verified group expansion. Document backup, apply and recovery query. Commit: `feat(qiraat): add canonical qiraat master schema`.

## Phase 2 — annotation write model

Likely files:

- `supabase/migrations/20260921130000_qiraat_annotation_write_model.sql`
- `src/lib/qiraat-editor/{annotation-service,validation,types}.ts`
- `src/app/api/mushaf-1441/qiraat-editor/annotations/route.ts` and dynamic ID routes
- unit/integration tests under `tests/qiraat/`.

Add annotations, structured faces, variants, multiple sources and revisions. Implement anchor, framework/entity/taxonomy validation and expected-version OCC. Tests cover WORD, RANGE, BOUNDARY, cross-ayah boundary, three faces, revision history and stale update rejection. Commit: `feat(qiraat): add annotations faces variants and revisions`.

## Phase 3 — resolver and read model

Likely files:

- `supabase/migrations/20260921140000_qiraat_annotation_resolution.sql`
- `src/lib/qiraat-editor/{resolver,cache,page-read}.ts`
- `src/app/api/mushaf-1441/qiraat-editor/page/route.ts`
- resolver/cache tests and a measured page-query benchmark.

Implement closure-based INHERIT/OVERRIDE/EXCLUDE resolution and same-transaction targeted cache updates. Cover reader inheritance, narrator/Tariq overrides, exclusions, unrelated branches, revision propagation and limited invalidation. Document DB/API/client timing separately. Commit: `feat(qiraat): add inheritance resolver and read model`.

## Phase 4 — batch engine

Likely files: batch migration, `batch-service.ts`, protected API endpoints, test fixtures and rollback integration tests. Build generic candidate → preview → selection → validate → commit flow; record mixed INSERT/UPDATE/DELETE and reverse in a transaction. The 50-record rollback test compares effective annotations/faces/variants/assignments/cache semantic state. Commit: `feat(qiraat): add transactional batch rollback`.

## Phase 5 — visual editor

Likely files:

- `src/app/mushaf-1441/_components/qiraat/QiraatAnnotationEditor.tsx`
- small editor subcomponents/styles next to current Qiraat UI
- viewer integration in `Mushaf1441Viewer.tsx`
- editor API client and Playwright tests.

Reuse current reader panels and `liveRef`/slot-prop conventions. Desktop is a drawer; mobile/tablet is a bottom sheet. Implement simple/advanced modes, explicit entity-rule assignment rows, faces, variants, sources, colour preview/override, existing assignments, Save/Next/Previous/Delete and OCC conflict recovery. Keep the QCF canonical display untouched. Commit: `feat(qiraat): add visual word annotation editor`.

## Phase 6 — range scope, indicators and review

Add second-word selection, range/boundary highlighting, page-level resolved indicators beneath or beside words, reader-filtered view and a review panel with counts/navigation. Indicators come from page cache data and never recolour canonical text. Test desktop/mobile, cross-ayah scopes, counts and page-turn regression. Commit: `feat(qiraat): add scope selection indicators and review mode`.

## Phase 7 — unified import validation

Expose the same server validation service through documented DTOs for manual/json/excel/AI/batch. No importer bypasses validation or writes a separate table. Commit: `feat(qiraat): prepare unified import validation`.

## Phase 8 — acceptance

Run unit, integration, isolated-migration, resolver/cache, batch rollback, Playwright, legacy Qiraat, Mushaf validators, typecheck/lint/build and representative manual reader checks. Create `QIRAAT_ENGINE_ACCEPTANCE_REPORT.md`; include measured timings, limitations and DDL/rollback/deploy notes. Commit: `test(qiraat): complete production acceptance validation`.
