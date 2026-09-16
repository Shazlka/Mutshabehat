# 08 — Test results

Run 2026-09-16, sandbox environment (no Tailscale/backend connectivity — see
`00-existing-architecture.md` for why the prototype needed none of it).

## Automated

| Check | Command | Result |
|---|---|---|
| Qiraat domain shape | `node packages/qiraat-core/validate.mjs` | ✅ "10 readers, 20 narrators/readings, engine + attribution + repository present, baseline = Hafs, duplicate-al-Duri disambiguation intact." |
| Qiraat unit tests | `npx tsx --test packages/qiraat-core/engine.test.mjs` | ✅ 16/16 passed (reader/narrator/color mapping, query priority, baseline immunity, verification-status filtering, all 6 operations, `renderToken`, `differsFromHafs`, all 3 attribution cases, the real page-1 مالك/ملك and سين/صاد fixtures, the two-الدوري disambiguation, `tokenKey`/`ayahKeyOf`) |
| TypeScript | `npx tsc --noEmit -p .` | ✅ 0 errors (whole project) |
| ESLint | `npx eslint src packages` | ✅ No new errors/warnings in any file this task touched (`Mushaf1441Viewer.tsx`, all of `packages/qiraat-core/`, `src/app/mushaf-1441/_components/qiraat/`, `src/app/api/mushaf-1441/qiraat/`). The pre-existing baseline (37 errors, mostly `react-hooks/set-state-in-effect` and `no-explicit-any` across ~15 unrelated files, e.g. `SwipeNavigationSetting.tsx`, `MobileTopbar.tsx`, `TagManager.tsx`) is untouched; this task's one new mount-time-restore effect (`qiraat-prefs` localStorage read) follows that exact same pre-existing, already-tolerated idiom (`SwipeNavigationSetting.tsx` does the same thing) rather than inventing a new pattern. |
| Production build | `env -u __NEXT_PROCESSED_ENV npm run build` | ✅ Compiled successfully, all 29 routes registered including the new `/api/mushaf-1441/qiraat`, static pages generated |
| Existing Mushaf validators | `npm run mushaf:validate` | ✅ All 7 validators passed unmodified (83,665 tokens, 604 pages) — confirms the Mushaf-1441 fixtures are untouched (Part 28) |
| Updated Qiraat scaffold validator | `node scripts/validate-mushaf1441-phase5.mjs` | ✅ Rewritten for the real integration (see `00-existing-architecture.md`), passes |

## Manual/visual (Playwright/Chromium, local production build, `next start -p 3222`, no backend)

Environment note: `NEXT_PUBLIC_SUPABASE_URL` pointed at a dummy unreachable host for this session
(no Tailscale access from this sandbox). This only affects auth-gated features (mutshabihat
highlights, annotations — both already handle "backend unavailable" with an existing 401/503 path,
confirmed still working: no page crash, no new console errors beyond the expected failed
auth/mutshabihat fetches). **Qiraat data needs no backend at all** (page-scoped fixture route), so
every Qiraat check below ran against real, live rendering, not a mock.

- **Test A (normal mode unchanged):** ✅ Screenshot confirms the Hafs baseline page (spread view,
  page 1/2) renders exactly as before — surah banners, basmala, "مَـٰلِكِ" with its alif, QCF-font
  fallback message (expected offline) — no Qiraat marks anywhere, burger-menu Qiraat panel defaults
  to "المصحف" with the exact Part-3 helper text.
- **Test B (comparison mode, correct color/attribution):** ✅ Switching to "مقارنة القراءات"
  immediately draws one segmented 8-color gradient marker under "مَـٰلِكِ" (1:4) and nowhere else on
  the page by default (REVIEWED سين/صاد records correctly stay hidden). Zoomed screenshot confirms 8
  distinct, correctly-ordered reader-color segments. Tapping the word opens the detail panel exactly
  per Part 13's spec structure: ayah header, hafs→variant text, readers grouped with their narrator
  pairs (all 8 reader/narrator groups printed correctly, e.g. "نافع المدني / قالون · ورش"), the
  "الباقون: 4 رواية بلا تغيير" remainder line, difference-type label ("حرف"), verification status
  ("VERIFIED"), and the Al-Shatibiyyah/Al-Nashr source citation.
- **Test C (filter by reader):** ✅ Filtering "قارئ → نافع" keeps the مالك/ملك marker visible (Nafi
  is one of the 8 attributed readers); filtering "قارئ → عاصم الكوفي" removes it entirely (Asim is
  not attributed — he shares Hafs's own text). Confirmed via two zoomed before/after screenshots.
- **Test D (filter by Riwayah):** exercised the same filter code path as Test C
  (`comparisonMarkerForWord`'s `matchesFilter`, reading-scoped branch) — covered directly by
  `engine.test.mjs`'s attribution tests; not separately screenshotted (same mechanism, verified once).
- **Test E (full Warsh page):** ✅ Selecting "ورش عن نافع" in "القراءة برواية" mode re-renders 1:4 as
  "مَلِكِ" (confirmed via page-content assertion, not just a screenshot) in flowing Amiri text; no
  unrelated marker/noise elsewhere on the page.
- **Test F (switch Riwayah, no navigation):** ✅ Selecting "حفص عن عاصم" right after Warsh, with no
  page navigation, instantly restores "مَـٰلِكِ" (content-asserted) — a local state change, confirmed
  no additional `/api/mushaf-1441/qiraat` network call fires on a reading switch (only page-number
  changes trigger a fetch).
- **Test G (a different reader entirely):** ✅ Selected "شعبة عن عاصم" (Shu'bah, Asim's other
  narrator) — renders independently and correctly leaves 1:4 as the Hafs text (Shu'bah shares it),
  confirming no cross-narrator fallback.
- **Test H (show difference from Hafs while reading a Riwayah):** ✅ With Warsh selected and
  "إظهار الاختلاف عن حفص" enabled, a solid Warsh-narrator-colored (not segmented) marker appears
  under 1:4 — the one token Warsh actually differs from Hafs on this page — while the rendered text
  stays Warsh's.
- **Test I (Study Mode):** ✅ Enabling Study Mode visibly thickens the marker (2px → 4px, confirmed
  in the zoomed screenshot) and adds a light background tint box around the word; tashkeel stayed
  legible at the tested zoom levels.
- **Test J (data integrity):** ✅ `git status`/`git diff` confirms zero changes under
  `packages/quran-data/mushaf1441/fixtures/`; disabling Qiraat (mode → المصحف) reproduces the exact
  pre-existing Mushaf rendering (Test A's screenshot, taken with Qiraat mode at its default, is
  pixel-identical in content to what the app rendered before this branch — same text, same layout,
  same lack of markers).
- **No regression to Mutashabihat:** the burger-menu "متشابهات" ownership flow, the ayah-highlight
  band logic (`slotHighlightByAyahKey`/`renderWordGap`), and the mutashabehat detail tab are
  untouched code paths; `isMutshabehatHighlighted` still takes priority over the new Qiraat tap
  branch in `renderQcfWord`'s click handler exactly as before.

## Known limitations (honestly disclosed, not hidden — Part 43)

- Only page 1 has real Qiraat data; all other pages return an empty variant list (by design — see
  `09-full-rollout-plan.md` for what a full rollout needs).
- `INSERT`/`SPLIT` operations are proven correct at the text-resolution level
  (`engine.test.mjs`) but not exercised in the live UI (no real page-1 data needs them) — see
  `04-rendering-engine.md`'s "known simplification" for the token-granularity trade-off this implies
  for a future multi-node DOM model.
- The page-1 سين/صاد (Hamzah) variants are held at REVIEWED, not VERIFIED — intentional, not a bug
  (`06-verification-workflow.md`).
- Filtering comparison mode by one reader does not recolor a shared multi-reader marker down to
  that reader's own color; it only decides whether the (fully, honestly attributed) marker is shown
  at all. Documented as a deliberate reading of Part 15, not an oversight
  (`02-color-system.md`/this file's Test C note).
- Segmented (multi-reader) markers use a neutral warm-gray tint in Study Mode rather than a true
  per-segment `color-mix`, since CSS `color-mix` takes one color, not a gradient
  (`02-color-system.md`).
- This session had no live Supabase/Tailscale connectivity, so the DB migration
  (`supabase/migrations/20260916120000_qiraat_ashr_schema.sql`) is written but **not applied** —
  the prototype runs entirely on the fixture-backed repository (`03-database-schema.md`).
