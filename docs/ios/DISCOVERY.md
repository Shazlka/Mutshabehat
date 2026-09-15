# iOS Native App — Phase 0 Discovery

Date: 2026-09-15. Run from a cloud Claude Code session (branch
`claude/titanic-313-phase-0-z1b1yt`), **not** the MacBook Air. No Tailscale
route to the Mac mini was available (`youssefs-mac-mini.tailcd68dd.ts.net:8443`
→ connection reset), so this is a **repo-file-based** discovery, not a live
`pg_dump` / row-count / size profile. Re-run the "unavailable" items below
from the Air once this plan resumes there.

## 1. Database schema (from repo SQL files, not a live dump)

### Tables

| Table | Kind | Notes |
|---|---|---|
| `groups` | User data | id, user_id FK→auth.users, title, color, note/unote, status CHECK(draft/published/locked), favorite/completed, search_vec, `source_automated_id` FK→automated_groups |
| `verses` | User data | id, group_id FK→groups (cascade), surah, ayah, label, sort_order |
| `parts` | User data | id, verse_id FK→verses (cascade), type CHECK(shared/diff/diff2/diff3/addition/unique/normal), text, sort_order, generated `search_vec`/`rasm_skeleton` |
| `tags` | User data | id, user_id FK, name, color; unique `(user_id, lower(name))` |
| `group_tags` | User data (join) | group_id+tag_id composite PK |
| `automated_groups` | **Reference data** | bigserial id, legacy_id, title, color, surahs[], payload jsonb — public read, service_role write only |
| `mushaf_annotations` | User data — **NOT applied to production** | notes/highlights/bookmarks/favorites; migration file's own header says "review and apply only to a preview/dev branch," never confirmed live |
| `test_answers` | User data | source CHECK(personal/quran), kind CHECK(mcq/flash/words), correct bool, per-answer log |

Quran text itself is **not in Postgres** — static JSON (`public/quran/ayahs.json`,
Uthmani script) plus 604 per-page fixtures under
`packages/quran-data/mushaf1441/fixtures/page-words/`. Only `automated_groups`
is DB-resident reference data.

### Views
`surah_counts` (security_invoker), `automated_surah_counts`,
`automated_groups_with_copy` (per-user `copied` flag via `auth.uid()`).

### RLS
Everything is `auth.uid() = user_id`, or an `EXISTS` join up to that
ownership (`verses`→`groups`, `parts`→`verses`→`groups`, `group_tags`→`groups`).
`automated_groups` is public-read, no public write policy.

### RPCs
`handle_updated_at()`, `groups_search_update()`, `normalize_arabic(text)` /
`rasm_skeleton(text)` (SQL mirrors of `src/lib/arabic.ts` — reuse the same
logic native-side rather than reimplementing), `get_dashboard_stats()`,
`save_group()` (atomic editor save), `search_group_ids()`, `get_test_answer_stats()`.

### Migrations, date order
1. `20260628000000_mushaf_annotations_preview.sql` — **not applied to prod** (see above)
2. `20260915120000_perf_save_search_surahs.sql` — `save_group`, `search_group_ids`, automated surah counts
3. `20260915150000_automated_copy_tracking.sql` — `source_automated_id`, copy tracking view
4. `20260915180000_test_answers.sql` — `test_answers` table + stats RPC

**Not available from this session:** row counts, table sizes, live schema
diff against repo files, Mac mini's dirty-tree git status. Get these from
the Air (`pg_dump --schema-only` + `git status` on the actual working copy)
before Phase 1 baseline snapshot.

## 2. Web feature inventory (App Router)

| Route | Purpose |
|---|---|
| `/` | Main groups list — search, filters, sort, list/collapsed/magazine views |
| `/groups/[id]`, `/groups/[id]/edit`, `/groups/new` | View/edit/create a personal group |
| `/automated`, `/automated/[id]` | Browse read-only automated candidates, copy-to-personal |
| `/surahs`, `/surahs/[no]` | 114-surah index, personal+automated counts |
| `/test` | Quiz mode (location/flashcard/word-hiding/mixed), answers logged to `test_answers` |
| `/mushaf-1441` | Full 604-page Mushaf reader, QCF glyphs, page-turn animation, highlights, annotations |
| `/network` | D3 force-graph of surah co-occurrence across the user's groups — **linked in `Sidebar.tsx` and `MobileTopbar.tsx`, live and reachable, not dead code** |
| `/stats` | Dashboard (`get_dashboard_stats()` RPC) + test-answer stats |
| `/tools` | Bulk tag management |
| `/settings` | Swipe-nav toggle, SQL export/backup |
| `/auth/callback`, `(auth)/login` | Auth flow |

## 3. Fonts and licensing — flag for Phase 5

- `Cairo`, `Amiri_Quran` via `next/font/google` — standard, no bundling issue.
- **Mushaf glyphs (QCF V2) are fetched at runtime per-page from an external
  CDN** (`verses.quran.foundation/fonts/quran/hafs/v2/woff2/p{page}.woff2`),
  not bundled anywhere in this repo. No font file or license text exists
  under `packages/quran-data` or `public/`.
  **This conflicts with the plan's offline-first requirement for the Mushaf
  reader** (Section 2: "SQLite on device is the source for all reads. App
  works fully offline."). Either: (a) bundle all 604 page fonts into the iOS
  app — licensing with Quran Foundation must be checked first, can't be
  confirmed from this repo; or (b) accept the Mushaf reader needs network
  on first view of each page, with cached fonts after. This is a Phase 2/5
  architecture decision, not yet made — flagging here rather than deciding
  it silently.

## 4. Search implementation

`src/lib/arabic.ts`: `normalizeArabic` (alef-wasla fold, dagger-alef
restore, tashkeel/tatweel strip), `rasmSkeleton` (drops long alef for
plene/defective tolerance) — client-side, in-memory index over the static
`ayahs.json`. DB-side (`groups`/`parts`) uses Postgres `tsvector` FTS on
generated `search_vec` columns with ILIKE/trigram fallback via the
`search_group_ids()` RPC. Both normalization functions are duplicated
SQL-side (`normalize_arabic`, `rasm_skeleton`) — reuse this logic in Swift
rather than reimplementing independently, to avoid the two clients
disagreeing on what counts as a match.

## 5. Where user data lives

All in Postgres, RLS-scoped to the single user: `groups`, `verses`, `parts`,
`tags`, `group_tags`, `test_answers`, and `mushaf_annotations` (not yet
live in prod — see above). No user data lives client-side today beyond
`localStorage` conveniences (last mushaf page, swipe-nav setting) — those
are device preferences, not sync candidates.

## 6. Env vars (repo has no `.env*` files committed — classified from usage)

| Var | Classification |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client-safe (public URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-safe (anon key, RLS-gated) |
| `NEXT_PUBLIC_SITE_URL` | Client-safe |
| `NEXT_PUBLIC_BUILD_ID` | Client-safe |
| `AUTOLOGIN_EMAIL`, `AUTOLOGIN_PASSWORD` | **Server-only / secret** — single-user auto-login credentials, never expose to the iOS bundle |
| `SUPABASE_FORCE_DOH` | Server-only, debug flag |
| `NODE_ENV` | Build-time |

No `SUPABASE_SERVICE_ROLE_KEY` (or similar) reference found in `src/` —
consistent with the plan's rule that the service-role key must never ship
in the iOS bundle. Confirm this against the Mac mini's actual `.env.local`
before Phase 2, since this session can't read it.

## 7. Recommended v1 feature cut

**In v1** (core to "study mutashabihat" + matches offline/sync goals):
Mushaf reader (with the font caveat above), personal groups (list/view/edit/create),
Arabic-aware search, bookmarks/notes (once `mushaf_annotations` is actually
applied to prod), sync + backup per the plan.

**Defer to v1.1** (real, but not core-loop): `/test` quiz mode (large surface,
its own answer-logging schema), `/stats` dashboard, `/automated` browse +
copy, `/tools` bulk tagging. None of these block daily reading/study use.

**D-04, network graph (`/network`)**: it's a genuinely live, nav-linked
feature (not dead code as the plan's "if actually used" test implied might
be the case) — so on usage grounds alone it leans toward v1. But it's a D3
force-directed graph with no direct SwiftUI equivalent; native
reimplementation is either a hand-rolled `Canvas`-based force layout or a
new third-party package, either way real work for Phase 4/5. Surfacing this
to Amr as D-04 rather than deciding it here.
