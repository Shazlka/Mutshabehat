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
  `main`; V2 replaced the legacy V84 app on 2026-09-15, which is archived as `legacy-v84-main` / tag `legacy-v84-final`). `~/dev/mutshabehat-v2` and the
  iCloud copy are stale duplicates. Do not edit them.
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
- Applying DB DDL: the `service_role` key CANNOT run DDL via PostgREST. Use the Supabase
  **Management API** with a personal access token (one curl), or the DB password. `supabase` CLI
  and `psql` are NOT installed locally.
- **📋 CHANGELOG IS MANDATORY:** every bug fix, feature, or performance improvement **MUST** be
  recorded — dated, newest-first — in **both** the `# Changelog` section below **and** the root
  `CHANGELOG.md` (keep the two in sync), before the work is considered done. This is the running
  history/log of all changes for future reference.

# Changelog

> Newest first. One dated entry per change (bug fix / feature / perf). Include the files touched
> and any required DB migration. This log is the source of truth for "what changed and when".

## 2026-09-15
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
