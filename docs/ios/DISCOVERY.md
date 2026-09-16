# iOS Native App — Phase 0 Discovery

Date: 2026-09-15, **live-verified and corrected 2026-09-16** (IOS-04, IOS-08). The original pass ran from a cloud Claude Code session with no
route to the Mac mini, so it was **repo-file-based**. Section 8 now carries the
live schema, row counts and payload sizes read straight from production, and
the corrections it forced are marked **[CORRECTED 2026-09-16]** inline below.
Where the two disagree, Section 8 wins — the repo's committed `.sql` files are
not a complete description of the production database.

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
| `mushaf_annotations` | User data — **LIVE in production** [CORRECTED 2026-09-16] | notes/highlights/bookmarks/favorites; 14 rows, all CHECK constraints + FK enforced, written by `src/app/api/mushaf-1441/annotations/route.ts`. The migration file's "preview only" header is stale — see §8.3 |
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
1. `20260628000000_mushaf_annotations_preview.sql` — **applied and live** [CORRECTED 2026-09-16]; the table reached prod via the 2026-08-31 cloud→self-host data migration, not by running this file. Its header is misleading.
2. `20260915120000_perf_save_search_surahs.sql` — `save_group`, `search_group_ids`, automated surah counts
3. `20260915150000_automated_copy_tracking.sql` — `source_automated_id`, copy tracking view
4. `20260915180000_test_answers.sql` — `test_answers` table + stats RPC

**Originally unavailable — now captured in §8** [2026-09-16]: live schema,
row counts, payload sizes, RLS verification, constraint verification. Still
open: `pg_dump` DDL text (indexes/policy bodies) and the Mac mini shell — see
§8.6.

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
`tags`, `group_tags`, `test_answers`, and `mushaf_annotations` (live — see §8.3).
[CORRECTED 2026-09-16] Production also holds a `profiles` table (1 row:
`display_name`, `font_preset`, `theme`, `font_size`, `compact_mode`) and four
frozen legacy tables — see §8.2. Beyond those, no user data lives client-side
today except `localStorage` conveniences (last mushaf page, swipe-nav
setting).

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

No `SUPABASE_SERVICE_ROLE_KEY` reference found in `src/` — consistent with
the plan's rule that the service-role key must never ship in the iOS bundle.
**[CORRECTED 2026-09-16 — audited against the real `.env.local` on the Air]**
see §8.5: the key *does* exist in `.env.local`, used only by `scripts/*.mjs`
(Node CLI), never by `src/`. Two vars in §6's table (`NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_BUILD_ID`) and `SUPABASE_FORCE_DOH` are **not** set in the real
file; three vars the table omits **are**.

## 7. Recommended v1 feature cut

**In v1** (core to "study mutashabihat" + matches offline/sync goals):
Mushaf reader (with the font caveat above), personal groups (list/view/edit/create),
Arabic-aware search, bookmarks/notes (once `mushaf_annotations` is actually
applied to prod), sync + backup per the plan.

**Defer to v1.1** (real, but not core-loop): `/test` quiz mode (large surface,
its own answer-logging schema), `/stats` dashboard, `/automated` browse +
copy, `/tools` bulk tagging. None of these block daily reading/study use.

**D-04 — DECIDED 2026-09-15: network graph (`/network`) deferred to v1.1.**
It is a genuinely live, nav-linked feature (not dead code, as the plan's "if
actually used" test allowed for), but it's a D3 force-directed graph with no
direct SwiftUI equivalent — native reimplementation means a hand-rolled
`Canvas` force layout or a new SPM dependency, either way Phase 4/5 work that
doesn't block the reading/study core loop. Revisit for v1.1 once v1 is on the
phone.

---

# 8. Live production verification — IOS-04 / IOS-08 (2026-09-16)

**Which machine this ran on.** The session was told it was on the MacBook Air.
It is not — it runs on the **Mac mini itself** (`hostname amr-Mac-mini.local`,
`hw.model Macmini9,1`, Tailscale self `100.88.212.88 youssefs-mac-mini`). That
mattered: the first half of this section was gathered the hard way, over the
public Tailscale Funnel, and the "SSH to the mini is refused" blocker was this
machine refusing a connection to itself. Anyone resuming this work should run
`hostname` before assuming which host they are on.

Consequences, both good: production Postgres is on `127.0.0.1:5433`
(`docker exec mutshabehat-db …`), so a real `pg_dump --schema-only` **was**
available and IOS-08 is closed below; and `/Volumes/External Mini` is this
machine's own SSD.

Method: §8.1–8.5 were read through **PostgREST's OpenAPI document**
(`GET /rest/v1/` with the service-role key), with row counts from
`HEAD … Prefer: count=exact`, RLS checked with the anon key, and constraints
probed with deliberately invalid inserts. §8.7 adds what only `pg_dump` and
`pg_class` can give: index definitions, RLS policy bodies and physical sizes.
The two agree everywhere they overlap.

## 8.1 Live schema and row counts (production, 2026-09-16)

| Relation | Rows | JSON payload | In repo `.sql`? | Verdict for iOS v1 |
|---|---:|---:|---|---|
| `groups` | 246 | 183.5 KB | yes | **sync** |
| `verses` | 923 | 164.4 KB | yes | **sync** |
| `parts` | 2 991 | 1 129.8 KB | yes | **sync** |
| `mushaf_annotations` | 14 | 7.6 KB | yes (mislabelled) | **sync** |
| `test_answers` | 80 | 16.7 KB | yes | defer (v1.1, `/test`) |
| `tags` | 0 | — | yes | defer (v1.1, `/tools`) |
| `group_tags` | 0 | — | yes | defer (v1.1, `/tools`) |
| `automated_groups` | 12 668 | **30.0 MB** | yes | defer (v1.1, `/automated`) |
| `profiles` | 1 | 0.2 KB | **no** | see §8.2 |
| `personal_groups` | 199 | 99.4 KB | **no** | legacy, §8.2 |
| `personal_verses` | 714 | 374.9 KB | **no** | legacy, §8.2 |
| `group_verses` | 0 | — | **no** | legacy, §8.2 |
| `verse_parts` | 0 | — | **no** | legacy, §8.2 |

Views live and reachable: `surah_counts` (75), `automated_surah_counts` (102),
`automated_groups_with_copy` (12 668).

RPCs live: `save_group`, `search_group_ids`, `get_dashboard_stats`,
`get_test_answer_stats`, `normalize_arabic`, `rasm_skeleton` (plus stock
`uuid-ossp` / `pgcrypto` / `pg_trgm` functions). All four repo migrations are
therefore applied. §1's migration list is accurate on content, wrong on
`mushaf_annotations`' status.

**The number that matters for Phase 1:** the complete v1 user dataset —
`groups` + `verses` + `parts` + `mushaf_annotations` (+ `profiles`) — is
**≈1.5 MB as raw JSON**. Full-corpus offline sync to SQLite is trivial; no
partial-sync, windowing or lazy-hydration design is warranted. Do not build
one. `automated_groups` at 30 MB is the only table that would need a
different strategy, and it is already deferred to v1.1.

**PostgREST caps responses at 1 000 rows** (`parts` needed 3 pages,
`automated_groups` 13). Any sync client must paginate via `Range` /
`offset`; a naive "select all" silently truncates. This is the single most
likely Phase 3 sync bug.

## 8.2 Five production relations the repo does not describe

`personal_groups`, `personal_verses`, `group_verses`, `verse_parts` and
`profiles` exist in production but in **no committed `.sql` file**. They
arrived via the 2026-08-31 Supabase-Cloud → self-host migration, which
reconstructed the cloud schema by introspection.

They are **dead to the web app**: zero `.from()` / `.rpc()` references across
`src/`. Freshness confirms it — `personal_groups` and `profiles` were last
written **2026-06-07**, while `groups` was written **2026-09-15**.
`personal_groups` (199) / `personal_verses` (714) are the *previous* data model,
superseded by `groups` (246) / `verses` (923).

**Decision for iOS v1: do not model, sync, or migrate any of the four legacy
relations.** They are frozen historical data behind a superseded model; the
iOS app targets the live model only.

`profiles` is a different case — it is also stale and unreferenced, but its
columns (`font_preset`, `theme`, `font_size`, `compact_mode`) are exactly the
reader preferences the web app now keeps in `localStorage`. It is a *latent*
settings table, not a legacy one. **Recommend: leave it untouched for v1** (iOS
keeps its own local preferences) and revisit it in v1.1 if cross-device
settings sync is wanted — at which point it is already the right shape.

This corrects §5's "no user data lives client-side today beyond `localStorage`
conveniences": those conveniences have a server-side home that predates them.

## 8.3 `mushaf_annotations` is live — IOS-07 resolved

§1 and the migration file both say this table was never applied to production.
**Both are wrong.** Live state, verified 2026-09-16:

- Table exists, **14 rows**. 12 dated `2026-06-28` (the original smoke test,
  carried over by the cloud migration), **2 dated `2026-09-15`** — real
  highlights on pages 110 and 112, i.e. the feature is in active use.
- All 19 columns match `20260628000000_mushaf_annotations_preview.sql` exactly.
- Every CHECK constraint is present **and enforced** — verified by probing:
  bad `annotation_type`, bad `target_type`, non-`^[0-9]+:[0-9]+$` `ayah_key`,
  `page_number` 999, and a `target_type='word'` row missing `word_id` were all
  rejected with `23514`; a bogus `user_id` was rejected with `23503`.
- RLS holds: the anon key sees **0 rows** (§8.4).
- It is wired end-to-end through `src/app/api/mushaf-1441/annotations/route.ts`
  (which references the table via a `const TABLE`, which is why a literal
  grep for the table name in `src/` reported nothing).

**D-07 — DECIDED 2026-09-16: `mushaf_annotations` is IN for v1.** No migration
to apply, no decision to defer. The bookmarks/notes/highlights feature in §7's
v1 cut has no blocker. Two documentation fixes follow from this, not schema
changes:

1. The migration file's "review and apply only to a preview/dev branch" header
   is stale and actively misleading — it is what made Phase 0 classify a live,
   in-use table as unapplied. Correct it.
2. The prod table was **not** created by running that file; it was rebuilt by
   introspection during the cloud migration. The file and production agree
   today (columns + constraints verified above), but that is a coincidence
   worth not relying on again — see §8.6 on getting real DDL.

## 8.4 RLS verification (anon key, every relation)

| Exposure | Relations |
|---|---|
| 0 rows to anon (correct) | `groups`, `verses`, `parts`, `tags`, `group_tags`, `test_answers`, `mushaf_annotations`, `profiles`, `personal_groups`, `personal_verses`, `group_verses`, `verse_parts`, `surah_counts` |
| public read (by design) | `automated_groups` (12 668), `automated_surah_counts` (102), `automated_groups_with_copy` (12 668) |

No user-scoped relation leaks to an unauthenticated caller. The public-read set
is exactly the reference data §1 says it should be. **Security posture is sound
for shipping the anon key in an iOS bundle** — which the plan requires.

## 8.5 `.env.local` audit (real file on the Air, names only)

| Var | Present | Classification | vs. §6 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | client-safe | as documented |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | client-safe | as documented |
| `AUTOLOGIN_EMAIL` | yes | **secret** | as documented |
| `AUTOLOGIN_PASSWORD` | yes | **secret** | as documented |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | **secret** | §6 said absent |
| `MUSHAF_1441_EXPECTED_SUPABASE_REF` | yes | build-time guard | §6 omitted |
| `VERCEL_OIDC_TOKEN` | yes | local CLI artifact | §6 omitted |
| `NEXT_PUBLIC_SITE_URL` | **no** | — | §6 listed it |
| `NEXT_PUBLIC_BUILD_ID` | **no** | — | §6 listed it |
| `SUPABASE_FORCE_DOH` | **no** | — | §6 listed it |

`SUPABASE_SERVICE_ROLE_KEY` is referenced **only** by `scripts/*.mjs`
(`migrate-personal-data`, `migrate-automated-data`,
`check-mushaf1441-supabase-env`) — Node CLI tooling, never by `src/`, never by
anything that reaches a browser bundle. §6's conclusion stands; its premise
did not.

**Rule for Phase 2, unchanged and now evidence-backed:** the iOS bundle ships
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` and nothing else.
`SUPABASE_SERVICE_ROLE_KEY`, `AUTOLOGIN_EMAIL` and `AUTOLOGIN_PASSWORD` must
never enter the app, an `Info.plist`, or a build setting. The single-user
auto-login the web app performs in `src/proxy.ts` is a **server-side**
trick and has no iOS equivalent — iOS signs in with the user's own
credentials against GoTrue.

## 8.6 Still open after IOS-04

1. ~~True `pg_dump --schema-only` DDL~~ — **CLOSED, see §8.7.**
2. ~~Mac mini shell / `git status`~~ — **CLOSED.** There was never a second
   machine: this session runs on the mini. Its checkout is
   `~/Projects/mutshabehat-v2` and `git status` is clean.
3. ~~Physical table/index sizes~~ — **CLOSED, see §8.7.**
4. **Stray probe row** — the constraint probe in §8.3 sent `Prefer: tx=rollback`,
   but this PostgREST is not configured with `db-tx-end = commit-allow-override`,
   so the one *valid* probe insert committed instead of rolling back. Row
   `710f9be6-b5e8-4339-9b57-d2ffb8153b27` (`note`/`ayah`, `1:1`, page 1, empty
   title/body/tags, `created_at` `2026-09-16T03:11:08Z`) is synthetic and must
   be deleted; the cleanup call was blocked by the auto-mode classifier as a
   production write. Counts above say 14 = the true user-data figure.
   **Note for all future sessions: `Prefer: tx=rollback` is NOT honoured on
   this stack. Never treat it as a dry run.**


## 8.7 What only `pg_dump` could give — IOS-08 (2026-09-16)

Taken with `docker exec mutshabehat-db pg_dump -U postgres --schema-only -n public`
plus `pg_class` / `pg_indexes`, once it became clear this session runs on the
mini itself.

**Row-level security is enabled on all 13 public tables** — `groups`, `verses`,
`parts`, `tags`, `group_tags`, `test_answers`, `mushaf_annotations`,
`automated_groups`, `profiles`, `personal_groups`, `personal_verses`,
`group_verses`, `verse_parts`. Nothing was left unprotected by the 2026-08-31
introspection-based migration. This is the DDL-level confirmation of the
behavioural result in §8.4.

**Indexes are all present**, including the three the annotations migration
defines, which is worth stating because that migration was never run as a file
(§8.3) and its indexes could plausibly have been lost:

| Table | Indexes |
|---|---|
| `groups` | pkey, `search_vec` (gin), `rasm_skeleton` + `title` (gin_trgm), `user_id`, and partial/composite btrees on `(user_id, …)` for created/updated/status/title/favorite/completed/source_automated |
| `verses` | pkey, `group_id`, `(group_id, sort_order)`, `(group_id, surah)`, `surah` |
| `parts` | pkey, `verse_id`, `(verse_id, sort_order)`, `search_vec` (gin), `rasm_skeleton` + `text` (gin_trgm) |
| `mushaf_annotations` | pkey, `(user_id, page_number, annotation_type)`, `(user_id, ayah_key, annotation_type)`, `(user_id, word_id)` |
| `tags` | pkey, `user_id`, unique `(user_id, lower(name))` |
| `test_answers` | pkey, `(user_id, created_at)` |

The annotations indexes are exactly the access patterns the iOS reader needs —
by page while turning pages, by ayah when opening a verse — so the SQLite
mirror should carry the same two (minus `user_id`, which is constant on device).

**Physical sizes** (whole database: **42 MB**):

| Table | Total | Heap | Indexes |
|---|---:|---:|---:|
| `automated_groups` | 24 MB | 19 MB | 2 904 kB |
| `parts` | 3 208 kB | 1 088 kB | 2 088 kB |
| `groups` | 944 kB | 176 kB | 728 kB |
| `verses` | 376 kB | 104 kB | 240 kB |
| `personal_verses` | 360 kB | 272 kB | 56 kB |
| `personal_groups` | 144 kB | 64 kB | 48 kB |
| `test_answers` | 96 kB | 32 kB | 32 kB |
| `mushaf_annotations` | 80 kB | 8 kB | 64 kB |
| `profiles`, `group_verses`, `tags`, `verse_parts`, `group_tags` | ≤32 kB each | | |

This confirms §8.1's conclusion from the other direction: everything in the v1
cut is **under 5 MB on disk including indexes**, and `automated_groups` is 24 MB
of the 42 MB database. Full-corpus offline replication remains the simple,
correct choice. Note how index-heavy the small tables are (`groups`: 728 kB of
index over 176 kB of heap) — that is Postgres FTS and trigram indexes, which
the SQLite mirror replaces with one FTS5 table, so do not use these figures to
size the on-device database.
