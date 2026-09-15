# Mutshabehat V2: Master Project Instructions (for any agent)

> **Read this first.** Last verified against the live system: **2026-09-15**.
> Then read `AGENTS.md` (Next.js 16 warning) and `CLAUDE.md` (gotchas + changelog).
> If anything here disagrees with what you observe, trust the observation and **update this file**.

---

## 0. Quick facts (cheat sheet)

| Item | Value |
|---|---|
| App name | **متشابهات القرآن الكريم**: Mutshabehat V2 |
| Live URL | https://mutshabehat-v2.vercel.app |
| Source code (only checkout) | `~/Projects/mutshabehat-v2` on the Mac Mini |
| GitHub | https://github.com/Shazlka/Mutshabehat (**public**), branch **`main`** |
| Vercel | team `shazlka-s-projects`, project `mutshabehat-v2`. **Git-connected: push to `main` deploys production** |
| Backend | self-hosted Supabase (Postgres + GoTrue + PostgREST + Caddy) in Docker/Colima on the Mac Mini |
| Backend public URL | `https://youssefs-mac-mini.tailcd68dd.ts.net:8443` (Tailscale Funnel) |
| Backend config dir | `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost` |
| Machine | Mac Mini `amr-Mac-mini`, Tailscale node `youssefs-mac-mini`, tailnet `tailcd68dd.ts.net` |
| Users | single user, **no login UI** (auto-login in `src/proxy.ts`) |
| Agent entry points | this file · `AGENTS.md` · `CLAUDE.md` · skill `mutshabehat` (identical copies in `~/.claude/skills/`, `~/.agents/skills/`, `~/.gemini/skills/`) |
| "Where is X?" | §10 search guide |

---

## 1. What the app is

An Arabic, RTL, single-user web app (installable as a PWA) for studying Quran **mutashabihat** (similar verses):

- **Personal groups:** curated groups of similar ayahs. Each ayah is split into colour-coded **parts**
  (shared / diff / addition / unique) so the differences between near-identical verses stand out.
  Groups have title, colour, notes, status, favourite, completed, and tags.
- **Automated groups:** 12.6k algorithm-detected candidate groups (read-only). They can be copied into personal groups.
- **Quran search:** 6,236 ayahs (Uthmani script) with spelling tolerance (alef wasla, dagger alef, rasm skeleton) and match highlighting.
- **Stats dashboard:** counts, juz heatmap, tag donut, 30-day activity. **Network graph:** D3 force graph of groups/surahs.
- **Tags:** CRUD, bulk tagging, import/export. **Export/backup:** JSON / SQL / Excel.
- **Mushaf 1441 reader** (`/mushaf-1441`): page-accurate mushaf (604 pages, 15 lines) with highlights, notes,
  bookmarks, favourites (`mushaf_annotations`), surah/page sliders, swipe page turning, and a mutshabehat connections panel.
- Mobile-first, native feel: bottom action bars, swipe navigation between groups, flip cards.

---

## 2. Locations on the Mac Mini

| What | Path | Notes |
|---|---|---|
| **App source (the ONLY checkout)** | `~/Projects/mutshabehat-v2` | internal disk. `origin` = GitHub. Work on `main` or short-lived branches. Repo-local git identity = `Shazlka <amr.eshazly@gmail.com>` |
| **Backend stack (source of truth)** | `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost` | local-only git repo. `docker-compose.yml`, `caddy/Caddyfile`, `volumes/initdb/`, `README.md`, `cloud-schema.sql`, `bin/ensure-running.sh`, `launchd/`, `tests/`. Secrets: `.env`, `.secrets.json`, `.autologin-password.txt` (chmod 600, git-ignored) |
| DB backups | `…/mutshabehat-selfhost/backups/` | `pg_dump -Fc` files (e.g. `pre-schema-apply-20260915b.dump`) |
| Watchdog runtime copy | `~/.mutshabehat-selfhost/` (`ensure-running.sh` + `runtime/`) | copy of the stack config (launchd can't read from the removable SSD). Re-sync after config changes (steps in the stack README) |
| LaunchAgent | `~/Library/LaunchAgents/com.mutshabehat.selfhost.plist` | runs the watchdog at login and every 60 s. Log: `~/Library/Logs/mutshabehat-selfhost.log` |
| Legacy LaunchAgent (not V2) | `com.mutshabehat.server` (plist renamed `….plist.disabled-20260911`) | old legacy Python `server.py` from iCloud `Mutshabehat_Mini`. Still loaded until logout/reboot and failing (exit 78). Not needed by V2. Unload with `launchctl bootout gui/$(id -u)/com.mutshabehat.server` |
| Colima VM + DB data | `~/.colima` → `/Volumes/External Mini/Colima` | Docker volume `mutshabehat_db-data` (inside the VM disk on the SSD) |
| Legacy V82–V84 static app | GitHub only: branch `legacy-v84-main`, tag `legacy-v84-final` | not V2. Old GitHub Pages app. Don't build on it |

**There are no other copies.** `~/dev/mutshabehat-v2`, `~/Projects/mutshabehat-selfhost`, the local legacy repo, and old
Codex worktrees were removed on 2026-09-15. Ignore iCloud/OneDrive "Mutshabehat" folders (personal archives).

> ⚠️ **External SSD:** `~/dev`, `~/apps`, `~/.colima`, `~/.claude` are symlinks onto **`/Volumes/External Mini`**.
> If the SSD is unmounted, failures look like docker/git errors. Check `ls "/Volumes/External Mini"` first.
> The Colima VM only mounts `/Volumes/External Mini`. In compose files, use the **real** path, never `~/apps/...`.

---

## 3. GitHub: https://github.com/Shazlka/Mutshabehat

| Branch / tag | Contents |
|---|---|
| **`main`** (default) | **The V2 Next.js app. Production.** |
| `feature/mushaf-1441-module` | old V2 working branch (same as `main` on 2026-09-15). Its pushes create duplicate previews, so it can be retired |
| `legacy-v84-main`, tag `legacy-v84-final` | archived legacy static app (old `main`, `b3a0a7b`) |
| `legacy-v84-local-statusline-fix` | one preserved legacy commit (`428eb86`) |
| `V82*`, `v83-release`, `claude/*` | legacy app branches |
| `diag/dns-region` | **temporary** DNS/region diagnostic commits ("do not merge"), preview-only, created 2026-09-15 by another session (with a worktree under `/private/tmp/...`). Never merge it; delete it when that diagnosis is done |

- The repo is **PUBLIC**. Never commit `.env*`, `.secrets.json`, passwords, user ids/emails, DB dumps, or xlsx/csv/pdf data.
- GitHub Pages builds from `main`, so the old `shazlka.github.io/Mutshabehat/V84/` URLs are 404. Point Pages at `legacy-v84-main` if they're needed.

---

## 4. Vercel: https://mutshabehat-v2.vercel.app

| Item | Value |
|---|---|
| Team | `shazlka-s-projects` (`team_sDnS0rtYIo3SJZtJ3FsFinGV`) |
| Project | `mutshabehat-v2` (`prj_CNcNhnaT36NFuHlcP5bnVbbDfsSj`), linked via `.vercel/project.json` |
| CLI user | `amreshazly-4497` (always pass `--scope shazlka-s-projects`) |
| Git | connected to `Shazlka/Mutshabehat`, **Production Branch `main`** |
| Build | Next.js preset, Node 24.x, Turbopack. **Functions pinned to `bom1` (Mumbai) in `vercel.json`**: in `iad1`, Vercel's DNS can't resolve the `*.ts.net` Funnel hostname (`ENOTFOUND`), so every page loads empty. Don't remove the pin |
| Aliases | `mutshabehat-v2.vercel.app`, `mutshabehat-v2-wine.vercel.app`, `mutshabehat-v2-shazlka-s-projects.vercel.app`, `mutshabehat-v2-git-main-shazlka-s-projects.vercel.app` (branch previews: `mutshabehat-v2-git-<branch>-shazlka-s-projects.vercel.app`) |
| Dashboard | https://vercel.com/shazlka-s-projects/mutshabehat-v2 |
| Env vars (Production) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTOLOGIN_EMAIL`, `AUTOLOGIN_PASSWORD` |

**How deploys work:**
- `git push origin main` → **production** build, auto-promoted.
- Push any other branch → **preview** URL (use it for review before merging).
- Fallback only: `vercel --prod --yes --scope shazlka-s-projects` (uploads the local working tree, including uncommitted files).
- If a `NEXT_PUBLIC_*` value changes, redeploy (it's baked in at build time):
  `vercel redeploy https://mutshabehat-v2.vercel.app --scope shazlka-s-projects`.
- A deploy that "hangs" or shows UNKNOWN is probably **`BLOCKED`** (commit author not a Vercel team member). Check the
  state via the Vercel API/MCP, and commit as `Shazlka <amr.eshazly@gmail.com>` (the repo-local git config already does).
- Verified 2026-09-15: production = git deploy `dpl_FayCF1kFS8LDkfLDAAckQTxAG9hr` (`ddd6e7f`, `main`) READY.
  `/`, `/stats`, `/automated`, `/network`, `/mushaf-1441` all return 200; backend health 200.

---

## 5. Backend: self-hosted Supabase (Mac Mini, Colima)

The Supabase **Cloud** project `tthlhkdmwusxerfiimgc` is **retired** (paused, data migrated 2026-08-31). Don't use it.

| Container (compose project `mutshabehat`) | Image | Port |
|---|---|---|
| `mutshabehat-db` | `postgres:17-alpine` + hand-written Supabase roles | `127.0.0.1:5433` |
| `mutshabehat-auth` | `supabase/gotrue:v2.189.0` | internal 9999 |
| `mutshabehat-rest` | `postgrest/postgrest:v14.12` | internal 3000 |
| `mutshabehat-gateway` | `caddy:2-alpine`: `/auth/v1/*` → auth, `/rest/v1/*` → rest | `127.0.0.1:8000` |

Not running: realtime, storage, studio, edge functions (the app uses none). Google OAuth and SMTP are off.

**Tailscale**
- Funnel **`:8443`** → `127.0.0.1:8000` = `https://youssefs-mac-mini.tailcd68dd.ts.net:8443` (this is `NEXT_PUBLIC_SUPABASE_URL`).
- Health: `curl https://youssefs-mac-mini.tailcd68dd.ts.net:8443/auth/v1/health` → 200.
- Funnel **`:443` → `:8090` belongs to the Wave C3B project. Never change it.**
- Status: `tailscale funnel status`. Node IP: `tailscale status --self`.

**Operate**
```bash
cd "/Volumes/External Mini/Projects/apps/mutshabehat-selfhost"   # real path, not ~/apps
docker compose ps
docker compose logs -f auth
docker compose up -d
docker compose exec db psql -U postgres -d postgres               # admin SQL / DDL
docker exec mutshabehat-db pg_dump -U postgres -d postgres --schema=public --schema=auth -Fc > backups/<name>.dump
launchctl print gui/$(id -u)/com.mutshabehat.selfhost             # watchdog
# NEVER: docker compose down -v   (deletes the database volume)
```

**Data (2026-09-15):** groups 246 · verses 923 · parts 2991 · automated_groups 12668 · personal_groups 199 ·
personal_verses 714 · mushaf_annotations 12 · profiles 1 · tags 0 · auth.users 1.

**Schema (`public`, RLS ON for every table, `auth.uid() = user_id`)**
- `groups(id, user_id, title, color, note, unote, status, favorite, completed, created_at, updated_at, search_vec, rasm_skeleton)`
  - `verses(id, group_id, surah, ayah, label, sort_order)`
    - `parts(id, verse_id, type, text, sort_order, search_vec, rasm_skeleton)`
- `tags(id, user_id, name, color)` (unique `user_id, lower(name)`) · `group_tags(group_id, tag_id)`
- `automated_groups(id bigint, legacy_id, title, color, surahs[], payload jsonb, created_at)`
- `personal_groups`, `personal_verses`, `group_verses`, `verse_parts`: legacy-import / mushaf set
- `mushaf_annotations(annotation_type, target_type, ayah_key, page_number 1–604, line_number 1–15, word ids, title, body, colours, tags[], metadata)`
- `profiles(display_name, font_preset, theme, font_size, compact_mode)`
- Functions: `get_dashboard_stats()`, `normalize_arabic()`, `rasm_skeleton()`, `groups_search_update()`, `handle_updated_at()`, `handle_new_user()`
- View: `surah_counts` (security_invoker)
- Schema history files: `supabase-schema*.sql`, `supabase-parts-fts.sql`, `supabase-stats-aggregates.sql`,
  `supabase-indexes.sql`, `supabase-migration-tag-uniqueness.sql`, `supabase/migrations/*.sql` (all applied and idempotent).

---

## 6. App architecture (`~/Projects/mutshabehat-v2`)

**Stack:** Next.js **16.2.6** (App Router, Turbopack), React 19.2, TypeScript, Tailwind CSS v4, `@supabase/ssr` +
`@supabase/supabase-js`, d3 submodules (network only), exceljs, sanitize-html. Node 22 locally (`.nvmrc`).

```
src/
  proxy.ts                 # Next 16 middleware (export `proxy`): auto sign-in as AUTOLOGIN_EMAIL,
                           # session refresh, one same-URL redirect after first sign-in, /login etc → /
  app/
    layout.tsx             # RTL <html>, fonts Cairo (UI) + Amiri Quran (ayahs), PWA manifest
    globals.css            # design tokens (§7)
    not-found.tsx
    (app)/                 # app shell: Sidebar (desktop) + MobileTopbar
      page.tsx             # groups list: search, surah filter, sort, pagination, mobile swipe pager
      groups/new/          # create group
      groups/[id]/         # group detail (+ loading.tsx), swipe prev/next, bottom bar
      groups/[id]/edit/    # editor (RichEditor, WordLinker, parts), save & next/prev
      automated/           # automated candidates → copy to personal
      network/             # D3 graph
      stats/               # dashboard via get_dashboard_stats RPC (fallback: multi-query)
      tools/  settings/    # tools; settings (swipe nav, DB export/backup, clear cache)
    mushaf-1441/           # page.tsx + _components/Mushaf1441Viewer.tsx (large client component)
    api/
      groups/  groups/[id]/  groups/[id]/tags/  groups/export/
      tags/  tags/[id]/  tags/bulk/  tags/export/  tags/import/
      search/              # FTS → ILIKE → rasm-skeleton tiers
      quran/               # ayahs + surah names (CDN-cached)
      automated/copy/
      mushaf-1441/annotations|mutshabehat|page-ayat|page-metadata|page-words/
    auth/callback/         # leftover OAuth callback
  components/              # ~40 components: GroupRow, GroupDetail, EditForm, RichEditor, WordLinker, ArabicDiff,
                           # QuranSearch, SurahFilter, FilterBar, SortBar, NetworkGraph, TagManager, BulkTagger,
                           # JuzHeatmap, TagDonut, ActivityChart, SwipeNavWrapper, GroupMobileBottomBar, ...
  lib/
    supabase.ts            # browser client
    supabase-server.ts     # server client (cookies)
    arabic.ts              # normalizeArabic, rasmSkeleton, normalizeArabicWithMap, matchRanges
    quran.ts               # pre-normalized in-memory ayah index, searchAyahs
    surah-names.ts         # useSurahNames (singleton fetch + cache)
    diff.ts  juz.ts  sanitize.ts  cn.ts
  types/database.ts
packages/
  quran-data/mushaf1441/   # page words/ayahs/metadata fixtures + loaders (imported by the app, must stay committed)
  mutshabehat-core/        # mushaf ↔ mutshabehat link adapter
  qiraat-core/             # qiraat variants adapter (sample source)
public/
  quran/ayahs.json         # 6,236 ayahs, UTHMANI script
  quran/surah-names.json
  sw.js  manifest.json  icons/   # PWA (SW cache "mutshabehat-v3", SWR for /api/quran)
scripts/                   # mushaf1441 import/validate, legacy data migration
tests/proxy-autologin.test.mjs
design-system/mutshabehat-v2/MASTER.md   # early generated spec. globals.css tokens win
CHANGELOG.md  CLAUDE.md  AGENTS.md  PROJECT_MASTER.md
```

**Data flow:** browser → Vercel (Next.js). `proxy.ts` ensures a session cookie. Server Components and route handlers call
`supabase-server.ts` → Tailscale Funnel → Caddy → PostgREST/GoTrue → Postgres (RLS as the single user). The service role
key is server-only.

---

## 7. Design system

- **Look:** RTL Arabic, warm "scholarly paper". Calm, readable, mobile-first, native-app feel.
- **Fonts:** `Cairo` (UI, 3 weights) and `Amiri Quran` (all Quran text), via `next/font/google`.
- **Tokens** (`src/app/globals.css`, oklch):
  - Surfaces: `--color-paper` (page) · `--color-surface` (card) · `--color-surface-2` · `--color-border` · `--color-border-soft`
  - Text: `--color-ink` · `--color-ink-soft` · `--color-ink-muted`
  - Brand: `--color-primary` indigo (+ `-hover`, `-soft`, `-tint`)
  - **Part/diff colours (core meaning, keep consistent):** `--color-shared` green · `--color-diff` ochre ·
    `--color-diff2` purple · `--color-diff3` teal · `--color-addition` blue · `--color-unique` terracotta (each has a `-bg`)
  - Status: `--color-danger` · `--color-success` · `--color-warn`
- **Patterns:** bottom action bars with ≥62px cells + safe-area insets. Swipe right/left follows RTL (next/prev). Flip
  cards on mobile. `loading.tsx` skeletons. Mushaf selection tint `#ece2c8`.
- **Safari gotcha:** inline text inside 3D-transformed cards collapses. Use flex children (see `GroupRow.tsx`).

---

## 8. Workflow for adding or fixing features

1. `cd ~/Projects/mutshabehat-v2 && git status && git pull --ff-only`. Confirm you're on a clean `main`.
2. Create a branch: `git checkout -b feat/<name>`.
3. Read `AGENTS.md`: **Next.js 16 has breaking changes.** Check `node_modules/next/dist/docs/` before using Next APIs.
   Middleware = `src/proxy.ts`. `ssr:false` dynamic imports are not allowed in Server Components.
4. Arabic text matching **must** use `normalizeArabic` / `rasmSkeleton` (`ayahs.json` is Uthmani: `ٱ`, dagger alef).
5. DB change: add `supabase/migrations/<timestamp>_<name>.sql` (idempotent, with RLS policies). Back up first, then apply:
   `docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < file.sql`,
   then `NOTIFY pgrst, 'reload schema'`. Update `src/types/database.ts`.
6. Verify locally:
   `env -u __NEXT_PROCESSED_ENV npm run build` · `npx tsc --noEmit` · `npm run lint` ·
   `set -a; source .env.local; set +a; npm run test:proxy` · Mushaf: `npm run mushaf:validate`.
   Dev server: `npm run dev` (uses `.env.local` → self-hosted backend, i.e. **real data**).
7. **Changelog is mandatory:** add a dated, newest-first entry to **both** `CHANGELOG.md` and the `# Changelog` section of `CLAUDE.md`.
8. Push the branch → review the Vercel **preview** URL → merge to `main` → push → production deploy → check the live site in a browser.
9. **Never:** commit secrets or data files · touch Wave C3B containers or Funnel `:443` · run `docker compose down -v` ·
   use the retired Supabase Cloud project · force-push `main` without an archive.

---

## 9. Troubleshooting

| Symptom | Check / fix |
|---|---|
| Live site up but empty, Vercel logs `getaddrinfo ENOTFOUND …ts.net` | Vercel function region can't resolve the Funnel host. Keep `vercel.json` `"regions": ["bom1"]` |
| Pages load but very slow / auth `/token` 504, DB "context deadline exceeded" | Mac Mini CPU overloaded (Colima VM CPU pressure). Check `colima ssh -- cat /proc/pressure/cpu`, `docker stats`, `ps -Ao pcpu,comm -r` on the host |
| Live site up but empty / 500 | `curl …ts.net:8443/auth/v1/health`. If it fails: SSD mounted? `colima status` → `docker compose ps` → `tail ~/Library/Logs/mutshabehat-selfhost.log` → `tailscale funnel status` |
| Local gateway OK, Funnel 502 after reboot | Colima lost the port-forward: `docker restart mutshabehat-gateway` |
| Docker/git "not found" weirdness | External SSD not mounted |
| Build: "Supabase URL and API key are required" | `env -u __NEXT_PROCESSED_ENV npm run build` |
| Search misses Uthmani spelling | normalize through `normalizeArabic` / `rasmSkeleton`, and check the `search_vec`/`rasm_skeleton` columns exist |
| Push didn't deploy / deploy hangs | Vercel deployment state `BLOCKED` = commit author. Check git identity (§4) |
| New `NEXT_PUBLIC_*` value not live | redeploy (baked at build time) |
| First page load empty | auto-login redirect in `proxy.ts` (see `tests/proxy-autologin.test.mjs`) |

---

## 10. Where to search ("where is X?")

| Looking for | Look in |
|---|---|
| A page / screen | `src/app/(app)/<route>/page.tsx` (mushaf: `src/app/mushaf-1441/`) |
| An API endpoint | `src/app/api/<name>/route.ts` |
| A UI piece (card, bar, editor, chart) | `src/components/` (grep the Arabic label text, e.g. `grep -rn "حفظ والتالية" src`) |
| Arabic normalization / search logic | `src/lib/arabic.ts`, `src/lib/quran.ts`, `src/app/api/search/route.ts` |
| Supabase client / auth / session | `src/lib/supabase*.ts`, `src/proxy.ts` |
| DB types | `src/types/database.ts`. Live schema: `docker compose exec db psql -U postgres -c '\d public.*'` (from the backend dir) |
| Migrations / SQL history | `supabase/migrations/`, root `supabase-*.sql`; backend `cloud-schema.sql`, `volumes/initdb/` |
| Colours, fonts, spacing | `src/app/globals.css`, `src/app/layout.tsx` |
| Mushaf page data & validators | `packages/quran-data/mushaf1441/`, `scripts/*mushaf1441*`, `npm run mushaf:*` |
| PWA / offline | `public/sw.js`, `public/manifest.json`, `public/icons/` |
| Why something changed | `CHANGELOG.md` (newest first), `git log -S "<code>"` |
| Backend compose, gateway, watchdog | `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost` (`README.md`, `docker-compose.yml`, `caddy/Caddyfile`, `bin/`, `launchd/`) |
| Deploys, env vars, runtime logs | Vercel dashboard / Vercel MCP (team `team_sDnS0rtYIo3SJZtJ3FsFinGV`, project `prj_CNcNhnaT36NFuHlcP5bnVbbDfsSj`) or `vercel logs <url> --scope shazlka-s-projects` |
| Code/knowledge graph (may be stale, Jun 2026) | `graphify-out/` |

## 11. Access and tools an agent has on this machine

- **GitHub:** `gh` CLI authenticated; `git push origin <branch>` works over HTTPS.
- **Vercel:** `vercel` CLI logged in as `amreshazly-4497`; the Vercel MCP connector also works for projects/deployments/logs.
- **Backend:** `docker` (Colima context) + `docker compose exec db psql …`. There's no Supabase CLI and no host `psql`, and there's no Management API either (the backend is self-hosted).
- **Tailscale:** `tailscale` CLI (status/funnel). Don't change Funnel config except `:8443`.
- **Secrets:** only in files, never in chat or git: app `.env.local` (dev → self-host), backend `.env`, `.secrets.json`,
  `.autologin-password.txt`. Production values live in Vercel env vars. Read values only when a task needs them, and never print them.
- **Stale data:** `.env.local.supabase-cloud.bak` points at the retired cloud project. Don't use it.
