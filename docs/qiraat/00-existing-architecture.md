# 00 — Existing architecture (inspected before writing any Qiraat code)

Inspected 2026-09-16, on branch `claude/qiraat-ashr-system-82wxgx` (from `main`). This is Phase 0 of the
Qiraat Ashr task: findings only, no design decisions here (see `01-qiraat-domain-model.md` onward).

## Framework / stack

- Next.js **16.2.6**, App Router, **Turbopack**, React **19.2**, TypeScript, Tailwind v4.
- Backend: self-hosted Supabase (Postgres 17 + GoTrue + PostgREST) behind a Tailscale Funnel, accessed
  via `@supabase/ssr`. RLS everywhere, single app user (`auth.uid() = user_id`).
- No test framework dependency beyond Node's built-in `node:test` run through `tsx --test`
  (`tests/proxy-autologin.test.mjs`, `npm run test:proxy`) plus a family of plain-Node `scripts/validate-*.mjs`
  validators wired into `npm run mushaf:validate`. There is also a Python/Playwright suite
  (`tests/test_mushaf_page_performance.py`) run against a local `next start` build.

## Quran/Mushaf rendering implementation

- `/mushaf-1441` (`src/app/mushaf-1441/page.tsx` + `_components/Mushaf1441Viewer.tsx`, ~3,177 lines) is a
  single large **client component**. The server page (`page.tsx`) resolves the initial page number, fetches
  the first page's words/metadata and the user's mutashabihat highlights (if signed in), and hands them to
  the viewer as props.
- Page data is **not** in Supabase. It is a set of 604 **static JSON fixtures**,
  `packages/quran-data/mushaf1441/fixtures/page-words/page-NNN.json`, one per Mushaf page, imported through
  `pageWordsIndex.ts` (a manifest of `import()` loaders keyed by page number) and `pageLoader.ts`
  (`loadMushaf1441Page(pageNumber)`), and served by the route handler
  `src/app/api/mushaf-1441/page-words/route.ts` (`GET ?page=N`, long-lived CDN cache headers). Page
  metadata (surah/juz/hizb ranges, decorations) is computed alongside from
  `packages/quran-data/mushaf1441/{pageMetadata,pageDecorations}.ts`.
- **This is the key fact for Qiraat**: because page-word data is a build-time-bundled static asset, not a
  DB round trip, a page-scoped Qiraat endpoint can follow exactly the same shape (a fixture-backed
  repository behind a thin route handler) and needs **no Supabase reachability at all** to work — unlike
  mutashabihat highlights or annotations, which do require the authenticated backend.

## Token / identifier model

`packages/quran-data/mushaf1441/types.ts` already defines the canonical addressable unit:

```ts
interface MushafWord {
  id: string                 // stable per-word id, unique across the whole Mushaf
  pageNumber: number         // 1–604
  lineNumber: number         // 1–15 within the page
  wordIndexInLine: number
  surahNumber: number
  ayahNumber: number
  wordIndexInAyah: number    // 1-based position of the word inside its ayah
  ayahKey: string            // "surah:ayah", e.g. "1:4"
  textUthmani: string
  glyph?: string             // QCF v2 codepoint(s) for this exact page's custom font
  textQpcHafs?: string       // plain-Unicode fallback text (also Hafs)
  qcfVersion?: string
}
```

So the Quran already has exactly the identifier the Qiraat task asks for
(`surah:ayah:token` via `surahNumber` + `ayahNumber` + `wordIndexInAyah`, with `ayahKey` as the
"surah:ayah" shorthand and `id` as a ready-made unique token key). **No new `quran_tokens` table is
needed** — `MushafWord` already is that table, expressed as fixtures. Qiraat variants anchor to
`(surahNumber, ayahNumber, wordIndexInAyah)`, i.e. exactly Part 7's "recommended `surah:ayah:token`",
with `pageNumber`/`lineNumber` carried for convenience only (never as the canonical key).

One structural fact that constrains the Riwayah rendering engine: **the base Mushaf text is glyph-based**.
`word.glyph` is a codepoint into a *page-specific* QCF v2 font (`getQcfV2FontFamily(pageNumber)`) whose
shapes are pre-composed for the exact Hafs Uthmani layout of that physical page (ligatures, spacing, line
justification all baked into the font). This glyph pipeline **cannot render a different Riwayah's text**
— there is no Warsh glyph font, and even if there were, word-length changes would break the page's fixed
line layout. The existing code already has a graceful fallback for exactly this situation: when the
per-page QCF font hasn't loaded yet, it renders `word.textQpcHafs ?? word.textUthmani` in the Amiri Quran
Unicode font instead (`useGlyph = qcfFontStatus[page] === 'loaded' && Boolean(word.glyph)`). The Qiraat
renderer reuses this same fallback path for any word carrying an applied variant: unaffected words keep
their exact glyph position, and only the differing word(s) drop to flowing Unicode text. This is the
"safe line-level reflow when unavoidable" trade-off Part 21 asks to document.

## Current Mutashabihat highlighting system (the closest existing analog)

This is the pattern to imitate for Qiraat, not reinvent:

- Domain lives in a **framework-agnostic package**, `packages/mutshabehat-core/` (`mushafLinkAdapter.ts` +
  `sampleMushafLinks.ts`), imported by the viewer with relative paths (`../../../../packages/...`).
- Real (Supabase-backed) links are loaded **server-side** with the initial page
  (`src/lib/mushaf-mutshabehat.ts`, used by both `page.tsx` and
  `src/app/api/mushaf-1441/mutshabehat/route.ts`) so the first paint already has highlights, with the
  client route as a same-shape fallback (`GET /api/mushaf-1441/mutshabehat[?ayahKeys=...]`, session-cookie
  auth via `getSessionUser`, 401 when logged out, 503 on real misconfiguration).
- The viewer turns the flat link list into a `Map<ayahKey, link>` once
  (`allHighlightByAyahKey` / `mutshabehatHighlightByAyahKey`) and reads that map, **by closure**, from
  inside the per-word render functions (`renderQcfWord`, `renderWordGap`, `getWordBandColor`). Per-group
  colour comes from a small deterministic hash over 10 preset tints (`tintForGroup`), not stored per row.
- Colour is applied as a background band across the *gap* between adjacent words when both share the same
  colour (`renderWordGap`), which is how "one continuous highlighter band per ayah" is achieved without a
  wrapping element per ayah. A Qiraat *underline* marker is a different visual (border-bottom on the word
  itself, not the gap), so it composes with this without collision — see Part 27 of the task and
  `06-verification-workflow.md`/`05-ui-ux.md` for the layering rule.
- There is also an **already-scaffolded, unused Qiraat stub** (`packages/qiraat-core/` — `types.ts`,
  `qiraatAdapter.ts` with `getQiraatVariantsByAyahKey(ayahKey, source)`, `sampleQiraatSource.ts` pointing at
  an intentionally-empty fixture, `validate.mjs`) and a matching **placeholder tab** in the viewer already
  wired up end to end: `DetailPanelTab = 'notes' | 'mutshabehat' | 'qiraat'`, a `qiraatVariantsForSelectedAyah`
  memo that calls the stub adapter, and a "قراءات" detail-panel tab whose body currently just says
  *"البنية منفصلة في qiraat-core، ولا توجد بيانات قراءات موثقة محملة بعد"* ("the structure lives separately
  in qiraat-core; no verified Qiraat data is loaded yet"). **This is the intended integration point** — a
  previous session deliberately left the door open here instead of building ahead of verified data. This
  implementation extends that stub rather than replacing it with a parallel system.

## Performance-critical constraint that any Qiraat integration must respect

`HANDOFF.md` §5b and the 2026-09-15 changelog entry describe a recently-finished, carefully measured
performance pass: page turns render in ~1 ms because `MushafPageSlot` (a `memo`-wrapped component with a
**custom, explicit comparator**) keeps the current page/spread plus one neighbour on each side mounted,
and a "turn" is only a visibility swap. The comparator explicitly ignores the `render` prop and instead
gates re-invocation on a fixed list of other props (`pageNo`, `layout`, `page`, `metadata`, `fontStatus`,
`highlights`, `annotations`, `selection`, `loading`). Any data that should affect a mounted page's visual
output — Qiraat's selected mode/reading/study-mode/variant map included — **must** be passed as one of
these compared props (a new stable object, recomputed only when it actually changes) and added to the
comparator; it must **not** be read from component-level state that isn't threaded through as a prop,
or mounted neighbour pages will silently go stale. `highlights={slotHighlightByAyahKey}` is the existing
example of exactly this pattern; Qiraat adds a `qiraat={...}` prop the same way.

## Existing color system

`src/app/globals.css` defines Mutashabihat's "part" colours as semantic OKLCH tokens
(`--color-shared`, `--color-diff`, `--color-diff2`, `--color-diff3`, `--color-addition`, `--color-unique`,
each with a `-bg` companion) plus surface/text/brand tokens. These are explicitly documented in
`PROJECT_MASTER.md` as "core meaning, keep consistent" — i.e. off-limits for reuse. Qiraat gets its own,
separate token namespace (`--q01-*` … `--q10-*`, per the task's Part 2), never overlapping these.

## Navigation / state management

- No global state library. Per-page client state lives in `useState`/`useMemo`/`useRef` inside
  `Mushaf1441Viewer`; cross-render-safe mutable data (for event handlers inside memoized slots) goes
  through a `liveRef` object updated every render. Settings that should survive a reload use `localStorage`
  directly with a versioned key (e.g. `mushaf1441:last-page:v1`, the swipe-nav setting in
  `src/components/SwipeNavigationSetting.tsx`) — read in an effect after mount, not blocking first paint.
- Routing is the Next.js App Router; the reader takes `?page=N` and syncs it via `router.replace`.

## Database technology / API layer

- Supabase Postgres via PostgREST, RLS-scoped to the single app user. DDL is applied by hand
  (`docker compose exec db psql ...`) from the Mac Mini — **not reachable from this sandboxed session**
  (no Tailscale connectivity here). Consequently any new DB schema for Qiraat is written as a migration
  file for the user to apply later, and the working prototype in this session is fixture-backed (mirroring
  how Mushaf page-words themselves work) rather than Supabase-backed. This matches Part 4's instruction not
  to over-engineer storage before the data model is proven, and Part 42/K's requirement to flag missing
  blocking resources rather than silently fabricate connectivity.

## Mobile / iOS compatibility

- PWA (`public/manifest.json`, `public/sw.js`), RTL, mobile-first. No native/Capacitor wrapper yet (listed
  as a future item in `CLAUDE.md`'s roadmap). Nothing about Qiraat is mobile-incompatible — markers are
  plain CSS (border-bottom / background), the bottom-sheet reuses the same detail-panel drawer pattern
  already used for notes/mutashabihat on mobile.

## Existing tests

- `npm run mushaf:validate` — a chain of `scripts/validate-mushaf1441-*.mjs` Node scripts asserting
  fixture/data invariants (page order, word/field agreement, header slots, navigation, Supabase
  interactions, page-ayat mapping).
- `npm run test:proxy` — one `node:test` file via `tsx --test`, needs real Supabase env vars.
- `tests/test_mushaf_page_performance.py` — Playwright/Python performance regression, run against a local
  `next start` build.
- No existing test touches Qiraat beyond `packages/qiraat-core/validate.mjs`, which only asserts the
  scaffold's shape and that the bundled sample fixture is empty ("no verified qiraat data is bundled").

## Quran text source / fonts

- `public/quran/ayahs.json`: 6,236 ayahs, **Uthmani script** (alef wasla `ٱ`, dagger alef, etc.) — any text
  matching must go through `normalizeArabic`/`rasmSkeleton` (`src/lib/arabic.ts`). Not used by the Mushaf
  reader itself (which has its own per-page word fixtures) but used by the Quran search feature.
- Quran UI font: `Amiri Quran` (`next/font/google`, `--font-amiri-quran`), used as the fallback whenever a
  page's specific QCF v2 glyph font (loaded per-page from `verses.quran.foundation`) hasn't finished
  loading. UI chrome font: `Cairo`.

## Words individually addressable in the DOM

Yes — every word renders as its own `<button data-word-id-implicit key={word.id}>` element
(`renderQcfWord`), independently clickable/long-pressable/right-clickable, already wired to a context menu,
annotation targeting, and (for personal mutashabihat) a tap-to-open ayah card. This is exactly the
granularity Qiraat markers need (per-word underline / tap-to-open bottom sheet) and requires no new DOM
structure, only new conditional styling and click-branching inside the existing word renderer.

## Where Qiraat integrates, with minimum disruption

| Concern | Reuses | New |
|---|---|---|
| Domain types/colors/engine | — | `packages/qiraat-core/*` (rewrites the existing empty stub, keeps its adapter name) |
| Page-scoped data fetch | Same shape as `page-words`/`mutshabehat` routes | `src/app/api/mushaf-1441/qiraat/route.ts` |
| Word-level rendering | `renderQcfWord`/`renderWordGap` closures, `MushafPageSlot` prop-gated memoization | one new stable `qiraat` prop + comparator entry; marker/substitution logic inside the existing renderers |
| Detail UI | The already-scaffolded `qiraat` detail-panel tab | real bottom-sheet content, `QiraatToolbar`, `QiraatLegend` components |
| Settings persistence | `localStorage` versioned-key pattern | `mushaf1441:qiraat-prefs:v1` |
| Colors | Separate token namespace in `globals.css`, same OKLCH/hex convention | `--q01-*` … `--q10-*` |
| Storage (future) | Supabase/RLS conventions, `supabase/migrations/` | schema documented now, **not applied** in this session (no backend connectivity) |

No existing file is rewritten wholesale. `Mushaf1441Viewer.tsx` gains new state, new closures, and new
prop plumbing, but its rendering pipeline, memoization strategy, and Mutashabihat behavior are unchanged.
