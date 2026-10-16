import Foundation
import SQLite3

public enum SQLiteSnapshotError: LocalizedError, Equatable {
    case openFailed(String)
    case backupFailed(String)

    public var errorDescription: String? {
        switch self {
        case let .openFailed(detail): "تعذر فتح قاعدة البيانات: \(detail)"
        case let .backupFailed(detail): "تعذر نسخ قاعدة البيانات: \(detail)"
        }
    }
}

public enum SQLiteSnapshot {
    /// Copies a database with SQLite's online backup API through a separate read connection, so the copy
    /// is consistent even while the app holds the source open in WAL mode. The copy is a single file
    /// (rollback-journal mode, no -wal/-shm) written beside the destination and then moved into place.
    public static func copy(from source: URL, to destination: URL) throws {
        // A write-ahead-log database cannot be opened read-only when its -shm file is not there (the app has
        // it closed), so the source is opened read-write without ever writing to it; read-only is the fallback.
        var sourceHandle: OpaquePointer?
        if sqlite3_open_v2(source.path, &sourceHandle, SQLITE_OPEN_READWRITE, nil) != SQLITE_OK {
            sqlite3_close(sourceHandle)
            sourceHandle = nil
            _ = sqlite3_open_v2(source.path, &sourceHandle, SQLITE_OPEN_READONLY, nil)
        }
        guard let sourceHandle, sqlite3_errcode(sourceHandle) == SQLITE_OK else {
            let detail = sourceHandle.map { String(cString: sqlite3_errmsg($0)) } ?? "no handle"
            sqlite3_close(sourceHandle)
            throw SQLiteSnapshotError.openFailed(detail)
        }
        defer { sqlite3_close(sourceHandle) }

        let directory = destination.deletingLastPathComponent()
        let partial = directory.appendingPathComponent(".\(destination.lastPathComponent).partial-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: partial) }

        // The destination handle has one owner: this variable. It is cleared only when `sqlite3_close`
        // succeeded, and the `defer` closes whatever is still open (close_v2 never double-frees).
        var destinationHandle: OpaquePointer?
        guard sqlite3_open_v2(partial.path, &destinationHandle, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nil) == SQLITE_OK,
              destinationHandle != nil else {
            let detail = destinationHandle.map { String(cString: sqlite3_errmsg($0)) } ?? "no handle"
            if let destinationHandle { sqlite3_close_v2(destinationHandle) }
            throw SQLiteSnapshotError.openFailed(detail)
        }
        defer {
            if let handle = destinationHandle { sqlite3_close_v2(handle) }
            for suffix in ["-wal", "-shm"] { try? FileManager.default.removeItem(atPath: partial.path + suffix) }
        }

        func closeDestination() throws {
            guard let handle = destinationHandle else { return }
            guard sqlite3_close(handle) == SQLITE_OK else {
                throw SQLiteSnapshotError.backupFailed("close: \(String(cString: sqlite3_errmsg(handle)))")
            }
            destinationHandle = nil
        }

        guard let backup = sqlite3_backup_init(destinationHandle, "main", sourceHandle, "main") else {
            throw SQLiteSnapshotError.backupFailed(String(cString: sqlite3_errmsg(destinationHandle)))
        }
        let stepResult = sqlite3_backup_step(backup, -1)
        let finishResult = sqlite3_backup_finish(backup)
        guard stepResult == SQLITE_DONE, finishResult == SQLITE_OK else {
            throw SQLiteSnapshotError.backupFailed("code \(stepResult)/\(finishResult)")
        }
        // Fold the copy into one self-contained file.
        guard sqlite3_exec(destinationHandle, "PRAGMA journal_mode = DELETE;", nil, nil, nil) == SQLITE_OK else {
            throw SQLiteSnapshotError.backupFailed("journal_mode: \(String(cString: sqlite3_errmsg(destinationHandle)))")
        }
        try closeDestination()

        if FileManager.default.fileExists(atPath: destination.path) {
            _ = try FileManager.default.replaceItemAt(destination, withItemAt: partial)
        } else {
            try FileManager.default.moveItem(at: partial, to: destination)
        }
    }

    /// True only when the file opens as a SQLite database and `PRAGMA integrity_check` answers "ok".
    public static func integrityCheck(at url: URL) -> Bool {
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let handle else {
            sqlite3_close(handle)
            return false
        }
        defer { sqlite3_close(handle) }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "PRAGMA integrity_check;", -1, &statement, nil) == SQLITE_OK, let statement else {
            return false
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW, let text = sqlite3_column_text(statement, 0) else { return false }
        return String(cString: text) == "ok"
    }
}
