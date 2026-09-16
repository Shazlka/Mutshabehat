# Handoff: move the iOS work to the MacBook Air

Everything through Phase 1 was done on the **Mac mini**, because that is where
the session actually ran (the resume prompt said "the Air" — it was wrong; see
`DISCOVERY.md` §8). Nothing is lost by moving: the mini keeps the backend, the
Air gets Xcode and the app.

## Why the split is the right one

| Stays on the mini | Moves to the Air |
|---|---|
| Self-hosted Supabase (Postgres 17, GoTrue, PostgREST, Caddy) in Docker | Xcode, iOS SDK, simulators |
| The Tailscale Funnel that serves production | `apps/ios/**` — the Swift package and, later, the app target |
| `docker exec mutshabehat-db …` for schema work | `swift build` / `swift test` / `xcodebuild` |

The mini is an **M1 with 8 GB RAM and ~38 GB free**, already running two Docker
stacks (Mutshabehat and WAVE C3B DPR). It is a poor place to run Xcode and a
simulator, and it is the last machine you want to destabilise — a wedged mini
takes production down with it. The Air is the right machine for this.

The Air does **not** need database access to do Phase 1–2 work: `MutshabehatCore`
has zero network code, and the live schema is already captured in
`DISCOVERY.md` §8.1 and §8.7.

## Steps on the Air

> **The mini now has Xcode 27.0 too.** It was installed there before the
> "put it on the Air" call, from the App Store page this work opened. Two
> consequences on the mini: `swift` commands fail until someone runs
> `sudo xcodebuild -license`, and ~15 GB of its ~38 GB free disk is gone.
> Either accept the licence there or uninstall it — but the Air is still where
> the iOS work belongs.

```sh
# 1. Get the work
cd ~/Projects/mutshabehat-v2            # or clone git@github.com:Shazlka/Mutshabehat.git
git fetch origin
git checkout claude/titanic-313-phase-0-z1b1yt
git pull

# 2. Install Xcode — the part that needs a human
#    The CLI routes both fail: `mas get 497799835` needs a sudo password it
#    cannot prompt for from an agent session, and `brew install xcodes` is
#    broken on macOS 27 (XcodesOrg/homebrew-made#4).
open "macappstore://apps.apple.com/app/id497799835"     # then click Get / Install

# 3. Point the toolchain at it and take the iOS platform
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
xcodebuild -downloadPlatform iOS

# 4. Confirm Phase 1 still passes on this machine
cd apps/ios/MutshabehatCore && swift build && swift test     # expect 18 tests / 6 suites
```

`Package.swift` carries a shim for a Swift 6.4 quirk: under Command Line Tools
it cannot auto-locate swift-testing's macro plugin. The shim is **conditional on
the active developer directory** — with Xcode selected it contributes nothing,
which matters because `.unsafeFlags` would otherwise make the package
ineligible as a versioned dependency of the Phase 4 app target. To force the
CLT path for comparison: `DEVELOPER_DIR=/Library/Developer/CommandLineTools swift test`.

Xcode 27.0 is a ~3 GB download; the iOS platform adds several GB on top.

## What is already done, so you don't redo it

- **Phase 0 gaps closed** — `DISCOVERY.md` §8: live schema, row counts,
  physical sizes, RLS verified on all 13 tables, every CHECK probed.
- **D-06** (QCF fonts) and **D-07** (`mushaf_annotations`) decided —
  `DECISIONS.md`.
- **Phase 1** — `docs/ios/ARCHITECTURE.md` and the `MutshabehatCore` package:
  2 targets, 0 dependencies, 18 tests passing, which run on the host toolchain
  and therefore already pass on the Air *before* Xcode is installed.

## What Xcode unblocks, in order

1. **IOS-10 verification** — re-run `apps/ios/tools/fontcheck.swift` in an iOS
   simulator. It currently proves CoreText behaviour on macOS 27 only, and the
   WOFF2 row in `DECISIONS.md` D-06 is explicitly marked as needing this.
2. **The app target** — a SwiftUI app depending on `MutshabehatCore`. Phase 4.
3. **IOS-13** — sync against PostgREST. Note the two traps already documented:
   PostgREST caps responses at **1 000 rows**, and Postgres emits lowercase
   UUIDs while Swift's `UUID.uuidString` is uppercase.

## Two loose ends unrelated to the move

- **IOS-09** — a synthetic row is still in production `mushaf_annotations`
  (`710f9be6-b5e8-4339-9b57-d2ffb8153b27`). Run **on the mini**:
  ```sh
  docker exec mutshabehat-db psql -U postgres -d postgres \
    -c "DELETE FROM public.mushaf_annotations WHERE id = '710f9be6-b5e8-4339-9b57-d2ffb8153b27';"
  ```
  True user-data count is 14, not 15.
- **`Prefer: tx=rollback` is not honoured on this stack.** PostgREST is not
  configured with `db-tx-end = commit-allow-override`, so a probe insert sent
  with it **commits**. That is how the row above got there. Never treat it as a
  dry run against production.
