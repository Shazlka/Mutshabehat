# One implementation of "validate and replace a SQLite file" — design

Date: 2026-10-16. Scope: `apps/ios` only.

## 1. Why this exists

An architecture review of the app asked whether the three user databases (`mushaf_memorization.sqlite`,
`mutshabehat.sqlite`, `mushaf_reading.sqlite`) should become one file. Reading the code showed they should not
be merged, because every cross-device and backup format is **per database**:

| Database | How it leaves / enters the device | Where |
|---|---|---|
| Reading | one whole-file snapshot per device, `ReadingDevices/<id>.sqlite`, merged table by table with `mergeDatabase(from:)`; legacy `reading.sqlite` is still read | `ICloudDatabaseSyncService.syncReadingSnapshots` (`Sync/ICloudDatabaseSyncService.swift:284-321`) |
| Mutshabehat | a whole file exported off-device (`mutshabehat.sqlite`, or built from the web JSON) **replaces** the local file | `MutshabehatDatabase.importDatabase` (`Mutshabehat/MutshabehatDatabase.swift:545-572`) |
| Memorization | JSON document (`MemorizationExport`), merged or replaced logically | `MemorizationDatabase+Transfer.swift` |
| Qiraat notes | row-level validated merge, never a whole-file replace | `QiraatNotesStore` (`Qiraat/QiraatNotesStore.swift`) |
| Backups | one file per database in the manifest (memorization, reading, Mutshabehat, Qiraat notes) | `BackupWorker.sqliteSources` (`Backup/BackupService.swift:131-137`) |

One merged file would make "replace the Mutshabehat file" a table-scoped replace, make a Reading snapshot carry
unrelated tables, and change the backup format. That is a large, risky change for little gain, so it is **not**
done here.

The part that is genuinely duplicated is smaller and safe to unify: validating a candidate SQLite file and
replacing the live file with rollback. It exists twice (Mutshabehat and Reading) and a third, never-called copy
sits in the iCloud service. The two live copies have drifted:

- Mutshabehat opens the candidate **read-write** and checks only table names; Reading opens it read-only and also
  runs `PRAGMA quick_check`.
- Mutshabehat exports by copying the file after a WAL checkpoint; Reading exports through SQLite's online backup
  (`SQLiteSnapshot.copy`), which is consistent while the app is writing.

## 2. Decisions

1. **One helper, `SQLiteFile`, in `MushafCore`** (UIKit-free, unit-tested with `swift test`). It owns: reading a
   file's table names, validating a candidate (read-only open, required tables present, `PRAGMA quick_check` is
   `ok`), removing `-wal`/`-shm` sidecars, and replacing a live file with the bytes of a validated candidate,
   restoring the previous bytes if the swap fails.
2. **The call sites keep their own connection, lock and error type.** The helper takes three closures that can
   fail (`checkpoint`, `close`, `reopen`) so it never owns a database handle. The replacement order is a safety
   rule: validate → checked checkpoint → read rollback bytes while still open → checked close → checked sidecar
   removal → write → reopen. A busy checkpoint or failed close aborts with the live file untouched. Public behaviour of
   `importDatabase(_:)` / `exportDatabase()` does not change, except as listed in §3.
3. **Mutshabehat adopts the stricter validation and the consistent export** that Reading already has.
4. **The three user databases stay three files.** Reconsider only if a feature needs a cross-domain query.
5. **Not validated:** column-level schema compatibility of an imported file (today's code does not check it
   either). Possible follow-up: a caller-supplied validator.
6. **Out of scope** (separate plans if wanted): moving the Qiraat JSON pages into SQLite; conditional requests in
   `QiraatLiveSync`; replacing the `.shared` singletons with a composition root (22 call sites today).

## 3. Behaviour changes (deliberate)

- Importing a Mutshabehat file now also fails if `PRAGMA quick_check` is not `ok`, and any candidate must have
  the `SQLite format 3\0` header and at least 100 bytes (an empty file is a valid empty SQLite database, so
  without this check a zero-byte file would pass).
- `SQLiteSnapshot.copy` is fixed first: it closed its destination handle twice (once explicitly, once in `defer`).
- `MutshabehatDatabase.exportDatabase()` returns a snapshot taken with the online backup API, in rollback-journal
  mode (one self-contained file), instead of the live file read after a checkpoint.
- Low-level failures during import or export (staging, read, close, sidecar, write, reopen, snapshot) are now
  reported as each database's `.databaseUnavailable`; invalid input is still `invalidDatabase`. Neither
  `SQLiteFileError` nor `SQLiteSnapshotError` ever reaches a caller of a public method.
- The unused `ICloudDatabaseSyncService.validateSqliteDatabase` is deleted.

## 4. Success criteria

- `swift test --package-path MushafCore` and the app's `MutshabehatTests`, `ReadingDatabaseTransferTests`,
  `ReadingCloudSyncTests`, `BackupServiceTests`, `RestoreServiceTests` pass.
- The bundled `Generated/mutshabehat.sqlite` still imports.
- About 100 lines of duplicated SQLite plumbing are gone; `scripts/check_isolation.sh` prints `isolation ok`.
