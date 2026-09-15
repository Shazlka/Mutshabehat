# Mutshabehat iOS — Task Board

Environment note (read first): this board was opened from a cloud Claude Code
session (branch `claude/titanic-313-phase-0-z1b1yt`), not the MacBook Air.
No Tailscale route to the Mac mini, no `codex`/`agy` CLI here. Session model
started as Sonnet 5 and was switched to Opus 5 after Phase 0 discovery was
written. Phase 0 tasks below were executed directly by this session plus one
Claude subagent, not by the real Codex/Agy roster. Re-open
this board from the Air for Phase 1+ so the real roster and live Postgres
access are available.

| ID | Phase | Tier | Agent (planned) | Agent (actual) | Objective | Allowed paths | Depends on | Status | Result |
|---|---|---|---|---|---|---|---|---|---|
| IOS-00 | 0 | T1 | Opus (setup) | Sonnet (this session) | Create `.orchestration/TASKS.md` + `quota.json` | `apps/ios/.orchestration/**` | — | DONE | Created; agent roster degraded, see quota.json |
| IOS-01 | 0 | T1 | Agy Flash | Claude subagent (general-purpose) | Schema inventory (repo SQL files, not live pg_dump) + web feature inventory by route | `docs/ios/DISCOVERY.md` (read-only elsewhere) | — | DONE | schema/views/RLS/RPCs/migrations + 13 routes inventoried |
| IOS-02 | 0 | T1 | Sonnet | Sonnet (this session) | Env var classification + v1 feature-cut recommendation | `docs/ios/DISCOVERY.md` (read-only elsewhere) | — | DONE | 7 vars classified, no service-role key in `src/`; v1 cut proposed |
| IOS-03 | 0 | T3 | Opus | Opus (this session) | Ask D-04 once DISCOVERY.md is ready | — | IOS-01, IOS-02 | IN PROGRESS | asked after DISCOVERY.md landed |
| IOS-04 | 1 | T1 | Sonnet | — | Re-run discovery gaps from the Air: live schema dump, row counts/sizes, Mac mini `git status`, `.env.local` audit | `docs/ios/DISCOVERY.md` | IOS-01 | TODO | blocked on running from the Air |
| IOS-06 | 2/5 | T3 | Opus | — | Decide QCF font strategy: bundle 604 page fonts (licence check first) vs. fetch-and-cache per page | `docs/ios/**` | IOS-01 | TODO | offline-first conflict flagged in DISCOVERY.md §3 |
| IOS-07 | 3 | T2 | Sol | — | `mushaf_annotations` is not applied to prod — decide apply vs. drop from v1 before sync design | `supabase/migrations/**` | IOS-01 | TODO | blocks annotations sync |
