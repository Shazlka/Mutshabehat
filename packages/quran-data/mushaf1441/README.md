# Mushaf Al-Madinah 1441 Data Module

Standalone preview data module for the future Mushaf Al-Madinah 1441 renderer.

The module now contains verified-source preview fixtures for 604 pages of page -> line -> word/token rendering using Quran.com QCF V2 glyph codes and line numbers. The older `sample-page-1.json` file remains only as a schema smoke-test fixture; do not use it as Quran or Mushaf source data.

## Files

- `types.ts` - TypeScript interfaces for Mushaf pages, lines, words, notes, qiraat variants, and Mutshabehat highlights.
- `schema.json` - JSON schema for one Mushaf page fixture.
- `pageLoader.ts` - lazy page loader for the 604 page-word fixtures.
- `pageMetadata.ts` - page header metadata, surah options, juz, hizb, and rub lookup helpers.
- `fixtures/sample-page-1.json` - fake fixture with 15 lines for renderer and validator development.
- `fixtures/page-words/` - per-page QCF V2 word/token fixtures for pages 1-604.
- `import-verified-source.mjs` - placeholder for a future import pipeline after a verified source is provided.
- `validate.mjs` - local validator that writes `validation-report.json`.

## Removed Visual Page Mode

The `/mushaf-1441` viewer no longer exposes the visual image/PDF-style page mode. Rendering is line-based from page-word data only. `pageImages.ts` remains as a historical helper and must not be wired back into the route unless a later phase explicitly reintroduces a visual verification view.

## Supabase Preview Setup

Annotations are designed to persist in `public.mushaf_annotations` once the preview migration is applied to a non-production Supabase branch:

- proposal: `packages/quran-data/mushaf1441/supabase-interactions-schema-proposal.sql`
- preview migration: `supabase/migrations/20260628000000_mushaf_annotations_preview.sql`
- environment check: `npm run mushaf:supabase`

Do not apply the migration to production from this preview module. The environment check prints only host/table status, project-ref diagnostics, and key length summaries; it never prints API keys. Set `MUSHAF_1441_EXPECTED_SUPABASE_REF` in `.env.local` when you want the checker to fail fast if the preview URL points at the wrong project.

The app-facing required values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is optional for local diagnostics and is not used by the Mushaf preview route.

After applying the preview migration to a non-production Supabase branch/project, verify annotation persistence with a signed-in preview user's access token:

```bash
MUSHAF_1441_TEST_ACCESS_TOKEN=<signed-in-preview-user-token> \
  npm run mushaf:supabase:crud
```

The verifier inserts temporary note, highlight, bookmark, and favorite rows through Supabase REST, reads them back, updates one note, and deletes all temporary rows. It never prints API keys or the access token.

## Validation

Use the project runtime from `.nvmrc` before running the Next preview. The currently observed Homebrew Node v26 causes the local Next CLI to hang before binding a dev-server port.

On this machine, Homebrew `node@22` can be used without changing the globally linked Node:

```bash
npm run mushaf:runtime
npm run mushaf:dev
```

Because the project is under iCloud Drive, the first Next startup and first route compile can take several minutes while files hydrate. If `/mushaf-1441` does not respond after the server prints `Ready`, sample the `start-server.js` child before assuming the route code is at fault.

Run:

```bash
npm run mushaf:runtime
npm run mushaf:validate
npm run mushaf:supabase
MUSHAF_1441_TEST_ACCESS_TOKEN=<signed-in-preview-user-token> npm run mushaf:supabase:crud
node packages/quran-data/mushaf1441/validate.mjs
node scripts/validate-mushaf1441-page-words.mjs
```

The validator enforces:

- page number is 1 through 604
- exactly 15 lines in the fixture
- every word has `surahNumber`, `ayahNumber`, and `ayahKey`
- `ayahKey` uses `surah:ayah`
- word order is strictly increasing inside each line
- no duplicate word IDs
