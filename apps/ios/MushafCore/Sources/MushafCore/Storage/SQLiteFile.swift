import Foundation
import SQLite3

public enum SQLiteFileError: Error, Equatable {
    /// Not a SQLite file: too short, wrong header, or it cannot be opened read-only.
    case unreadable
    /// The file is a database but lacks these tables (sorted).
    case missingTables([String])
    /// `PRAGMA quick_check` answered anything but "ok".
    case integrity
    /// A checkpoint, close, sidecar, write or reopen step failed; the text says which.
    case replaceFailed(String)
}

/// Checks a candidate SQLite file and replaces a live database file with it, restoring the old bytes when the
/// swap fails. It never owns a database handle: the caller passes closures for the steps that touch its own
/// connection.
public enum SQLiteFile {
    private static let magic = Array("SQLite format 3\0".utf8)
    private static let headerSize = 100

    // MARK: Validation

    public static func tableNames(at url: URL) throws -> Set<String> {
        try tableNames(at: url, readOnly: true)
    }

    /// `readOnly: false` is for a private staged copy only: a database in WAL format cannot be opened read-only
    /// when its `-wal`/`-shm` files are missing (the web sync builds its file in WAL mode and only the main
    /// file's bytes travel), so the staged copy is opened read-write; its sidecars are removed afterwards.
    private static func tableNames(at url: URL, readOnly: Bool) throws -> Set<String> {
        guard hasSQLiteHeader(url) else { throw SQLiteFileError.unreadable }
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, readOnly ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE, nil) == SQLITE_OK,
              let handle else {
            if let handle { sqlite3_close(handle) }
            throw SQLiteFileError.unreadable
        }
        defer { sqlite3_close(handle) }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "SELECT name FROM sqlite_master WHERE type='table'", -1, &statement, nil) == SQLITE_OK,
              let statement else { throw SQLiteFileError.unreadable }
        defer { sqlite3_finalize(statement) }
        var names = Set<String>()
        while sqlite3_step(statement) == SQLITE_ROW, let text = sqlite3_column_text(statement, 0) {
            names.insert(String(cString: text))
        }
        return names
    }

    /// Throws unless `url` is a SQLite file holding every required table and passing `PRAGMA quick_check`.
    public static func validate(at url: URL, requiredTables: Set<String>) throws {
        try validate(at: url, requiredTables: requiredTables, readOnly: true)
    }

    private static func validate(at url: URL, requiredTables: Set<String>, readOnly: Bool) throws {
        let found = try tableNames(at: url, readOnly: readOnly)
        let missing = requiredTables.subtracting(found)
        guard missing.isEmpty else { throw SQLiteFileError.missingTables(missing.sorted()) }

        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, readOnly ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE, nil) == SQLITE_OK,
              let handle else {
            if let handle { sqlite3_close(handle) }
            throw SQLiteFileError.unreadable
        }
        defer { sqlite3_close(handle) }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "PRAGMA quick_check", -1, &statement, nil) == SQLITE_OK, let statement else {
            throw SQLiteFileError.integrity
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW, let text = sqlite3_column_text(statement, 0),
              String(cString: text) == "ok" else { throw SQLiteFileError.integrity }
    }

    private static func hasSQLiteHeader(_ url: URL) -> Bool {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return false }
        defer { try? handle.close() }
        guard let head = try? handle.read(upToCount: headerSize), head.count == headerSize else { return false }
        return Array(head.prefix(magic.count)) == magic
    }

    // MARK: Connection helpers (called by the owner of the handle)

    /// Runs `PRAGMA wal_checkpoint(TRUNCATE)` and throws unless it completed: a reader holding an older
    /// snapshot makes it report busy, and the WAL must not be deleted in that case.
    public static func checkpointTruncate(_ db: OpaquePointer) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "PRAGMA wal_checkpoint(TRUNCATE)", -1, &statement, nil) == SQLITE_OK, let statement else {
            throw SQLiteFileError.replaceFailed("checkpoint: \(String(cString: sqlite3_errmsg(db)))")
        }
        defer { sqlite3_finalize(statement) }
        let first = sqlite3_step(statement)
        if first == SQLITE_BUSY { throw SQLiteFileError.replaceFailed("checkpoint busy") }
        guard first == SQLITE_ROW else {
            throw SQLiteFileError.replaceFailed("checkpoint: \(String(cString: sqlite3_errmsg(db)))")
        }
        guard sqlite3_column_int(statement, 0) == 0 else { throw SQLiteFileError.replaceFailed("checkpoint busy") }
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw SQLiteFileError.replaceFailed("checkpoint: \(String(cString: sqlite3_errmsg(db)))")
        }
    }

    /// Puts the connection in WAL mode with foreign keys on, and checks that both took effect.
    public static func enableWALAndForeignKeys(_ db: OpaquePointer) throws {
        guard scalarText(db, "PRAGMA journal_mode = WAL")?.lowercased() == "wal" else {
            throw SQLiteFileError.replaceFailed("journal_mode is not WAL")
        }
        guard sqlite3_exec(db, "PRAGMA foreign_keys = ON;", nil, nil, nil) == SQLITE_OK,
              scalarText(db, "PRAGMA foreign_keys") == "1" else {
            throw SQLiteFileError.replaceFailed("foreign_keys is not enabled")
        }
    }

    private static func scalarText(_ db: OpaquePointer, _ sql: String) -> String? {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { return nil }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW, let text = sqlite3_column_text(statement, 0) else { return nil }
        return String(cString: text)
    }

    // MARK: Sidecars

    /// Deletes `<path>-wal` and `<path>-shm`. A leftover WAL would be applied to a different database.
    public static func removeSidecars(of url: URL) throws {
        var problems: [String] = []
        for suffix in ["-wal", "-shm"] {
            let path = url.path + suffix
            guard FileManager.default.fileExists(atPath: path) else { continue }
            do { try FileManager.default.removeItem(atPath: path) } catch { problems.append("\(suffix): \(error.localizedDescription)") }
            if FileManager.default.fileExists(atPath: path), problems.isEmpty { problems.append(suffix) }
        }
        if !problems.isEmpty { throw SQLiteFileError.replaceFailed("sidecar not removed (\(problems.joined(separator: ", ")))") }
    }

    // MARK: Replacement

    /// Replaces `target` with `data` once `data` passes `validate`.
    ///
    /// Order (a safety rule): validate the candidate, `checkpoint`, read the old bytes while the connection is
    /// still open, `close`, remove the sidecars, write, `reopen`. A failure before the write leaves the file
    /// untouched; `reopen` runs after such a failure only if `close` already returned. A failure at the write or
    /// reopen restores the old bytes. Validation errors propagate unchanged; every other failure is
    /// `.replaceFailed`.
    ///
    /// The caller's closures must not clear its handle unless `sqlite3_close` returned `SQLITE_OK`, `close` must be
    /// safe to call when already closed, and `reopen` must either leave a fully configured open handle or close
    /// whatever it opened and throw. Run the checkpoint with `checkpointTruncate`.
    public static func replaceContents(
        of target: URL, with data: Data, requiredTables: Set<String>,
        checkpoint: () throws -> Void, close: () throws -> Void, reopen: () throws -> Void
    ) throws {
        let staging = FileManager.default.temporaryDirectory.appendingPathComponent("sqlitefile-\(UUID().uuidString).sqlite")
        defer {
            try? FileManager.default.removeItem(at: staging)
            for suffix in ["-wal", "-shm"] { try? FileManager.default.removeItem(atPath: staging.path + suffix) }
        }
        do { try data.write(to: staging, options: .atomic) } catch {
            throw SQLiteFileError.replaceFailed("staging: \(describe(error))")
        }
        try validate(at: staging, requiredTables: requiredTables, readOnly: false)

        do { try checkpoint() } catch { throw SQLiteFileError.replaceFailed("checkpoint: \(describe(error))") }
        let previous: Data
        do { previous = try Data(contentsOf: target) } catch {
            throw SQLiteFileError.replaceFailed("reading the current file: \(describe(error))")
        }
        do { try close() } catch { throw SQLiteFileError.replaceFailed("close: \(describe(error))") }

        // From here the connection is closed.
        do { try removeSidecars(of: target) } catch {
            let sidecar = describe(error)
            do { try reopen() } catch {
                throw SQLiteFileError.replaceFailed("\(sidecar); reopen failed: \(describe(error))")
            }
            throw SQLiteFileError.replaceFailed(sidecar)
        }

        let original: String
        do {
            do { try data.write(to: target, options: .atomic) } catch { throw SQLiteFileError.replaceFailed("write: \(describe(error))") }
            do { try reopen() } catch { throw SQLiteFileError.replaceFailed("reopen: \(describe(error))") }
            return
        } catch {
            original = describe(error)
        }

        // Recovery: put the old file back and reopen it, keeping every failure.
        var problems: [String] = []
        do { try close() } catch { problems.append("close: \(describe(error))") }
        do { try previous.write(to: target, options: .atomic) } catch { problems.append("restore: \(describe(error))") }
        do { try removeSidecars(of: target) } catch { problems.append(describe(error)) }
        do { try reopen() } catch { problems.append("reopen: \(describe(error))") }
        throw SQLiteFileError.replaceFailed(problems.isEmpty ? original : "\(original); recovery failed: \(problems.joined(separator: ", "))")
    }

    private static func describe(_ error: Error) -> String {
        if case let SQLiteFileError.replaceFailed(text) = error { return text }
        return error.localizedDescription
    }
}
