# Mutshabehat V2: Master Project Instructions (for any agent)

> Verified against the live system on **2026-09-15**. Read this first, then `CLAUDE.md` + `AGENTS.md`.
> If something here disagrees with what you observe, trust the observation and update this file.

## 1. What the app is

**متشابهات القرآن الكريم (Mutshabehat V2)** is an Arabic, RTL, **single-user** web app for studying Quran
*mutashabihat* (similar verses): curated groups of similar ayahs, where each ayah is split into
colour-coded parts (shared / different / addition / unique). It also has automated candidate groups,
Quran search with Uthmani spelling tolerance, stats, a D3 network graph, tags, export/import, and a
Mushaf 1441 page reader with annotations.

- **Owner account:** the single GoTrue user in `AUTOLOGIN_EMAIL` (Vercel env / `.env.local`)
- **No login UI.** Middleware signs in automatically as that account (see §6).

## 2. Where everything lives (Mac Mini `amr-Mac-mini`, Tailscale name `youssefs-mac-mini`)

| What | Path | Status |
|---|---|---|
| **App source (CANONICAL)** | `~/Projects/mutshabehat-v2` (internal disk) | git remote `origin` = GitHub. Branches `main` and `feature/mushaf-1441-module` (identical as of 2026-09-15), clean tree |
| **Self-host backend (source of truth)** | `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost` | own local git repo (no remote), branch `fix/colima-selfhost-recovery`. Holds `docker-compose.yml`, `caddy/`, `volumes/initdb/`, `.env`, `.secrets.json`, `.autologin-password.txt`, `cloud-schema.sql`, `README.md` |
| Launchd runtime copy | `~/.mutshabehat-selfhost/` (`ensure-running.sh` + `runtime/`) | copy of the SSD stack config (launchd cannot read from the removable SSD). Re-sync after config changes (see selfhost README) |
| LaunchAgent | `~/Library/LaunchAgents/com.mutshabehat.selfhost.plist` | runs `ensure-running.sh` at login + every 60 s. Log: `~/Library/Logs/mutshabehat-selfhost.log` |
| Colima VM + DB volume | `~/.colima` → `/Volumes/External Mini/Colima` | Docker volume `mutshabehat_db-data` lives in the VM disk on the SSD |
| Legacy static app (V82B/V82C/V83/V84) | GitHub only: branch `legacy-v84-main` / tag `legacy-v84-final` | Old GitHub Pages HTML app. **Not** the V2 app |

**Cleanup 2026-09-15:** `~/Projects/mutshabehat-v2` is the **only** app checkout. Removed (moved to macOS Trash):
`~/dev/mutshabehat-v2` (old snapshot), `~/Projects/mutshabehat-selfhost` (early stack draft), the local legacy repo
`/Volumes/External Mini/Projects/Mutshabehat`, and the Codex worktree `fix/autologin-first-request`. Its WIP
ActivityChart test is saved at `mutshabehat-selfhost/backups/codex-worktree-wip-20260915.patch`.
OneDrive `Mutshabehat/Old version Mutshabehat App` is a personal archive. Do not use it.
- The `mutshabehat` skill (`~/.claude/skills/mutshabehat`) describes the **legacy V83 GitHub Pages app**, not V2.

> ⚠️ `~/dev`, `~/apps`, `~/.colima` are symlinks onto the **External Mini** SSD. If the SSD is not
> mounted, errors look like docker or git failures. Check `ls "/Volumes/External Mini"` first.
> Inside the Colima VM only `/Volumes/External Mini` is mounted. Always use the **real** path for
> compose bind mounts, never `~/apps/...`.

## 3. GitHub: `https://github.com/Shazlka/Mutshabehat` (PUBLIC)

| Branch | Contents |
|---|---|
| `main` (default) | **The Next.js V2 app.** Force-replaced on 2026-09-15 (was the legacy V84 app) |
| `feature/mushaf-1441-module` | V2 working branch, identical to `main` as of 2026-09-15 |
| `legacy-v84-main` + tag `legacy-v84-final` | archived legacy V84 `main` (`b3a0a7b`) |
| `legacy-v84-local-statusline-fix` | an unpushed local legacy commit (`428eb86`), preserved |
| `V82*`, `v83-release`, `claude/*` | legacy app branches |

GitHub Pages still builds from `main`, so the old `shazlka.github.io/Mutshabehat/V84/` URLs no longer serve the
legacy app. To restore them, point Pages at `legacy-v84-main`.

**Local vs GitHub (synced 2026-09-15):** the previously uncommitted production code (mushaf-1441,
`packages/`, scripts, PWA assets) was committed and merged with origin's auto-login fix, then pushed.
Local `feature/mushaf-1441-module` == origin (merge `7fd9b1b`) with a clean tree. Build, `tsc` and `test:proxy` pass.
Pre-sync rollback point: local tag `backup/pre-sync-20260915` (`571a8c9`).
- Local `main` tracks `origin/main`. Work on a branch, merge to `main`, and keep `feature/mushaf-1441-module` in step or retire it.
- The repo is public, so never commit `.env*`, `.secrets.json`, or data files.

## 4. Vercel: `https://mutshabehat-v2.vercel.app`

- Team `shazlka-s-projects` (`team_sDnS0rtYIo3SJZtJ3FsFinGV`), project `mutshabehat-v2`
  (`prj_CNcNhnaT36NFuHlcP5bnVbbDfsSj`), CLI user `amreshazly-4497`. Node 24.x, Next.js preset, region `iad1`.
- `.vercel/project.json` in the canonical repo links to this project. ✅
- **No Git integration** (`link: null`). Pushing to GitHub does **not** deploy. All deploys are CLI uploads
  of a local working tree.
  If you connect Git, the default Production Branch `main` is now correct (V2). Note that Vercel may
  BLOCK git deploys whose commit author is not a team member.
- Current production: `dpl_DfsCpfR9DfhtvHKk79RUFSFqdYPc` (2026-09-11, actor `codex`, CLI).
  Aliases: `mutshabehat-v2.vercel.app`, `mutshabehat-v2-wine.vercel.app`, `mutshabehat-v2-shazlka-s-projects.vercel.app`.
- Production env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `AUTOLOGIN_EMAIL`, `AUTOLOGIN_PASSWORD`.
- Live check 2026-09-15: first hit `307 → /` with the session cookie set, then `200`. ✅

**Deploy:**
```bash
cd ~/Projects/mutshabehat-v2
env -u __NEXT_PROCESSED_ENV npm run build     # must pass first
vercel --prod --yes                           # uploads the WORKING TREE (includes uncommitted WIP)
# If only NEXT_PUBLIC_* env values changed (baked into the bundle at build time):
vercel redeploy https://mutshabehat-v2.vercel.app --scope shazlka-s-projects
```
Prefer committing and pushing to `feature/mushaf-1441-module` before a prod deploy, so GitHub matches production.

## 5. Backend: self-hosted Supabase on the Mac Mini

The Supabase Cloud project `tthlhkdmwusxerfiimgc` is **paused and retired** (the data was migrated 2026-08-31).
`CLAUDE.md` still mentions it as the ref. That is outdated.

| Service (compose project `mutshabehat`) | Image | Port |
|---|---|---|
| `mutshabehat-db` | `postgres:17-alpine` (+ hand-written Supabase roles) | `127.0.0.1:5433` |
| `mutshabehat-auth` | `supabase/gotrue:v2.189.0` | internal 9999 |
| `mutshabehat-rest` | `postgrest/postgrest:v14.12` | internal 3000 |
| `mutshabehat-gateway` | `caddy:2-alpine` (`/auth/v1/*`, `/rest/v1/*`) | `127.0.0.1:8000` |

There is no realtime, storage, studio, or edge functions stack. The app uses none of them. Google OAuth and SMTP are off.

**Tailscale:**
- Node `youssefs-mac-mini`, tailnet `tailcd68dd.ts.net` (tailnet IP: `tailscale status --self`)
- **Public API URL (Funnel):** `https://youssefs-mac-mini.tailcd68dd.ts.net:8443` → `127.0.0.1:8000`
  (= `NEXT_PUBLIC_SUPABASE_URL`). Health: `/auth/v1/health` → 200.
- Funnel `:443` → `127.0.0.1:8090` belongs to **Wave C3B**. Do not touch it.

**Operate:**
```bash
cd "/Volumes/External Mini/Projects/apps/mutshabehat-selfhost"
docker compose ps | logs -f auth | up -d
docker compose exec db psql -U postgres -d postgres      # admin SQL (DDL goes here, not via PostgREST)
launchctl print gui/$(id -u)/com.mutshabehat.selfhost   # watchdog status
# NEVER: docker compose down -v   (deletes the database volume)
```

**Data (exact counts 2026-09-15):** groups 245 · verses 916 · parts 2954 · automated_groups 12668 ·
personal_groups 199 · personal_verses 714 · mushaf_annotations 12 · profiles 1 · tags 0 · auth.users 1.
Every public table has RLS on (`auth.uid() = user_id`).

**Schema (public):**
- `groups(id, user_id, title, color, note, unote, status, favorite, completed, created_at, updated_at, search_vec)`
  → `verses(id, group_id, surah, ayah, label, sort_order)` → `parts(id, verse_id, type, text, sort_order)`
- `tags(id, user_id, name, color)`, `group_tags(group_id, tag_id)`
- `automated_groups(id bigint, legacy_id, title, color, surahs[], payload jsonb, created_at)`, read-only candidates
- `personal_groups` / `personal_verses` / `group_verses` / `verse_parts`: mushaf-1441 / legacy-import set
- `mushaf_annotations` (notes/highlights/bookmarks, page 1–604, line 1–15), `profiles` (UI prefs)
- Functions: `handle_updated_at`, `handle_new_user`, `groups_search_update`

**Repo schema files** (`supabase-stats-aggregates.sql`, `supabase-parts-fts.sql`, `supabase-indexes.sql`,
`supabase-migration-tag-uniqueness.sql`) were not applied after the cloud migration. They were applied on 2026-09-15 (below).

**✅ APPLIED 2026-09-15:** `get_dashboard_stats`, `normalize_arabic`, `rasm_skeleton`, `parts.search_vec`,
the `rasm_skeleton` columns, `surah_counts`, trigram/sort indexes, and `tags_user_name_unique` now exist.
Pre-apply backup: `mutshabehat-selfhost/backups/pre-schema-apply-20260915b.dump`. The files are idempotent. To re-run them
(e.g. on a rebuilt DB):
```bash
cd ~/Projects/mutshabehat-v2
cat supabase-stats-aggregates.sql supabase-parts-fts.sql supabase-indexes.sql supabase-migration-tag-uniqueness.sql \
  | docker exec -i mutshabehat-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction
docker exec mutshabehat-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema'"
```

## 6. App architecture (`~/Projects/mutshabehat-v2`)

**Stack:** Next.js **16.2.6** (App Router, Turbopack), React 19.2, TypeScript, Tailwind v4,
`@supabase/ssr` + `supabase-js`, d3 submodules (network graph only), exceljs, sanitize-html. Node 22 (`.nvmrc`).

```
src/
  proxy.ts                  # Next 16 "middleware": auto-login as AUTOLOGIN_EMAIL, refresh session,
                            # redirect /login|/signup|... → /, GET re-run after first sign-in
  app/
    layout.tsx              # fonts: Cairo (UI) + Amiri Quran (ayahs), RTL, PWA manifest
    globals.css             # design tokens (oklch), see §7
    (app)/                  # main shell (Sidebar + MobileTopbar)
      page.tsx              # groups list: filter/sort/search/pagination, mobile swipe pager
      groups/new, groups/[id], groups/[id]/edit   (+ loading.tsx skeletons)
      automated/            # automated candidate groups → copy into personal
      network/              # D3 force graph
      stats/                # dashboard (RPC w/ fallback), JuzHeatmap, TagDonut, ActivityChart
      tools/, settings/     # tools; settings (swipe nav, export/backup, cache clear)
    mushaf-1441/            # Mushaf page reader (Mushaf1441Viewer.tsx, big client component)
    api/
      groups/ [id]/ [id]/tags/ export/     # CRUD + JSON/SQL/Excel export
      tags/ [id]/ bulk/ export/ import/
      search/               # groups + parts search (FTS → ILIKE → rasm-skeleton tiers)
      automated/copy/
      mushaf-1441/ annotations/ mutshabehat/ page-metadata/ page-words/
    auth/callback/          # leftover OAuth callback
  components/               # ~40 client/server components (GroupRow, EditForm, RichEditor, WordLinker,
                            # ArabicDiff, QuranSearch, NetworkGraph, TagManager, SwipeNavWrapper, ...)
  lib/
    supabase.ts / supabase-server.ts   # browser / server clients
    arabic.ts               # normalizeArabic (folds ٱ→ا, dagger alef→ا, strips tashkeel/tatweel),
                            # rasmSkeleton, normalizeArabicWithMap, matchRanges
    quran.ts                # in-memory pre-normalized ayah index, searchAyahs
    surah-names.ts          # useSurahNames singleton hook
    diff.ts, juz.ts, sanitize.ts, cn.ts
  types/database.ts
packages/                   # mutshabehat-core (mushaf link adapter), qiraat-core, quran-data/mushaf1441 fixtures
public/quran/ayahs.json     # 6,236 ayahs, **Uthmani script**
public/sw.js, manifest.json, icons/   # PWA, SW cache "mutshabehat-v3"
scripts/                    # mushaf1441 import/validate scripts, legacy data migration
supabase-*.sql, supabase/migrations/  # schema history (see §5 gaps)
design-system/mutshabehat-v2/MASTER.md
```

**Data flow:** Server Components and route handlers call `supabase-server.ts` using cookies from `proxy.ts`.
Every request is authenticated as the single user, so RLS applies. The client never holds the service role key.

## 7. Design system

- **Direction:** RTL Arabic, warm "scholarly paper" look. Mobile-first with a native-app feel
  (bottom action bars ≥62px tap targets, swipe navigation, flip cards, iOS safe-area insets).
- **Fonts:** `Cairo` (UI, 3 weights) + `Amiri Quran` (ayah text) via `next/font/google`.
- **Tokens (`src/app/globals.css`, oklch):**
  - Surfaces: `--color-paper` (page), `--color-surface` (card), `--color-surface-2`, `--color-border(-soft)`
  - Ink: `--color-ink`, `--color-ink-soft`, `--color-ink-muted`
  - Primary indigo: `--color-primary` (+ `-hover`, `-soft`, `-tint`)
  - **Diff semantics (the core of the app):** `--color-shared` green · `--color-diff` ochre ·
    `--color-diff2` purple · `--color-diff3` teal · `--color-addition` blue · `--color-unique` terracotta (each has a `-bg`)
  - Status: `--color-danger`, `--color-success`, `--color-warn`
- `design-system/mutshabehat-v2/MASTER.md` is an early generated spec (Noto fonts, black and gold). The
  **live tokens in globals.css win.**
- Safari gotcha: inline text inside 3D-transformed cards collapses. Use flex children (see `GroupRow.tsx`).

## 8. Rules for adding or fixing features

1. Work in `~/Projects/mutshabehat-v2` only. Run `git status` first, because the tree has large uncommitted WIP.
   Create a branch off `feature/mushaf-1441-module` and pull `origin` first (you are 1 commit behind).
2. Read `AGENTS.md`: Next 16 has breaking changes. Check `node_modules/next/dist/docs/` before using Next APIs.
   Middleware lives in `src/proxy.ts` (export `proxy`). `ssr:false` dynamic imports are not allowed in Server Components.
3. All Arabic text matching goes through `normalizeArabic` (`ayahs.json` is Uthmani, with `ٱ` alef wasla).
4. DB changes: write a migration SQL file under `supabase/migrations/`, apply it via
   `docker compose exec db psql` on the Mac Mini, keep RLS policies, then `NOTIFY pgrst, 'reload schema'`.
5. Build: `env -u __NEXT_PROCESSED_ENV npm run build` (a leaked `__NEXT_PROCESSED_ENV` skips `.env.local`).
   Dev: `npm run dev`. Mushaf checks: `npm run mushaf:validate`, `npm run mushaf:runtime`.
6. **Changelog is mandatory:** add a dated entry, newest first, to both `CHANGELOG.md` and the `# Changelog` section of `CLAUDE.md`.
7. Commit, push to `feature/mushaf-1441-module`, deploy with `vercel --prod --yes`, then verify the live site in a browser.
8. Never commit secrets or data files. Never touch Wave C3B containers or Funnel `:443`.
   Never run `docker compose down -v`.

## 9. Troubleshooting quick map

| Symptom | Check / fix |
|---|---|
| Live site loads but shows no data / 500 | `curl https://youssefs-mac-mini.tailcd68dd.ts.net:8443/auth/v1/health` → if it fails: SSD mounted? `colima status`, `docker compose ps`, `tail ~/Library/Logs/mutshabehat-selfhost.log`, `tailscale funnel status` |
| Gateway healthy locally but Funnel 502 after reboot | Colima lost port forward. `docker restart mutshabehat-gateway` |
| Build fails "Supabase URL and API key are required" | `env -u __NEXT_PROCESSED_ENV npm run build` |
| Search misses Uthmani words | route through `normalizeArabic` / `rasmSkeleton` |
| Stats slow | `get_dashboard_stats` RPC missing on self-host (§5) |
| Push to GitHub didn't deploy | expected: no Git integration, deploy via CLI |
