# Release review plan (2026-11-12)

Pre-App-Store review of `apps/ios`: bugs, module boundaries, dead code, UI glitches. Inputs: baseline test run
(core 560/560; app 461 with 2 localization failures), a Swift correctness review, an architecture/dead-code review
and an App Store readiness review (all read-only).

## Rules for this round
- Behaviour-preserving only. No rewrites, no data changes, no web (`main`) changes.
- Every step is a pure move or a narrow fix the compiler and existing tests can check.
- After each step: build; after each group: `MutshabehatTests`; at the end: core tests, Release build,
  `release_guard.py`, `release_check.sh`, simulator walk-through on iPhone and iPad.
- One CHANGELOG entry for the round. Commit on `ios/main` locally; no push without the owner.

## A. Bugs and release blockers (done in the working tree, verified as noted)
1. Release build did not compile: `showsSubcategory` was declared inside `#if DEBUG` but used in Release
   (`ReaderSettingsView.swift`). Release build passes.
2. Hold-to-peek bubble could stay on screen if the page disappears mid-hold (`PageController.viewWillDisappear`).
3. Localization tests failed: peek «و N أخرى» strings and the narrator chip «عن …» were verbatim Arabic.
   Now catalog keys with English; the «عن» name check moved to `AuthorityPill.namesItsReader` (MushafCore).
4. English UI showed Arabic in five sentences with no English value; bundle name "Mutshabehat" → "Qiraat".
5. Release «الآلية» tab was always empty and offered a developer JSON import → hidden in Release (`Mode.shown`).
6. Release binary carried 726 local `/Users/...` build paths → Release strips (`project.yml`).
7. iPad rail: "Not memorized" truncated to "Not mem…" in the 80 pt rail; English khatma percent used Arabic digits.

## B. Module boundaries (from the architecture review; pure moves)
1. `QiraatBackupService` → `Qiraat/QiraatArchiveService.swift` (out of the DEBUG developer screen file).
   Removes Backup→Reader, Sync→Reader, root→Reader.
2. New `Sources/Shared/` for cross-feature infrastructure: `AppLanguage`, `LaunchHooks` (out of ReaderView),
   `SearchDebounce`, `Haptics`, `MushafAppearance`, `MushafColors`, `BarPopoverMenu`, `FlowLayout`,
   `AppEndpoints` (+ `LiveSyncRoute`, `PublicLiveSyncSession`). Storage keys for theme and language become
   constants on their types instead of duplicated literals.
3. `extension ReaderView { qiraatDestination }` moves from `Qiraat/QiraatHub.swift` into `Reader/`. After 1–3,
   Qiraat no longer references Reader.
4. `MemorizationRuntime.makeBackupController` → `Backup/BackupRuntime.swift`.
5. `ReadingTracker` no longer defaults to `ICloudDatabaseSyncService.shared` by name inside Reading: the default
   comes from `UserStores` (composition root).
6. Dead code: `ICloudDatabaseSyncService.clearCustomFolder()` (no callers).
Not in this round (moderate risk, needs its own tests): closure seam for BackupController, moving live-Qiraat
polling out of `MushafPageView`, renaming Reading's `SurahProgress`, splitting the 700–1100-line files.

## C. UI/UX
- Walk the main screens on iPhone 18 Pro Max and iPad Pro 13 (light, dark, English) and fix layout glitches found.
- Keep the existing design language; no restyle for its own sake.

## D. Left for the owner (cannot be done in app code)
- Web legal pages show `SUPPORT_EMAIL_TBD` / `OPERATOR_NAME_TBD`; `/api/public/v1/mutoon` returns 503.
- Content rights O1–O3, Apple Developer account, device archive, TestFlight + VoiceOver pass on a device.

## Gaps checked
- Moving a file needs no `project.yml` change (Sources is included recursively) — confirmed in `project.yml`.
- `MutshabehatView.Mode.automated` is still compiled in Release; only the picker hides it, so the screen can only
  show `.automated` if `selectedTab` starts there (initial value is `.personal`; checked).
- Catalog edits keep Xcode's formatting (empty entries, no trailing newline) so the diff only adds lines.
