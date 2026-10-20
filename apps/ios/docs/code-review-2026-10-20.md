# Qiraat iOS: code review and fix plan (2026-10-20)

Scope: `apps/ios` on `ios/main` (app `Sources/` 19k lines, `MushafCore/` 16k lines, tests 15k lines).
Method: automated scans (unsafe patterns, declarations referenced once, repeated 8-line blocks), the two
test suites, and line-by-line reads of the data, sync, backup, live-sync and reading-tracker code.
**Not done:** XCUITest runs, VoiceOver, a real iCloud account, a physical device. Files not listed under
"read" below were scanned by tooling only, not read.

Read in full or in the relevant parts: `MutshabehatDatabase`, `ICloudDatabaseSyncService`, `RestoreService`,
`QuranReadingDatabase` (merge), `ReadingTracker`, `QiraatLiveSync`, `QiraatBulkSync`, `QiraatStore`,
`SQLiteFile`, `MushafLibrary.installQiraatBackup`, `ReaderView` (lifecycle), `ReviewEditorEntry`,
`project.yml`, `Makefile`, `MutshabehatView` (duplicated parts).

## Test status (measured)

| Suite | Result |
|---|---|
| `swift test --package-path MushafCore` | **9 tests fail**, all in `UsulIndexTests`, `QiraatPageSummaryTests`, `QiraatCompareTests` |
| `MutshabehatTests` (316 tests, iPhone 18 Pro Max simulator) | **3 fail**: `testEveryArabicQiraatLiteralHasAnEnglishTranslation`, `testPage008QiraatRulingsMatchWebapp` (2 assertions) |
| Python script tests (`build_mushaf_db`, `release_guard`, `fetch_qiraat`) | pass |

All 12 failures are test-versus-data problems, not feature failures: the tests pin counts of the git-ignored
`Generated/Qiraat` snapshot (12,506 rulings, 12,297 places, page 8 = 6 variants / 44 rulings) and that snapshot was
refreshed from the live web database on 18 Oct (page 8 is now 8 / 87). One more test scans the DEBUG-only file
`QiraatCardReview.swift` and demands English translations for it.

## Progress (2026-10-20)

Done: fix-plan step 1 (all tests green), P0-1, P0-2, P0-3, P0-4, P1-3, P1-5, and the unchecked SQLite calls in the web-export compile step. Also done: P1-1 (iOS guard only), P1-4, P1-6 (sync), P2-1, P2-5 (sync messages), P3 dead code and the magazine-card and sheet-alert duplicates. Still open: P1-2 (web decision), P2-3 (split large files), P2-4 (review editor target), remaining `try?` outside sync, reading-progress merge on the main actor, smaller duplicates (`WordContextIndex`, `QiraatCardReview`/`FacesStepView`, `ReadingTracker`, `QiraatLegendSheet`).

## P0: fix first (data loss or silent wrong data)

**P0-1. Automatic sync overwrites local data and discards newer live data on every launch and every foreground.**
`ReaderView.swift:110,122` calls `syncFromICloud` on appear and on every `.active` scene phase.
`ICloudDatabaseSyncService.swift:233-260` then, if the folder holds the files:
- replaces the whole Mutshabehat database with iCloud's `mutshabehat.sqlite` (`importDatabase` → `replaceContents`). Groups
  created or edited on the device since the last export are lost; nothing publishes local groups back (only the web fallback writes that file).
- installs `qiraat.qiraatdata` and deletes the live overlay (`MushafLibrary.installQiraatBackup`:131-133), which throws away the
  newer pages `QiraatBulkSync` just downloaded. The backup is older than the live data by design.
- reports `qiraatPages = 604` whatever was installed, and `force` and the stored hash are never compared (every call re-imports).
Fix: import only when the manifest hash differs from `icloud:sync:last_hash` (or `force`); never replace user-edited Mutshabehat data
without a merge or an explicit user action; never clear the live overlay from an automatic sync; report the real count.

**P0-2. `syncFromICloud` runs on the main actor and reads whole files synchronously.** `Data(contentsOf:)` of the Mutshabehat database and the
Qiraat archive, plus the SQLite replace, run on `@MainActor` at every foreground. This stalls the UI (watchdog risk on large archives).
Fix: move file reading, hashing and replacing to a background task; hop to the main actor only to publish state.

**P0-3. 106 `sqlite3_bind_text(..., (s as NSString).utf8String, -1, nil)` calls.** The `nil` destructor is `SQLITE_STATIC`: SQLite keeps a pointer to a
temporary NSString buffer that Swift may free before `sqlite3_step`. It works by luck inside one autorelease scope and corrupts or crashes
when it does not. Locations: `MutshabehatDatabase` 45, `QuranReadingDatabase` 45, `ICloudDatabaseSyncService` 16.
`MemorizationDatabase`, `QiraatNotesStore` and `MushafDatabase` already use `SQLITE_TRANSIENT` correctly.
Fix: one shared `SQLiteStatement`/bind helper in `MushafCore/Storage` using `SQLITE_TRANSIENT`; replace all 106 calls mechanically.

**P0-4. `MutshabehatDatabase.savePersonalGroup` and `deletePersonalGroup` ignore every SQLite result.** The group row is replaced, the old verses and parts are
deleted, and each insert is skipped silently when `prepare` fails; `COMMIT` runs regardless and a failed step is never rolled back. One
bad insert therefore saves a group with missing verses and still returns success. Same pattern: `execute()` ignores errors, `fetchPersonalGroups`
returns `[]` on a failed prepare (an error looks like "no groups"), `String(cString: sqlite3_column_text(...))` crashes on NULL (lines 120, 122, 168, 207).
Fix: make these methods `throws`, check every step, `ROLLBACK` on failure, surface the error to the editor.

## P1: high (correctness, security, reliability)

**P1-1. The live endpoint can overwrite good data with stale data.** `QiraatStore.applyLivePage` accepts any response that decodes to the right page number and
persists it. The web route silently falls back to bundled fixtures when its database is unreachable (web changelog, 2026-09-25), so an outage on the
Mac Mini replaces fresh pages with the oldest data, on disk. Fix: have the web route mark fallback responses (header or field) and reject them on iOS;
also reject a page whose ruling/variant counts shrink sharply versus the stored one unless forced.

**P1-2. Sensitive web data is fetched without authentication.** `syncDirectlyFromWeb` downloads `/api/groups/export?format=json` and the app uses
`/api/mushaf-1441/qiraat-review` for writes (DEBUG) with no credentials; both only work because the production web app signs every visitor in as the owner (web CHANGELOG 2026-09-23).
Anyone with the URL can read the owner's groups and edit Qiraat data. This is a web-side issue; the iOS side should stop depending on it
(use a signed-in session or a dedicated read token) and the web decision should be revisited before any public release.

**P1-3. N+1 reads.** `fetchPersonalGroups` runs one query per group, one per verse (`fetchVerses` → `fetchParts`). The list screen calls it on the main thread.
Fix: three queries (groups, verses `WHERE group_id IN`, parts) assembled in memory, or a single join; run off the main thread.

**P1-4. Hard-coded personal data and endpoints in a public repository.** `/Users/amrelshazly/...` appears in `ICloudDatabaseSyncService.swift:163`, `ReadingTests.swift:508`,
`ReaderUITests.swift:393`, `scripts/sync_colima_to_icloud.py:32`; the production URL is duplicated in `QiraatLiveSync.swift:23` and `ICloudDatabaseSyncService.swift:367` (plus two scripts).
Fix: one `AppEndpoints` value read from `Base.xcconfig`/Info.plist; test paths via `#filePath`; delete the Mac fallback.

**P1-5. Tests depend on mutable, git-ignored data.** See the table above. `make test` is red on a fresh refresh of `Generated/Qiraat`.
Fix: assert invariants (every ruling resolves to a page, no duplicate ids, counts ≥ a floor) instead of exact counts, or pin a small committed fixture
snapshot for the count tests; give `QiraatLocalizationTests` an exclusion list for `#if DEBUG` files; resolve the page-8 test path with `#filePath`.

**P1-6. Error handling by swallowing.** 146 `try?` in app and core code; the auto-sync calls use `_ = try?` so a failed sync is invisible; Qiraat install failure only
`print`s (`ICloudDatabaseSyncService.swift:239`). Fix: record the last error in the sync status object and show it in the sync settings; replace `print` with `os.Logger`
(`WordContextIndex.swift` also prints, but only inside `#if DEBUG`).

## P2: medium (architecture and maintainability)

**P2-1. Singletons bypass the injection you already built.** `UserStores` exists so services take their stores, yet `ReadingTracker` calls
`ICloudDatabaseSyncService.shared` in 9 places, and the sync service reaches back to `stores.tracker()`: a cycle. Fix: inject a `ReadingSyncing` protocol
into `ReadingTracker`; the sync service publishes events instead of calling the tracker.

**P2-2. Four hand-rolled SQLite wrappers.** `closeConnection`/`reopenDatabase`/`importDatabase`/`exportDatabase`, `lock`+`guard let db`, and two error enums
(`TransferError`, `DatabaseTransferError`) are copied between `QuranReadingDatabase` and `MutshabehatDatabase`; `SQLiteFile` already holds the shared pieces for the swap.
Fix: extract a small `SQLiteConnection` (open, pragmas, prepare/bind/step/columns, transaction, replace) in `MushafCore/Storage`; one `DatabaseTransferError`. This also solves P0-3 and P0-4.

**P2-3. Large view files mix layout, data access and rules.** `MushafPageView` 1087, `MutshabehatView` 1134, `ReaderView` 757 (32 state properties), `ReadingStatisticsView` 765, `QuranReadingDatabase` 1400 (database + merge + statistics).
Fix by extraction, one file per concern, no behaviour change: split `QuranReadingDatabase` into core, merge, statistics; move the dwell rule in `ReadingTracker`
(`Int(Double(total) * min(1, elapsed/30))`) into `MushafCore` where it is unit-testable without UIKit.

**P2-4. Developer-only code ships in the app target.** The review editor (23 app files + 19 core files) and `QiraatCardReview` are `#if DEBUG` inside the production target; `release_guard.py` proves nothing leaks, but build time, test time and review noise grow.
Fix (optional, lower value): move to a separate `ReviewEditor` Swift package/target compiled only into a debug scheme.

**P2-5. Hard-coded Arabic error strings** in services (`NSError(domain: "ICloudSync", ...)` ×13, `RestoreError`) bypass `appLocalized`, so English mode shows Arabic errors.

**P2-6. Product scope.** The app's stated main goal is القراءات العشر; the Mutshabehat module (3.4k lines, web export sync, automated groups) is a second product with its own data-loss risks (P0-1, P0-4).
Decide: finish and test it properly, or hide it until the account/sync design is settled.

## P3: dead and duplicated code

Dead (declared, never referenced; verify each with the compiler after removal):
- `ComingSoonView` (`MemorizationView.swift:125`), `QiraatNotesView` (whole file `QiraatNotesView.swift`), `MutshabehatCardShell`, `MutshabehatCardTitle`, `MutshabehatVerseDetail` (`MutshabehatView.swift:1016-1105`, about 90 lines)
- `AdvancedSearchResultItem` (core), `explanationActions` (`QiraatClassification.swift:151`), `mushafDesk` constant, `ReadingTracker.setKeepScreenAwake`, `setScenePhase`, `startNewKhatmaManually`,
  `QuranReadingDatabase.allCompletedKhatmas`, `QuranReadingModels.remainingAyahs`, `Models.rubElHizb` case
- Used only by tests, i.e. production code kept for tests: `QiraatStore.clearOverlay` (duplicated by hand in `installQiraatBackup`), `FaceBuilders.detectType`, `ReviewDraft.addFaceForReader`,
  `MemorizationDatabase.upsertRecordForTesting`, `QuranReadingDatabase.resetForTesting`, `MutshabehatDatabase.fetchPersonalGroup(id:)`, `QiraatModels.attributionLabel`/`fetchedAt` fields.
  Move test hooks into test targets or `#if DEBUG`.

Duplicated:
- `PersonalMagazineCard` vs `AutomatedMagazineCard` (`MutshabehatView.swift:563-796`): 33 repeated 8-line blocks (header, badges, title, expand). Extract one generic card with a content slot.
- `PageSheet`/`UpdateSheet`/`AyahSheet`: shared status-picker blocks (3 files).
- `WordContextIndex` cache-hit and load paths (lines 149/218), `QiraatCardReview` vs `FacesStepView`, `ReadingTracker` completion blocks (lines 321/366), `QiraatLegendSheet` (297/311).

## What is already good

- `SQLiteFile.replaceContents` validates, checkpoints, restores the old bytes on failure; restore verifies hashes and makes a safety copy first.
- Reading merge has deletion tombstones and runs in one `BEGIN IMMEDIATE` transaction with rollback.
- `MemorizationDatabase`, `QiraatNotesStore`, `MushafDatabase` bind with `SQLITE_TRANSIENT`.
- Dependency direction is clean: `MushafCore` has no UIKit; no `try!` on user input (one constant regex), no `as!`; the review editor is absent from Release (`release_guard`).
- Secrets are git-ignored (`Config.xcconfig`, `Signing.xcconfig`); no keys found in tracked files.

## Fix plan (order and gates)

1. **Safety net (0.5 day):** make the 12 red tests green by fixing the tests (P1-5), so later regressions are visible. Gate: `swift test` and `MutshabehatTests` all pass.
2. **SQLite layer (1.5 days):** add `SQLiteConnection` + bind helper with tests; migrate `MutshabehatDatabase` first (fixes P0-3, P0-4, P1-3), then `QuranReadingDatabase`, then the sync compile step. Gate: existing database, transfer and cloud-sync tests, plus new tests for failed insert rollback and NULL columns.
3. **Sync semantics (1 day):** P0-1, P0-2, P1-6: hash-gated import, background I/O, no overlay wipe, real status and errors. Tests: injected folder provider already exists (`ICloudSyncInjectionTests`); add "local group survives a sync", "live page survives a sync", "second sync is a no-op".
4. **Live data guard (0.5 day iOS + a small web change):** P1-1.
5. **Config and hygiene (0.5 day):** P1-4, P2-5, `print` → `Logger` in the sync service.
6. **Dead code and duplicates (1 day):** P3 in one commit per item group; compile and run tests after each.
7. **Architecture (as time allows):** P2-1, P2-3, P2-4.
8. **Verification before calling it done:** `make test` (iPhone), `make test-ipad`, `make perf`, `make release-guard`, then a hand check on a device of iCloud sync with two devices, backup/restore, and page turning with the Qiraat layer on.
