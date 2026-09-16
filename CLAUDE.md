@AGENTS.md

# Project: متشابهات V2 (Mutshabehat V2)

Arabic Quran "mutashabihat" (similar verses) library. Next.js 16 (App Router, **Turbopack**),
React 19, Supabase (SSR + RLS), Tailwind v4, D3 (network graph only).

- **📘 Start with `PROJECT_MASTER.md`**: locations, GitHub/Vercel/Tailscale wiring, backend, schema, design, rules.
- **Live:** https://mutshabehat-v2.vercel.app
- **Deploy:** `git push origin main` (Vercel git-connected, Production Branch `main`; fallback
  `vercel --prod --yes --scope shazlka-s-projects`, project `mutshabehat-v2`, user `amreshazly-4497`)
- **Backend:** self-hosted Supabase (Postgres + GoTrue + PostgREST + Caddy) on the Mac Mini under Colima,
  exposed at `https://youssefs-mac-mini.tailcd68dd.ts.net:8443` (Tailscale Funnel). The Supabase Cloud
  project `tthlhkdmwusxerfiimgc` is retired (paused, data migrated 2026-08-31).
- **Location:** `~/Projects/mutshabehat-v2` on the Mac Mini (GitHub `Shazlka/Mutshabehat`, branch
  `main`; V2 replaced the legacy V84 app on 2026-09-15, which is archived as `legacy-v84-main` / tag `legacy-v84-final`). This is the
  only checkout (`~/dev/mutshabehat-v2` was removed 2026-09-15). Ignore iCloud/OneDrive "Mutshabehat" folders.
- **Local build/dev env gotcha:** if a shell has `__NEXT_PROCESSED_ENV` set (leaks in from another
  Next.js process), `next build`/`next dev` will **skip loading `.env.local`** and fail to prerender
  with "Supabase URL and API key are required". Run with `env -u __NEXT_PROCESSED_ENV ...` or use a
  clean shell. Also unset any foreign `NEXT_PUBLIC_*` vars from other projects.

## Gotchas (read before coding)
- AGENTS.md: this Next.js has breaking changes — check `node_modules/next/dist/docs/` first.
- `ssr: false` dynamic imports are **NOT allowed in Server Components** — wrap in a client component.
- **Turbopack build output does NOT print Size / First Load JS columns.** Measure bundles via
  `.next/static/chunks` file sizes instead.
- `public/quran/ayahs.json` is **Uthmani script** (alef wasla `ٱ` U+0671, not `ا`). Any text
  matching must go through `normalizeArabic` (`src/lib/arabic.ts`), which folds `ٱ→ا` + strips tatweel.
- Applying DB DDL: the `service_role` key CANNOT run DDL via PostgREST. The backend is self-hosted, so the
  Management API no longer applies. Back up, then run `docker compose exec -T db psql -U postgres -d postgres
  -v ON_ERROR_STOP=1 --single-transaction < file.sql` from `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost`,
  then `NOTIFY pgrst, 'reload schema'` (PROJECT_MASTER.md §8). The `supabase` CLI and host `psql` are not installed.
- **📋 CHANGELOG IS MANDATORY:** every bug fix, feature, or performance improvement **MUST** be
  recorded — dated, newest-first — in **both** the `# Changelog` section below **and** the root
  `CHANGELOG.md` (keep the two in sync), before the work is considered done. This is the running
  history/log of all changes for future reference.

# Changelog

> Newest first. One dated entry per change (bug fix / feature / perf). Include the files touched
> and any required DB migration. This log is the source of truth for "what changed and when".

## 2026-09-16
- **Feature — Qiraat Ashr (ten canonical Quran readings) prototype on Mushaf page 1:** a full,
  tested architecture (not just scaffolding) for the ten readers / twenty narrators / twenty
  Riwayat, integrated into the Mushaf 1441 reader as an additional layer alongside the existing
  Hafs baseline and Mutashabihat highlighting. Three modes reachable from the reader's burger menu
  under a new "القراءات" panel: **المصحف** (normal, unchanged Hafs, the default — Qiraat code paths
  don't even run), **مقارنة القراءات** (Hafs text stays displayed; a color-coded underline marks
  words with documented variants — solid narrator/reader color for one narrator or a whole reader,
  a segmented gradient for several readers sharing one variant; filterable by الكل/قارئ/رواية; a
  Study Mode toggle thickens the marker and adds a light background tint), and **القراءة برواية**
  (renders the entire page according to any of the 20 selected Riwayat, switchable instantly with
  no navigation, with an optional "إظهار الاختلاف عن حفص" marker). Tapping a marked word opens the
  existing (previously-empty-placeholder) "قراءات" detail-panel tab with the full attribution
  (readers grouped with their narrator pairs), difference type, verification status, and source
  citation. New framework-agnostic domain package `packages/qiraat-core/` (types, canonical
  reader/narrator/reading IDs and colors, a deterministic token-anchored rendering engine
  supporting KEEP/REPLACE/INSERT/DELETE/MERGE/SPLIT/DIACRITIC_CHANGE/ORTHOGRAPHIC_CHANGE, an
  EXTRACTED→MAPPED→REVIEWED→VERIFIED→PUBLISHED verification lifecycle that keeps unverified data
  out of the default view, and a fixture-backed `QiraatRepository` — superseding its earlier empty
  scaffold). New route `GET /api/mushaf-1441/qiraat?page=N` (no auth needed — shared reference
  data, same cache strategy as `page-words`). Seeded with one real, classically-cited variant
  (1:4 مالك/ملك, VERIFIED, 8 readers/16 narrators) and two REVIEWED-tier ones (1:6–1:7 الصراط
  سين/صاد, Hamzah) plus clearly-labeled SYNTHETIC fixtures exercising every remaining operation and
  attribution case (never rendered in the app). New CSS tokens `--q01-*`…`--q10-*` in
  `globals.css`. 16 new unit tests (`packages/qiraat-core/engine.test.mjs`, all passing), the whole
  Mushaf-1441 fixture set untouched and its 7 existing validators still passing, `tsc --noEmit` and
  `next build` clean, and manual Playwright/Chromium verification of every mode, the multi-reader
  marker, Riwayah switching, the difference-from-Hafs toggle, and Study Mode (screenshots and full
  results in `docs/qiraat/08-test-results.md`). Files: `packages/qiraat-core/*` (rewritten from the
  earlier stub), `src/app/api/mushaf-1441/qiraat/route.ts` (new),
  `src/app/mushaf-1441/_components/qiraat/*` (new: `QiraatToolbar`, `QiraatLegend`,
  `qiraatWordMarker.ts`), `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`,
  `src/app/globals.css`, `scripts/validate-mushaf1441-phase5.mjs` (rewritten for the real
  integration). **DB migration written, NOT applied** (no backend connectivity from this session —
  see `docs/qiraat/03-database-schema.md`): `supabase/migrations/20260916120000_qiraat_ashr_schema.sql`.
  Full design docs: `docs/qiraat/00`–`09`. **Not done**: full-Quran data (only page 1 has real
  content — see `docs/qiraat/09-full-rollout-plan.md` for what that needs; this was intentional
  per the task's own "prototype first" sequencing, not an oversight).

## 2026-09-15
- **Performance — Mushaf page turns render in ~1 ms (finishes the Codex "2 ms rendering" task):** the reader now keeps the current page/spread plus one neighbour on each side mounted as memoized `MushafPageSlot`s stacked in one grid cell; a turn only flips which slot is visible. Measured on a local production build (Chromium, prefetched turns): React render→commit **0.8–1.3 ms**, click→commit **1.8–2.4 ms**, **0 page slots re-rendered** (desktop spread and phone, with and without the curl); before: 9–31 ms per turn. New neighbours mount afterwards in a deferred pass (`useDeferredValue`, 2–3 ms each), and both pages of the next/previous spread are prefetched. Page slots read session-wide highlight/annotation maps so their props stay identical across turns; slot event handlers go through a live ref; re-fetched annotations that didn't change keep the same array. The page curl now animates the real on-screen page elements (clip-path on the outgoing page, reflection transform on the incoming page as the back of the sheet) instead of rendering three extra page copies, and no longer forces a layout at turn start. Codex's earlier commits (`272e4d3`, `2ef9d83`: readable fallback text before the QCF font, bundled metadata, request de-duplication, font preload) were reviewed and kept. Regression: `tests/test_mushaf_page_performance.py::test_prefetched_turn_reuses_the_mounted_neighbor_page`. Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `src/app/mushaf-1441/_components/PageCurlOverlay.tsx`, `tests/test_mushaf_page_performance.py`, `scripts/validate-mushaf1441-objective.mjs` (context-menu token now goes through `liveRef`). No DB change.
- **Performance — Mushaf pages become readable immediately instead of waiting for the QCF font:** page text now paints with its Uthmani/Amiri fallback as soon as page data is available, then swaps to the exact page-specific QCF glyph font when it finishes loading. The initial font is preconnected/preloaded before hydration; page-word and metadata payloads are combined; concurrent page/prefetch requests share one in-flight promise; and the database-backed home route is no longer prefetched from the reader. Live baseline page turns were 794–1,087 ms because font loading gated text; local production-build app render/update is now 6.8–11.7 ms on an uncached turn and 3.7–5.9 ms on a prefetched turn across 1440×900, 1180×820 and 390×844 (below one 60 Hz frame; a literal 2 ms browser guarantee is not technically achievable). Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `src/app/api/mushaf-1441/page-words/route.ts`, `tests/test_mushaf_page_performance.py`. Verification: `npx tsc --noEmit -p .` (exit 0); `npm run mushaf:validate` (all validators passed); `env -u __NEXT_PROCESSED_ENV npm run build` (exit 0, 28 static pages); `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q tests/test_mushaf_page_performance.py` against `next start -p 3222` (4 passed); Chromium checks at all three target viewports (readable at DOMContentLoaded, one neighbour page request, zero separate metadata/home-prefetch requests, zero console/page/HTTP errors, page curl completed). No DB change.
  - Production verification separates public network latency from rendering: a cold page-data request took 650.6 ms but rendered in 7.4 ms after `responseEnd`; warmed requests took 63–69 ms and rendered in 4.4–4.6 ms. The browser regression therefore allows up to 5 s for public data arrival while retaining a strict `<50 ms` post-response render assertion.
- **Feature — Groups list: collapsed and magazine card views (desktop / iPad landscape):** the home list has two new views, picked from the العرض select or the new قائمة / مطوية / مجلة switch shown at ≥1024px. **بطاقات مطوية** shows equal cards with only the colour, number, title, surahs, ayah count and actions; clicking a card expands it across the full row with its colour-coded ayat and open/edit buttons. **مجلة** is an editorial mosaic that fills the page width: a dense grid (3/4/5 columns by width) of unequal tiles — hero, tall, wide, regular, short — sized by the group's text length with a stable per-group hash for variety, ayat faded out at the tile edge. Both views drop the page's max width and show 24 groups per page; phones and portrait tablets keep the normal list. Files: `src/components/GroupCardGrid.tsx` (new), `src/components/SortBar.tsx`, `src/app/(app)/page.tsx`. No DB change.
- **Feature — Mushaf iBooks-style page curl (replaces the swing flip):** turning a page now peels it like iPad Books. The outgoing sheet folds along a moving line from its outer bottom corner; the flat part stays, the folded flap shows the back of the sheet (in a spread: the page that lands on the other side, correctly oriented; on a single page: paper with the print showing through mirrored), with a crease highlight, a drop shadow and a shadow cast on the page revealed underneath. Buttons, wheel, keys, taps and the page slider play it automatically (~0.7 s); dragging a page (touch or mouse) curls it under the finger — release past ~30% or with a flick to complete, otherwise it falls back to the page it started from. The overlay renders the outgoing sheets once and updates clip-path/transform/SVG gradients per frame; their highlights stay on while they curl. Skipped with reduced motion and on the saved-page resume. The old touch-swipe handlers are replaced by the pointer drag. Files: `src/app/mushaf-1441/_components/PageCurlOverlay.tsx` (new), `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Feature — Test mode: words test, whole-Quran source, right/wrong statistics:** `/test` now has a question source (مجموعاتي / القرآن كاملًا) and a new mode **الكلمات المتشابهة**: one word/part of the ayah is hidden and you pick it from the similar wording. For personal groups the hidden part is a coloured diff/addition/unique part and the choices are the matching parts of the other locations; for the whole Quran the choices are words that follow the same one or two preceding words elsewhere in the Quran (pause marks stripped so they don't hint). Whole-Quran location questions offer surahs where an ayah opens with the same words (or, with a surah filter, nearby ayah numbers); identical wording elsewhere counts as correct. Mixed now rotates location/words/flash. Every answer is saved (`POST /api/test/answers` → `test_answers`) and the statistics tab shows correct, wrong and accuracy overall and per test type/source (`get_test_answer_stats`). Missed whole-Quran questions link to their mushaf page. Files: `src/lib/test-questions.ts`, `src/lib/test-questions-quran.ts` (new), `src/components/TestRunner.tsx`, `src/components/TestAnswerStats.tsx` (new), `src/app/(app)/test/page.tsx`, `src/app/(app)/stats/page.tsx`, `src/app/api/test/answers/route.ts` (new), `src/app/globals.css` (`.part-blank`). **DB migration:** `supabase/migrations/20260915180000_test_answers.sql` (applied on self-host after a pg_dump backup `backups/pre-test-answers-20260915.dump`).
- **Change — Mushaf bottom slider moves by page, not surah:** the quick slider now spans pages 1–604 (page 1 on the right). While dragging, the bubble shows the page number and the surah on that page; releasing (or arrow keys) jumps straight to that page, with the flip animation. The label beside it reads `ص N · surah`. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Feature — Mushaf paper page-turn animation:** turning pages (arrows, wheel, swipe, taps, slider jumps) now plays a short 3D page flip. The incoming page swings flat from the spine (spread) or page edge (single page) — forward sweeps left→right, back right→left — with a passing shadow, while the page revealed underneath brightens out of the leaf's shadow. Uses the Web Animations API on `[data-mushaf-leaf]` elements (transform/filter only, no layout change), 520 ms, and is skipped when the OS asks for reduced motion. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Feature — Mushaf two-page spread on desktop and iPad landscape:** at `(min-width: 1024px) and (orientation: landscape)` the reader shows an open-book spread: the odd page on the right, its even partner on the left, with a soft spine shadow. Arrows, wheel, swipe and tapping a page (left page → forward, right page → back) turn a whole spread; `?page=` still records the page navigated to. The partner page's words, fonts, metadata, highlights and notes are loaded too, and the next/previous spread is prefetched. Phones and portrait tablets keep the single page. `renderLineWords` now renders any page (page, number, metadata, layout). File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`; page-words validator token updated. No DB change.
- **Change — Mushaf ayah card opens collapsed:** tapping a highlighted ayah now shows only the group titles (colour swatch, title, number of locations, chevron). Tapping a title expands that group's ayat and open/edit actions (tap again to collapse); a group's details are fetched only when first expanded. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Fix — Mushaf highlight is one continuous band per ayah and appears instantly:** the space between words is now a flex filler (`renderWordGap`) that grows like `justify-between` and takes the highlight colour when both neighbouring words share it, so an ayah's colour is continuous instead of word-by-word. All of the user's ayah→group links are loaded on the server with the page (`src/lib/mushaf-mutshabehat.ts`, also used by `/api/mushaf-1441/mutshabehat`) and filtered per page locally, so highlights render in the first paint and on every page turn without a request (API fetch remains only as fallback). Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `src/app/mushaf-1441/page.tsx`, `src/lib/mushaf-mutshabehat.ts`, `src/app/api/mushaf-1441/mutshabehat/route.ts`, validators read the new loader. No DB change.
- **Fix — Mushaf mutashabihat highlight was only a font colour:** ayat in your personal groups now get a highlighter-style background band, with a different soft colour per group (10-colour palette, picked deterministically from the group id so a group keeps its colour on every page). The ayah card shows the group's colour swatch and tints the current ayah with it. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Feature — Mushaf resumes the last page:** every page change is saved (`localStorage` key `mushaf1441:last-page:v1`); opening the reader without `?page=` (Mushaf tab, home → back, after opening a group) jumps to the saved page instead of page 1. An explicit `?page=N` link always wins. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Feature — Mushaf 1441: surah banner redesign, personal mutashabihat highlight + card, wheel paging:** the surah header is now one scalable SVG (gold band, lattice, pointed cartouche, surah-number and ayah-count medallions) with the name positioned by geometry, fixing the misaligned/clipped name. Ayat that belong to your personal groups are drawn in one consistent teal with a dotted underline (`PERSONAL_AYAH_HIGHLIGHT`); clicking/tapping one opens a card with every group containing it, all similar ayat (colour-coded parts, current ayah marked), "jump to ayah", open and edit links (Esc/backdrop closes). Mouse wheel/trackpad turns pages (down → next, one page per gesture, ignores momentum; disabled while menus or the card are open). `/api/mushaf-1441/mutshabehat` reads the user from the session cookie (no auth-server round-trip). Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `src/app/api/mushaf-1441/mutshabehat/route.ts`, validators `objective` + `supabase-interactions` updated. No DB change.
- **Feature — Copied automated candidates are tagged and moved to the end:** personal groups now record `source_automated_id` (set by `/api/automated/copy`; earlier copies backfilled by exact title, lowest automated id when titles repeat). New view `automated_groups_with_copy` adds a per-user `copied` flag; `/automated` and the surah page's automated tab order by `copied, id`, so copied items sink to the end. Copied cards get a magenta "منسوخة" badge, soft border and tint (new tokens `--color-copied`, `--color-copied-bg`); the detail page shows the badge and a link to the personal copy instead of the copy button. **DB migration:** `supabase/migrations/20260915150000_automated_copy_tracking.sql`. Files: `src/components/AutomatedCard.tsx`, `src/app/(app)/automated/page.tsx`, `src/app/(app)/automated/[id]/page.tsx`, `src/app/(app)/surahs/[no]/page.tsx`, `src/app/api/automated/copy/route.ts`, `src/app/globals.css`.
- **Feature — Mushaf tab:** "المصحف" in the sidebar and mobile menu opens `/mushaf-1441`; the reader's top bar has a home button back to the app. Files: `src/components/Sidebar.tsx`, `src/components/MobileTopbar.tsx`, `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB change.
- **Fix — "Database not loaded" (Vercel DNS can't resolve the Funnel host, now also in `bom1`):** server-side Supabase clients (`src/lib/supabase-server.ts`, `src/proxy.ts`) use `resilientFetch` (`src/lib/resilient-fetch.ts`): undici Agent whose lookup tries system DNS, then DNS-over-HTTPS (Cloudflare → Google, TTL-cached), then the last known good IPs. TLS still validates the real hostname. `SUPABASE_FORCE_DOH=1` forces the DoH path for testing (verified locally: auto-login test + pages with data). New dependency `undici`. No DB change.
- **Feature — Mutashabihat test mode (`/test`, nav "اختبار"):** setup screen (mode, group scope all/favourite/completed/draft, surah, 10/20/50 questions). *اختيار الموضع*: the ayah is shown without colour hints and you pick its surah + ayah among the group's similar locations (identical wording counts for either). *بطاقات الاستذكار*: the location is shown, you recall, reveal and self-grade. *مختلط* alternates. After each answer every similar location is shown with colour-coded differences; the result screen lists missed groups with links. Files: `src/app/(app)/test/page.tsx`, `src/components/TestRunner.tsx`, `src/lib/test-questions.ts`, `Sidebar`, `MobileTopbar`. No DB migration.
- **Fix — Mushaf 1441 corrupted pages (data):** the importer placed every word on the page where its verse *starts* (`verses/by_page`), but verses spill onto the next page and QCF V2 glyphs only render with their own page's font. 25 pages had lines out of order and wrong glyphs (e.g. 80:41–42 drawn on page 585 line 1), and ~15 surahs lost their header/basmala slot. The importer now places words by their own `page_number`/`line_number` and moves misplaced ayah-end markers (84:21, page 589); all 604 fixtures were regenerated. New `scripts/validate-mushaf1441-page-order.mjs` (in `npm run mushaf:validate`) checks reading order, field/position agreement and header slots. Files: `scripts/import-mushaf1441-page-words.mjs`, `packages/quran-data/mushaf1441/fixtures/page-words/*`.
- **Fix — Mushaf 1441 rendering, layout and loading:** QCF text never renders before that page's own font is loaded (the old check `document.fonts.check()` returns true for unregistered fonts, and one failed neighbour font switched every page to fallback text); per-page font status with retry. Surah headers/basmalas whose slot is on the previous page are computed server-side (`pageDecorations.ts`, returned by `/api/mushaf-1441/page-words`). Lines are justified edge to edge (short surah endings centred); pages 1–2 use a centred block; surah banner no longer clips; page fills taller phone screens (up to +18%); font size is pure `cqw` so lines never overflow. Skeleton page while loading + route `loading.tsx`. `?page=N` deep links and URL sync. Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `src/app/mushaf-1441/page.tsx`, `src/app/mushaf-1441/loading.tsx`, `src/app/api/mushaf-1441/page-words/route.ts`, `packages/quran-data/mushaf1441/{pageDecorations,types}.ts`; stale validator expectations updated.
- **Perf + Feature — Fast saves, fast filters, openable automated cards, Surah tab:**
  - *Save:* editor save was ~7 sequential backend round-trips (auth check, ownership check, update, delete verses, insert verses, insert parts) plus a 650 ms delay and a `router.refresh()` that re-rendered the editor. It's now **one** `save_group()` RPC and navigates immediately. Files: `src/app/api/groups/[id]/route.ts`, `src/components/EditForm.tsx`.
  - *Auth round-trips removed everywhere:* `proxy.ts`, layout, pages and API routes read the user from the session cookie (`src/lib/session-user.ts`) instead of calling `auth.getUser()` on the auth server per request. PostgREST still verifies the JWT and RLS still applies.
  - *Filtering:* surah filter is an inner join inside the main query (was a separate query first); text search is one `search_group_ids()` RPC (was 2–4 queries). Automated title filter gets a trigram index. File: `src/app/(app)/page.tsx`.
  - *Automated cards:* title and "عرض كل الآيات (N)" open the new `/automated/[id]` page with every ayah, surah links, notes and a copy-to-personal button. Files: `src/components/AutomatedCard.tsx`, `src/components/AutomatedCopyButton.tsx`, `src/components/AutomatedList.tsx`, `src/app/(app)/automated/[id]/page.tsx`.
  - *Surah tab (السور):* `/surahs` shows 114 surah cards with personal + automated counts; `/surahs/[no]` lists that surah's personal groups and automated candidates (tabs, pagination, prev/next surah). Nav added to `Sidebar` and `MobileTopbar`; `Pagination` takes a `basePath`.
  - **DB migration:** `supabase/migrations/20260915120000_perf_save_search_surahs.sql` (`save_group`, `search_group_ids`, `automated_surah_counts` view, `automated_groups_title_trgm_idx`). Must be applied **before** deploying this code.
- **Fix — Production showed no data (Vercel couldn't reach the Mac Mini):** Vercel functions in the default `iad1` region failed DNS for the Tailscale Funnel host (`getaddrinfo ENOTFOUND youssefs-mac-mini.tailcd68dd.ts.net`), so auto-login and all queries failed. Diagnostic previews on `diag/dns-region` showed `bom1` resolves it and reaches `/auth/v1/health` (200). Added `vercel.json` pinning functions to `bom1`, which is also closer to the Mac Mini. Files: `vercel.json`, `PROJECT_MASTER.md`. No DB change.
- **Docs — Agent handoff verified against live systems:** `PROJECT_MASTER.md` now has a "where to search" guide (§10), an agent access/tools section (§11), the current prod deployment, the `git-main` alias, the Vercel dashboard link, the temporary `diag/dns-region` branch, and the `page-ayat` API route. `CLAUDE.md`: removed the stale `~/dev` copy note and replaced the Management-API DDL advice with the self-hosted `docker compose exec psql` path. No code or DB change.
- **DB — Re-applied missing schema on the self-hosted stack:** `supabase-stats-aggregates.sql`, `supabase-parts-fts.sql`, `supabase-indexes.sql`, `supabase-migration-tag-uniqueness.sql` (never re-run after the cloud→Mac Mini migration). `/stats` now uses the `get_dashboard_stats()` RPC, and search uses FTS plus rasm-skeleton trigram columns instead of the ILIKE fallback. Verified through the Funnel URL as the app user (RPC counts, `surah_counts` view, FTS). Backup: `mutshabehat-selfhost/backups/pre-schema-apply-20260915b.dump`.
- **Chore — Sync GitHub with production source:** committed the previously uncommitted Mushaf 1441 module (`src/app/mushaf-1441`, `src/app/api/mushaf-1441`, `packages/`), mushaf validation/import scripts, PWA icons/manifest/SW, loading skeletons and export route, which were already live on Vercel via CLI deploys. Merged `origin/feature/mushaf-1441-module` (auto-login first-request fix + proxy test). Added `PROJECT_MASTER.md` agent handoff doc and corrected stale location/backend notes in `CLAUDE.md`. No DB migration.

## 2026-06-28
- **Feature — Mushaf 1441 reader refinements (round 4):** surah banner spans full page width; double-tap/double-click a word copies the whole ayah to clipboard (+ toast); disabled native text selection & iOS callout on the page so long-press opens the menu without highlighting text; emoji replaced with inline SVG icons in context menu + hover card; bottom surah slider less sensitive (bigger thumb, navigates on release only) with a zoomed surah-name bubble above the thumb while dragging. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB migration.
- **Feature — Mushaf 1441 reader refinements (round 3):** full-width surah banner (name fits width); removed technical word-mapping fields from ayah details (friendly surah+ayah header instead); desktop hover preview card (highlight colour, notes, bookmark/favourite, mutshabehat); bookmark+favourite now in any word's right-click menu (act on the ayah), all menu items iconed; mobile swipe reversed to Arabic RTL (right→next, left→previous); bottom surah slider for quick jump; mobile ayah details open by long-press only (tap no longer selects) and the menu opens without selecting; top arrows follow RTL (previous → right, next ← left). File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB migration.
- **Feature — Mushaf 1441 reader refinements (round 2):** tap left half → next page / right half → previous (RTL); selected ayah/word uses a subtle paper-darker tint (`#ece2c8`) instead of yellow/black; 14 highlight colours (was 4); instant flipping via adjacent-page prefetch (words+metadata+font); full-bleed page on mobile; surah banner restyled with a Madina-style Islamic ornamental frame before the basmala; mutshabehat mapping activated (default flag on) — connected ayat marked + tappable connections panel. Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, `packages/mutshabehat-core/mushafLinkAdapter.ts`. No DB migration.
- **Feature — Mushaf 1441 reader UX overhaul:** `/mushaf-1441` is now the mushaf page itself — surah-name banner + basmala before ayah 1; juz/حزب/ربع + left/right page indicator moved into the page margins (separate header strip removed); fit-to-screen page via container-query sizing with evenly distributed 15 lines; swipe to turn pages; long-press a word/ayah for the highlight/notes menu; surah/ayah/page sliders + sign-in inside a burger menu; notes editor as an on-demand sheet. Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`, validators updated. No DB migration.
- **Fix — Login honors `?next=`:** `/login?next=/mushaf-1441` returns the user to the mushaf after sign-in (password/magic/Google). File: `src/app/(auth)/login/page.tsx`. No DB migration.
- **DB — Mushaf 1441 annotations table created (production):** applied the `mushaf_annotations` migration to the production Supabase project `tthlhkdmwusxerfiimgc`. Purely additive, isolated table (notes/highlights/bookmarks/favorites) with per-user RLS (`auth.uid() = user_id` on select/insert/update/delete), CHECK constraints (target shape, `line_number` 1–15, `page_number` 1–604, `ayah_key` format) and 3 supporting indexes. Existing tables untouched. Unblocks the Mushaf 1441 annotations feature (was 501 "table not installed"). Migration: `supabase/migrations/20260628000000_mushaf_annotations_preview.sql`.
- **Fix — Mushaf 1441 API type-safety bug:** `POST /api/mushaf-1441/annotations` failed `tsc` (validated `target` possibly `undefined` after the error guard). Tightened the guard so `target` is provably defined before the insert. File: `src/app/api/mushaf-1441/annotations/route.ts`. No DB migration needed.
- **Fix — Mushaf 1441 logged-out UX (401 vs 503):** annotations and Mutshabehat preview routes returned `503 "authentication unavailable"` for not-signed-in visitors; they now detect a missing session (`AuthSessionMissingError`) and return `401`, so the viewer shows the friendly "sign in to sync" message instead of a red error. Genuine misconfig still returns 503. Files: `src/app/api/mushaf-1441/annotations/route.ts`, `src/app/api/mushaf-1441/mutshabehat/route.ts`. No DB migration needed.

## 2026-06-11
- **Feature — Surah names preview on mobile group cards:** added a list of unique Surah names on the front face (preview) of mobile group cards in `GroupRow.tsx` formatted as inline flex items separated by gray dots and spaces (`السور: البقرة · آل عمران`). This uses a flexbox layout (`flex flex-wrap items-center`) to force block-level box formatting on children, which bypasses a well-known Safari rendering bug where inline text elements inside a parent container with 3D transforms (`preserve-3d`, `rotateY`, `backface-visibility`) flatten and overlap horizontally. Mobile tap highlights and text selection are disabled using `select-none` and `tap-highlight-color`. Files: `src/components/GroupRow.tsx`, `src/app/globals.css`. No DB migration needed.
- **Feature — Mobile header links to home page:** wrapped the mobile branding header (`متشابهات القرآن` and its subtitle) in a Link component in `MobileTopbar.tsx` so that tapping it returns the user to the home screen, matching the desktop brand behavior. Files: `src/components/MobileTopbar.tsx`. No DB migration needed.
- **Fix — Darker page background for contrast:** adjusted CSS variables (`--color-paper`, `--color-surface-2`, `--color-border`, `--color-border-soft`) in `globals.css` to make the page background slightly darker, significantly improving visual contrast and card boundary separation while maintaining the warm scholarly theme. Files: `src/app/globals.css`. No DB migration needed.
- **Fix — Mobile group cards now resize to fit active face:** modified CSS to make mobile card size only fit the active face (relative positioning when active, absolute when inactive). This keeps front face height compact, preventing unnecessary blank vertical space, and auto-extends the card to fit all ayahs when flipped. Files: `src/app/globals.css`. No DB migration needed.

## 2026-06-08 (2)
- **Fix — Swipe setting now changes the main groups screen:** when the swipe navigation setting is enabled, the mobile main screen no longer renders all flat/titles-only groups stacked vertically. It shows a single current group card with right/left swipe paging and previous/next buttons; desktop and setting-off behavior remain the normal vertical list. Files: `src/components/MainGroupSwipePager.tsx`, `src/app/(app)/page.tsx`, `src/components/SwipeNavigationSetting.tsx`. No DB migration needed.
- **Feature — Settings toggle for swipe-priority group navigation:** added a `التنقل` setting that lets the user prioritize right/left swipes for previous/next group navigation on the group detail page instead of having the gesture treated as vertical scrolling. The preference is stored per device in `localStorage` and takes effect without a reload. Files: `src/components/SwipeNavigationSetting.tsx`, `src/components/SwipeNavWrapper.tsx`, `src/app/(app)/settings/page.tsx`. No DB migration needed.

## 2026-06-08
- **Fix — Mobile group cards now flip instead of immediately navigating:** group rows and titles-only rows split desktop click-to-open from mobile tap-to-flip behavior. On mobile, tapping a card rotates it in place with stable 3D faces; the back side exposes the ayahs/options plus explicit `فتح المجموعة` and `تعديل` links, so the card tap is no longer stolen by row navigation. Files: `src/components/GroupRow.tsx`, `src/components/GroupRowTitlesOnly.tsx`, `src/app/globals.css`. No DB migration needed.

## 2026-06-07
- **Feature — SQL database backup/restore (Settings):** new `?format=sql` export emits a Supabase-compatible `.sql` restore file for all user data (tags, groups, verses, parts, group↔tag links). Idempotent upserts (`on conflict (id) do update`; links `do nothing`) in a `begin/commit` transaction, FK-ordered. Preserves original UUIDs + timestamps; embeds `user_id` literally → restore into the same project/auth user only. Files: `src/app/api/groups/export/route.ts`, `src/components/DatabaseExport.tsx`. No DB migration needed.
- **Feature — Mobile swipe navigation on group detail page:** swiping left navigates to التالية (next group) and swiping right navigates to السابقة (previous group), matching RTL reading direction. Real-time follow-finger translateX feedback with spring-back on aborted swipe; edge hint arrows (‹ ›) appear as opacity ramp during swipe. Axis detection (horiz vs. vertical) prevents interfering with normal page scroll; non-passive `touchmove` listener calls `preventDefault` only when horizontal. New file: `src/components/SwipeNavWrapper.tsx`. Updated: `src/app/(app)/groups/[id]/page.tsx` (wraps `GroupDetail` in `SwipeNavWrapper`). No DB migration needed.

## 2026-06-03 (2)
- **DB — Full indexing pass (`supabase-indexes.sql`):** Audit found 9 missing indexes. Added: `surah_counts` security-invoker view (SurahFilter was querying a non-existent relation), `groups_title_trgm_idx` + `parts_text_trgm_idx` (GIN trgm for ILIKE search fallbacks), `groups_user_title_idx(user_id, title)` (title sort), `verses_group_sort_idx(group_id, sort_order)` + `parts_verse_sort_idx(verse_id, sort_order)` (pre-sorted delivery on every group page), `group_tags_tag_id_idx(tag_id)` (reverse tag join in stats RPC), partial indexes `groups_user_favorite_idx` + `groups_user_completed_idx`, `groups_user_status_idx(user_id, status)`. **⚠️ Run `supabase-indexes.sql` in Supabase SQL Editor.**

## 2026-06-03
- **Perf — Group navigation made fast:** Three compounding performance bugs fixed:
  (1) `prefetch={false}` on all nav Links disabled the Next.js router cache — removed from `GroupMobileBottomBar` and `GroupBrowseNav`. (2) No `loading.tsx` meant blank screen on click — added skeletons for both `/groups/[id]/` and `/groups/[id]/edit/`. (3) Nested PostgREST select ran 3-4 sequential Supabase round-trips — rewritten as 2 parallel rounds: (group+verses+auth) then (parts+nextNeighbour+prevNeighbour). (4) Added `PrefetchNeighbours` client component that calls `router.prefetch()` for both neighbour routes on mount, so by the time the user taps, the RSC payload for the destination is already cached → instant navigation. Files: `src/components/PrefetchNeighbours.tsx` (new), `src/app/(app)/groups/[id]/page.tsx`, `src/app/(app)/groups/[id]/edit/page.tsx`, `src/app/(app)/groups/[id]/loading.tsx` (new), `src/app/(app)/groups/[id]/edit/loading.tsx` (new), `src/components/GroupMobileBottomBar.tsx`, `src/components/GroupBrowseNav.tsx`.
- **UX — Mobile bottom bar redesigned for large tap targets:** replaced the cramped icon-only buttons with a native-app-style tab bar: 5 full-width equal cells (رجوع · السابقة · التالية · حذف · تعديل) on the view page, 4 cells (رجوع · سابقة · حفظ · تالية) on the edit page. Each cell is `min-h-[62px]` with a 24px icon + 11px label, `active:` background feedback, and iOS safe-area inset. Confirm-delete replaces the bar inline rather than popping a modal. `src/components/GroupMobileBottomBar.tsx` (new), `src/components/EditForm.tsx`.
- **Feature — Mobile bottom action bar (view + edit pages):** on mobile the sticky top toolbars (back, prev/next, edit/save) are hidden and replaced with a `fixed bottom-0` bar that stays within thumb reach. View page bottom bar: back | prev/next/delete | edit. Edit page bottom bar: back | prev-save / save / next-save. Desktop layout is unchanged. Files: `src/app/(app)/groups/[id]/page.tsx`, `src/components/EditForm.tsx`.
- **Feature — Main-screen search includes parts text:** the `?q=` listing filter now searches both group titles AND the ayah parts text (previously title-only). Uses FTS on `search_vec` for both, with ILIKE fallback. Both searches run in parallel; results are unioned — so a group appears if the query matches its title OR any of its part text. No DB migration needed (uses existing `search_vec` and `text` columns). File: `src/app/(app)/page.tsx`.
- **Feature — Browsing-mode group navigation + delete:** the group **view** page toolbar now has
  previous/next buttons (navigate to the adjacent group's view page, no save) and a delete button
  with inline confirm (deletes, then lands on a neighbour or `/`). New client component
  `src/components/GroupBrowseNav.tsx`; `src/app/(app)/groups/[id]/page.tsx` now fetches `created_at`
  + computes prev/next neighbours. Deployed.
- **Feature — Edit-mode group navigation (review sweep):** in the group editor, the toolbar now has
  Save-&-Previous / Save-&-Next buttons (jump straight to the adjacent group's editor, no back-and-
  forth), and the main save **auto-advances to the next group** when the group is marked *completed*
  or *published* (with an inline hint + a `حفظ والتالية` button label). Neighbours computed in
  `created_at DESC` order. Files: `src/app/(app)/groups/[id]/edit/page.tsx` (adds `prevGroupId`),
  `src/components/EditForm.tsx`. Deployed.
- **Feature — Search highlighting:** matched word(s) are now highlighted (`<mark>`) inside each ayah
  in the Quran search results, with the match position mapped from normalized text back onto the
  original Uthmani characters (tashkeel/dagger-alef aware). Exact + approximate (skeleton) matches,
  and multiple occurrences, all highlight. Added `normalizeArabicWithMap()` + `matchRanges()` in
  `src/lib/arabic.ts`; `highlight()` render in `src/components/QuranSearch.tsx`. Deployed.
- **Feature — Search: Uthmani rasm tolerance (Tier 1 + Tier 2):** mushaf spelling now matches what
  users type across all search surfaces (Quran ayahs, group titles, part text).
  - *Tier 1* — dagger alef `ٰ` (U+0670) is restored to `ا` in `normalizeArabic` instead of being
    stripped as tashkeel, so `عَٰلَمِينَ`→`عالمين`, `ٱلصِّرَٰطَ`→`الصراط` match. (`src/lib/arabic.ts`)
  - *Tier 2* — `rasmSkeleton()` drops the long `ا` so plene/defective variants collapse
    (`السماوات` ↔ `السموات` → `لسموت`, `عاكفين` ↔ `عكفين`). Used as an `approximate`-flagged fallback
    tier in `src/lib/quran.ts` (`searchAyahs`) and `src/app/api/search/route.ts` (groups + parts).
    Approximate hits get a `≈ تقريبي` badge in `QuranSearch.tsx`.
  - **DB migration APPLIED** (`supabase-parts-fts.sql`): `normalize_arabic()` updated (dagger→ا),
    `parts.search_vec` rebuilt, `rasm_skeleton` generated columns + `pg_trgm` GIN indexes on
    `parts` and `groups`, and `groups.search_vec` switched to use `normalize_arabic` (was plain
    `to_tsvector(title)`). Deployed.
- **Cleanup — removed dead `/api/stats` route** (`src/app/api/stats/route.ts`): old 12-query
  dashboard endpoint, superseded by the `get_dashboard_stats()` RPC; nothing referenced it. Deployed.

# Performance program — STATUS (last updated 2026-06-03)

## ✅ DONE & deployed to production
- **Phase 1 — bundles:** `NetworkGraph.tsx` uses narrow d3 submodule imports (d3-selection/zoom/
  force/drag/interpolate/transition) instead of `import * as d3` → /network chunk **222 KB → 68 KB**.
  `package.json` swapped `d3`→submodules. Cairo fonts trimmed 5→3 weights (dropped unused 600/800) in
  `src/app/layout.tsx`.
- **Phase 2 — data layer:**
  - `src/lib/quran.ts` `searchAyahs()` uses a pre-normalized in-memory index (no re-normalizing 6,236
    ayahs per request).
  - `src/app/api/quran/route.ts` adds immutable CDN `Cache-Control` headers.
  - `src/lib/arabic.ts` `normalizeArabic` fixed to fold alef-wasla `ٱ` (search for "الرجفة" now works).
  - `src/app/(app)/stats/page.tsx` calls `get_dashboard_stats()` RPC with a fallback to the old
    12-query path.
  - **DB migration APPLIED** (`supabase-stats-aggregates.sql`): RPC + 4 indexes (`verses_surah_idx`,
    `verses_group_surah_idx`, `groups_user_created_idx`, `groups_user_updated_idx`). Verified live.
- **Phase 3 — dedup:** `src/lib/surah-names.ts` (`useSurahNames` hook, singleton in-flight promise +
  session cache). `SurahFilter`, `QuranSearch`, `AutomatedList` use it → 3 identical fetches → 1.
- **Phase 4 — offline SW:** `public/sw.js` (cache `mutshabehat-v3`) stale-while-revalidates
  `/api/quran`; cache-first for `/_next/static`; user/auth data always hits network.
- **Phase 5 — search FTS + rasm tolerance:** parts/groups search uses `tsvector` FTS on
  `search_vec` (GIN-indexed) with ILIKE fallback; Uthmani dagger-alef + rasm-skeleton matching;
  result highlighting. See the `## 2026-06-03` Changelog entries for detail. Migration
  `supabase-parts-fts.sql` applied. **Closes the former "Parts FTS" + "dead `/api/stats`" items.**

## 🔜 REMAINING (start here next session)
1. **iOS PWA icons** (blocks "installable iPhone app"): manifest only points to one SVG. Need PNG
   `apple-touch-icon` sizes (180×180, etc.) + iOS splash screens, then wire into
   `src/app/layout.tsx` `<head>` and `public/manifest.json`. **Needs a source logo/image from the user.**
2. **Native-app feature roadmap** (longer-term):
   - Spaced-repetition review of groups (data model already has favorite/completed/status).
   - Per-ayah audio recitation playback.
   - Push / daily-review reminders (Web Push, or native via Capacitor).
   - Capacitor wrapper for App Store distribution.
   - Native feel: haptics, swipe gestures, bottom-tab nav (MobileTopbar exists), Face ID lock.

## ✅ CLOSED 2026-06-03
- ~~`/api/stats` dead route~~ — removed (see Changelog).
- ~~Parts text search uses ILIKE, no tsvector~~ — upgraded to FTS + rasm tolerance (see Changelog).

## ⚠️ Action item for the user
Revoke the Supabase personal access token shared on 2026-06-03
(https://supabase.com/dashboard/account/tokens).
