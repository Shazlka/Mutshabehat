# Changelog

All notable changes to **متشابهات V2 (Mutshabehat V2)** are recorded here, newest first.
One dated entry per change (bug fix / feature / performance). Each entry lists the files touched
and any required DB migration.

> This file mirrors the `# Changelog` section in `CLAUDE.md` — keep both in sync. Every bug fix,
> feature, or performance improvement **must** be logged here, dated, before the work is done.

Live: https://mutshabehat-v2.vercel.app

## 2026-09-15
- **Fix — Production showed no data (Vercel couldn't reach the Mac Mini):** Vercel functions in the default `iad1` region failed DNS for the Tailscale Funnel host (`getaddrinfo ENOTFOUND youssefs-mac-mini.tailcd68dd.ts.net`), so auto-login and all queries failed. Diagnostic previews on `diag/dns-region` showed `bom1` resolves it and reaches `/auth/v1/health` (200). Added `vercel.json` pinning functions to `bom1`, which is also closer to the Mac Mini. Files: `vercel.json`, `PROJECT_MASTER.md`. No DB change.
- **Docs — Agent handoff verified against live systems:** `PROJECT_MASTER.md` now has a "where to search" guide (§10), an agent access/tools section (§11), the current prod deployment, the `git-main` alias, the Vercel dashboard link, the temporary `diag/dns-region` branch, and the `page-ayat` API route. `CLAUDE.md`: removed the stale `~/dev` copy note and replaced the Management-API DDL advice with the self-hosted `docker compose exec psql` path. No code or DB change.
- **DB — Re-applied missing schema on the self-hosted stack:** `supabase-stats-aggregates.sql`, `supabase-parts-fts.sql`, `supabase-indexes.sql`, `supabase-migration-tag-uniqueness.sql` (never re-run after the cloud→Mac Mini migration). `/stats` now uses the `get_dashboard_stats()` RPC, and search uses FTS plus rasm-skeleton trigram columns instead of the ILIKE fallback. Verified through the Funnel URL as the app user (RPC counts, `surah_counts` view, FTS). Backup: `mutshabehat-selfhost/backups/pre-schema-apply-20260915b.dump`.
- **Chore — Sync GitHub with production source:** committed the previously uncommitted Mushaf 1441 module (`src/app/mushaf-1441`, `src/app/api/mushaf-1441`, `packages/`), mushaf validation/import scripts, PWA icons/manifest/SW, loading skeletons and export route, which were already live on Vercel via CLI deploys. Merged `origin/feature/mushaf-1441-module` (auto-login first-request fix + proxy test). Added `PROJECT_MASTER.md` agent handoff doc and corrected stale location/backend notes in `CLAUDE.md`. No DB migration.

## 2026-06-28
- **Feature — Mushaf 1441 reader refinements (round 4):** (1) **surah banner spans the full page
  width** (outer wrapper was shrinking to the name); (2) **double-tap / double-click a word copies the
  whole ayah** text to the clipboard, with a toast; (3) **disabled native text selection + iOS
  long-press callout** on the page (`select-none`, `-webkit-touch-callout:none`) so long-press opens the
  menu without highlighting text; (4) **replaced emoji with inline SVG icons** (note/highlight/bookmark/
  star) in the context menu and hover card; (5) **bottom surah slider** is less twitchy — bigger thumb,
  it only navigates on release (not during drag), and shows a **zoomed surah-name bubble above the thumb**
  while dragging. File: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB migration needed.
- **Feature — Mushaf 1441 reader refinements (round 3):** (1) **surah banner full width** of the page
  with the name scaled to fit; (2) **removed the technical word-mapping** fields (page/line/word index,
  raw key) from the ayah-details panel — it now shows a friendly surah + ayah header and the selected
  word; (3) **desktop hover preview** — hovering an ayah shows a card with its applied highlight colour,
  notes, bookmark/favourite, and mutshabehat connections; (4) **bookmark + favourite are now in the
  right-click menu for any word** (act on the word's ayah), all menu items have icons; (5) **mobile swipe
  reversed** to true Arabic RTL — swipe right → next, swipe left → previous; (6) **bottom surah slider**
  bar for quick jump to any surah; (7) on mobile, **ayah details open by long-press only** (a tap no
  longer selects), and the long-press opens the menu without selecting part of the ayah; (8) **top arrows
  follow RTL** (previous → on the right, next ← on the left). Files:
  `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`. No DB migration needed.
- **Feature — Mushaf 1441 reader refinements (round 2):** (1) **tap the left half** of the page →
  next page, **right half** → previous (Arabic RTL turning), matching the swipe direction; (2) the
  **selected ayah/word** no longer turns yellow/black — it uses a subtle "page colour one step darker"
  tint (`#ece2c8`); (3) **14 highlight colours** for words/ayat (was 4); (4) **instant page flipping** —
  adjacent pages (words + metadata + QCF font) are prefetched, so turns are ~0.1s instead of a network
  round-trip; (5) **full-bleed page on mobile** (edge-to-edge, no outer padding/border) so it uses the
  whole screen width; (6) **surah header banner** restyled with a Mushaf-Madina-style Islamic ornamental
  frame (gold lattice + rosettes + name cartouche), shown before the basmala; (7) **mutshabehat mapping
  activated** in the reader — connected ayat are marked (dotted underline) and tapping opens the
  connections panel (real connections from the signed-in user's groups; sample data as fallback).
  Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`,
  `packages/mutshabehat-core/mushafLinkAdapter.ts`. No DB migration needed.
- **Feature — Mushaf 1441 reader UX overhaul (real mushaf page):** the `/mushaf-1441` screen is now
  the mushaf page itself. Changes: (1) ornamental **surah-name banner before ayah 1** plus the
  **basmala line**, rendered into the fixture's reserved empty lines; (2) **juz · حزب · ربع** and a
  **left/right page indicator** moved into the page's own margins (the separate metadata header strip
  was removed); (3) the page is **fit-to-screen** via container-query sizing (`min(100cqw, 100cqh·ratio)`)
  with the 15 lines evenly distributed; (4) **swipe** left/right turns pages on touch; (5) **long-press**
  a word or ayah opens the highlight/notes menu (in addition to right-click); (6) surah/ayah/page
  **sliders**, page nav, page info, and **sign-in** are now inside a **burger menu**; (7) the
  annotation/notes editor opens as an on-demand sheet (bottom on mobile, side panel on desktop).
  Files: `src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx`; validators
  `scripts/validate-mushaf1441-objective.mjs` and `scripts/validate-mushaf1441-phase6.mjs` updated to
  match. No DB migration needed.
- **Fix — Login honors `?next=`:** `/login` now redirects back to the page that sent the user there
  (e.g. `/login?next=/mushaf-1441`) after password, magic-link, or Google sign-in, so signing in to add
  a highlight returns to the mushaf. File: `src/app/(auth)/login/page.tsx`. No DB migration needed.
- **DB — Mushaf 1441 annotations table created (production):** applied the `mushaf_annotations`
  migration to the production Supabase project `tthlhkdmwusxerfiimgc`. Purely additive, isolated
  table (notes/highlights/bookmarks/favorites) with per-user RLS (`auth.uid() = user_id` on
  select/insert/update/delete), CHECK constraints (target shape, `line_number` 1–15, `page_number`
  1–604, `ayah_key` format), and 3 supporting indexes. Existing tables untouched. This unblocks the
  Mushaf 1441 preview annotations feature (was returning 501 "table not installed"). Migration:
  `supabase/migrations/20260628000000_mushaf_annotations_preview.sql`.
- **Fix — Mushaf 1441 API type-safety bug:** `POST /api/mushaf-1441/annotations` failed `tsc` because
  the validated `target` was possibly `undefined` after the error guard (non-discriminated union).
  Tightened the guard so `target` is provably defined before building the insert row. File:
  `src/app/api/mushaf-1441/annotations/route.ts`. No DB migration needed.
- **Fix — Mushaf 1441 logged-out UX (401 vs 503):** the annotations and Mutshabehat preview routes
  returned `503 "authentication unavailable"` (a scary server error) for visitors who simply aren't
  signed in. They now detect a missing/expired session (`AuthSessionMissingError`) and return `401`,
  so the viewer shows the existing friendly "sign in to sync notes" message instead of a red error.
  Genuine Supabase misconfiguration still returns 503. Files:
  `src/app/api/mushaf-1441/annotations/route.ts`, `src/app/api/mushaf-1441/mutshabehat/route.ts`.
  No DB migration needed.

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
- **Feature — SQL database backup/restore (Settings → تصدير قاعدة البيانات):** new `?format=sql` export produces a Supabase-compatible `.sql` file that re-imports all of the user's data (tags, groups, verses, parts, group↔tag links) for emergency restore. Idempotent — each row is `insert … on conflict (id) do update` (group_tags uses `do nothing`), wrapped in a `begin/commit` transaction, FK-ordered (tags → groups → verses → parts → links). Original UUIDs and `created_at`/`updated_at` are preserved; `user_id` is embedded as a literal so it must be restored into the same Supabase project & auth user (RLS rejects otherwise). `search_vec` is left to the existing insert trigger. Files: `src/app/api/groups/export/route.ts` (adds `sql` branch + fetches `tags`/`group_tags`), `src/components/DatabaseExport.tsx` (new "نسخة احتياطية SQL" button + restore note). No DB migration needed.
- **Feature — Mobile swipe navigation on group detail page:** swiping left navigates to التالية (next group) and swiping right navigates to السابقة (previous group), matching RTL reading direction. Real-time follow-finger translateX feedback with spring-back on aborted swipe; edge hint arrows (‹ ›) appear as opacity ramp during swipe. Axis detection (horiz vs. vertical) prevents interfering with normal page scroll; non-passive `touchmove` listener calls `preventDefault` only when horizontal. New file: `src/components/SwipeNavWrapper.tsx`. Updated: `src/app/(app)/groups/[id]/page.tsx` (wraps `GroupDetail` in `SwipeNavWrapper`). No DB migration needed.

---

## 2026-06-03 (2)

### Added
- **Full database indexing pass** (`supabase-indexes.sql`). Audit found 9 missing indexes vs. the query patterns in the live code:

  | Index | Purpose |
  |---|---|
  | `surah_counts` VIEW (security_invoker) | Main-page SurahFilter sidebar — was querying a non-existent relation; now a proper security-invoker view on `verses` that respects RLS |
  | `groups_title_trgm_idx` GIN trgm on `title` | ILIKE title fallback in search was a full scan |
  | `parts_text_trgm_idx` GIN trgm on `text` | ILIKE text fallback in search was a full scan |
  | `groups_user_title_idx` `(user_id, title)` | Title sort delivers pre-sorted rows instead of in-memory sort |
  | `verses_group_sort_idx` `(group_id, sort_order)` | Every group view/edit page: pre-sorted verse delivery |
  | `parts_verse_sort_idx` `(verse_id, sort_order)` | Every group view/edit page: pre-sorted parts delivery |
  | `group_tags_tag_id_idx` `(tag_id)` | Reverse tag-id join in `get_dashboard_stats()` |
  | `groups_user_favorite_idx` partial `(user_id) WHERE favorite` | Compact partial index for favorite filter |
  | `groups_user_completed_idx` partial `(user_id) WHERE completed` | Compact partial index for completed filter |
  | `groups_user_status_idx` `(user_id, status)` | draft/locked filter queries |

  **⚠️ DB migration required** — run `supabase-indexes.sql` in Supabase SQL Editor.

---

## 2026-06-03

### Added
- **Group navigation performance — instant switching.** Four compounding bugs were causing slow group-to-group navigation:

  | Root cause | Fix |
  |---|---|
  | `prefetch={false}` on every nav `Link` — disabled Next.js router cache | Removed from `GroupMobileBottomBar` + `GroupBrowseNav` |
  | No `loading.tsx` — blank screen on tap until server responds | Added pulse skeletons for view and edit pages |
  | Nested PostgREST select ran **3-4 sequential** Supabase round-trips | Rewritten as **2 parallel** rounds: (group + verses + auth) → (parts + next neighbour + prev neighbour) |
  | No prefetch of neighbours — cold server render on every tap | Added `PrefetchNeighbours` component: calls `router.prefetch()` on both neighbours on mount → RSC payload cached before tap |

  Combined effect: first visit shows skeleton < 100 ms; subsequent group visits are instant (router cache hit). Files: `src/components/PrefetchNeighbours.tsx`, `src/app/(app)/groups/[id]/loading.tsx`, `src/app/(app)/groups/[id]/edit/loading.tsx`, both page.tsx files, `GroupMobileBottomBar.tsx`, `GroupBrowseNav.tsx`.

- **Mobile bottom bar redesigned for large tap targets.** Replaced cramped icon-only mini-buttons with a native-app-style tab bar. Each cell is `min-h-[62px]` (24px icon + 11px label + padding), fills equal width, and has `active:` background feedback on tap. View page: 5 cells — رجوع · السابقة · التالية · حذف · تعديل. Edit page: 4 cells — رجوع · سابقة · حفظ (slightly wider, colored) · تالية. Confirm-delete replaces the bar inline with a red top-border warning state. iOS safe-area inset applied. `src/components/GroupMobileBottomBar.tsx` (new component).

- **Mobile bottom action bar (group view + edit pages).** On mobile, the sticky top toolbars (back, prev/next navigation, delete, edit/save) are hidden and replaced by a `fixed bottom-0` bar within easy thumb reach. View-page bar: back · prev/next/delete · edit. Edit-page bar: back · prev-save / save / next-save. Desktop layout is unchanged.
  - `src/app/(app)/groups/[id]/page.tsx` — top toolbar `hidden md:flex`; mobile bottom bar added
  - `src/components/EditForm.tsx` — top toolbar `hidden md:block`; mobile bottom bar with save states added

- **Main-screen search now includes parts text.** The `?q=` listing filter previously matched only group titles. It now also matches any ayah part text within a group — so typing "ونزلنا" or any Quranic phrase surfaces all groups containing that text, even if the group title doesn't contain it. Implementation: FTS on `search_vec` (normalized, GIN-indexed) for both titles and parts in parallel, ILIKE fallback when FTS returns nothing; results are unioned and applied as `.in('id', ...)` group-ID filter. No DB migration needed.
  - `src/app/(app)/page.tsx` — added `qGroupIds` resolution; `applyFilters` now uses `.in('id', ...)` instead of `ilike('title', ...)`

- **Browsing-mode group navigation + delete.** The group **view** page toolbar gains previous/next
  buttons (navigate straight to the adjacent group's view page — no save, since you're just
  browsing) and a delete button with inline confirmation (after delete, lands on a neighbouring
  group or the list).
  - `src/components/GroupBrowseNav.tsx` — new client component
  - `src/app/(app)/groups/[id]/page.tsx` — fetches `created_at`, computes prev/next neighbours

- **Edit-mode group navigation (review sweep).** The group editor toolbar gains Save-&-Previous /
  Save-&-Next buttons that jump straight to the adjacent group's editor (no bouncing back to the
  view). The main save also **auto-advances to the next group** when the group is marked *completed*
  or *published*, so marking a batch flows continuously. An inline hint and a `حفظ والتالية` save
  label make the behaviour discoverable. Neighbours are resolved in `created_at DESC` list order.
  - `src/app/(app)/groups/[id]/edit/page.tsx` — computes `prevGroupId` + `nextGroupId`
  - `src/components/EditForm.tsx` — nav buttons, `saveAndGo()`, auto-advance on save

- **Search result highlighting.** Matched word(s) are highlighted (`<mark>`) inside each ayah in the
  Quran search results. The match position is computed on normalized text and mapped back onto the
  original Uthmani characters (tashkeel / dagger-alef aware), so exact + approximate (skeleton)
  matches and multiple occurrences all highlight correctly.
  - `src/lib/arabic.ts` — `normalizeArabicWithMap()`, `matchRanges()`
  - `src/components/QuranSearch.tsx` — `highlight()` render

- **Search: Uthmani rasm tolerance (Tier 1 + Tier 2).** Mushaf spelling now matches what users type
  across all search surfaces (Quran ayahs, group titles, part text).
  - **Tier 1** — dagger alef `ٰ` (U+0670) is restored to `ا` in `normalizeArabic` instead of being
    stripped as tashkeel (`عَٰلَمِينَ` → `عالمين`, `ٱلصِّرَٰطَ` → `الصراط`).
  - **Tier 2** — `rasmSkeleton()` drops the long `ا` so plene/defective variants collapse
    (`السماوات` ↔ `السموات` → `لسموت`, `عاكفين` ↔ `عكفين`). Used as an `approximate`-flagged fallback
    tier; approximate hits get a `≈ تقريبي` badge.
  - Files: `src/lib/arabic.ts`, `src/lib/quran.ts` (`searchAyahs`),
    `src/app/api/search/route.ts`, `src/components/QuranSearch.tsx`
  - **DB migration:** `supabase-parts-fts.sql` — `normalize_arabic()` updated (dagger → ا),
    `parts.search_vec` rebuilt, `rasm_skeleton` generated columns + `pg_trgm` GIN indexes on `parts`
    and `groups`, and `groups.search_vec` switched to use `normalize_arabic` (was plain
    `to_tsvector(title)`). **Applied.**

### Removed
- **Dead `/api/stats` route** (`src/app/api/stats/route.ts`) — old 12-query dashboard endpoint,
  superseded by the `get_dashboard_stats()` RPC; nothing referenced it.

---

_For earlier work (performance Phases 1–4: bundle trimming, data-layer caching, fetch dedup, offline
service worker), see the "Performance program — STATUS" section in `CLAUDE.md`._
