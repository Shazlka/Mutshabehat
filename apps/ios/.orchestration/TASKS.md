# Mutshabehat iOS — Task Board

Environment note (read first): this board was opened from a cloud Claude Code
session (branch `claude/titanic-313-phase-0-z1b1yt`), not the MacBook Air.
No Tailscale route to the Mac mini, no `codex`/`agy` CLI here, session model
is Sonnet 5 (not Opus 5). Phase 0 tasks below were executed directly by this
session plus one Claude subagent, not by the real Codex/Agy roster. Re-open
this board from the Air for Phase 1+ so the real roster and live Postgres
access are available.

| ID | Phase | Tier | Agent (planned) | Agent (actual) | Objective | Allowed paths | Depends on | Status | Result |
|---|---|---|---|---|---|---|---|---|---|
| IOS-00 | 0 | T1 | Opus (setup) | Sonnet (this session) | Create `.orchestration/TASKS.md` + `quota.json` | `apps/ios/.orchestration/**` | — | DONE | Created; agent roster degraded, see quota.json |
| IOS-01 | 0 | T1 | Agy Flash | Claude subagent (general-purpose) | Schema inventory (repo SQL files, not live pg_dump) + web feature inventory by route | `docs/ios/DISCOVERY.md` (read-only elsewhere) | — | IN PROGRESS | pending subagent report |
| IOS-02 | 0 | T1 | Sonnet | Sonnet (this session) | Env var classification + v1 feature-cut recommendation | `docs/ios/DISCOVERY.md` (read-only elsewhere) | — | IN PROGRESS | env vars enumerated; feature cut pending IOS-01 |
| IOS-03 | 0 | T3 | Opus | Sonnet (this session, flagged) | Ask D-04 once DISCOVERY.md is ready | — | IOS-01, IOS-02 | BLOCKED | waiting on IOS-01 |
