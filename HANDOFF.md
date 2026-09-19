# Handoff — Mutshabehat V2 (state as of 2026-09-17)

For the next agent picking up this project. Read this first, then `PROJECT_MASTER.md` (full reference:
locations, backend, architecture, troubleshooting) and `CLAUDE.md` (gotchas + mandatory changelog).

**Where the project is right now:** the Mushaf reader gained a full Qiraat Ashr layer over 2026-09-16/17
— pages 1–224 plus all of سورة مريم (pages 305–312) are imported and live
(1,330 variants, 6,137 أصول rulings across 252 pages),
the أصول rulings colour the words, and the three colour systems on the page (notes / متشابهات / قراءات)
are now mutually exclusive.
**The user's stated next activity is visually reviewing the imported pages, one by one**, against
the paper original, using the built-in review mode. Do not start new feature work ahead of that
without being asked.

---

## 1. Where everything is

| What | Where |
|---|---|
| Code (only checkout) | `~/Projects/mutshabehat-v2` on the Mac Mini (NOT `~/dev`, NOT iCloud) |
| GitHub | `Shazlka/Mutshabehat`, branch `main` (public repo — never commit secrets or data files) |
| Production | https://mutshabehat-v2.vercel.app — Vercel is git-connected: **push to `main` = production deploy** (~1–2 min) |
| Vercel region | pinned to `bom1` in `vercel.json` |
| Backend | self-hosted Supabase (Postgres 17 + GoTrue + PostgREST + Caddy) in Docker/Colima on the Mac Mini external SSD, exposed via Tailscale Funnel `https://youssefs-mac-mini.tailcd68dd.ts.net:8443`. Supabase Cloud is retired — don't use it. |
| Backend stack repo | `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost` (local git; secrets in `.env`, `.secrets.json`) |
| DB backups | `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost/backups/*.dump` |
| DB shell | `docker exec -it mutshabehat-db psql -U postgres -d postgres` |
| Changelog | `CHANGELOG.md` **and** the `# Changelog` section of `CLAUDE.md` — dated entry, newest first, required for every change |

Stack: Next.js 16 (App Router, Turbopack; middleware is `src/proxy.ts`), React 19, Tailwind v4.

## 2. Rules the user expects (do not break)

- Commit as `Shazlka <amr.eshazly@gmail.com>`.
- **Production DB DDL needs explicit user approval**, and a `pg_dump -Fc` backup into `backups/` first. Migrations go in `supabase/migrations/` and are applied with `docker exec -i mutshabehat-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < file.sql`.
- Never touch the Wave C3B containers or Tailscale Funnel `:443`; never `docker compose down -v`.
- Confirm before killing processes or other destructive / outward-facing actions.
- No data files (xlsx/csv/pdf) in the repo.
- Local testing runs against the **production** DB (there is no separate dev DB). If a test writes rows (e.g. `test_answers`), delete them afterwards.
- Never put a model identifier in a commit message, PR or code comment.

## 3. How to verify a change

```bash
cd ~/Projects/mutshabehat-v2
npx tsc --noEmit -p .                 # must be clean
npm run mushaf:validate               # 7 Mushaf data/token/source validators
npm run test:qiraat                   # 23 engine tests + the Qiraat dataset linter
npm run qiraat:validate               # dataset linter alone
env -u __NEXT_PROCESSED_ENV npm run build
npx next start -p 3222                # then drive it with Playwright at 1440x950, 1024x768, 390x844
```

After `git push`, wait ~1–2 min and re-run the same checks against `https://mutshabehat-v2.vercel.app`.

**Verifying a feature that depends on the user's own data** (highlights, notes, متشابهات links): do
**not** conclude it works because the control's `aria-pressed` flips. Stub the API with Playwright's
`context.route()` so there is real data to show or hide, and count what is actually painted in the
DOM. That technique found a real bug on 2026-09-17 (see §5b) that a state-only check had missed, and
closed an earlier "could not verify" gap from the day before.

**From a cloud sandbox:** the agent proxy blocks `*.vercel.app` (403 on CONNECT). A `curl` to
production returns 0 bytes, which looks exactly like "not deployed yet" and is not. Confirm deploy
state through the Vercel API (`list_deployments` / `get_deployment`), not by fetching the page, and
say plainly that the live page itself was not loaded.

Known lint baseline (pre-existing, not regressions): `Mushaf1441Viewer.tsx` has 1 error
(set-state-in-effect in the notes localStorage effect) + unused-var warnings; `src/app/(app)/page.tsx`
and `stats/page.tsx` have `no-explicit-any` errors.

## 4. What was done in the 2026-09-16 / 17 sessions (newest first)

| Commit | Change |
|---|---|
| (this batch) | **Qiraat pages 21–41 imported**: +109 variants, +490 أصول rulings, every locus partitioning the 20 Riwayat exactly once. Pages 1–41 are now contiguous. Also unpinned two tools that were silently scoped to 20 pages (`build_rulings.py`, `validate-qiraat-data.mjs`) and untracked the stray `__pycache__`. |
| `8a0fe08` | **One reader layer at a time** + long-press haptic. `ReaderLayer` enum replaces three independent booleans; a press is answered by the active layer only; `haptics.ts` (new). See `PROJECT_MASTER.md` §13. |
| `5b02897` | **Annotations on/off switch** ("ن"), auto-cleared when the Qiraat layer came on (that auto-off is now subsumed by the exclusivity rule above). Fixed the memo-identity bug that made the first cut of the toggle do nothing. |
| `05bc02b` | **Permanent Qiraat sidebar** (desktop / iPad landscape, 330px), a متشابهات toggle ("م"), and per-word أصول explanation grouped **by action** (﴿تَرْضَىٰ﴾ → «إمالة → حمزة/الكسائي/خلف العاشر» and «تقليل → ورش»). `PROJECT_MASTER.md` §12 written. |
| `7b54c40` | **Qiraat pages 1–20 imported in full**: 100 variants across 72 loci + **403 أصول rulings** across 18 categories, every locus anchored to a real Mushaf token by `scripts/qiraat/tokens.py`. أصول colour the word (one colour per family); ذو وجهين underlined; per-locus review mode with JSON export. Generators caught 3 swapped source rows and ~20 bad query spellings. |
| `6c565e0` | **Qiraat V2 schema** — the permanent data architecture for all 604 pages, reviewed against a competing 10-table proposal and **executed** against PostgreSQL 16.13 (applies + re-applies clean). `supabase/migrations/20260917120000_qiraat_v2_schema.sql`, `docs/qiraat/10-v2-architecture-plan.md`. **Not applied to the live backend.** |
| `7a15928` | Qiraat page-level rules (`QiraatRule`): عدّ الآي، الإدغام الكبير، أوجه الوصل بين السورتين، المد قبل الإدغام — page 1. |
| `f3d46d0` | Qiraat variants for pages 11–20 (REVIEWED tier). |
| earlier 09-16 | Qiraat hover peek redesign, colored reader/narrator pills, mobile tap-to-peek, pages 1–10 data, the ~7 s stall fix when the backend is unreachable (`resilient-fetch.ts`). |

**No DB migration was applied in either session.** Everything Qiraat ships as committed fixtures.

## 5. Open items / known issues

### 5.1 Qiraat — the live thread

- **Visual review of the imported pages (1–244 and 305–312) is the user's next activity.** Open the reader in مقارنة القراءات,
  then burger/sidebar → «مراجعة المواضع المستوردة». Every imported locus gets a ring (amber unchecked,
  green confirmed, red wrong), with a «بقي N من M» counter and a JSON export of the verdicts.
  Verdicts live in `localStorage` (`mushaf1441:qiraat-review:v1`) — **per device, not synced**.
  Feeding the exported verdicts back into the dataset is not built yet.
- **352 pages left to import** (245–304 and 313–604). The page table is deliberately **not**
  contiguous now — 244 → 305 is a legal jump and nothing assumes a dense range. The recipe, the five
  non-negotiable rules, the six generator invariants, the four anchor shapes that cost 23 rejections
  in the 22–41 batch and the classification rules for an ayah-by-ayah source are in
  `PROJECT_MASTER.md` §12 (§12.4b for the anchor shapes, §12.5 for سورة مريم). Do not improvise around it.
- **سورة مريم came from a different source** — a user-supplied ayah-by-ayah table, not the PDF — so
  its records carry their own `src` instead of a PDF page. Five source rows were dropped and two were
  imported against the source's own aside; all seven are listed in `PROJECT_MASTER.md` §12.5 and are
  the first thing to check on the paper original. ميم الجمع rows were left out entirely: this dataset
  has no such أصول family.
- **Pages 22–41 carry their own source defects**, all in `PROJECT_MASTER.md` §12.5: three corrected
  slips (page 34 كثير→كبير، page 38 خير→خبير، page 41 إني→مني) and eight `؟`-marked entries omitted
  rather than guessed. Resolve these against the paper original first.
- **3 loci held at `NEEDS_MANUAL_REVIEW`**, each with the defect recorded: 2:83 تعبدون (حمزة والكسائي
  in both أوجه, يعقوب unaccounted for), 2:93 قلوبهم العجل (خلف in two of three), 2:105 ينزل (the
  source omits أبو جعفر entirely).
- **3 loci were corrected by the generator and should be confirmed against the paper original**:
  2:9 يخدعون، 2:81 خطيئته، 2:111 أمانيهم — the supplied extraction had the أوجه rows **swapped**
  (the group containing عاصم did not match what the Hafs mushaf prints). Flagged `source_swap`.
- ~15 `؟` markers the extractor left on pages 9, 11, 16 and 19, and page 8's corrupted ﴿وَعَٰدْنَا﴾
  header. The extraction was made visually at 150 dpi from a PDF with a scrambled text layer — treat
  every page as suspect until a human checks it.
- Nothing in the import claims `VERIFIED`. `qiraatIncludeReviewed` defaults ON so the data is visible
  at all; `PUBLIC_VERIFICATION_STATUSES` still gates the public view on `VERIFIED`/`PUBLISHED`.
- **`20260917120000_qiraat_v2_schema.sql` is written, tested and NOT applied.** It needs a `pg_dump`
  backup and an explicit go-ahead. Fixtures stay the serving layer either way (zero round-trip page
  turns, works when the Mac Mini is offline); Postgres becomes the authoring/QA source of truth.

### 5.2 Reader layers — decisions worth revisiting

- **A new device defaults to the متشابهات layer.** That was my call, not the user's: it is this app's
  namesake and what the mushaf showed before any of these switches existed. Devices that had already
  chosen "annotations on, متشابهات off" keep that (one-time migration off the two superseded keys
  `mushaf1441:mutshabehat-highlight:v1` / `mushaf1441:annotations-visible:v1`). **Flag this to the
  user if it comes up** — a reader who lives in their notes may want `'annotations'` instead.
- **The iOS haptic is best-effort and unconfirmed on real hardware.** Mobile Safari has no Vibration
  API; the fallback is the iOS 17.4+ switch-label trick. Verified in Chromium only (where
  `navigator.vibrate` is used and the fallback correctly never fires). Worth one check on the user's
  own iPhone.
- The 2026-09-17 production verification was done against a **local** production build; the live page
  itself was never loaded from the sandbox (proxy blocks `*.vercel.app`). Deploy state came from the
  Vercel API.

### 5.3 Older, still open

- `/stats` throws React hydration error #418 in the browser console (predates the test stats; likely
  `ActivityChart` date/timezone rendering). Not fixed.
- Mushaf header shows only the navigated page number in spread mode (e.g. "ص 106"), not both pages;
  the header's ayah range comes from that page's metadata.
- Page curl drag was verified with a mouse in Chromium, not on a physical iPad — worth a real-device
  check (Safari, `touch-action`, `filter: drop-shadow` cost during the curl).
- Magazine view: tile sizes are heuristic (`magazineSize` in `GroupCardGrid.tsx`); the last row can be
  ragged.
- The Impeccable design hook flags literal colours in `Mushaf1441Viewer.tsx` because there is no
  `DESIGN.md`. Classified as intentional/pre-existing, not suppressed. The user has not chosen between
  `/impeccable document` (create DESIGN.md) and ignore-values.
- Mac Mini load: earlier outages came from overload (stale agy/claude processes, old dev servers). If
  the DB is slow or GoTrue 504s, check `top` / stale processes first and **ask the user before killing
  anything**.

## 5b. Mushaf rendering architecture (read before touching the reader)

Layer model, press routing and haptics now live in **`PROJECT_MASTER.md` §13** — read it before
changing anything about what a tap or long-press on a word does.

- The stage renders **slot groups** (a page, or a spread keyed by its right page) for the current group
  and one neighbour on each side (`slotGroups`, from `useDeferredValue(pageNumber)`), stacked in one
  grid cell; only `[data-page-slot-current]` is visible. Hidden groups are `inert` + `aria-hidden`.
- Each page is a `MushafPageSlot` — `memo` with a custom comparator that **compares props by identity**
  and ignores the `render` prop. Keep slot props stable: use the session-wide maps
  (`slotHighlightByAyahKey`, `slotAnnotationsByWordId`, `slotAnnotationsByAyahKey`), never per-turn
  subsets, or every mounted page re-renders on each turn.
- **The identity trap, which has bitten twice:** anything a word's render or click closure reads must
  reach the slot through a prop. Gating only the derived map is not enough — the slot stays convinced
  nothing changed, and the effect appears only when some *other* prop happens to move. That is exactly
  why the first annotations toggle silently did nothing, and why `readerLayer` now rides in the
  `selection` prop. Gate at the prop.
- Handlers inside page JSX must go through `liveRef.current.*` (memoized slots would otherwise keep
  stale closures).
- State that must **not** enter any slot prop, or selecting a word would re-render a page and cost the
  ~1 ms page-turn invariant: `hoveredAyahKey`, `hoveredQiraatWord`, `qiraatSelection`.
- The curl (`PageCurlOverlay`) mutates the real page elements' `clip-path` / `transform` / `z-index`
  during a turn and restores them on unmount; `measurePageTurn` passes the elements and rects measured
  before the state change.
- Measuring: a prefetched turn is ~1 ms render→commit, 0 slot renders. Re-check after reader changes
  (instrument a render counter locally, don't ship it).
- Qiraat page fixtures are loaded directly in the browser through `FixtureQiraatRepository` and
  prefetched from `slotGroups`; in spread mode every group contributes both page leaves. The loaded
  window is published to React state once, after all its chunks resolve. Keep `/api/mushaf-1441/qiraat`
  for external/API consumers, but do not put it back in the reader's flip path. Performance tests
  block the route and require both pages of the mounted next spread to be colored before a turn.

## 6. Key files map (recently touched)

- **Mushaf reader:** `src/app/mushaf-1441/page.tsx`, `_components/Mushaf1441Viewer.tsx` (~4.2k lines),
  `_components/PageCurlOverlay.tsx`, `_components/haptics.ts`, `_components/qiraat/qiraatWordMarker.ts`,
  `src/lib/mushaf-mutshabehat.ts`, `packages/quran-data/mushaf1441/*`,
  validators `scripts/validate-mushaf1441-*.mjs`.
- **Qiraat domain:** `packages/qiraat-core/{types,readers,narrators,repository,engine}.ts`,
  `engine.test.mjs`, fixtures under `fixtures/pages/` (variants), `fixtures/rulings/` (أصول) and
  `fixtures/rules/` (page-level rules); API `src/app/api/mushaf-1441/qiraat/route.ts`.
- **Qiraat pipeline:** `scripts/qiraat/{tokens,authorities,data_variants,data_rulings,build_variants,build_rulings}.py`,
  `scripts/validate-qiraat-data.mjs`; docs `docs/qiraat/00`–`10`.
- **Groups list:** `src/app/(app)/page.tsx`,
  `src/components/{GroupRow,GroupRowTitlesOnly,MainGroupSwipePager,GroupCardGrid,SortBar,FilterBar}.tsx`.
- **Test mode:** `src/app/(app)/test/page.tsx`, `src/components/TestRunner.tsx`,
  `src/lib/test-questions.ts`, `src/lib/test-questions-quran.ts`, `src/app/api/test/answers/route.ts`.
- **Stats:** `src/app/(app)/stats/page.tsx`, `src/components/TestAnswerStats.tsx`.
- **Supabase clients:** `src/lib/supabase-server.ts`, `src/lib/resilient-fetch.ts`,
  `src/lib/session-user.ts`, `src/proxy.ts`.
- **Quran text:** `public/quran/ayahs.json` (Uthmani, alef wasla — normalize with `normalizeArabic`),
  `public/quran/surah-names.json`.

## 7. localStorage keys the reader owns

| Key | Meaning |
|---|---|
| `mushaf1441:reader-layer:v1` | which of the three colour layers is active (`none`/`annotations`/`mutshabehat`/`qiraat`) |
| `mushaf1441:qiraat-prefs:v1` | Qiraat sub-mode, selected Riwayah, study mode, diff toggle, filter |
| `mushaf1441:qiraat-review:v1` | per-locus review verdicts (confirmed / rejected) |
| `mushaf1441:last-page:v1` | resume page |
| `mushaf1441:mutshabehat-highlight:v1`, `mushaf1441:annotations-visible:v1` | **superseded**, read once for migration |

Every access is wrapped in try/catch — private windows and blocked site data make these throw.
