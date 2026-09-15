# Handoff — Mutshabehat V2 (state as of 2026-09-15)

For the next agent picking up this project. Read this first, then `PROJECT_MASTER.md` (full reference:
locations, backend, architecture, troubleshooting) and `CLAUDE.md` (gotchas + mandatory changelog).

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

## 3. How to verify a change

```bash
cd ~/Projects/mutshabehat-v2
npx tsc --noEmit -p .                 # must be clean
npm run mushaf:validate               # Mushaf data/token validators
npm run build                         # must pass
npx next start -p 3222                # then drive it with Playwright (Python) at 1440x900, 1180x820, 390x844
```
After `git push`, wait ~1–2 min and re-run the same Playwright checks with `BASE=https://mutshabehat-v2.vercel.app`.

Known lint baseline (pre-existing, not regressions): `Mushaf1441Viewer.tsx` has 1 error (set-state-in-effect in the
notes localStorage effect) + unused-var warnings; `src/app/(app)/page.tsx` and `stats/page.tsx` have `no-explicit-any` errors.

## 4. What was done this session (newest first)

| Commit | Change |
|---|---|
| `5ab1b0c` | **Groups list card views** (≥1024px): `?view=collapsed` (equal cards, click expands full row) and `?view=magazine` (dense mosaic of hero/tall/wide/regular/short tiles, sized by text length + stable hash). 24 per page, full width; phones fall back to the list. `src/components/GroupCardGrid.tsx`, `SortBar.tsx` (layout switch), `src/app/(app)/page.tsx`. |
| `fb49712` | **Mushaf iBooks-style page curl** + drag-to-turn. `src/app/mushaf-1441/_components/PageCurlOverlay.tsx` (fold geometry, clip-path/matrix/SVG gradients per rAF frame). Viewer: `measurePageTurn`, `goToPage(page, ayahKey, { animate, turnMode })`, pointer drag handlers on `<main>` (`touch-action: none`), `turnPages` keeps highlights on curling sheets. |
| `329b503` | **Test mode**: words mode (hidden differing word), whole-Quran source (`src/lib/test-questions-quran.ts`), answers saved via `POST /api/test/answers` → table `test_answers`; stats tab section `TestAnswerStats.tsx` via RPC `get_test_answer_stats`. Migration `20260915180000_test_answers.sql` **applied** (backup `pre-test-answers-20260915.dump`). |
| `738cb6f` | Mushaf bottom slider navigates by page (1–604), bubble shows page + surah. |
| `7be4d0e` | Mushaf two-page spread at `(min-width:1024px) and (orientation: landscape)`. |
| `047aa6e` … `0a94175` | Mushaf: SVG surah banner, per-group highlight tints as continuous bands loaded server-side, collapsible ayah card, wheel paging, resume last page. |
| `2e4744d`, `e27333d` | Automated candidates copied to personal get a "copied" badge and sort last (`groups.source_automated_id`, view `automated_groups_with_copy`). |
| `090ba8a` | DB-not-loading fix: `src/lib/resilient-fetch.ts` DNS-over-HTTPS fallback for Vercel → `*.ts.net`. |
| `daee8d6` | Test mode `/test`; Mushaf 1441 importer fix (words placed by their own page) + fixtures regenerated. |
| `0026ee2` | Perf: `save_group` RPC, `search_group_ids` RPC, surah filter join, session-cookie user (`src/lib/session-user.ts`); `/automated/[id]`, `/surahs`. |
| `a731364` | Vercel functions pinned to `bom1`. |

Applied migrations this session: `20260915120000_perf_save_search_surahs.sql`, `20260915150000_automated_copy_tracking.sql`, `20260915180000_test_answers.sql`.

## 5. Open items / known issues (not requested yet)

- `/stats` throws React hydration error #418 in the browser console (existed before the test stats; likely `ActivityChart` date/timezone rendering). Not fixed.
- Mushaf header shows only the navigated page number in spread mode (e.g. "ص 106"), not both pages; header ayah range comes from that page's metadata.
- Page curl drag was verified with a mouse in Chromium, not on a physical iPad — worth a real-device check (Safari, `touch-action`, performance of `filter: drop-shadow` during the curl).
- Magazine view: sizes are heuristic (`magazineSize` in `GroupCardGrid.tsx`); the last row can be ragged.
- The Impeccable design hook flags literal colours in `Mushaf1441Viewer.tsx` because there is no `DESIGN.md`. They were classified as intentional/pre-existing, not suppressed. The user has not yet chosen between `/impeccable document` (create DESIGN.md) or ignore-values.
- Mac Mini load: earlier outages came from overload (stale agy/claude processes, old dev servers). If the DB is slow or GoTrue 504s, check `top` / stale processes first and ask the user before killing anything.

## 6. Key files map (recently touched)

- Mushaf reader: `src/app/mushaf-1441/page.tsx`, `_components/Mushaf1441Viewer.tsx` (~3k lines), `_components/PageCurlOverlay.tsx`, `src/lib/mushaf-mutshabehat.ts`, `packages/quran-data/mushaf1441/*`, validators `scripts/validate-mushaf1441-*.mjs`.
- Groups list: `src/app/(app)/page.tsx`, `src/components/{GroupRow,GroupRowTitlesOnly,MainGroupSwipePager,GroupCardGrid,SortBar,FilterBar}.tsx`.
- Test mode: `src/app/(app)/test/page.tsx`, `src/components/TestRunner.tsx`, `src/lib/test-questions.ts`, `src/lib/test-questions-quran.ts`, `src/app/api/test/answers/route.ts`.
- Stats: `src/app/(app)/stats/page.tsx`, `src/components/TestAnswerStats.tsx`.
- Supabase clients: `src/lib/supabase-server.ts`, `src/lib/resilient-fetch.ts`, `src/lib/session-user.ts`, `src/proxy.ts`.
- Quran text: `public/quran/ayahs.json` (Uthmani, alef wasla — normalize with `normalizeArabic`), `public/quran/surah-names.json`.
