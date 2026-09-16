# Mutshabehat iOS — Architecture Baseline (Phase 1)

Date: 2026-09-16. Written from the Air after live production verification
(`DISCOVERY.md` §8). Decisions that constrain this document live in
`DECISIONS.md`.

## What the numbers changed

Phase 0 planned for an unknown-size corpus. It is now measured, and two
measurements decide most of the architecture:

| Measurement | Value | Consequence |
|---|---:|---|
| v1 user dataset (`groups`+`verses`+`parts`+`mushaf_annotations`) | **≈1.5 MB** | Mirror the whole thing on device. No partial sync, no windowing, no lazy hydration. |
| `automated_groups` | **30.0 MB** | The only table that would need a different strategy — already deferred to v1.1 (`/automated`). |
| All 604 QCF V2 page fonts as TTF | **~205 MB** | Cannot be bundled. Fetched on demand (D-06). |
| PostgREST response cap | **1 000 rows** | Every sync read must paginate. `parts` alone needs 3 pages. |

The first row is the important one. A 1.5 MB corpus means the app can hold a
complete local replica and every read can be a local read — which is what makes
"works fully offline" a property of the design rather than a feature to build.

## Layers

```
        SwiftUI views  ·  view models          ← Phase 4, needs Xcode (IOS-10)
                    ↓
   MutshabehatDomain    entities · ArabicText · ports      Foundation only
                    ↑                          ↑
   MutshabehatPersistence                MutshabehatSync    ← Phase 3 (IOS-13)
   SQLite replica                        PostgREST client
```

Dependencies point inward. `MutshabehatDomain` imports nothing but Foundation
— no SQLite, no URLSession, no SwiftUI — so the rules that matter (Arabic
normalisation, what a valid `AyahKey` is, what a group *is*) are testable in
milliseconds with no database and no simulator.

That is not architectural taste here, it is the only reason Phase 1 could
proceed at all: **Xcode is not installed** (IOS-10), so nothing that imports
UIKit or targets the iOS SDK can be compiled today. Keeping the domain
platform-independent turned a hard blocker into a scheduling inconvenience.
`swift test` runs the whole core on the host toolchain.

Two SPM targets, not five. The split exists to make exactly one rule
compiler-enforced — Domain cannot see SQLite. Further splitting buys nothing
for a single-user reading app.

## Data flow

**Reads are always local.** SQLite is the source of truth for the UI. No view
model ever awaits the network to render. This is what D-06's font strategy
relies on too: a Mushaf page with no downloaded font still renders readable
Uthmani text from the local fixtures, so the reader works on a plane on first
launch — the font download upgrades fidelity, it does not unlock the feature.

**Writes go local-first**, then replicate. Conflict policy is Phase 3 (IOS-13),
but the shape is already constrained by reality: one user, one account, a
handful of devices, ~1.5 MB. Last-write-wins on `updated_at` is almost
certainly sufficient; do not design a CRDT for this.

## Three places the port can silently go wrong

These are the failure modes worth naming up front, because each produces
*plausible* output rather than a crash.

1. **Arabic normalisation drift.** `normalizeArabic` / `rasmSkeleton` already
   exist twice — TypeScript and Postgres SQL. Swift is a third copy, and a copy
   that disagrees does not error, it just stops finding verses. Mitigated:
   `scripts/gen-arabic-golden-vectors.mjs` samples 406 real strings, proves TS
   and SQL agree on all of them (verified 2026-09-16), and emits the fixture
   Swift is tested against. Re-run it whenever `src/lib/arabic.ts` changes.
   The specific trap: dagger alef `ٰ` (U+0670) must be restored to `ا` *before*
   tashkeel is stripped, because it sits inside the tashkeel range — strip
   first and the result is quietly wrong.

2. **UUID case.** Postgres emits lowercase; Swift's `UUID.uuidString` is
   uppercase. Stored as `TEXT` in SQLite, they do not compare equal, so joins
   return nothing and sync re-inserts rows that already exist. Normalise to
   lowercase on every write.

3. **Silent truncation at 1 000 rows.** PostgREST caps responses. A sync that
   "selects all" gets 1 000 `parts` out of 2 991 and reports success.

## Search

Postgres `tsvector` has no SQLite equivalent, so the replica uses FTS5 over
**pre-normalised** text: `norm_text` = `normalizeArabic(part.text)`,
`rasm_text` = `rasmSkeleton(part.text)`, both written whenever `parts` is
written. Queries normalise the same way, and fall back from `norm_text` to
`rasm_text` when the first tier is empty — the same two-tier behaviour as the
web's `search_group_ids()` RPC and `matchRanges()`. Tokenising raw Arabic with
a stock tokenizer and hoping is the failure mode this avoids.

## Security

Verified live (`DISCOVERY.md` §8.4): no user-scoped relation is readable with
the anon key; only `automated_groups` and its two views are public by design.
**The anon key is therefore safe to ship in the iOS bundle**, which the plan
requires.

`SUPABASE_SERVICE_ROLE_KEY`, `AUTOLOGIN_EMAIL` and `AUTOLOGIN_PASSWORD` must
never enter the app, an `Info.plist`, or a build setting. The service-role key
exists in `.env.local` but is referenced only by `scripts/*.mjs`; it never
reaches a browser bundle today and must not reach a phone.

Open: the web app signs itself in server-side via `src/proxy.ts` using
`AUTOLOGIN_*`. That trick has no iOS equivalent — a phone cannot hold those
credentials safely. iOS signs in against GoTrue with the user's own
credentials and stores the refresh token in the Keychain. Settled in D-14
(Phase 2).

## Not being built

Recorded so nobody rebuilds them by reflex:

- Partial/incremental sync, pagination-by-relevance, lazy hydration — the
  corpus is 1.5 MB.
- A CRDT or vector-clock merge — single user.
- A font bundle, subsetter or WOFF2 decoder — D-06, and the licence forbids
  altering the files.
- `personal_groups` / `personal_verses` / `group_verses` / `verse_parts` —
  frozen legacy tables behind a superseded model (`DISCOVERY.md` §8.2).
- `/network`, `/test`, `/stats`, `/automated`, `/tools` — v1.1 (D-04, §7).
