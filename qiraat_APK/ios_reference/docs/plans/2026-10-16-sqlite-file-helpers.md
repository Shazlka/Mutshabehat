# SQLite File Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated, already-drifted "validate a candidate SQLite file and replace the live file with rollback" code in the Mutshabehat and Reading databases with one tested `MushafCore` helper, without weakening today's data-safety order, and delete a dead third copy.

**Architecture:** A UIKit-free `SQLiteFile` namespace in `MushafCore` (header + table + integrity validation, checked checkpoint, sidecar removal, replace-with-rollback). It never owns a database handle: callers pass `checkpoint`, `close` and `reopen` closures that can fail, so each database keeps its own connection, `NSLock` and error type. Because Mutshabehat will now export through `SQLiteSnapshot.copy`, that helper is fixed first (it closes a handle twice).

**Tech Stack:** Swift 6, SQLite3 (raw), Swift Testing (`MushafCore`), XCTest (app target), XcodeGen. iOS 18 minimum.

**Spec:** `apps/ios/docs/specs/2026-10-16-sqlite-file-helpers-design.md` (read it first; it explains why the user databases stay separate files).

## Global Constraints

- Work on branch `ios/sqlite-file-helpers` created from `ios/main`; every file under `apps/ios/`; `scripts/check_isolation.sh` must print `isolation ok` before every commit; never push. **Prerequisite (already done by the plan's author, do not undo):** the untracked `.archify/` diagram folder at the repository root is excluded through the shared `.git/info/exclude`; do not delete or edit it.
- Commits: `GIT_AUTHOR_NAME=Shazlka GIT_AUTHOR_EMAIL=amr.eshazly@gmail.com GIT_COMMITTER_NAME=Shazlka GIT_COMMITTER_EMAIL=amr.eshazly@gmail.com git commit -m "iOS: …"`; no model names or attribution trailers in commits or code comments. Written `COMMIT "msg"` below.
- Public signatures and notifications of `MutshabehatDatabase.importDatabase(_:)` / `exportDatabase()` and `QuranReadingDatabase.importDatabase(_:)` / `mergeDatabase(from:)` stay the same, and so do their thrown error *types* (`DatabaseTransferError`, `QuranReadingDatabase.TransferError`): invalid input stays `invalidDatabase`. The one deliberate change to *which case* is thrown: low-level failures (staging, read, close, sidecar, write, reopen, snapshot) are normalized to each database's `.databaseUnavailable`; no `SQLiteFileError` or `SQLiteSnapshotError` ever escapes a public method. All behaviour changes are exactly those in spec §3.
- Existing Arabic error strings stay verbatim: `DatabaseTransferError.invalidDatabase` = «الملف ليس قاعدة متشابهات صالحة»; `QuranReadingDatabase.TransferError.invalidDatabase` = «الملف ليس نسخة صالحة من بيانات القراءة».
- Required tables: Mutshabehat `groups`, `verses`, `parts`, `automated_groups`; Reading `bookmarks`, `khatmas`, `khatma_read_ayahs`, `reading_days`, `reading_metadata`.
- **Replacement order is a safety rule and must not change:** validate candidate → checkpoint (checked) → read rollback bytes while the connection is still open → close (checked) → remove `-wal`/`-shm` (checked) → write → reopen. A failure before the write leaves the live file untouched, and `reopen` runs after such a failure only if `close` itself returned successfully. A caller must never clear its handle unless `sqlite3_close` returned `SQLITE_OK` (a failed close leaves the original handle assigned and open, and `reopen` must not run). Every `reopen` closure either leaves a fully configured open handle in the database object, or closes and clears whatever it opened and throws; its PRAGMAs and schema setup are checked.
- Swift 6 strict concurrency; follow the existing `public final class … : @unchecked Sendable` + `NSLock` pattern; the helper holds no state.
- Shorthand (run from `apps/ios`):
  - `CORETEST <Suite>` = `swift test --package-path MushafCore --filter <Suite>`
  - `APPTEST <Class>` = `xcodegen generate --quiet && xcodebuild -project Mutshabehat.xcodeproj -scheme Mutshabehat -derivedDataPath DerivedData -destination 'platform=iOS Simulator,name=iPhone 18 Pro Max' -collect-test-diagnostics never -only-testing:MutshabehatTests/<Class> test`

## Review Focus

Failure modes the happy path would miss, most likely first, each pinned by a named test in the task that owns the code.

1. A busy checkpoint (a reader holds an older WAL snapshot) must abort the replace with the live database still open and its data intact. → `checkpointTruncateThrowsWhenAReaderBlocksIt`, `replaceContentsAbortsWhenCheckpointFails`, `replaceContentsAbortsWhenCloseFails` (Task 2).
2. Zero bytes, a truncated header, or garbage (a half-downloaded iCloud file) must be rejected before anything is closed. → `validateRejectsZeroByteTruncatedAndGarbage`, `replaceContentsRejectsInvalidDataWithoutClosing` (Task 2); `testImportCorruptFileKeepsExistingData` (Task 3).
3. A sidecar that cannot be removed must stop the swap with the original file untouched. → `replaceContentsStopsBeforeWritingWhenSidecarCannotBeRemoved` (Task 2).
4. If reopening the new file fails, the previous bytes come back and the database is usable; if recovery also fails the error says so. → `replaceContentsRestoresPreviousBytesWhenReopenFails`, `replaceContentsReportsRecoveryFailure` (Task 2); `testImportThatFailsSchemaSetupRestoresPreviousData` (Task 4).
5. The bundled `Generated/mutshabehat.sqlite` and a database exported while the app holds it open in WAL mode must still import. → `validateAcceptsBundledMutshabehatSeed` (Task 2), `testExportContainsLatestWriteWhileOpen`, `testBundledSeedStillImports` (Task 3).

---

### Task 1: Make `SQLiteSnapshot.copy` own its destination handle once

**Files:**
- Modify: `MushafCore/Sources/MushafCore/Backup/SQLiteSnapshot.swift:36-65` (the destination handle is closed by `defer` at line 47 and explicitly at line 59)
- Test: `MushafCore/Tests/MushafCoreTests/BackupCoreTests.swift` (existing open-WAL and overwrite tests at about lines 120-144 must keep passing)

**Interfaces:**
- Consumes: nothing.
- Produces: `SQLiteSnapshot.copy(from:to:)` and `integrityCheck(at:)` with unchanged signatures.

- [ ] **Step 1: Write the failing test** `copyLeavesOnlyTheDestinationFile` in `BackupCoreTests`: put an open-WAL source in one temp directory and the destination in a **different, empty** temp directory; after `copy`, enumerate only the destination directory and assert it contains exactly one file (the destination), no `.partial-` file and no `-wal`/`-shm`.
- [ ] **Step 2: Reproduce the double close.** Run: `swift test --package-path MushafCore --sanitize=address --filter BackupCoreTests`. Expected: either an AddressSanitizer report (heap-use-after-free in `sqlite3_close`) or all PASS; record which. If PASS, still apply Step 3 (the double close is visible in the source).
- [ ] **Step 3: Fix.** Keep a single owner of `destinationHandle` as a `var`: a local `closeDestination() throws` calls `sqlite3_close` and sets the variable to nil **only if** it returned `SQLITE_OK`, and is called once before the file is moved into place. The scope-exit `defer` closes the handle only if the variable is still non-nil, using `sqlite3_close_v2` (so a failed earlier close is never closed twice with the plain call). Check the result of `PRAGMA journal_mode = DELETE` (`sqlite3_exec` must return `SQLITE_OK`); that failure and a failed close both throw `SQLiteSnapshotError.backupFailed`.
- [ ] **Step 4: Run to verify.** Run: `swift test --package-path MushafCore --sanitize=address --filter BackupCoreTests`. Expected: all PASS, no sanitizer report.
- [ ] **Step 5: Commit.** `COMMIT "iOS: SQLiteSnapshot closes its destination handle once and checks its results"`

---

### Task 2: `SQLiteFile` helper in MushafCore

**Files:**
- Create: `MushafCore/Sources/MushafCore/Storage/SQLiteFile.swift`
- Test: `MushafCore/Tests/MushafCoreTests/SQLiteFileTests.swift`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (public; used by Tasks 3 and 4):
  ```swift
  public enum SQLiteFileError: Error, Equatable {
      case unreadable                 // wrong size/header, or cannot be opened read-only
      case missingTables([String])    // sorted names
      case integrity                  // PRAGMA quick_check answered anything but "ok"
      case replaceFailed(String)      // checkpoint/close/sidecar/write/reopen failure
  }
  public enum SQLiteFile {
      public static func tableNames(at url: URL) throws -> Set<String>
      public static func validate(at url: URL, requiredTables: Set<String>) throws
      public static func checkpointTruncate(_ db: OpaquePointer) throws   // throws .replaceFailed when the busy column is not 0
      public static func enableWALAndForeignKeys(_ db: OpaquePointer) throws  // steps `PRAGMA journal_mode = WAL` and requires the returned mode "wal"; sets `PRAGMA foreign_keys = ON` and requires `PRAGMA foreign_keys` to read 1; else throws .replaceFailed
      public static func removeSidecars(of url: URL) throws               // throws .replaceFailed if -wal or -shm still exists afterwards
      public static func replaceContents(
          of target: URL, with data: Data, requiredTables: Set<String>,
          checkpoint: () throws -> Void, close: () throws -> Void, reopen: () throws -> Void
      ) throws
  }
  ```
  `close` must be safe to call when already closed (a nil handle is a no-op).

- [ ] **Step 1: Write the failing tests** in `SQLiteFileTests.swift` (Swift Testing, `@Suite struct SQLiteFileTests`). A helper `makeDatabase(at:tables:)` creates a real SQLite file with the given table names via `sqlite3_exec`; every test uses a unique temp directory. Tests and assertions:
  - `validateAcceptsFileWithRequiredTables`: file has `a`,`b`,`c`; requiring `["a","b"]` does not throw.
  - `validateReportsMissingTablesSorted`: file has `a`; requiring `["c","b","a"]` throws `.missingTables(["b","c"])`.
  - `validateRejectsZeroByteTruncatedAndGarbage`: three separate inputs — 0 bytes, the 16-byte header `SQLite format 3\0` alone (shorter than the 100-byte header), 4096 bytes of `0x41` — each throws `.unreadable`.
  - `validateAcceptsBundledMutshabehatSeed`: `generatedDirectory.appendingPathComponent("mutshabehat.sqlite")` (from `Support.swift`) validates with `["groups","verses","parts","automated_groups"]`; a missing file fails the test (no skip).
  - `checkpointTruncateEmptiesTheWAL`: open a WAL database, insert a row, call `checkpointTruncate`, assert the `-wal` file size is 0 and no error.
  - `enableWALAndForeignKeysConfiguresAFreshDatabase`: on a new file, the call succeeds, `PRAGMA journal_mode` then reads `wal` and `PRAGMA foreign_keys` reads `1`.
  - `checkpointTruncateThrowsWhenAReaderBlocksIt`: two connections to one WAL database with `sqlite3_busy_timeout(…, 0)`; connection A runs `BEGIN`, then prepares and **steps** `SELECT count(*) FROM t` (asserting `SQLITE_ROW`, which is what pins its older snapshot) and keeps the transaction open; connection B inserts a row; `checkpointTruncate` on B throws `.replaceFailed`; afterwards both connections are still usable (B can read, A can finish its transaction) and the inserted row is present.
  - `removeSidecarsThrowsWhenTheyCannotBeDeleted`: create `x-wal` and `x-shm`, make the directory read-only (`0o555`, restored in a `defer`), assert `.replaceFailed`.
  - `replaceContentsRunsStepsInOrder`: target has table `old`, data has table `new`; hooks append `"checkpoint"`, `"close"`, `"reopen"`; the array equals that order and `tableNames(at: target) == ["new"]`.
  - `replaceContentsRejectsInvalidDataWithoutClosing`: garbage data throws `.unreadable`; none of the three hooks ran; target bytes unchanged.
  - `replaceContentsAbortsWhenCheckpointFails`: `checkpoint` throws; result is `.replaceFailed`; `close` and `reopen` never ran; target bytes unchanged.
  - `replaceContentsAbortsWhenCloseFails`: `close` throws; result `.replaceFailed`; `reopen` never ran; target bytes unchanged.
  - `replaceContentsStopsBeforeWritingWhenSidecarCannotBeRemoved`: sidecar present, directory read-only; result `.replaceFailed`; `reopen` ran exactly once; target bytes unchanged.
  - `replaceContentsReportsReopenFailureAfterSidecarFailure`: sidecar present, directory read-only, and `reopen` throws; result is `.replaceFailed` whose message contains the sidecar failure and `reopen failed`; target bytes unchanged; `reopen` ran exactly once.
  - `replaceContentsAbortsWhenTheRollbackBytesCannotBeRead`: make the read of the target fail (the target path is a directory, or file permissions `0o000` restored in `defer`), after validation succeeded; result `.replaceFailed`; `close` and `reopen` never ran.
  - `replaceContentsRestoresPreviousBytesWhenReopenFails`: `reopen` throws on its first call only; result `.replaceFailed`; `close` ran again before the restore; `reopen` ran twice; target bytes equal the originals.
  - `replaceContentsReportsRecoveryFailure`: `reopen` throws on every call; result is `.replaceFailed` whose message contains both the original failure and `recovery failed`; target bytes still equal the originals (the restore was attempted and written).
  - `replaceContentsRemovesStaleSidecars`: dummy `target-wal` and `target-shm` exist; after a successful replace neither exists.

- [ ] **Step 2: Run to verify failure.** Run: `CORETEST SQLiteFileTests`. Expected: compile failure, `cannot find 'SQLiteFile' in scope`.

- [ ] **Step 3: Implement `SQLiteFile` and `SQLiteFileError` in `Storage/SQLiteFile.swift`.**
  - `tableNames`: require file size ≥ 100 bytes and the first 16 bytes equal to `SQLite format 3\0`, else `.unreadable`; open read-only; `SELECT name FROM sqlite_master WHERE type='table'`; any open/prepare failure is `.unreadable`.
  - `validate`: `tableNames`, then missing = required − found → `.missingTables(sorted)`, then `PRAGMA quick_check` must return the single row `ok`, else `.integrity` (the logic now in `QuranReadingDatabase.validateDatabase`, lines 343-367).
  - `checkpointTruncate`: `sqlite3_prepare_v2` must return `SQLITE_OK`; the first `sqlite3_step` must return `SQLITE_ROW` and column 0 (busy) must be `0`; the next step must return `SQLITE_DONE`; anything else throws `.replaceFailed` with the SQLite message (`"checkpoint busy"` when column 0 is non-zero).
  - `removeSidecars`: remove `path + "-wal"` and `path + "-shm"`; ignore "does not exist"; if either still exists afterwards, throw `.replaceFailed`.
  - `replaceContents` order is the Global Constraint order. Stage `data` to a temp file and `validate` it; run `checkpoint`; read `previous = Data(contentsOf: target)`; run `close`; `removeSidecars`; `data.write(to: target, options: .atomic)`; `reopen`. Errors: staging-write failures become `.replaceFailed`; **validation errors (`.unreadable`, `.missingTables`, `.integrity`) propagate unchanged** (callers map them to `invalidDatabase`); every other failure below becomes `.replaceFailed`. Track `closed = true` only after `close()` returned. A failure in validation, `checkpoint`, the rollback-bytes read, or `close`: nothing was written; do not call `reopen` (the connection is still open or never closed). A failure in sidecar removal: nothing was written; call `reopen` exactly once (the connection was closed) and throw `.replaceFailed("<sidecar failure>")`, or `.replaceFailed("<sidecar failure>; reopen failed: <reopen failure>")` if that `reopen` also threw (the `reopen` closure itself leaves the handle nil on failure). A failure at the write or reopen step is an explicit recovery: attempt in this order, collecting each failure rather than discarding it — `close()` (best effort, closes a half-opened handle), write `previous` atomically, `removeSidecars`, `reopen()`; then throw `.replaceFailed("<original failure>; recovery failed: <collected failures>")` if any recovery step failed, else `.replaceFailed("<original failure>")`. Wrap every Cocoa error into `.replaceFailed`; the staging file is always deleted. Document that callers pass `PRAGMA`-aware closures and must not clear their handle unless close succeeded.

- [ ] **Step 4: Run to verify pass.** Run: `CORETEST SQLiteFileTests`. Expected: 18 tests PASS.

- [ ] **Step 5: Commit.** `COMMIT "iOS: SQLiteFile helper — validate a candidate database and replace a live file with rollback"`

---

### Task 3: Mutshabehat uses `SQLiteFile` and the consistent snapshot

**Files:**
- Modify: `Sources/Mutshabehat/MutshabehatDatabase.swift` (`exportDatabase` lines 537-543, `importDatabase` 545-572, `validateDatabase` 589-609; delete private `removeSidecars()`)
- Test: `Tests/MutshabehatTests.swift`

**Interfaces:**
- Consumes: `SQLiteFile.replaceContents`, `checkpointTruncate`, `SQLiteFileError` (Task 2); fixed `SQLiteSnapshot.copy(from:to:)` (Task 1).
- Produces: unchanged public API (`exportDatabase() throws -> Data`, `importDatabase(_ data: Data) throws`).

- [ ] **Step 1: Write the failing tests** in `MutshabehatTests`, in the file's temp-URL style:
  - `testImportCorruptFileKeepsExistingData`: save a group; `importDatabase(Data(repeating: 0x41, count: 4096))` throws `DatabaseTransferError.invalidDatabase`; `fetchPersonalGroup(id:)` still returns the group; a second save then also works (connection still open).
  - `testImportMissingTablesKeepsExistingData`: a SQLite file with only a `groups` table; same assertions.
  - `testImportPostsNotificationOnlyOnSuccess`: observe `mutshabehatDatabaseDidUpdate`; a failing import posts nothing; a valid import posts exactly once.
  - `testExportContainsLatestWriteWhileOpen`: save a group and call `exportDatabase()` with no manual checkpoint; import the result into a second database; the group is there.
  - `testExportFailureMapsToDatabaseUnavailable`: create a database at a temp URL, then delete its file and sidecars while the connection is still open; `exportDatabase()` throws `DatabaseTransferError.databaseUnavailable` (the snapshot cannot open the missing path), not a `SQLiteSnapshotError`.
  - `testBundledSeedStillImports`: `Bundle.main.url(forResource: "mutshabehat", withExtension: "sqlite")` must exist (`XCTUnwrap`, no skip); importing its bytes does not throw.
- [ ] **Step 2: Run to verify.** Run: `APPTEST MutshabehatTests`. Expected: record which of the six already pass; the corrupt/missing-table tests may pass today because they pin existing behaviour.
- [ ] **Step 3: Refactor.**
  - `importDatabase`: under `lock`, call `SQLiteFile.replaceContents(of: databaseURL, with: data, requiredTables: ["groups","verses","parts","automated_groups"], checkpoint: { try SQLiteFile.checkpointTruncate(db) }, close: { close `db` and set it to nil **only if** `sqlite3_close` returned `SQLITE_OK`, otherwise throw }, reopen: reopenDatabase)`. Map `.unreadable/.missingTables/.integrity` to `DatabaseTransferError.invalidDatabase` and `.replaceFailed` to `.databaseUnavailable`. Post `mutshabehatDatabaseDidUpdate` only after success. `reopenDatabase` still throws `.databaseUnavailable` when `sqlite3_open` fails.
  - `exportDatabase`: under `lock`, `SQLiteSnapshot.copy(from: databaseURL, to: <temp URL>)`, read the bytes, delete the temp file; `db == nil` still throws `.databaseUnavailable`, and any `SQLiteSnapshotError` or read error is caught and rethrown as `DatabaseTransferError.databaseUnavailable`.
  - `reopenDatabase`: open into `db`; if `sqlite3_open` fails, close any non-nil handle it returned, set `db = nil`, throw `.databaseUnavailable`; then call `SQLiteFile.enableWALAndForeignKeys(db)`; on failure close and clear `db` and throw `.databaseUnavailable`. (`init` keeps its own unchecked setup unchanged.)
  - Add `import MushafCore` to `MutshabehatDatabase.swift` (it imports only Foundation and SQLite3 today).
  - Delete the private static `validateDatabase(at:)` and `removeSidecars()`.
  - Do not touch the callers in `ICloudDatabaseSyncService` that post `mutshabehatDatabaseDidUpdate` again (lines 213-219 and 376-381): that double post exists today and is out of scope.
- [ ] **Step 4: Run to verify pass.** Run: `APPTEST MutshabehatTests`. Expected: all PASS, including the existing `testExportAndImportDatabase`.
- [ ] **Step 5: Commit.** `COMMIT "iOS: Mutshabehat import/export use SQLiteFile and a consistent snapshot"`

---

### Task 4: Reading uses `SQLiteFile`, plus a real-database restore test

**Files:**
- Modify: `Sources/Reading/QuranReadingDatabase.swift` (`importDatabase` lines 94-125, validation call in `mergeDatabase(from:)` line 135, `validateDatabase` 343-367, `setupTables` 369-449; `checkedExec` at line 456 already exists)
- Test: `Tests/RestoreServiceTests.swift` (one new test); `Tests/ReadingDatabaseTransferTests.swift` (three new tests, below); `Tests/ReadingDatabaseTransferTests.swift` already covers foreign/missing tables, garbage, empty input and open-WAL export (lines 51-87) and gets **no** duplicate tests.

**Interfaces:**
- Consumes: `SQLiteFile.validate`, `SQLiteFile.replaceContents`, `checkpointTruncate`, `SQLiteFileError` (Task 2).
- Produces: unchanged public API (`importDatabase(_:)`, `mergeDatabase(from:)`, `TransferError`).

- [ ] **Step 1: Write the failing tests.** `testImportThatFailsSchemaSetupRestoresPreviousData` in `ReadingDatabaseTransferTests`: build the candidate from a real Reading database: create one with `makeDatabase`, export it, open the exported copy with `sqlite3`, run `DROP INDEX idx_bookmarks_type; CREATE TABLE idx_bookmarks_type(x);`, and use those bytes (it keeps every required table with its real columns and passes `quick_check`, but the schema setup's `CREATE INDEX IF NOT EXISTS idx_bookmarks_type …` then fails with "there is already a table named idx_bookmarks_type"). Assert `importDatabase` throws, and that the database still holds its earlier bookmark and accepts a new one. Also add `testReadingExportFailureMapsToDatabaseUnavailable` (create a database at a temp URL, delete its file and sidecars while it is open, `exportDatabase()` throws `QuranReadingDatabase.TransferError.databaseUnavailable`, not a `SQLiteSnapshotError`), and `testInitEnablesWALAndForeignKeys` (a new database file read through a second SQLite connection reports `journal_mode` = `wal`; foreign-key enforcement, which is per connection and so cannot be read from outside, is checked through the public API: `recordReadAyahs(khatmaId: "missing", items: [(1,1,1)])` returns 0 and `readAyahsCount(khatmaId: "missing")` is 0 because `khatma_read_ayahs` references `khatmas`; it passes before and after and pins the unchanged `init`). Then `testRestoreImportsIntoRealReadingAndMutshabehatDatabases` in `RestoreServiceTests`: back up a real `QuranReadingDatabase` (one bookmark) and a real `MutshabehatDatabase` (one group) with `BackupService`, then restore into two fresh real databases by passing `{ try readingDB.importDatabase($0) }` and `{ try mutshabehatDB.importDatabase($0) }` as the `readingImport` / `mutshabehatImport` targets (mirror `makeService`, replacing those two closures **and** `readingFileURL` / `mutshabehatFileURL` with the fresh databases' `fileURL`, so the restore's safety copies point at the files that receive the imports); assert the bookmark and the group are present afterwards.
- [ ] **Step 2: Run to verify.** Run: `APPTEST ReadingDatabaseTransferTests` then `APPTEST RestoreServiceTests`. Expected: `testReadingExportFailureMapsToDatabaseUnavailable` and `testImportThatFailsSchemaSetupRestoresPreviousData` FAIL before the refactor (export currently throws a `SQLiteSnapshotError`; and today's import ignores the setup error and leaves the new file in place, so the import does not throw); `testRestoreImportsIntoRealReadingAndMutshabehatDatabases` PASSES (it pins end-to-end behaviour).
- [ ] **Step 3: Refactor.** Add `private static let requiredTables: Set<String>` with the five Reading tables. `importDatabase`: under `lock`, `SQLiteFile.replaceContents(of: databaseURL, with: data, requiredTables: Self.requiredTables, checkpoint: { try SQLiteFile.checkpointTruncate(db) }, close: { close and nil `db` only on success }, reopen: { open into `db`; if open fails close any returned handle, clear `db` and throw; run the checked setup; on any failure close and clear `db` and throw })`. Make the setup checkable **without changing `init`**: move the schema statements (tables and indexes, no PRAGMAs) and the legacy-migration statements into two `private static let` SQL strings, keeping their text and batch boundaries exactly (`sqlite3_exec` stops a batch at its first error, and `execute` ignores that error; that is today's behaviour and must stay). `setupTables()` keeps its current behaviour: one unchecked `execute("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;" + schemaSQL)`, then the column check, the `ALTER TABLE`, and the legacy migration, all unchecked. Add `private func setupTablesStrict() throws` for the import's `reopen` closure: `SQLiteFile.enableWALAndForeignKeys(db)`, then `checkedExec` on the schema SQL, the column check, the `ALTER TABLE` and the legacy migration, throwing at the first failure. Map `.unreadable/.missingTables/.integrity` to `TransferError.invalidDatabase` and `.replaceFailed` to `.databaseUnavailable`. In `mergeDatabase(from:)` replace the call to `Self.validateDatabase(at:)` with `SQLiteFile.validate(at:requiredTables:)` mapped to `.invalidDatabase`. Delete the private static `validateDatabase(at:)`. Normalize `exportDatabase()` errors: catch any `SQLiteSnapshotError` or file-read error from the snapshot step and rethrow `TransferError.databaseUnavailable` (same contract as Mutshabehat export).
- [ ] **Step 4: Run to verify pass.** Run, one after another: `APPTEST ReadingDatabaseTransferTests`, `APPTEST ReadingCloudSyncTests`, `APPTEST BackupServiceTests`, `APPTEST RestoreServiceTests`. Expected: all PASS.
- [ ] **Step 5: Commit.** `COMMIT "iOS: Reading import and merge use SQLiteFile"`

---

### Task 5: Remove the dead copy, log it, run everything

**Files:**
- Modify: `Sources/Sync/ICloudDatabaseSyncService.swift` (delete `validateSqliteDatabase(at:requiredTables:)`, lines 419-443)
- Modify: `CHANGELOG.md` (new top entry)

**Interfaces:**
- Consumes: nothing new. Produces: nothing.

- [ ] **Step 1: Confirm it is dead.** Run: `grep -rn validateSqliteDatabase Sources Tests`. Expected: exactly one match, the declaration.
- [ ] **Step 2: Delete the method** and any import left unused by it.
- [ ] **Step 3: Add the changelog entry** at the top of `CHANGELOG.md`, in the file's format `## [Unreleased] — 2026-10-16 — SQLiteFile helper for database import`: what changed (shared `SQLiteFile`; stricter Mutshabehat import validation; Mutshabehat export through the online backup API; `SQLiteSnapshot` double close fixed; unused iCloud validator removed), the tests added, and "file formats and sync protocol unchanged".
- [ ] **Step 4: Run the full suite.** Run: `make test` from `apps/ios`. Expected: `isolation ok`, all Python data tests, every `MushafCore` test, every app test PASS, release guard OK.
- [ ] **Step 5: Commit.** `COMMIT "iOS: remove unused iCloud database validator; changelog for SQLiteFile"`

---

## Not in this plan

- **Schema compatibility on import** (wrong columns in a file that has the right table names). Today's code does not check it either; it is not a regression. A caller-supplied schema validator is a possible follow-up.
- `QiraatNotesStore` (a fourth user file, merged row by row, not replaced as a whole file) keeps its own code.
- Merging the user databases, moving Qiraat pages into SQLite, conditional requests for `QiraatLiveSync`, replacing the `.shared` singletons with a composition root.
