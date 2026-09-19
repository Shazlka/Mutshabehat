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
- **Test mode** (`/test`): quiz on your own groups or the whole Quran — pick the location / pick the missing similar word / recall flashcards / mixed — with a colour-coded review. Every answer is stored in `test_answers`; the stats tab shows right/wrong totals.
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
- Functions: `save_group(id, fields, verses)` (editor save, 1 round-trip), `search_group_ids(q)`, `get_dashboard_stats()`, `normalize_arabic()`, `rasm_skeleton()`, `groups_search_update()`, `handle_updated_at()`, `handle_new_user()`
- Views: `surah_counts`, `automated_surah_counts` (security_invoker)
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
      automated/           # automated candidates (cards) → copy to personal
      automated/[id]/      # one automated candidate: all ayat, surah links, copy button
      surahs/              # Surah tab: 114 cards with personal + automated counts
      surahs/[no]/         # one surah: personal groups / automated tabs
      test/                # mutashabihat test mode: setup → quiz (TestRunner) → results
      network/             # D3 graph
      stats/               # dashboard via get_dashboard_stats RPC (fallback: multi-query)
      tools/  settings/    # tools; settings (swipe nav, DB export/backup, clear cache)
    mushaf-1441/           # page.tsx (?page=N) + loading.tsx + _components/Mushaf1441Viewer.tsx (large client component)
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
    session-user.ts        # getSessionUser: user from session cookie, no auth round-trip
    arabic.ts              # normalizeArabic, rasmSkeleton, normalizeArabicWithMap, matchRanges
    quran.ts               # pre-normalized in-memory ayah index, searchAyahs
    surah-names.ts         # useSurahNames (singleton fetch + cache)
    test-questions.ts      # builds test questions from personal groups (shared types)
    test-questions-quran.ts # whole-Quran questions (server; distractors from the Quran text)
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
| Live site up but empty, Vercel logs `getaddrinfo ENOTFOUND …ts.net` | Vercel DNS intermittently can't resolve the Funnel host (any region). Server Supabase clients must use `resilientFetch` (`src/lib/resilient-fetch.ts`, DoH fallback); keep `vercel.json` `bom1` pin too. Any new `createServerClient` must pass `global: { fetch: resilientFetch }` |
| Pages load but very slow / auth `/token` 504, DB "context deadline exceeded" | Mac Mini CPU overloaded (Colima VM CPU pressure). Check `colima ssh -- cat /proc/pressure/cpu`, `docker stats`, `ps -Ao pcpu,comm -r` on the host |
| Live site up but empty / 500 | `curl …ts.net:8443/auth/v1/health`. If it fails: SSD mounted? `colima status` → `docker compose ps` → `tail ~/Library/Logs/mutshabehat-selfhost.log` → `tailscale funnel status` |
| Local gateway OK, Funnel 502 after reboot | Colima lost the port-forward: `docker restart mutshabehat-gateway` |
| Docker/git "not found" weirdness | External SSD not mounted |
| Build: "Supabase URL and API key are required" | `env -u __NEXT_PROCESSED_ENV npm run build` |
| Mushaf page shows wrong letters, lines out of order, or a missing surah header | data: `npm run mushaf:validate` (page-order check); re-import with `node scripts/import-mushaf1441-page-words.mjs` (places words by their own page_number). Render: page text waits for its own QCF font |
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

---

## 12. Qiraat Ashr: the import process for the remaining Mushaf pages

**Read this before importing any page beyond 20.** Pages 1–20 are done and live; this section is the
repeatable recipe for 21–604, written so the next session does not have to rediscover it. The
architecture behind it is `docs/qiraat/10-v2-architecture-plan.md`; this is the operating procedure.

### 12.1 Where everything lives

| Thing | Path |
|---|---|
| Token matcher (anchors every locus to a real Mushaf word) | `scripts/qiraat/tokens.py` |
| Arabic name → canonical Q-ID, with the ambiguity guards | `scripts/qiraat/authorities.py` |
| The الأوجه tables (variants), page by page | `scripts/qiraat/data_variants.py` |
| The جدول الصفحة (أصول rulings), page by page | `scripts/qiraat/data_rulings.py` |
| Generators (write the fixtures, enforce the invariants) | `scripts/qiraat/build_variants.py`, `build_rulings.py` |
| Dataset linter (no dev deps) | `scripts/validate-qiraat-data.mjs` — `npm run qiraat:validate` |
| Generated variant fixtures | `packages/qiraat-core/fixtures/pages/page-NNN.json` |
| Generated ruling fixtures | `packages/qiraat-core/fixtures/rulings/page-NNN.json` |
| Postgres schema (written + tested, NOT applied) | `supabase/migrations/20260917120000_qiraat_v2_schema.sql` |

### 12.2 The loop for one batch of pages

1. **Transcribe the source page into the data files.** Add a `PAGES[n]` entry to `data_variants.py`
   (the الأوجه table) and a `RULINGS[n]` entry to `data_rulings.py` (the جدول الصفحة). Include
   الشواهد via `ev=[...]` and any صندوق الملاحظات text via `note=`.
2. **Run the generators.** `python3 scripts/qiraat/build_variants.py && python3 scripts/qiraat/build_rulings.py`.
   They fail loudly rather than emitting bad data — fix what they report, do not work around it.
3. **Wire the page in** — one line each in `PAGE_VARIANT_LOADERS` and `PAGE_RULING_LOADERS`
   (`packages/qiraat-core/repository.ts`). Nothing else changes; the API and UI are page-count-agnostic.
4. **Lint the dataset.** `npm run qiraat:validate`.
5. **Test + build.** `npm run test:qiraat`, `npx tsc --noEmit -p .`, `npm run mushaf:validate`,
   `env -u __NEXT_PROCESSED_ENV npx next build`.
6. **Review in the app.** Burger/sidebar → «مراجعة المواضع المستوردة», walk the page, export the
   verdicts as JSON. Only a locus confirmed against the paper original may ever be promoted past
   `REVIEWED`.

### 12.3 Rules that are not negotiable

- **Never hand-type `baseText`.** It always comes from `tokens.find()`, i.e. verbatim from the real
  Mushaf-1441 word fixtures. Hand-typing silently reorders combining marks and produces spans that
  match nothing at render time. The generator and the linter both enforce this.
- **Never write a bare `خلف`.** It is two different people: the narrator خلف عن حمزة (`Q06-R01`)
  and the reader خلف العاشر (`Q10`). `authorities.py` refuses to resolve it — write `KHALAF_HAMZA`
  or `KHALAF10`. Same for `الدوري` → `DURI_AMR` / `DURI_KISAI`.
  Rule of thumb from the source's own layout: inside ترك الغنة and وقف حمزة, «لخلف» is the narrator;
  in a list that already names حمزة separately, it is خلف العاشر.
- **A rule is written once but never auto-applied.** Every occurrence is its own verified record,
  because the rule genuinely does not hold at every position (وقفًا vs وصلًا, ميم الجمع before a
  vowel, …). Never expand a rule across the Quran automatically.
- **Never infer "performance-only" from normalised text equality.** Normalisation strips harakat, so
  عَلَيْهِمْ and عَلَيْهُمْ compare equal and a real, visible difference gets erased. It is decided
  from the source's own wording (إشمام / اختلاس / سكت). This bug shipped once and was caught by the
  baseline invariant — do not reintroduce it.
- **Nothing reaches `VERIFIED` without a human reading the paper original.** The import ships at
  `REVIEWED`; RLS and `PUBLIC_VERIFICATION_STATUSES` keep that out of the ordinary reader's view.

### 12.4 Invariants the generators enforce (and what each one caught)

| Invariant | Why it exists |
|---|---|
| The baseline وجه must contain حفص **and** its text must equal what the Mushaf prints | Caught three loci where the source's أوجه rows are **swapped** (2:9 يخدعون، 2:81 خطيئته، 2:111 أمانيهم) |
| A variant locus must partition all 20 Riwayat exactly once | Caught 2:83 تعبدون (حمزة/الكسائي in both أوجه، يعقوب missing) and 2:93 قلوبهم العجل (خلف in two of three) |
| Every anchor must be a real word on that page | Caught ~20 query spellings that did not exist in the mushaf (أمانيكم for أمانيهم, وتستحيون for ويستحيون …) |
| No reading claimed twice at the **same token** | Note: a grouped locus spans several words (2:37 آدم+كلمات), where one reader legitimately differs at each — the check is per token, not per locus |
| One usul family = exactly one colour, dataset-wide | Keeps the page legible as categories grow |
| `hasAlternate` must agree with its readings | Keeps the ذو وجهين marker honest |

### 12.4b What the pages 22–41 batch cost in anchor fixes (read before the next batch)

The generators rejected **23 anchors** on the first run of this batch. None was a data error on
my side — every one was the source spelling a word differently from the mushaf. The four shapes,
because they will recur on every remaining batch:

| Shape | Example | Fix |
|---|---|---|
| A small high **ۥ / ۦ** expands to و / ي in `norm()` | `قوله` ✗ → `قولهو` ✓ (قَوْلُهُۥ); `بيده` ✗ → `بيدهي` ✓ | write the expansion letter, as page 20's `فامتعهو` already did |
| The source quotes the **variant**, the anchor needs the **rasm** | `حتى يقتلوكم` ✗ → `حتى يقاتلوكم` ✓; `كثير ومنفع` ✗ → `كبير ومنافع` ✓ | anchor on what Hafs prints, never on the وجه |
| Final long aa written `ىٰ` | `واليتمى` ✗ → `واليتاما` ✓ | the fold tier usually catches this; spell it as the mushaf does |
| A neighbouring word is part of the token | `شيء` ✗ → `بشيء` ✓; `العذاب بالمغفرة` ✗ → `والعذاب بالمغفرة` ✓ | copy the span from the page dump |

The fastest way to resolve a rejection is to dump the page and read it, not to guess:

```python
import sys; sys.path.insert(0, 'scripts/qiraat'); import tokens as T
print(' '.join(T.norm(w['textUthmani']) for w in T.page_words(34)))
```

### 12.5 Known defects carried from the sources

Held at `NEEDS_MANUAL_REVIEW` with the reason recorded; resolve against the paper original:
2:83 تعبدون، 2:93 قلوبهم العجل، 2:105 ينزل (أبو جعفر unattributed), plus ~15 `؟` markers the
extractor flagged on pages 9, 11, 16 and 19, and page 8's corrupted ﴿وَعَٰدْنَا﴾ header.
The extraction was made visually at 150 dpi with a scrambled text layer — treat every page as
suspect until checked.

**Pages 22–41** (the Juz' 2 batch). Three source slips were corrected against the mushaf, because
the word the source printed does not exist on that page at all:

| Page | Source printed | The mushaf prints | Why the correction is safe |
|---|---|---|---|
| 34 | ﴿كَثِيرٌ وَمَنَٰفِعُ﴾ | ﴿كَبِيرٌ وَمَنَٰفِعُ﴾ | كثير is the حمزة/الكسائي **reading**, recorded separately as a variant on the same page; a ترك الغنة anchor must sit on the rasm |
| 38 | ﴿خَيْرٌ﴾ (ترقيق الراءات) | ﴿خَبِيرٌ﴾ (2:234) | page 38 has no ﴿خَيْرٌ﴾; خبير is the ر-final word the ruling is about |
| 41 | ﴿إِنِّىٓ إِلَّا﴾ (ياءات الإضافة) | ﴿مِنِّىٓ إِلَّا﴾ (2:249) | إني does not occur on the page; the attribution given is the standard one for مِنِّىٓ |

Eight `؟`-marked or impossible entries were **omitted rather than guessed**, and are the first
thing to resolve against the paper original: page 27 ﴿ٱلْمَشْرِقِ﴾؟ and ﴿ٱلتَّأْنِيبِ؟/ٱلنَّأْىِ﴾
(ٱلنَّأْىِ is in الإسراء, not on page 27); page 29 ﴿يُبَيِّنُ ٱللَّهُ؟/يُبَيِّنَ لَكُمْ﴾; page 33
﴿زُيِّنَ﴾؟ (in both الممال and ترك الغنة); page 36 ﴿أَنفُسِهِمَا؟﴾; page 37 ﴿يَعْمَلْ ذَٰلِكَ﴾؟.

**Page 21 (2:135–141)** was missing from the batch that supplied 22–41 and was imported separately
straight afterwards; **pages 1–41 are now contiguous**. It went through both generators with zero
anchor rejections — the first batch to do so, which is what §12.4b is for.

Two modelling decisions in this batch worth knowing before they recur:
- **page 25 ﴿يَأْمُرُكُم﴾** — الدوري عن أبي عمرو has the إسكان *and* the اختلاس. Two أوجه
  overlapping on one Riwayah cannot partition the 20, so the إسكان وجه carries both السوسي and
  الدوري, `alternate_of=['DURI_AMR']` marks الدوري ذو وجهين, and the اختلاس is kept in the note.
- **page 39 ﴿وَيَبْصُۜطُ﴾** — the baseline text must be the mushaf's own rasm (صاد with the small
  seen), with the description naming السين; writing `وَيَبْسُطُ` fails the baseline invariant.

**Pages 82–101** (the Juz' 5 batch, An-Nisa 24–147). 36 new variant loci (+83 variants, 292 total) and +509 أصول rulings (1,402 total) across 61 active pages.
- Corrected source slips:
  - Page 96: source cited ﴿بَرِيئًا وَإِثْمًا﴾; the actual verse 4:112 text in Hafs is ﴿بُهْتَـٰنًۭا وَإِثْمًۭا﴾.
  - Page 93: source had typo `'فتتبينوا'`; corrected to rasm `'فتبينوا'` (4:94).
- Normalizations aligned with §12.4b:
  - Dagger alefs: page 85 ﴿سُكَـٰرَىٰ﴾ (`'سكارى'`), page 86 ﴿هَـٰٓؤُلَآءِ أَهْدَىٰ﴾ (`'هاولاء اهدا'`), page 87 ﴿وَءَاتَيْنَـٰهُم﴾ (`'وءاتيناهم'`), page 98 ﴿يَتَـٰمَى﴾ (`'يتامى'`).
  - Small high letters (`ۥ` / `ۧ` / `ۦ`): page 89 ﴿ٱلنَّبِيِّـۧنَ﴾ (`'النبيين'`), page 94 ﴿بَيْتِهِۦ﴾ (`'بيتهي'`), page 97 ﴿نُوَلِّهِۦ﴾ / ﴿وَنُصْلِهِۦ﴾ (`'نولهي'` / `'ونصلهي'`), page 100 ﴿تَلْوُۥٓا۟﴾ (`'تلووا'`), page 100 ﴿حَدِيثٍ غَيْرِهِۦٓ﴾ (`'حديث غيرهي'`).
  - Multi-word rasm anchors: page 94 ﴿ٱلْمَلَـٰٓئِكَةُ ظَالِمِىٓ﴾ (`'الملايكه ظالمي'`), page 95 ﴿قِيَـٰمًۭا وَقُعُودًۭا وَعَلَىٰ﴾ (`'قياما وقعودا وعلا'`), page 100 ﴿نَزَّلَ عَلَىٰ رَسُولِهِۦ وَٱلْكِتَـٰبِ ٱلَّذِىٓ أَنزَلَ﴾ (`'نزل علا رسولهي والكتاب الذي انزل'`).
- All 36 loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Surah Maryam (19), Mushaf pages 305-312.** The first batch that did **not** come from the
«مصحف القراءات العشر» PDF: the user supplied an ayah-by-ayah table (فرش الكلمات + الأصول المطردة +
الشواهد) for 19:1-98. Two things follow from that and are now permanent:

- The page spec may carry `src=` (name / kind / ref / note) and then every record says where it
  really came from, instead of borrowing a PDF page number nobody read. `build_variants.source_of()`
  keeps the old PDF shape for every page that came from it.
- **The page table is no longer contiguous.** 245-304 are unimported, so 244 → 305 is a legal jump;
  the loader table, the linter and `build_rulings` are all data-driven and none of them assumes a
  dense range.

The classification rules used on that table, so the next ayah-by-ayah batch repeats them:

| The source row says | What was done |
|---|---|
| A rule that holds for all ten readers (مقادير المد، القلقلة، الإدغام الشمسي، الإقلاب، كسر الساكن للساكنين، إبدال التنوين ألفًا وقفًا، صلة الهاء بين متحركين، حذف ألف ﴿أنا﴾ وصلًا) | **not imported** — the أصول layer marks who *differs*; a universal rule colours half the page and tells the reader nothing |
| ميم الجمع | **not imported** — this dataset has no such family, and one surah does not justify a 19th colour |
| سكت وصلًا | `SAKT` (the category existed but had never been used); **وقف حمزة** stays `WAQF_HAMZA` |
| ورش's النقل | `TAGHYIR_HAMZ` with `action='النقل'` — it is a تغيير همز, and needs no new family |
| إمالة / ياءات / صلة / إدغام / ترقيق, even where the source printed them in the فرش column | a **ruling**, not a variant — classify by nature, not by which column the source used |

Dropped rather than guessed, and the first thing to resolve against the paper original:

| Locus | Why |
|---|---|
| 19:2 إمالة ﴿زَكَرِيَّا﴾ | the row is headed «لمن قرأ بالقصر» and then lists ورش, who reads it بالهمز والمد |
| 19:4 ترقيق الراء في ﴿ٱلرَّأْسُ﴾ | the source asks and answers itself: «؟ بل الراء مفتوحة فلا تُرقَّق» |
| 19:25 الإدغام الكبير | the row ends «لا إدغام هنا لعدم توفر الشروط» |
| 19:46 غنة النون عند اللام | «بغنة لخلف بخلفه» — النون عند اللام بغير غنة للعشرة جميعًا |
| 19:38 ﴿وَأَبْصِرْ﴾ · 19:62 ﴿رِزْقُهُمْ﴾ | the source itself says «لجميع القراء» — universal, not a خلاف |

Two loci were imported **against** the source's own aside, because the aside contradicts the row:
19:1 ﴿كهيعص﴾ names الدوري عن الكسائي in a group that already holds الكسائي whole and then retracts it
(«والمشهور عن الكسائي إمالتهما معًا كحمزة») — imported على المشهور, which is also the only reading
under which the five إمالة groups partition the twenty exactly once, with the aside kept in the row's
note; and 19:21 ﴿لِّلنَّاسِ﴾ is `؟`-marked but the source then supplies «وَخُلْفُهُ فِي النَّاسِ فِي
الْجَرِّ حُصِّلَا», so it is imported with the خلف rather than dropped.

Still to check on the paper original: 19:1's «السكت على الحروف المقطعة لخلف عن حمزة من طريق السكت
العام», and the two شواهد the source prints in garbled form (19:23 ﴿نَسْيًا﴾, 19:42 ﴿يَا أَبَتِ﴾ —
transcribed as given; they are citations, not attributions).

**Surah Taha (20), Mushaf pages 312-321.** Imported from the same kind of user-supplied
ayah-by-ayah table as Maryam, not from the PDF: **62 variant records and 322 أصول rulings**. Page
312 is a real transition page (Maryam 96-98 + Taha 1-12); its source metadata therefore names both
tables, while every generated record remains anchored to its actual surah/ayah/token. The batch
uses the Maryam classification rules above unchanged: universal tajwid and ordinary madd amounts,
ميم الجمع, agreed صلة/وقف, and statements that explicitly say «جميع القراء» are not imported;
فرش الكلمات become variants, while إمالة/تقليل، ياءات، صلة، إدغام، نقل، سكت، and وقف become rulings.

Source cautions to verify against the paper original before promoting anything above `REVIEWED`:

- the supplied table contains self-corrections and contradictory prose (notably 20:52, 20:69 and
  20:111); the universal or internally contradicted clauses were omitted instead of guessed;
- 20:13 was modeled as the established two-way locus ﴿وَأَنَا ٱخْتَرْتُكَ﴾ / ﴿وَأَنَّا
  ٱخْتَرْنَـٰكَ﴾ for Hamza; 20:58 ﴿سِوًى﴾ keeps the Hafs baseline despite the source presenting the
  ضم row first; and 20:71 ﴿ءَامَنتُمْ﴾ keeps the detailed performance differences in the note while
  the written one-hamza/two-hamza split forms the variant;
- the variant generator rejected ten initial query anchors and six baseline spellings, and the
  ruling generator rejected fourteen anchors, because of the standard §12.4b shapes (small high
  ۥ/ۦ, joined ﴿يَـٰمُوسَىٰ﴾, and rasm spellings such as ﴿رَءَا﴾); every one was resolved from the
  page-word fixture, with no hand-written `baseText` and no new review flag.

The combined fixture state after this batch is **1,392 variants and 6,459 rulings across 261 active
pages** (1-244 and 305-321). PostgreSQL remains intentionally populated only through page 244;
Maryam and Taha are fixture-only until a database population is explicitly requested.

**Surah Al-Anbiya (21), Mushaf pages 322-331.** Imported from the user-supplied ayah-by-ayah table (فرش الكلمات ومذاهب القراء العشرة + الأصول المطردة + الشواهد for 21:1–112), not from the PDF: **35 variant records (across 31 loci) and 157 أصول rulings**.

Source cautions & slips corrected during ingestion:
- 21:4 ﴿قَالَ رَبِّى﴾ (page 322): Hafs, Hamza, Kisai, Khalaf 10 read `قَالَ` (ماضي); the remaining 16 Riwayat (`REST`) read `قُل` (أمر).
- 21:7 ﴿نُّوحِىٓ إِلَيْهِمْ ۖ﴾ (page 322): The raw source conflated 21:7 (إليهم) with 21:25 (إليه). Under Shatibiyyah 887 (*وَيُوحَى إِلَيْهِمْ كَسْرُ حَاءِ جَمِيعِهَا وَنُونٌ عُلًا*), Hafs alone (`عُلاً`) reads `نُّوحِىٓ إِلَيْهِمْ` (بالنون وكسر الحاء); all other 19 Riwayat (`REST`) read `يُوحَىٰٓ إِلَيْهِمْ` (بالياء وفتح الحاء).
- 21:25 ﴿نُوحِىٓ إِلَيْهِ﴾ (page 324): Under Shatibiyyah 887 (*يُوحَى إِلَيْهِ شَذًا عَلَا*), Hafs + Hamza + Kisai + Khalaf 10 read `نُوحِىٓ إِلَيْهِ` (4 readers / 7 Riwayat); all other 13 Riwayat read `يُوحَىٰٓ إِلَيْهِ`.
- 21:67 ﴿أُفٍّۢ لَّكُمْ﴾ (page 327): Clean 3-way partition:
  - `أُفٍّۢ` (كسر وتنوين): Nafi, Hafs, Abu Ja'far (5 Riwayat).
  - `أُفَّ` (فتح بغير تنوين): Ibn Kathir, Ibn Amir, Ya'qub (6 Riwayat).
  - `أُفِّ` (كسر بغير تنوين): Abu Amr, Shu'bah, Hamzah, Al-Kisa'i, Khalaf 10 (9 Riwayat). Total = 20 Riwayat.
- 21:112 ﴿قَـٰلَ رَبِّ ٱحْكُم﴾ (page 331): Under Shatibiyyah (*وَآخِرُهَا عَلَا*), Hafs alone (`عَلَا`) reads `قَـٰلَ` (ماضي, 1 Riwayat); all other 19 Riwayat (`REST`) read `قُل` (أمر).
- Normalizations aligned with §12.4b:
  - 21:41 ﴿ٱسْتُهْزِئَ﴾ (`'استهزئ'`).
  - 21:62 ﴿يَـٰٓإِبْرَٰهِيمُ﴾ (`'يابراهيم'`).
  - 21:63 ﴿بَلْ فَعَلَهُۥ﴾ (`'بل فعلهو'`).
  - 21:84 ﴿وَذِكْرَىٰ﴾ (`'وذكرى'`).
  - 21:88 ﴿نُـۨجِى﴾ (`'نجي'` matching small high nun in rasm).
  - 21:110 ﴿وَيَعْلَمُ مَا﴾ (`'ويعلم ما'`).
  - 21:111 ﴿وَمَتَـٰعٌ إِلَىٰ﴾ (`'ومتاع الى'`).

The combined fixture state after this batch is **1,427 variants and 6,616 rulings across 271 active pages** (1–244 and 305–331). PostgreSQL remains intentionally populated only through page 244; Maryam, Taha, and Al-Anbiya are fixture-only until a database population is explicitly requested.

**Pages 42–61** (the Juz' 3 batch, Al-Baqarah 253 to Ali 'Imran 91). 52 new variant loci (+121 variants, 413 total) and +552 أصول rulings (1,954 total) across 81 active pages. Pages 1–61 (Juz' 1, 2, and 3) are now fully contiguous.
- Corrected source slips & query alignments:
  - Page 53: source cited ﴿نَفْسَهُۥ وَيُحَذِّرُكُمُ﴾; actual verse 3:28 rasm is ﴿نَفْسَهُۥ ۗ وَإِلَى ٱللَّهِ ٱلْمَصِيرُ﴾ (`'نفسهۥ والى'`).
  - Page 60: source cited ﴿عَلَيْكُمْ إِصْرِى﴾; actual verse 3:81 rasm is ﴿عَلَىٰ ذَٰلِكُمْ إِصْرِى﴾ (`'اصري'`).
- Normalizations aligned with §12.4b:
  - Dagger alefs & rasm bases: page 43 ﴿نُنشِزُهَا﴾ (`'ننشزها'`), page 45 ﴿وَيَأْمُرُكُم﴾ (`'وَيَأْمُرُكُم'`), page 46 ﴿وَيُكَفِّرُ﴾ (`'ويكفر'`), page 56 ﴿أَنِّىٓ أَخْلُقُ﴾ (`'انى اخلق'`).
  - Small high letters (`ۥ` / `ۧ` / `ۦ`): page 42 ﴿تَأْخُذُهُۥ﴾ (`'تاخذهو'`) and ﴿بِإِذْنِهِۦ﴾ (`'باذنهي'`), page 52 ﴿ٱلنَّبِيِّـۧنَ﴾ (`'النبيين'`), page 60 ﴿لَفَرِيقًا يَلْوُۥنَ﴾ (`'لفريقا يلوون'`).
  - Multi-way splits cleanly partitioned: page 48 ﴿فَتُذَكِّرَ﴾ 2:282 (3-way partition: 12-6-2 = 20), page 56 ﴿صِرَٰطٌ﴾ 3:51 (17-2-1 = 20), page 57 ﴿فَيُوَفِّيهِمْ﴾ 3:57 (4-way split: 1-17-1-1 = 20).
**Pages 62–81** (the Juz' 4 batch, Ali 'Imran 92 to An-Nisa 23). 84 new variant loci (+107 variants, 520 total) and +405 أصول rulings (2,359 total) across 101 active pages. Pages 1–101 (Juz' 1, 2, 3, 4, and 5) are now 100% contiguous.
- Corrected source slips & domain alignments:
  - Page 77 ﴿تَسَآءَلُونَ﴾ (4:1): Shatibiyyah baseline (*وَكُوفِيُّهُمْ تَسَاءَلُونَ مُخَفَّفًا*) for Kufis (Asim, Hamza, Kisai, Khalaf 10) is تخفيف السين (`تَسَآءَلُونَ`), matching Hafs baseline; Harami+Shami+Basri+Madani read تشديد ﴿تَسَّآءَلُونَ﴾.
  - Page 72 ﴿أَلَّا خَوْفٌ عَلَيْهِمْ﴾ (3:170): rasm query `'الا خوف عليهم'` matching 3:170 w17-19.
  - Page 78 صلة هاء الكناية: resolved to 4:8 ﴿مِنْهُ﴾ and 4:11 ﴿وَلِأَبَوَيْهِ﴾.
  - Page 79 صلة هاء الكناية: resolved to 4:13 and 4:14 ﴿يُدْخِلْهُ﴾.
  - Page 80 صلة هاء الكناية: resolved to 4:19 ﴿فِيهِ خَيْرًا كَثِيرًا﴾.
  - Page 81: separated Abu Ja'far ikhfa (4:21 ﴿مِّيثَـٰقًا غَلِيظًۭا﴾) from Khalaf tark al-ghunna (4:20 ﴿بُهْتَـٰنًۭا وَإِثْمًۭا﴾, 4:21 ﴿بَعْضٍ وَأَخَذْنَ﴾, 4:22 ﴿فَـٰحِشَةًۭ وَمَقْتًۭا﴾).
- All 84 loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 102–125** (Juz' 6 & early Juz' 7, An-Nisa 148 to Al-Ma'idah 108). 108 new variant loci (+108 variants, 628 total across 125 pages) and +569 أصول rulings (2,928 total) across 125 active pages. Pages 1–125 (Juz' 1 through early Juz' 7) are now 100% contiguous.
- Corrected glyph spacing defect in source fixture:
  - Page 117 token 5:2 (ayah 52): fixed split glyph `"دَآئِرَ ةٌۭ ۚ"` -> `"دَآئِرَةٌۭ ۚ"`. Verified clean with `npm run mushaf:validate`.
- Normalizations aligned with §12.4b & token queries:
  - Multi-word queries: page 115 ﴿وَٱلْعَيْنَ بِٱلْعَيْنِ...﴾ (5:45 token span 7-15), page 117 ﴿وَيَقُولُ ٱلَّذِينَ ءَامَنُوٓا۟﴾ (5:53), page 118 ﴿وَأَكْلِهِمُ ٱلسُّحْتَ﴾ (5:62,63), page 125 ﴿عَلَيْهِمُ ٱلْأَوْلَيَـٰنِ﴾ (5:107).
  - Dagger alefs & rasm bases: page 119 ﴿رِسَالَتَهُۥ﴾ (5:67), page 119 ﴿وَٱلصَّـٰبِـُٔونَ﴾ (5:69), page 124 ﴿قِيَـٰمًا﴾ (5:97), page 124 ﴿يُنَزَّلُ﴾ (5:101).
- All 108 loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 126–145** (Juz' 7 & early Juz' 8, Al-Ma'idah 109 to Al-An'am 137). 155 new variant records (783 total across 145 pages) and +527 أصول rulings (3,455 total) across 145 active pages. Pages 1–145 (Juz' 1 through early Juz' 8) are now 100% contiguous.
- Normalizations aligned with §12.4b & token queries:
  - Multi-word & phrase queries: page 126 ﴿هَلْ يَسْتَطِيعُ رَبُّكَ﴾ (5:112); page 129 ﴿ٱسْتُهْزِئَ﴾ (6:10); page 133 ﴿أَقُولُ لَكُمْ﴾ (6:50); page 134 ﴿أَنَّهُۥ مَنْ﴾ and ﴿فَأَنَّهُۥ﴾ (6:54); page 139 ﴿تَجْعَلُونَهُۥ﴾ (6:91); page 143 ﴿رِسَالَتَهُۥ﴾ (6:124).
  - Baseline alignments: page 138 ﴿دَرَجَـٰتٍۢ مَّن نَّشَآءُ﴾ (6:83) aligned to Hafs tanween baseline; page 140 ﴿وَجَعَلَ ٱلَّيْلَ﴾ baseline vs variant ﴿وَجَاعِلُ ٱلَّيْلِ﴾.
  - Locus grouping: page 145 ﴿زَيَّنَ﴾ and ﴿قَتْلَ أَوْلَـٰدِهِمْ شُرَكَآؤُهُمْ﴾ (6:137) linked via shared locus group `L145-زين_قتل_اولادهم`.
- All loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 146–165** (Juz' 8, Al-An'am 138 to Al-A'raf 130). 117 new variant records (900 total across 165 pages) and +513 أصول rulings (3,968 total) across 165 active pages. Pages 1–165 (Juz' 1 through Juz' 8) are now 100% contiguous.
- Normalizations aligned with §12.4b & token queries:
  - Multi-word & phrase queries: page 146 ﴿شُرَكَٰٓؤُاْ﴾ aligned to Hafs rasm ﴿شُرَكَآءُ ۚ﴾ (6:139); page 147 ﴿ٱلْحَوَايَآ﴾ (6:146); page 148 pure usul (0 variants) with 26 rulings, including ﴿كَذَٰلِكَ كَذَّبَ﴾ (6:148); page 149 ﴿بِـَٔايَـٰتِ﴾ and ﴿ءَايَـٰتِنَا﴾ (6:157), ﴿ٱلْعَذَابِ بِمَا﴾ (6:157); page 150 ﴿إِلَىٰ صِرَٰطٍۢ مُّسْتَقِيمٍۢ﴾ (6:161), ﴿أَن تَأْتِيَهُمُ﴾ (6:158).
  - Usul disambiguation & small letters: page 151 ﴿الٓمٓصٓ﴾, disambiguated Abu Ja'far ikhfa ﴿وَمَنْ خَفَّتْ﴾ (7:9) and Khalaf tark al-ghunna ﴿بِعِلْمٍۢ ۖ وَمَا﴾ (7:7); page 152 ﴿وَيَـٰٓـَٔادَمُ﴾ (7:19), ﴿نَّارٍۢ وَخَلَقْتَهُۥ﴾ (7:12); page 153 ﴿بِٱلْفَحْشَآءِ ۖ أَتَقُولُونَ﴾ (7:28), ﴿مُسْتَقَرٌّۭ وَمَتَـٰعٌ﴾ (7:24); page 154 ﴿كَذَّبَ بِـَٔايَـٰتِهِۦٓ﴾ (7:37); page 155 ﴿رُسُلُ رَبِّنَا﴾ (7:43); page 156 ﴿عِوَجًۭا وَهُم﴾ (7:45), ﴿نَنسَىٰهُمْ﴾ (7:51); page 159 ﴿فَٱنتَظِرُوٓا۟﴾ (7:71), ﴿وَءَابَآؤُكُم﴾ (7:71), ﴿بَصْۜطَةًۭ ۖ﴾ (7:69); page 160 ﴿إِنَّكُمْ﴾ (7:81); page 163 ﴿أَوَأَمِنَ﴾ (7:98); page 164 ﴿أَرْجِهْ﴾ (7:111), ﴿نَّكُونَ نَحْنُ﴾ (7:115), ﴿يَدَهُۥ﴾ (7:108); page 165 ﴿مَكَرْتُمُوهُ﴾ (7:123).
- All loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 166–184** (Juz' 9 & early Juz' 10, Al-A'raf 131 to Al-Anfal 61). 101 new variant records (1,001 total across 184 pages) and +469 أصول rulings (4,437 total) across 184 active pages. Pages 1–184 (Juz' 1 through Juz' 9 and start of Juz' 10) are now 100% contiguous.
- Normalizations aligned with §12.4b & token queries:
  - Multi-word & phrase queries: page 166 ﴿أَنجَيْنَـٰكُم﴾ (7:141); page 168 ﴿حُلِيِّهِمْ﴾ (7:148) and Yaqub ضم الهاء on ﴿يَهْدِيهِمْ﴾ and ﴿أَيْدِيهِمْ﴾; page 170 disambiguated multiple occurrences of `عليهم` in 7:157 (occurrence 1 ﴿عَلَيْهِمُ ٱلْخَبَـٰٓئِثَ﴾ before sakin vs occurrence 2 ﴿عَلَيْهِمْ ۚ﴾ before mutaharrik); page 172 ﴿ذُرِّيَّتَهُمْ﴾ (7:172) Hafs singular baseline vs plural; page 173 ﴿تَقُولُوا۟﴾ (7:172) and ﴿تَقُولُوٓا۟﴾ (7:173); page 175 ﴿طَـٰٓئِفٌۭ﴾ (7:201) Hafs baseline vs ﴿طَيْفٌ﴾; page 178 ﴿وَرِئَآءَ﴾ (8:47).
  - Cross-ayah multi-word spans resolved: page 86 4:49–50 ﴿فَتِيلًا ٱنظُرْ﴾ and page 160 7:74–75 ﴿مُفْسِدِينَ قَالَ﴾.
- All loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 185–204** (Juz' 10 & early Juz' 11, Al-Anfal 62 to At-Tawbah 111). 72 new variant records (1,073 total across 204 pages) and +441 أصول rulings (4,878 total) across 204 active pages. Pages 1–204 (Juz' 1 through Juz' 10 and start of Juz' 11) are now 100% contiguous.
- Normalizations aligned with §12.4b & token queries:
  - Multi-word & phrase queries: page 185 ﴿بِنَصْرِهِۦ وَبِٱلْمُؤْمِنِينَ﴾ (8:62) `'بنصرهي'`; page 186 ﴿ٱلۡأَسۡرَىٰ﴾ (8:70) combined Abu Amr's variant `الأسارى` with base imalah on `الاسرى`, ﴿ٱلْمُؤْمِنُونَ﴾ (8:74); page 188 ﴿ذِمَّةًۭ ۚ وَأُو۟لَـٰٓئِكَ﴾ (9:10); page 189 At-Tawbah 14–20 omitted duplicate ﴿تُطَهِّرُهُمْ﴾ (belongs to 9:103 on page 203); page 190 ﴿مِّنْهُ﴾ (9:21), ﴿عَلَىٰ رَسُولِهِۦ وَعَلَى ٱلْمُؤْمِنِينَ﴾ (9:26) anchored to `'المؤمنين'`, ﴿بِأَمْرِهِۦ ۗ﴾ (9:24) `'بامرهي'`; page 192 ﴿بِٱلْهُدَىٰ﴾ (9:33); page 193 ﴿وَكَلِمَةُ ٱللَّهِ﴾ (9:40); page 195 ﴿ٱئْذَن لِّى وَلَا﴾ (9:49) assigned all ten readers for agreed ya'at idafa; page 196 ﴿هُوَ أُذُنٌۭ﴾ and ﴿قُلْ أُذُنُ خَيْرٍۢ﴾ (9:61) modeled as two distinct loci; page 197 ﴿وَءَايَـٰتِهِۦ﴾ (9:65) `'وءايتهۦ'`, ﴿إِن نَّعْفُ﴾ (9:66) `'ان نعف'` with note for Hamzah on reading `إن يُعف`; page 199 ﴿وَٱغْلُظْ عَلَيْهِمْ﴾ (9:73); page 200 pure usul (0 variants) with 17 rulings, ﴿ٱسْتَـْٔذَنَكَ﴾ (9:86); page 202 ﴿نُّؤْمِنَ لَكُمْ﴾ (9:94); page 203 ﴿صَلَوٰتَكَ﴾ (9:103) baseline text aligned with Mushaf-1441 rasm; page 204 ﴿أَسَّسَ بُنْيَـٰنَهُۥ﴾ (9:109 occurrences 1 and 2 under locus group `L204-اسس_بنيانه`).
- All loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 205–224** (Juz' 11 & early Juz' 12, At-Tawbah 112 to Hud 28). 107 new variant records (1,180 total across 224 pages) and +498 أصول rulings (5,376 total) across 224 active pages. Pages 1–224 (Juz' 1 through Juz' 11 and start of Juz' 12) are now 100% contiguous.
- Normalizations aligned with §12.4b & token queries:
  - Multi-word & phrase queries: page 205 ﴿لِلنَّبِىِّ – ٱلنَّبِىِّ﴾ (9:113, 117) Nafi with hamza & madd muttasil, ﴿إِبْرَٰهِيمَ﴾ (9:114) Hisham with alef, ﴿ٱلْعُسْرَةِ﴾ (9:117) Abu Ja'far damma on seen, ﴿كَادَ يَزِيغُ﴾ (9:117) Hamzah, Hafs, Ibn Kathir with taa `تَزِيغُ`; page 207 ﴿يَلُونَكُم﴾ (9:123) damma on laam for Ibn Kathir, ﴿يَفْقَهُونَ﴾ (9:127) Abu Ja'far with taa `تَفْقَهُونَ`; page 208 Yunus 1–6: ﴿الٓر ۚ﴾ (10:1) Abu Ja'far sakt on huruf tahajji, ﴿لَسَـٰحِرٌ﴾ (10:2) Sahir vs Sihr, ﴿فَصَّلَ ٱلْـَٔايَـٰتِ﴾ (10:5) Nafi, Abu Amr, Hafs, Abu Ja'far with nun `نُفَصِّلُ`; page 212 omitted Hud table artifacts ﴿ٱلْأَخْسَرُونَ﴾ and ﴿يَسْتَغْشُونَ﴾ accidentally included in Yunus extraction; page 213 ﴿لَّا يَهِدِّىٓ﴾ (10:35) Hafs baseline aligned with rasm `لَّا يَهِدِّىٓ`, ﴿يَعْزُبُ﴾ (10:61) Hamzah, Kisai, Khalaf 10 kasr on zaay; page 215 ﴿قِطَعًا﴾ (10:27) Ibn Kathir, Kisai sukun on taa `قِطْعًا`, ﴿أَصْغَرَ﴾ and ﴿أَكْبَرَ﴾ (10:61) Hamzah, Khalaf 10 rafa'; page 216 ﴿مَتَـٰعُ﴾ (10:23) Hafs nasb `مَتَـٰعَ`; page 219 ﴿وَلَا تَتَّبِعَآنِّ﴾ (10:89) corrected prompt inversion: Hafs and majority read `وَلَا تَتَّبِعَآنِّ` (tashdeed nun maksoorah + madd mushabba') matching rasm baseline, Ibn Dhakwan alone reads `وَلَا تَتَّبِعَانِ` (takhfeef); page 220 ﴿نُنَجِّى﴾ (10:103) Kisa'i, Ya'qub with single nun and sukun `نُنْجِ`; page 221 transition page spanning Surah 10 (Yunus 107–109) and Surah 11 (Hud 1–5): `PAGES[221]` defined with `surah=10, af=107, at=5`, modeled ﴿وَهُوَ﴾ with `all_occurrences=True` matching all 3 positions (10:107, 10:109, 11:4); page 222 ﴿سِحْرٌۭ﴾ (11:7) Hamzah, Kisai, Khalaf 10 read `سَـٰحِرٌۭ`; page 224 ﴿يُضَـٰعَفُ﴾ (11:20) Ibn Kathir, Ibn Amir, Abu Ja'far, Ya'qub read `يُضَعَّفُ` without alef and with tashdeed on 'ayn.
- All loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags.

**Pages 225–244** (Juz' 12, Hud 29 to Yusuf 78). 98 new variant records (1,278 total across 244 pages) and +593 أصول rulings (5,969 total) across 244 active pages. Pages 1–244 (Juz' 1 through Juz' 11 and most of Juz' 12) are now 100% contiguous.
- Normalizations and source reconciliation aligned with §12.4b:
  - Page 240 is correctly represented as an أصول-only page (0 فرش variants, 35 rulings).
  - Page 242 extends through Yusuf 63, not 62 as its supplied heading stated; both ﴿أَبِيهِمْ﴾ and ﴿نَكْتَلْ﴾ are in 12:63 and resolve to real page-242 tokens.
  - Page 244 ﴿نَرْفَعُ دَرَجَـٰتٍ مَّن نَّشَاءُ﴾ keeps the Hafs/Aasim row on the Mushaf's tanween baseline; the non-tanween idafa is the alternate Nafi/Ibn Kathir/Abu Amr/Ibn Amir/Abu Ja'far reading, and Ya'qub's yā' reading keeps tanween.
  - Question-marked source artifacts were omitted rather than guessed: page 225 ﴿قَوْمًا تَجْهَلُونَ؟﴾ under ترك الغنة, and page 239 ﴿رَءَايَةً؟﴾ / ﴿نَبِّئْتُكُمَا؟﴾. The unambiguous page-239 entries ﴿رَأَوُا۟﴾, ﴿ٱلْـَٔايَـٰتِ﴾ and ﴿نَبِّئْنَا﴾ remain imported.
- All loci partition the 20 Riwayat cleanly with zero gaps or overlaps and zero new review flags (4 total unchanged).

### 12.6 Postgres V2 Migration & Ingestion (Phase A completed 2026-09-19)

Fixtures remain the client serving layer (zero round-trip page turns, offline-capable). Postgres is the authoring, relational query, and QA source of truth.
- **Migration**: Applied `supabase/migrations/20260917120000_qiraat_v2_schema.sql` (19 tables, enums, triggers, and export functions) after full binary `pg_dump -Fc` backup (`backups/pre-qiraat-v2-20260919091434.dump`).
- **Data Ingestion**: Populated all 244 pages into Postgres via `scripts/qiraat/import_to_postgres.py`:
  - `qiraat_pages`: 244 rows
  - `qiraat_loci`: 7,038 rows
  - `qiraat_entries`: 7,247 rows (1,278 variants, 5,969 rulings)
  - `qiraat_entry_readings`: 22,224 rows
  - `qiraat_evidence_texts`: 752 rows
  - `qiraat_evidence_links`: 1,696 rows
- **Schema Enhancements**:
  - Added `CS-HIMSI` and `CS-DIMASHQI` into `qiraat_count_schools`.
  - Replaced restrictive `ayah_to >= ayah_from` check on `qiraat_pages` with `CHECK (ayah_to >= 1)` to support transition pages spanning surah boundaries (e.g. page 106: 4:176 -> 5:2; page 221: 10:107 -> 11:5).
- Verified `qiraat_export_page(1::smallint, true)` and `qiraat_export_page(244::smallint, true)` on Postgres 17; reloaded PostgREST cache (`NOTIFY pgrst, 'reload schema'`).

---

## 13. The Mushaf reader's three colour layers (read before touching the reader)

The mushaf page can paint three different colour systems onto the **same letters**. Exactly one of
them runs at a time. This is a product rule the user set explicitly, and it is enforced structurally
rather than by discipline — the shape of the state makes the forbidden states unrepresentable.

### 13.1 The layer model

| Layer | Top-bar button | What it paints | What a press on a word does |
|---|---|---|---|
| `annotations` | **ن** | highlight background/text colour, bookmark & favourite ring, ayah-medallion tint | opens the note / highlight / bookmark / favourite menu |
| `mutshabehat` | **م** | the per-group highlight band on linked ayat | opens that ayah's متشابهات card — and a word in no group does **nothing** |
| `qiraat` | **ق** | أصول word colours, variant markers, ذو وجهين underline | opens the قراءات explanation (sidebar on desktop/iPad landscape, sheet on a phone) |
| `none` | — | nothing | opens the notes panel (what a press means with no layer on) |

Pressing an inactive button switches to that layer and turns the other two off. Pressing the active
one turns it off → plain mushaf.

### 13.2 How it is enforced (do not undo this)

```ts
type ReaderLayer = 'none' | 'annotations' | 'mutshabehat' | 'qiraat'
const [readerLayer, setReaderLayer] = useState<ReaderLayer>('mutshabehat')

const annotationsVisible          = readerLayer === 'annotations'
const mutshabehatHighlightEnabled = readerLayer === 'mutshabehat'
const qiraatMode: QiraatMode      = readerLayer === 'qiraat' ? qiraatSubMode : 'normal'
```

- **One enum, not three booleans.** Three booleans can represent "two layers on at once" — a state
  the reader is not allowed to be in — and each such state would then have to be defended against
  separately at every render site. The enum cannot represent it at all.
- The three old flags are **derived**, so the whole render path below them is unchanged.
- `qiraatSubMode` (`'comparison' | 'riwayah'`) is kept apart from the layer, so leaving القراءات and
  coming back restores the mode the reader was in instead of resetting them.
- `activateLayer()` is the only writer. It persists to `mushaf1441:reader-layer:v1` and closes
  whatever the previous layer had open (متشابهات card, notes sheet, Qiraat peek and selection).
- The burger panel's mode select and the **ق** button both go through `applyQiraatMode()`, so they
  cannot disagree about whether القراءات is on.
- `scripts/validate-mushaf1441-objective.mjs` has an exclusivity block that **fails the build** if
  the enum or the derived flags are replaced by independent on/off state again.

### 13.3 Routing a press

Two entry points, both routed by layer — add new press behaviour to these, never beside them:

- **Tap / click** → `renderQcfWord`'s `onClick`. Qiraat is checked first and returns early, so a word
  that carries Qiraat data *and* a متشابهات link *and* a highlight (real example: ﴿إِبْرَٰهِـۧمَ﴾ 2:124)
  still answers with Qiraat alone.
- **Long-press (touch) / right-click** → the single `openContextMenu()` funnel. It returns `boolean`
  — whether the press produced anything — which is what decides if the haptic plays.

The ayah-end medallion follows the same rule; it used to be a back door into the notes sheet.

The detail sheet no longer has a three-way tab bar: `activeDetailTab` is **derived** from the layer,
so it cannot show متشابهات links over a page painted with Qiraat.

### 13.4 The memoization trap (this has bitten twice)

`MushafPageSlot` compares its props **by identity**. Anything a word's render or click closure reads
must therefore reach the slot through a prop, or the slot keeps a stale closure and the change only
appears when some *other* prop happens to move.

- 2026-09-17, first bug: the annotations toggle silently did nothing because the slot was handed the
  raw `annotations` array. Fixed by passing the gated value (`annotationsVisible ? annotations : EMPTY_ANNOTATIONS`).
- Same day, prevented: `readerLayer` rides in the slot's `selection` prop precisely because the press
  routing reads it from the render closure.

Rule: **gate at the prop, not only at the derived map.**

### 13.5 Haptics (`_components/haptics.ts`)

`impactHaptic()` plays one crisp tick when a long press is recognised — and only when the press
actually produced something, because a long press that opens nothing buzzing anyway would be lying
about what just happened. A CSS `active:` state on the word gives the same feedback visually, with no
React state and so no page-slot re-render.

Two paths, because no single API covers both platforms:

1. `navigator.vibrate(15)` — Android / Chromium. Longer than ~20 ms stops reading as a tap.
2. iOS 17.4+ only — clicking the `<label>` of an `<input type="checkbox" switch>` makes WebKit play
   the system switch haptic. **Mobile Safari exposes no Vibration API at all**, so this is the only
   haptic an iOS web page can ask for. It is a platform quirk, not a standard: if a future WebKit
   stops playing it the tick goes quiet and nothing else breaks. **Not yet confirmed on a real
   iPhone** — the sandbox only has Chromium.
