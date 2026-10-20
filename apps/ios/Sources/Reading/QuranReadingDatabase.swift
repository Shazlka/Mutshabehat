import Foundation
import MushafCore
import SQLite3

public final class QuranReadingDatabase: @unchecked Sendable {
    public static let shared = QuranReadingDatabase(url: launchOverrideURL)

    /// UI tests pass `-reading-fresh` (DEBUG builds only) to read and write a throw-away database, so one
    /// test's reading progress never changes where another test's index jump lands.
    static var launchOverrideURL: URL? {
#if DEBUG
        guard ProcessInfo.processInfo.arguments.contains("-reading-fresh") else { return nil }
        return FileManager.default.temporaryDirectory.appendingPathComponent("reading-ui-\(UUID().uuidString).sqlite")
#else
        return nil
#endif
    }

    var db: OpaquePointer?
    let lock = NSLock()
    let databaseURL: URL

    nonisolated(unsafe) static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar.current
        f.timeZone = TimeZone.current
        return f
    }()

    public init(url: URL? = nil) {
        let targetURL: URL
        if let url = url {
            targetURL = url
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
            targetURL = appSupport.appendingPathComponent("mushaf_reading.sqlite")
        }
        self.databaseURL = targetURL

        if sqlite3_open(targetURL.path, &db) != SQLITE_OK {
            db = nil
        } else {
            setupTables()
        }
    }

    deinit {
        if let db = db {
            sqlite3_close(db)
        }
    }

    /// The SQLite file this database is stored in (used by backups to take a consistent snapshot).
    public var fileURL: URL { databaseURL }

    // MARK: - Backup transfer

    public enum TransferError: LocalizedError {
        case databaseUnavailable
        case invalidDatabase
        case mergeFailed(String)

        public var errorDescription: String? {
            switch self {
            case .databaseUnavailable: "تعذر فتح قاعدة بيانات القراءة"
            case .invalidDatabase: "الملف ليس نسخة صالحة من بيانات القراءة"
            case let .mergeFailed(detail): "فشل دمج بيانات القراءة: \(detail)"
            }
        }
    }

    /// The whole database as one self-contained file's bytes: a consistent snapshot (SQLite's online backup
    /// API) in rollback-journal mode, so it opens anywhere without its write-ahead log.
    public func exportDatabase() throws -> Data {
        lock.lock()
        defer { lock.unlock() }
        guard db != nil else { throw TransferError.databaseUnavailable }
        let snapshot = FileManager.default.temporaryDirectory.appendingPathComponent("reading-export-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: snapshot) }
        do {
            try SQLiteSnapshot.copy(from: databaseURL, to: snapshot)
            return try Data(contentsOf: snapshot)
        } catch {
            throw TransferError.databaseUnavailable
        }
    }

    /// Replaces the whole database with `data` after checking that it holds the reading tables. If anything
    /// fails after the swap starts, the previous contents are restored (see `SQLiteFile.replaceContents`).
    public func importDatabase(_ data: Data) throws {
        lock.lock()
        defer { lock.unlock() }
        do {
            try SQLiteFile.replaceContents(
                of: databaseURL, with: data, requiredTables: Self.requiredTables,
                // With no open connection (it failed to open) there is nothing to fold in, as before.
                checkpoint: { if let db { try SQLiteFile.checkpointTruncate(db, busyTimeoutMs: 2000) } },
                close: { try closeConnection() },
                reopen: { try reopenDatabase() })
        } catch let error as SQLiteFileError {
            switch error {
            case .unreadable, .missingTables, .integrity: throw TransferError.invalidDatabase
            case .replaceFailed: throw TransferError.databaseUnavailable
            }
        }
    }

    static let requiredTables: Set<String> = ["bookmarks", "khatmas", "khatma_read_ayahs", "reading_days", "reading_metadata"]

    /// Closes the connection and clears `db` only if SQLite agreed to close it.
    func closeConnection() throws {
        guard let handle = db else { return }
        guard sqlite3_close(handle) == SQLITE_OK else { throw TransferError.databaseUnavailable }
        db = nil
    }

    /// Opens the file and runs the strict schema setup; on any failure nothing stays open.
    func reopenDatabase() throws {
        var handle: OpaquePointer?
        guard sqlite3_open(databaseURL.path, &handle) == SQLITE_OK, let opened = handle else {
            if let handle { sqlite3_close_v2(handle) }
            db = nil
            throw TransferError.databaseUnavailable
        }
        db = opened
        do {
            try setupTablesStrict()
        } catch {
            sqlite3_close_v2(opened)
            db = nil
            throw TransferError.databaseUnavailable
        }
    }

    /// The tables and indexes (no PRAGMAs). Kept as one batch: `sqlite3_exec` stops a batch at its first error.
    static let schemaSQL = """

        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            page INTEGER NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(type, surah, ayah, page)
        );

        CREATE TABLE IF NOT EXISTS khatmas (
            id TEXT PRIMARY KEY,
            khatma_number INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            status TEXT NOT NULL,
            percent_complete REAL NOT NULL DEFAULT 0.0
        );

        CREATE TABLE IF NOT EXISTS khatma_read_ayahs (
            khatma_id TEXT NOT NULL,
            surah INTEGER NOT NULL,
            ayah INTEGER NOT NULL,
            page INTEGER NOT NULL,
            read_at TEXT NOT NULL,
            PRIMARY KEY (khatma_id, surah, ayah),
            FOREIGN KEY (khatma_id) REFERENCES khatmas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reading_days (
            date_string TEXT PRIMARY KEY,
            ayahs_read INTEGER NOT NULL DEFAULT 0,
            pages_read INTEGER NOT NULL DEFAULT 0,
            seconds_read INTEGER NOT NULL DEFAULT 0,
            last_read_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_days_legacy (
            date_string TEXT PRIMARY KEY, ayahs_read INTEGER NOT NULL,
            pages_read INTEGER NOT NULL, seconds_read INTEGER NOT NULL, last_read_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reading_activity_events (
            id TEXT PRIMARY KEY, date_string TEXT NOT NULL, ayahs_read INTEGER NOT NULL,
            pages_read INTEGER NOT NULL, seconds_read INTEGER NOT NULL, recorded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_deletions (
            kind TEXT NOT NULL, khatma_number INTEGER NOT NULL DEFAULT 0,
            surah INTEGER NOT NULL, ayah INTEGER NOT NULL DEFAULT 0,
            page INTEGER NOT NULL DEFAULT 0, deleted_at TEXT NOT NULL,
            PRIMARY KEY(kind, khatma_number, surah, ayah, page)
        );

        CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(type);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_page ON bookmarks(page);
        CREATE INDEX IF NOT EXISTS idx_khatma_surah ON khatma_read_ayahs(khatma_id, surah);
        CREATE INDEX IF NOT EXISTS idx_khatma_page ON khatma_read_ayahs(khatma_id, page);
        """

    static let legacyMigrationSQL = """
            INSERT INTO reading_days_legacy(date_string, ayahs_read, pages_read, seconds_read, last_read_at)
            SELECT date_string, ayahs_read, pages_read, seconds_read, last_read_at FROM reading_days
            WHERE NOT EXISTS (SELECT 1 FROM reading_metadata WHERE key = 'reading_events_migrated');
            INSERT OR IGNORE INTO reading_metadata(key, value) VALUES ('reading_events_migrated', '1');
            """

    /// Best effort, used by `init`: errors are ignored, exactly as before.
    func setupTables() {
        execute("PRAGMA journal_mode = WAL;\nPRAGMA foreign_keys = ON;\n" + Self.schemaSQL)

        // Safely migrate existing databases that might not have seconds_read column yet
        if let db, !tableHasColumn(db, table: "reading_days", column: "seconds_read") {
            execute("ALTER TABLE reading_days ADD COLUMN seconds_read INTEGER NOT NULL DEFAULT 0;")
        }
        execute(Self.legacyMigrationSQL)
    }

    /// The same setup, but every step is checked; used when an import reopens the database.
    func setupTablesStrict() throws {
        guard let db else { throw TransferError.databaseUnavailable }
        do { try SQLiteFile.enableWALAndForeignKeys(db) } catch { throw TransferError.databaseUnavailable }
        try checkedExec(db, Self.schemaSQL)
        if !tableHasColumn(db, table: "reading_days", column: "seconds_read") {
            try checkedExec(db, "ALTER TABLE reading_days ADD COLUMN seconds_read INTEGER NOT NULL DEFAULT 0;")
        }
        try checkedExec(db, Self.legacyMigrationSQL)
    }

    func execute(_ sql: String) {
        guard let db = db else { return }
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    func checkedExec(_ db: OpaquePointer, _ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else {
            throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    func sourceHasTable(_ db: OpaquePointer, _ name: String) throws -> Bool {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT 1 FROM source_db.sqlite_master WHERE type='table' AND name=?", -1, &statement, nil) == SQLITE_OK else {
            throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }
        SQLiteBind.text(statement, 1, name)
        return sqlite3_step(statement) == SQLITE_ROW
    }

    func tableHasColumn(_ db: OpaquePointer, table: String, column: String,
                                schema: String = "main") -> Bool {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "PRAGMA \(schema).table_info(\(table))", -1, &statement, nil) == SQLITE_OK else {
            return false
        }
        defer { sqlite3_finalize(statement) }
        while sqlite3_step(statement) == SQLITE_ROW {
            if let name = sqlite3_column_text(statement, 1), String(cString: name) == column { return true }
        }
        return false
    }

    func recordDeletion(_ db: OpaquePointer, kind: String, khatmaNumber: Int = 0,
                                surah: Int, ayah: Int = 0, page: Int = 0) -> Bool {
        let sql = """
            INSERT INTO reading_deletions(kind, khatma_number, surah, ayah, page, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(kind, khatma_number, surah, ayah, page) DO UPDATE SET deleted_at = MAX(deleted_at, excluded.deleted_at);
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return false }
        defer { sqlite3_finalize(statement) }
        SQLiteBind.text(statement, 1, kind)
        sqlite3_bind_int64(statement, 2, Int64(khatmaNumber))
        sqlite3_bind_int64(statement, 3, Int64(surah))
        sqlite3_bind_int64(statement, 4, Int64(ayah))
        sqlite3_bind_int64(statement, 5, Int64(page))
        let time = Self.isoFormatter.string(from: Date())
        SQLiteBind.text(statement, 6, time)
        return sqlite3_step(statement) == SQLITE_DONE
    }

    func deleteWithTombstone(_ db: OpaquePointer, kind: String, khatmaNumber: Int = 0,
                                     surah: Int, ayah: Int = 0, page: Int = 0,
                                     sql: String, bind: (OpaquePointer?) -> Void) {
        guard sqlite3_exec(db, "BEGIN IMMEDIATE TRANSACTION;", nil, nil, nil) == SQLITE_OK else { return }
        var committed = false
        defer { if !committed { sqlite3_exec(db, "ROLLBACK;", nil, nil, nil) } }
        guard recordDeletion(db, kind: kind, khatmaNumber: khatmaNumber,
                             surah: surah, ayah: ayah, page: page) else { return }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
        bind(statement)
        let deleted = sqlite3_step(statement) == SQLITE_DONE
        sqlite3_finalize(statement)
        guard deleted, sqlite3_exec(db, "COMMIT;", nil, nil, nil) == SQLITE_OK else { return }
        committed = true
    }

    public func resetForTesting() {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        sqlite3_exec(db, "DELETE FROM khatma_read_ayahs; DELETE FROM khatmas; DELETE FROM reading_days; DELETE FROM reading_metadata; DELETE FROM bookmarks;", nil, nil, nil)
    }
}
