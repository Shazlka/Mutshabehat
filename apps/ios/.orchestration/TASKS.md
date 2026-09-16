# Mutshabehat iOS — Task Board

**Environment (updated 2026-09-16).** This board has moved off the cloud
session onto a real machine — and that machine is the **Mac mini**, not the
MacBook Air as the resume prompt assumed (`hostname amr-Mac-mini.local`,
`hw.model Macmini9,1`, Tailscale self `100.88.212.88`). Run `hostname` before
assuming otherwise. Consequences: production Postgres is **local** on
`127.0.0.1:5433` via `docker exec mutshabehat-db`, which closed IOS-08, and
there is no second host to SSH into. Also available: the `codex` / `agy` /
`grok` / `opencode` CLIs and the Swift 6.4 toolchain.

**Still missing: Xcode.** Only Command Line Tools are installed
(`xcode-select` points at `/Library/Developer/CommandLineTools`), so there is
no `xcodebuild`, no iOS SDK and no simulator. SwiftPM builds and tests run fine
against the host toolchain — verified — so all platform-independent work
proceeds; anything that must compile *for iOS* or run in a simulator is blocked
until Xcode is installed. See IOS-10.

Session model: Opus 5. Roster state in `quota.json`.

| ID | Phase | Tier | Agent (planned) | Agent (actual) | Objective | Allowed paths | Depends on | Status | Result |
|---|---|---|---|---|---|---|---|---|---|
| IOS-00 | 0 | T1 | Opus (setup) | Sonnet (cloud) | Create `.orchestration/TASKS.md` + `quota.json` | `apps/ios/.orchestration/**` | — | DONE | Created; roster degraded, see quota.json |
| IOS-01 | 0 | T1 | Agy Flash | Claude subagent | Schema inventory (repo SQL) + web feature inventory by route | `docs/ios/DISCOVERY.md` | — | DONE | schema/views/RLS/RPCs/migrations + 13 routes; **3 claims later corrected by IOS-04** |
| IOS-02 | 0 | T1 | Sonnet | Sonnet (cloud) | Env var classification + v1 feature-cut recommendation | `docs/ios/DISCOVERY.md` | — | DONE | 7 vars classified; **partly corrected by IOS-04 §8.5** |
| IOS-03 | 0 | T3 | Opus | Opus (cloud) | Decide D-04 | — | IOS-01, IOS-02 | DONE | D-04: `/network` → v1.1 |
| IOS-04 | 1 | T1 | Sonnet | Opus (Air) | Close discovery gaps from the Air: live schema, row counts, mini `git status`, `.env.local` audit | `docs/ios/**` | IOS-01 | **DONE** | `DISCOVERY.md` §8. Live schema + counts + sizes + RLS + constraints captured via PostgREST. 3 corrections, 5 undocumented relations found, v1 dataset ≈1.5 MB. 2 items deferred → IOS-08, IOS-09 |
| IOS-06 | 2/5 | T3 | Opus | Opus (Air) | Decide QCF font strategy | `docs/ios/**` | IOS-01 | **DONE** | **D-06**: fetch official TTF on demand + permanent cache + opt-in full prefetch. Never bundle 604, never transcode. Provenance follow-up → IOS-11 |
| IOS-07 | 3 | T2 | Sol | Opus (Air) | `mushaf_annotations` apply vs. drop | `supabase/migrations/**` | IOS-01 | **DONE** | **D-07**: already live in prod and in active use — nothing to apply, IN for v1. Stale migration header corrected |
| IOS-08 | 1 | T1 | Sonnet | Opus | Get true `pg_dump --schema-only` (index DDL + RLS policy bodies + sizes) | `docs/ios/**` | IOS-04 | **DONE** | `DISCOVERY.md` §8.7. Was never blocked — the "unreachable mini" was this machine. RLS on all 13 tables, every index present incl. the 3 annotations ones, DB 42 MB of which `automated_groups` is 24 MB |
| IOS-09 | 1 | T1 | — | — | Delete stray probe row `710f9be6-…` from `mushaf_annotations` | prod DB | IOS-04 | **NEEDS USER** | auto-mode classifier blocks prod writes; one-liner in DISCOVERY §8.6 item 4 |
| IOS-10 | 1 | T1 | — | — | Install Xcode + iOS SDK | — | — | **NEEDS USER** | `mas get 497799835` needs sudo and cannot prompt from an agent session; `brew install xcodes` is broken on macOS 27 (XcodesOrg/homebrew-made#4). Blocks every iOS-target build and simulator run; does **not** block IOS-12 |
| IOS-11 | 5 | T2 | — | — | Source official KFGQPC QCF V2 TTFs (CDN build is self-labelled "Test Font"), verify glyph codepoints still match the fixtures | `docs/ios/**` | IOS-06 | TODO | release gate only; CDN files fine for private/TestFlight builds |
| IOS-12 | 1 | T2 | Codex | — | Scaffold `apps/ios/MutshabehatCore` SPM package: domain models, SQLite schema, sync ports. No UIKit/SwiftUI — must build with CLT | `apps/ios/**` | IOS-04 | IN PROGRESS | platform-independent by design so IOS-10 does not block it |
| IOS-13 | 3 | T3 | Opus | — | Sync design: pull/push protocol, conflict policy, `updated_at` watermarks. Must handle PostgREST's 1 000-row cap | `docs/ios/**` | IOS-04, IOS-12 | TODO | full-corpus sync viable — v1 dataset ≈1.5 MB |

## Open decisions

| ID | Question | Status |
|---|---|---|
| D-04 | `/network` graph in v1? | DECIDED 2026-09-15 — defer to v1.1 |
| D-06 | Bundle QCF fonts or fetch? | DECIDED 2026-09-16 — fetch TTF on demand + opt-in prefetch |
| D-07 | Apply or drop `mushaf_annotations`? | DECIDED 2026-09-16 — already live, keep in v1 |
| D-14 | Auth on iOS: the web app auto-logs-in server-side (`src/proxy.ts`) with `AUTOLOGIN_*`, which has no iOS equivalent. Real GoTrue sign-in, or Keychain-stored credentials? | OPEN — Phase 2 |
