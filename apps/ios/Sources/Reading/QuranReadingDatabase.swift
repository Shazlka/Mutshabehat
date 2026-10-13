import Foundation
import MushafCore
import SQLite3

public final class QuranReadingDatabase: @unchecked Sendable {
    public static let shared = QuranReadingDatabase(url: launchOverrideURL)

    /// UI tests pass `-reading-fresh` (DEBUG builds only) to read and write a throw-away database, so one
    /// test's reading progress never changes where another test's index jump lands.
    private static var launchOverrideURL: URL? {
#if DEBUG
        guard ProcessInfo.processInfo.arguments.contains("-reading-fresh") else { return nil }
        return FileManager.default.temporaryDirectory.appendingPathComponent("reading-ui-\(UUID().uuidString).sqlite")
#else
        return nil
#endif
    }

    private var db: OpaquePointer?
    private let lock = NSLock()
    private let databaseURL: URL

    nonisolated(unsafe) private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let dayFormatter: DateFormatter = {
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
        try SQLiteSnapshot.copy(from: databaseURL, to: snapshot)
        return try Data(contentsOf: snapshot)
    }

    /// Replaces the whole database with `data` after checking that it holds the reading tables. If anything
    /// fails after the swap starts, the previous contents are restored.
    public func importDatabase(_ data: Data) throws {
        let stagingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("reading-import-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: stagingURL) }
        try data.write(to: stagingURL, options: .atomic)
        try Self.validateDatabase(at: stagingURL)

        lock.lock()
        defer { lock.unlock() }
        execute("PRAGMA wal_checkpoint(TRUNCATE);")
        let previous = try Data(contentsOf: databaseURL)
        if let db {
            sqlite3_close(db)
            self.db = nil
        }
        for suffix in ["-wal", "-shm"] { try? FileManager.default.removeItem(atPath: databaseURL.path + suffix) }

        do {
            try data.write(to: databaseURL, options: .atomic)
            guard sqlite3_open(databaseURL.path, &db) == SQLITE_OK else {
                db = nil
                throw TransferError.databaseUnavailable
            }
            setupTables()
        } catch {
            if let db { sqlite3_close(db) }
            db = nil
            try? previous.write(to: databaseURL, options: .atomic)
            if sqlite3_open(databaseURL.path, &db) == SQLITE_OK { setupTables() } else { db = nil }
            throw error
        }
    }

    /// Merges reading data (bookmarks, reading days, khatmas, read ayahs) from another database snapshot.
    /// This is an additive, union-based merge:
    /// - Khatmas with matching numbers are unified: if marked completed in either, it is completed.
    /// - Read ayahs from both databases are unioned.
    /// - Reading days take the maximum counts/seconds per date.
    /// - Bookmarks are unioned by (type, surah, ayah, page).
    @discardableResult
    public func mergeDatabase(from sourceURL: URL) throws -> (khatmasMerged: Int, ayahsMerged: Int, daysMerged: Int) {
        try Self.validateDatabase(at: sourceURL)

        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { throw TransferError.databaseUnavailable }

        let escapedPath = sourceURL.path.replacingOccurrences(of: "'", with: "''")
        let attachSQL = "ATTACH DATABASE '\(escapedPath)' AS source_db;"
        guard sqlite3_exec(db, attachSQL, nil, nil, nil) == SQLITE_OK else {
            throw TransferError.invalidDatabase
        }
        defer {
            sqlite3_exec(db, "DETACH DATABASE source_db;", nil, nil, nil)
        }

        try checkedExec(db, "BEGIN IMMEDIATE TRANSACTION;")
        var committed = false
        defer { if !committed { sqlite3_exec(db, "ROLLBACK;", nil, nil, nil) } }

        // 1. Merge Bookmarks
        let bookmarksSQL = """
        INSERT INTO bookmarks (id, type, surah, ayah, page, note, created_at)
        SELECT id, type, surah, ayah, page, note, created_at FROM source_db.bookmarks WHERE 1
        ON CONFLICT(type, surah, ayah, page) DO UPDATE SET
            note = CASE WHEN excluded.created_at > bookmarks.created_at THEN excluded.note ELSE bookmarks.note END,
            created_at = MAX(bookmarks.created_at, excluded.created_at);
        """
        try checkedExec(db, bookmarksSQL)

        // 2. Merge legacy totals once and identified sessions additively.
        try mergeDailyActivity(db)

        // 3. Merge Khatmas
        var khatmasMerged = 0
        var ayahsMerged = 0

        struct TempKhatma {
            let id: String
            let number: Int
            let startedAt: String
            let completedAt: String?
            let status: String
            let percent: Double
        }

        var sourceKhatmas: [TempKhatma] = []
        let selectKhatmasSQL = "SELECT id, khatma_number, started_at, completed_at, status, percent_complete FROM source_db.khatmas ORDER BY khatma_number ASC;"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, selectKhatmasSQL, -1, &stmt, nil) == SQLITE_OK else {
            throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
        }
        var sourceStep = sqlite3_step(stmt)
        while sourceStep == SQLITE_ROW {
            let id = String(cString: sqlite3_column_text(stmt, 0))
            let num = Int(sqlite3_column_int64(stmt, 1))
            let started = String(cString: sqlite3_column_text(stmt, 2))
            var completed: String? = nil
            if sqlite3_column_type(stmt, 3) != SQLITE_NULL, let text = sqlite3_column_text(stmt, 3) {
                completed = String(cString: text)
            }
            let status = String(cString: sqlite3_column_text(stmt, 4))
            let pct = sqlite3_column_double(stmt, 5)
            sourceKhatmas.append(TempKhatma(id: id, number: num, startedAt: started, completedAt: completed, status: status, percent: pct))
            sourceStep = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)
        guard sourceStep == SQLITE_DONE else { throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db))) }

        for srcKhatma in sourceKhatmas {
            // Check if local has a khatma with matching number
            var localKhatmaId: String? = nil
            var localCompletedAt: String? = nil

            let findLocalSQL = "SELECT id, status, completed_at FROM khatmas WHERE khatma_number = ? LIMIT 1;"
            var findStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, findLocalSQL, -1, &findStmt, nil) == SQLITE_OK else {
                throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
            }
            sqlite3_bind_int64(findStmt, 1, Int64(srcKhatma.number))
            if sqlite3_step(findStmt) == SQLITE_ROW {
                localKhatmaId = String(cString: sqlite3_column_text(findStmt, 0))
                if sqlite3_column_type(findStmt, 2) != SQLITE_NULL, let text = sqlite3_column_text(findStmt, 2) {
                    localCompletedAt = String(cString: text)
                }
            }
            sqlite3_finalize(findStmt)

            let targetId: String
            if let existingId = localKhatmaId {
                targetId = existingId
                // If source is completed, mark local as completed too
                if srcKhatma.status == "completed" {
                    let completedDateStr = srcKhatma.completedAt ?? localCompletedAt ?? Self.isoFormatter.string(from: Date())
                    let updateSQL = "UPDATE khatmas SET status = 'completed', completed_at = ?, percent_complete = 100.0 WHERE id = ?;"
                    var updStmt: OpaquePointer?
                    guard sqlite3_prepare_v2(db, updateSQL, -1, &updStmt, nil) == SQLITE_OK else {
                        throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
                    }
                    sqlite3_bind_text(updStmt, 1, (completedDateStr as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(updStmt, 2, (existingId as NSString).utf8String, -1, nil)
                    guard sqlite3_step(updStmt) == SQLITE_DONE else { sqlite3_finalize(updStmt); throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db))) }
                    sqlite3_finalize(updStmt)
                }
            } else {
                targetId = srcKhatma.id
                let insertKhatmaSQL = """
                INSERT INTO khatmas (id, khatma_number, started_at, completed_at, status, percent_complete)
                VALUES (?, ?, ?, ?, ?, ?);
                """
                var insStmt: OpaquePointer?
                guard sqlite3_prepare_v2(db, insertKhatmaSQL, -1, &insStmt, nil) == SQLITE_OK else {
                    throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
                }
                sqlite3_bind_text(insStmt, 1, (srcKhatma.id as NSString).utf8String, -1, nil)
                sqlite3_bind_int64(insStmt, 2, Int64(srcKhatma.number))
                sqlite3_bind_text(insStmt, 3, (srcKhatma.startedAt as NSString).utf8String, -1, nil)
                if let comp = srcKhatma.completedAt {
                    sqlite3_bind_text(insStmt, 4, (comp as NSString).utf8String, -1, nil)
                } else {
                    sqlite3_bind_null(insStmt, 4)
                }
                sqlite3_bind_text(insStmt, 5, (srcKhatma.status as NSString).utf8String, -1, nil)
                sqlite3_bind_double(insStmt, 6, srcKhatma.percent)
                guard sqlite3_step(insStmt) == SQLITE_DONE else { sqlite3_finalize(insStmt); throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db))) }
                sqlite3_finalize(insStmt)
                khatmasMerged += 1
            }

            // Union read ayahs from source khatma into local khatma
            let copyAyahsSQL = """
            INSERT INTO khatma_read_ayahs (khatma_id, surah, ayah, page, read_at)
            SELECT ?, surah, ayah, page, read_at FROM source_db.khatma_read_ayahs WHERE khatma_id = ?
            ON CONFLICT(khatma_id, surah, ayah) DO UPDATE SET
                page = CASE WHEN excluded.read_at > khatma_read_ayahs.read_at THEN excluded.page ELSE khatma_read_ayahs.page END,
                read_at = MAX(khatma_read_ayahs.read_at, excluded.read_at);
            """
            var copyStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, copyAyahsSQL, -1, &copyStmt, nil) == SQLITE_OK else {
                throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
            }
            sqlite3_bind_text(copyStmt, 1, (targetId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(copyStmt, 2, (srcKhatma.id as NSString).utf8String, -1, nil)
            guard sqlite3_step(copyStmt) == SQLITE_DONE else { sqlite3_finalize(copyStmt); throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db))) }
            ayahsMerged += Int(sqlite3_changes(db))
            sqlite3_finalize(copyStmt)
        }

        // 4. Ensure an active Khatma exists locally
        var activeCount = 0
        var activeCountStmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM khatmas WHERE status = 'active';", -1, &activeCountStmt, nil) == SQLITE_OK else {
            throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
        }
        if sqlite3_step(activeCountStmt) == SQLITE_ROW {
            activeCount = Int(sqlite3_column_int64(activeCountStmt, 0))
        }
        sqlite3_finalize(activeCountStmt)

        if activeCount == 0 {
            // Create next active khatma
            var maxKhatmaNum = 0
            var maxStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, "SELECT COALESCE(MAX(khatma_number), 0) FROM khatmas;", -1, &maxStmt, nil) == SQLITE_OK else {
                throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
            }
            if sqlite3_step(maxStmt) == SQLITE_ROW {
                maxKhatmaNum = Int(sqlite3_column_int64(maxStmt, 0))
            }
            sqlite3_finalize(maxStmt)

            let nextNum = maxKhatmaNum + 1
            let newId = UUID().uuidString
            let nowStr = Self.isoFormatter.string(from: Date())
            let insActiveSQL = "INSERT INTO khatmas (id, khatma_number, started_at, status, percent_complete) VALUES (?, ?, ?, 'active', 0.0);"
            var insActiveStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, insActiveSQL, -1, &insActiveStmt, nil) == SQLITE_OK else {
                throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
            }
            sqlite3_bind_text(insActiveStmt, 1, (newId as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(insActiveStmt, 2, Int64(nextNum))
            sqlite3_bind_text(insActiveStmt, 3, (nowStr as NSString).utf8String, -1, nil)
            guard sqlite3_step(insActiveStmt) == SQLITE_DONE else { sqlite3_finalize(insActiveStmt); throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db))) }
            sqlite3_finalize(insActiveStmt)
        }

        // 5. Update completed_khatmas in reading_metadata
        let updateMetaSQL = """
        INSERT INTO reading_metadata (key, value)
        VALUES ('completed_khatmas', (SELECT CAST(COUNT(*) AS TEXT) FROM khatmas WHERE status = 'completed'))
        ON CONFLICT(key) DO UPDATE SET value = (SELECT CAST(COUNT(*) AS TEXT) FROM khatmas WHERE status = 'completed');
        """
        try checkedExec(db, updateMetaSQL)
        try mergeDeletionTombstones(db)
        try checkedExec(db, "COMMIT;")
        committed = true

        return (khatmasMerged: khatmasMerged, ayahsMerged: ayahsMerged, daysMerged: sourceKhatmas.count)
    }

    @discardableResult
    public func mergeDatabase(_ data: Data) throws -> (khatmasMerged: Int, ayahsMerged: Int, daysMerged: Int) {
        let stagingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("reading-merge-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: stagingURL) }
        try data.write(to: stagingURL, options: .atomic)
        return try mergeDatabase(from: stagingURL)
    }

    private static func validateDatabase(at url: URL) throws {
        var candidate: OpaquePointer?
        guard sqlite3_open_v2(url.path, &candidate, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let candidate else {
            if let candidate { sqlite3_close(candidate) }
            throw TransferError.invalidDatabase
        }
        defer { sqlite3_close(candidate) }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(candidate, "SELECT name FROM sqlite_master WHERE type='table'", -1, &statement, nil) == SQLITE_OK,
              let statement else { throw TransferError.invalidDatabase }
        defer { sqlite3_finalize(statement) }
        var found = Set<String>()
        while sqlite3_step(statement) == SQLITE_ROW, let text = sqlite3_column_text(statement, 0) {
            found.insert(String(cString: text))
        }
        let required: Set<String> = ["bookmarks", "khatmas", "khatma_read_ayahs", "reading_days", "reading_metadata"]
        guard required.isSubset(of: found) else { throw TransferError.invalidDatabase }
        var integrity: OpaquePointer?
        guard sqlite3_prepare_v2(candidate, "PRAGMA quick_check", -1, &integrity, nil) == SQLITE_OK,
              let integrity else { throw TransferError.invalidDatabase }
        defer { sqlite3_finalize(integrity) }
        guard sqlite3_step(integrity) == SQLITE_ROW,
              let result = sqlite3_column_text(integrity, 0),
              String(cString: result) == "ok" else { throw TransferError.invalidDatabase }
    }

    private func setupTables() {
        execute("""
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

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
        """)

        // Safely migrate existing databases that might not have seconds_read column yet
        if let db, !tableHasColumn(db, table: "reading_days", column: "seconds_read") {
            execute("ALTER TABLE reading_days ADD COLUMN seconds_read INTEGER NOT NULL DEFAULT 0;")
        }
        execute("""
            INSERT INTO reading_days_legacy(date_string, ayahs_read, pages_read, seconds_read, last_read_at)
            SELECT date_string, ayahs_read, pages_read, seconds_read, last_read_at FROM reading_days
            WHERE NOT EXISTS (SELECT 1 FROM reading_metadata WHERE key = 'reading_events_migrated');
            INSERT OR IGNORE INTO reading_metadata(key, value) VALUES ('reading_events_migrated', '1');
            """)
    }

    private func execute(_ sql: String) {
        guard let db = db else { return }
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    private func checkedExec(_ db: OpaquePointer, _ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else {
            throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    private func sourceHasTable(_ db: OpaquePointer, _ name: String) throws -> Bool {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT 1 FROM source_db.sqlite_master WHERE type='table' AND name=?", -1, &statement, nil) == SQLITE_OK else {
            throw TransferError.mergeFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, (name as NSString).utf8String, -1, nil)
        return sqlite3_step(statement) == SQLITE_ROW
    }

    private func tableHasColumn(_ db: OpaquePointer, table: String, column: String,
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

    private func mergeDailyActivity(_ db: OpaquePointer) throws {
        let hasLegacy = try sourceHasTable(db, "reading_days_legacy")
        let source = hasLegacy ? "source_db.reading_days_legacy" : "source_db.reading_days"
        let seconds = hasLegacy || tableHasColumn(db, table: "reading_days", column: "seconds_read", schema: "source_db")
            ? "seconds_read" : "0"
        try checkedExec(db, """
            INSERT INTO reading_days_legacy(date_string, ayahs_read, pages_read, seconds_read, last_read_at)
            SELECT date_string, ayahs_read, pages_read, \(seconds), last_read_at FROM \(source) WHERE 1
            ON CONFLICT(date_string) DO UPDATE SET
                ayahs_read = MAX(reading_days_legacy.ayahs_read, excluded.ayahs_read),
                pages_read = MAX(reading_days_legacy.pages_read, excluded.pages_read),
                seconds_read = MAX(reading_days_legacy.seconds_read, excluded.seconds_read),
                last_read_at = MAX(reading_days_legacy.last_read_at, excluded.last_read_at);
            """)
        if try sourceHasTable(db, "reading_activity_events") {
            try checkedExec(db, """
                INSERT OR IGNORE INTO reading_activity_events(id, date_string, ayahs_read, pages_read, seconds_read, recorded_at)
                SELECT id, date_string, ayahs_read, pages_read, seconds_read, recorded_at
                FROM source_db.reading_activity_events;
                """)
        }
        try checkedExec(db, """
            DELETE FROM reading_days;
            INSERT INTO reading_days(date_string, ayahs_read, pages_read, seconds_read, last_read_at)
            SELECT dates.date_string,
                COALESCE(legacy.ayahs_read, 0) + COALESCE((SELECT SUM(ayahs_read) FROM reading_activity_events e WHERE e.date_string = dates.date_string), 0),
                COALESCE(legacy.pages_read, 0) + COALESCE((SELECT SUM(pages_read) FROM reading_activity_events e WHERE e.date_string = dates.date_string), 0),
                COALESCE(legacy.seconds_read, 0) + COALESCE((SELECT SUM(seconds_read) FROM reading_activity_events e WHERE e.date_string = dates.date_string), 0),
                MAX(COALESCE(legacy.last_read_at, ''), COALESCE((SELECT MAX(recorded_at) FROM reading_activity_events e WHERE e.date_string = dates.date_string), ''))
            FROM (SELECT date_string FROM reading_days_legacy UNION SELECT date_string FROM reading_activity_events) dates
            LEFT JOIN reading_days_legacy legacy ON legacy.date_string = dates.date_string;
            """)
    }

    private func mergeDeletionTombstones(_ db: OpaquePointer) throws {
        let hasSourceDeletions = try sourceHasTable(db, "reading_deletions")
        if hasSourceDeletions {
            try checkedExec(db, """
                INSERT INTO reading_deletions(kind, khatma_number, surah, ayah, page, deleted_at)
                SELECT kind, khatma_number, surah, ayah, page, deleted_at FROM source_db.reading_deletions WHERE 1
                ON CONFLICT(kind, khatma_number, surah, ayah, page) DO UPDATE SET
                    deleted_at = MAX(reading_deletions.deleted_at, excluded.deleted_at);
                """)
        }
        try checkedExec(db, """
            DELETE FROM bookmarks WHERE EXISTS (
                SELECT 1 FROM reading_deletions d WHERE d.kind = 'bookmark:' || bookmarks.type
                AND d.surah = bookmarks.surah AND d.ayah = bookmarks.ayah AND d.page = bookmarks.page
                AND d.deleted_at >= bookmarks.created_at
            );
            DELETE FROM khatma_read_ayahs WHERE EXISTS (
                SELECT 1 FROM reading_deletions d JOIN khatmas k ON k.khatma_number = d.khatma_number
                WHERE d.kind = 'surah' AND k.id = khatma_read_ayahs.khatma_id
                AND d.surah = khatma_read_ayahs.surah AND d.deleted_at >= khatma_read_ayahs.read_at
            );
            """)
    }

    private func recordDeletion(_ db: OpaquePointer, kind: String, khatmaNumber: Int = 0,
                                surah: Int, ayah: Int = 0, page: Int = 0) -> Bool {
        let sql = """
            INSERT INTO reading_deletions(kind, khatma_number, surah, ayah, page, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(kind, khatma_number, surah, ayah, page) DO UPDATE SET deleted_at = MAX(deleted_at, excluded.deleted_at);
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return false }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, (kind as NSString).utf8String, -1, nil)
        sqlite3_bind_int64(statement, 2, Int64(khatmaNumber))
        sqlite3_bind_int64(statement, 3, Int64(surah))
        sqlite3_bind_int64(statement, 4, Int64(ayah))
        sqlite3_bind_int64(statement, 5, Int64(page))
        let time = Self.isoFormatter.string(from: Date())
        sqlite3_bind_text(statement, 6, (time as NSString).utf8String, -1, nil)
        return sqlite3_step(statement) == SQLITE_DONE
    }

    private func deleteWithTombstone(_ db: OpaquePointer, kind: String, khatmaNumber: Int = 0,
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

    // MARK: - Bookmarks

    @discardableResult
    public func addBookmark(
        type: BookmarkType,
        surah: Int,
        ayah: Int,
        page: Int,
        note: String? = nil,
        createdAt: Date = Date()
    ) -> QuranBookmark? {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return nil }

        let id = UUID().uuidString
        let dateStr = Self.isoFormatter.string(from: createdAt)
        let sql = """
        INSERT INTO bookmarks (id, type, surah, ayah, page, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(type, surah, ayah, page) DO UPDATE SET
            note = excluded.note,
            created_at = excluded.created_at;
        """
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (type.rawValue as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 3, Int64(surah))
            sqlite3_bind_int64(stmt, 4, Int64(ayah))
            sqlite3_bind_int64(stmt, 5, Int64(page))
            if let note = note {
                sqlite3_bind_text(stmt, 6, (note as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_null(stmt, 6)
            }
            sqlite3_bind_text(stmt, 7, (dateStr as NSString).utf8String, -1, nil)
            _ = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)

        return QuranBookmark(id: id, type: type, surah: surah, ayah: ayah, page: page, note: note, createdAt: createdAt)
    }

    public func removeBookmark(type: BookmarkType, surah: Int, ayah: Int, page: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        let sql = "DELETE FROM bookmarks WHERE type = ? AND surah = ? AND ayah = ? AND page = ?;"
        deleteWithTombstone(db, kind: "bookmark:\(type.rawValue)", surah: surah, ayah: ayah, page: page, sql: sql) { stmt in
            sqlite3_bind_text(stmt, 1, (type.rawValue as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
            sqlite3_bind_int64(stmt, 3, Int64(ayah))
            sqlite3_bind_int64(stmt, 4, Int64(page))
        }
    }

    public func removeBookmark(id: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        var deletion: (kind: String, surah: Int, ayah: Int, page: Int)?
        var lookup: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT type, surah, ayah, page FROM bookmarks WHERE id = ?", -1, &lookup, nil) == SQLITE_OK {
            sqlite3_bind_text(lookup, 1, (id as NSString).utf8String, -1, nil)
            if sqlite3_step(lookup) == SQLITE_ROW, let typeText = sqlite3_column_text(lookup, 0) {
                deletion = ("bookmark:\(String(cString: typeText))",
                            Int(sqlite3_column_int64(lookup, 1)),
                            Int(sqlite3_column_int64(lookup, 2)),
                            Int(sqlite3_column_int64(lookup, 3)))
            }
        }
        sqlite3_finalize(lookup)

        guard let deletion else { return }
        deleteWithTombstone(db, kind: deletion.kind, surah: deletion.surah,
                            ayah: deletion.ayah, page: deletion.page,
                            sql: "DELETE FROM bookmarks WHERE id = ?;") { stmt in
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
        }
    }

    public func isAyahBookmarked(surah: Int, ayah: Int) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return false }

        let sql = "SELECT 1 FROM bookmarks WHERE type = 'ayah' AND surah = ? AND ayah = ? LIMIT 1;"
        var stmt: OpaquePointer?
        var found = false
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(stmt, 1, Int64(surah))
            sqlite3_bind_int64(stmt, 2, Int64(ayah))
            if sqlite3_step(stmt) == SQLITE_ROW {
                found = true
            }
        }
        sqlite3_finalize(stmt)
        return found
    }

    public func isPageBookmarked(page: Int) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return false }

        let sql = "SELECT 1 FROM bookmarks WHERE type = 'page' AND page = ? LIMIT 1;"
        var stmt: OpaquePointer?
        var found = false
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(stmt, 1, Int64(page))
            if sqlite3_step(stmt) == SQLITE_ROW {
                found = true
            }
        }
        sqlite3_finalize(stmt)
        return found
    }

    public func bookmarkedAyahs(on page: Int) -> Set<AyahKey> {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        let sql = "SELECT surah, ayah FROM bookmarks WHERE type = 'ayah' AND page = ?;"
        var stmt: OpaquePointer?
        var results = Set<AyahKey>()
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(stmt, 1, Int64(page))
            while sqlite3_step(stmt) == SQLITE_ROW {
                let surah = Int(sqlite3_column_int64(stmt, 0))
                let ayah = Int(sqlite3_column_int64(stmt, 1))
                results.insert(AyahKey(surah: surah, ayah: ayah))
            }
        }
        sqlite3_finalize(stmt)
        return results
    }

    public func allBookmarks(type: BookmarkType? = nil, query: String? = nil) -> [QuranBookmark] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        var sql = "SELECT id, type, surah, ayah, page, note, created_at FROM bookmarks WHERE 1=1"
        if let type = type {
            sql += " AND type = '\(type.rawValue)'"
        }
        if let query = query, !query.trimmingCharacters(in: .whitespaces).isEmpty {
            sql += " AND (note LIKE ? OR surah = ? OR page = ?)"
        }
        sql += " ORDER BY created_at DESC;"

        var stmt: OpaquePointer?
        var results: [QuranBookmark] = []
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if let query = query, !query.trimmingCharacters(in: .whitespaces).isEmpty {
                let pattern = "%\(query)%"
                sqlite3_bind_text(stmt, 1, (pattern as NSString).utf8String, -1, nil)
                let num = Int(query) ?? -1
                sqlite3_bind_int64(stmt, 2, Int64(num))
                sqlite3_bind_int64(stmt, 3, Int64(num))
            }

            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let typeStr = String(cString: sqlite3_column_text(stmt, 1))
                let bType = BookmarkType(rawValue: typeStr) ?? .ayah
                let surah = Int(sqlite3_column_int64(stmt, 2))
                let ayah = Int(sqlite3_column_int64(stmt, 3))
                let page = Int(sqlite3_column_int64(stmt, 4))
                var note: String? = nil
                if let notePtr = sqlite3_column_text(stmt, 5) {
                    note = String(cString: notePtr)
                }
                let dateStr = String(cString: sqlite3_column_text(stmt, 6))
                let date = Self.isoFormatter.date(from: dateStr) ?? Date()

                results.append(QuranBookmark(
                    id: id,
                    type: bType,
                    surah: surah,
                    ayah: ayah,
                    page: page,
                    note: note,
                    createdAt: date
                ))
            }
        }
        sqlite3_finalize(stmt)
        return results
    }

    // MARK: - Khatma Progress

    public func getOrCreateActiveKhatma() -> KhatmaRecord {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else {
            return KhatmaRecord(khatmaNumber: 1)
        }

        let sql = "SELECT id, khatma_number, started_at, completed_at, status, percent_complete FROM khatmas WHERE status = 'active' ORDER BY khatma_number DESC LIMIT 1;"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let num = Int(sqlite3_column_int64(stmt, 1))
                let startedStr = String(cString: sqlite3_column_text(stmt, 2))
                let started = Self.isoFormatter.date(from: startedStr) ?? Date()
                let pct = sqlite3_column_double(stmt, 5)
                sqlite3_finalize(stmt)
                return KhatmaRecord(id: id, khatmaNumber: num, startedAt: started, status: "active", percentComplete: pct)
            }
        }
        sqlite3_finalize(stmt)

        // No active khatma: create Khatma #1 or Next
        let countSql = "SELECT COALESCE(MAX(khatma_number), 0) FROM khatmas;"
        var nextNumber = 1
        var countStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, countSql, -1, &countStmt, nil) == SQLITE_OK {
            if sqlite3_step(countStmt) == SQLITE_ROW {
                nextNumber = Int(sqlite3_column_int64(countStmt, 0)) + 1
            }
        }
        sqlite3_finalize(countStmt)

        let newId = UUID().uuidString
        let now = Date()
        let nowStr = Self.isoFormatter.string(from: now)
        let insertSql = "INSERT INTO khatmas (id, khatma_number, started_at, status, percent_complete) VALUES (?, ?, ?, 'active', 0.0);"
        var insertStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, insertSql, -1, &insertStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(insertStmt, 1, (newId as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(insertStmt, 2, Int64(nextNumber))
            sqlite3_bind_text(insertStmt, 3, (nowStr as NSString).utf8String, -1, nil)
            _ = sqlite3_step(insertStmt)
        }
        sqlite3_finalize(insertStmt)

        return KhatmaRecord(id: newId, khatmaNumber: nextNumber, startedAt: now, status: "active", percentComplete: 0.0)
    }

    @discardableResult
    public func recordReadAyahs(khatmaId: String, items: [(surah: Int, ayah: Int, page: Int)], at readDate: Date = Date()) -> Int {
        guard !items.isEmpty else { return 0 }
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        execute("BEGIN TRANSACTION;")
        let dateStr = Self.isoFormatter.string(from: readDate)
        let insertSql = "INSERT OR IGNORE INTO khatma_read_ayahs (khatma_id, surah, ayah, page, read_at) VALUES (?, ?, ?, ?, ?);"
        var stmt: OpaquePointer?
        var newCount = 0

        if sqlite3_prepare_v2(db, insertSql, -1, &stmt, nil) == SQLITE_OK {
            for item in items {
                sqlite3_reset(stmt)
                sqlite3_bind_text(stmt, 1, (khatmaId as NSString).utf8String, -1, nil)
                sqlite3_bind_int64(stmt, 2, Int64(item.surah))
                sqlite3_bind_int64(stmt, 3, Int64(item.ayah))
                sqlite3_bind_int64(stmt, 4, Int64(item.page))
                sqlite3_bind_text(stmt, 5, (dateStr as NSString).utf8String, -1, nil)
                if sqlite3_step(stmt) == SQLITE_DONE {
                    if sqlite3_changes(db) > 0 {
                        newCount += 1
                    }
                }
            }
        }
        sqlite3_finalize(stmt)
        execute("COMMIT;")

        return newCount
    }

    public func readAyahsCount(khatmaId: String) -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT COUNT(DISTINCT surah || ':' || ayah) FROM khatma_read_ayahs WHERE khatma_id = ?;"
        var stmt: OpaquePointer?
        var count = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (khatmaId as NSString).utf8String, -1, nil)
            if sqlite3_step(stmt) == SQLITE_ROW {
                count = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)
        return count
    }

    public func lifetimeReadAyahsCount() -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        // Unique ayahs recorded in all khatmas
        let khatmaAyahsSql = "SELECT COUNT(*) FROM khatma_read_ayahs;"
        var stmt: OpaquePointer?
        var khatmaAyahsCount = 0
        if sqlite3_prepare_v2(db, khatmaAyahsSql, -1, &stmt, nil) == SQLITE_OK {
            if sqlite3_step(stmt) == SQLITE_ROW {
                khatmaAyahsCount = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)

        // Sum of all daily reading activity
        let dailyAyahsSql = "SELECT COALESCE(SUM(ayahs_read), 0) FROM reading_days;"
        var dailyStmt: OpaquePointer?
        var dailyAyahsCount = 0
        if sqlite3_prepare_v2(db, dailyAyahsSql, -1, &dailyStmt, nil) == SQLITE_OK {
            if sqlite3_step(dailyStmt) == SQLITE_ROW {
                dailyAyahsCount = Int(sqlite3_column_int64(dailyStmt, 0))
            }
        }
        sqlite3_finalize(dailyStmt)

        // Also ensure completed khatmas (each 6236 ayahs) are accounted for
        let completedSql = "SELECT COUNT(*) FROM khatmas WHERE status = 'completed';"
        var compStmt: OpaquePointer?
        var completedCount = 0
        if sqlite3_prepare_v2(db, completedSql, -1, &compStmt, nil) == SQLITE_OK {
            if sqlite3_step(compStmt) == SQLITE_ROW {
                completedCount = Int(sqlite3_column_int64(compStmt, 0))
            }
        }
        sqlite3_finalize(compStmt)

        return max(khatmaAyahsCount, max(dailyAyahsCount, completedCount * 6236))
    }

    public func readPagesCount(khatmaId: String) -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT COUNT(DISTINCT page) FROM khatma_read_ayahs WHERE khatma_id = ?;"
        var stmt: OpaquePointer?
        var count = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (khatmaId as NSString).utf8String, -1, nil)
            if sqlite3_step(stmt) == SQLITE_ROW {
                count = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)
        return count
    }

    public func readAyahsCountForSurah(khatmaId: String, surah: Int) -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT COUNT(DISTINCT ayah) FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;"
        var stmt: OpaquePointer?
        var count = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (khatmaId as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
            if sqlite3_step(stmt) == SQLITE_ROW {
                count = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)
        return count
    }

    public func allReadAyahsForSurah(khatmaId: String, surah: Int) -> Set<Int> {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        let sql = "SELECT DISTINCT ayah FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;"
        var stmt: OpaquePointer?
        var ayahs = Set<Int>()
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (khatmaId as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
            while sqlite3_step(stmt) == SQLITE_ROW {
                ayahs.insert(Int(sqlite3_column_int64(stmt, 0)))
            }
        }
        sqlite3_finalize(stmt)
        return ayahs
    }

    public func completedSurahsCount(khatmaId: String, surahAyahCounts: [Int: Int]) -> Int {
        var completed = 0
        for (surah, total) in surahAyahCounts {
            let read = readAyahsCountForSurah(khatmaId: khatmaId, surah: surah)
            if read >= total && total > 0 {
                completed += 1
            }
        }
        return completed
    }

    /// Removes all read ayahs for a surah from the given khatma (e.g. when unmarking a completed surah).
    public func removeReadAyahsForSurah(khatmaId: String, surah: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        var khatmaNumber: Int?
        var numberStatement: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT khatma_number FROM khatmas WHERE id = ?", -1, &numberStatement, nil) == SQLITE_OK {
            sqlite3_bind_text(numberStatement, 1, (khatmaId as NSString).utf8String, -1, nil)
            if sqlite3_step(numberStatement) == SQLITE_ROW {
                khatmaNumber = Int(sqlite3_column_int64(numberStatement, 0))
            }
        }
        sqlite3_finalize(numberStatement)
        guard let khatmaNumber else { return }
        deleteWithTombstone(db, kind: "surah", khatmaNumber: khatmaNumber, surah: surah,
                            sql: "DELETE FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;") { stmt in
            sqlite3_bind_text(stmt, 1, (khatmaId as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
        }
    }

    public func completeActiveKhatma(khatmaId: String) -> KhatmaRecord? {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return nil }

        let now = Date()
        let nowStr = Self.isoFormatter.string(from: now)
        let updateSql = "UPDATE khatmas SET status = 'completed', completed_at = ?, percent_complete = 100.0 WHERE id = ?;"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, updateSql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (nowStr as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (khatmaId as NSString).utf8String, -1, nil)
            _ = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)

        // Increment completed khatmas counter in metadata
        let incSql = """
        INSERT INTO reading_metadata (key, value) VALUES ('completed_khatmas', '1')
        ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT);
        """
        sqlite3_exec(db, incSql, nil, nil, nil)

        // Return updated record
        var completedRecord: KhatmaRecord? = nil
        let selectSql = "SELECT id, khatma_number, started_at, completed_at, status, percent_complete FROM khatmas WHERE id = ?;"
        var selectStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, selectSql, -1, &selectStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(selectStmt, 1, (khatmaId as NSString).utf8String, -1, nil)
            if sqlite3_step(selectStmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(selectStmt, 0))
                let num = Int(sqlite3_column_int64(selectStmt, 1))
                let startedStr = String(cString: sqlite3_column_text(selectStmt, 2))
                let started = Self.isoFormatter.date(from: startedStr) ?? now
                completedRecord = KhatmaRecord(id: id, khatmaNumber: num, startedAt: started, completedAt: now, status: "completed", percentComplete: 100.0)
            }
        }
        sqlite3_finalize(selectStmt)
        return completedRecord
    }

    public func completedKhatmasCount() -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT COUNT(*) FROM khatmas WHERE status = 'completed';"
        var stmt: OpaquePointer?
        var count = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if sqlite3_step(stmt) == SQLITE_ROW {
                count = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)
        return count
    }

    public func allCompletedKhatmas() -> [KhatmaRecord] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        let sql = "SELECT id, khatma_number, started_at, completed_at, status, percent_complete FROM khatmas WHERE status = 'completed' ORDER BY khatma_number DESC;"
        var stmt: OpaquePointer?
        var records: [KhatmaRecord] = []
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let num = Int(sqlite3_column_int64(stmt, 1))
                let started = Self.isoFormatter.date(from: String(cString: sqlite3_column_text(stmt, 2))) ?? Date()
                var completed: Date? = nil
                if let compPtr = sqlite3_column_text(stmt, 3) {
                    completed = Self.isoFormatter.date(from: String(cString: compPtr))
                }
                let status = String(cString: sqlite3_column_text(stmt, 4))
                let pct = sqlite3_column_double(stmt, 5)

                records.append(KhatmaRecord(id: id, khatmaNumber: num, startedAt: started, completedAt: completed, status: status, percentComplete: pct))
            }
        }
        sqlite3_finalize(stmt)
        return records
    }

    // MARK: - Daily Reading & Streak Calculation

    @discardableResult
    public func recordDailyReadingActivity(
        ayahsCount: Int,
        pagesCount: Int,
        seconds: Int = 0,
        on date: Date = Date()
    ) -> (currentStreak: Int, longestStreak: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return (0, 0) }

        let dateStr = Self.dayFormatter.string(from: date)
        let nowStr = Self.isoFormatter.string(from: date)

        let eventSQL = "INSERT INTO reading_activity_events(id, date_string, ayahs_read, pages_read, seconds_read, recorded_at) VALUES (?, ?, ?, ?, ?, ?);"
        var eventStatement: OpaquePointer?
        guard sqlite3_prepare_v2(db, eventSQL, -1, &eventStatement, nil) == SQLITE_OK else {
            return recalculateStreaks(asOf: date)
        }
        let id = UUID().uuidString
        sqlite3_bind_text(eventStatement, 1, (id as NSString).utf8String, -1, nil)
        sqlite3_bind_text(eventStatement, 2, (dateStr as NSString).utf8String, -1, nil)
        sqlite3_bind_int64(eventStatement, 3, Int64(ayahsCount))
        sqlite3_bind_int64(eventStatement, 4, Int64(pagesCount))
        sqlite3_bind_int64(eventStatement, 5, Int64(seconds))
        sqlite3_bind_text(eventStatement, 6, (nowStr as NSString).utf8String, -1, nil)
        let eventSaved = sqlite3_step(eventStatement) == SQLITE_DONE
        sqlite3_finalize(eventStatement)
        guard eventSaved else { return recalculateStreaks(asOf: date) }

        let upsertSql = """
        INSERT INTO reading_days (date_string, ayahs_read, pages_read, seconds_read, last_read_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date_string) DO UPDATE SET
            ayahs_read = ayahs_read + excluded.ayahs_read,
            pages_read = pages_read + excluded.pages_read,
            seconds_read = seconds_read + excluded.seconds_read,
            last_read_at = excluded.last_read_at;
        """
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, upsertSql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (dateStr as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 2, Int64(ayahsCount))
            sqlite3_bind_int64(stmt, 3, Int64(pagesCount))
            sqlite3_bind_int64(stmt, 4, Int64(seconds))
            sqlite3_bind_text(stmt, 5, (nowStr as NSString).utf8String, -1, nil)
            _ = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)

        return recalculateStreaks(asOf: date)
    }

    public func calculateStreaks(asOf date: Date = Date()) -> (currentStreak: Int, longestStreak: Int, totalReadingDays: Int) {
        lock.lock()
        defer { lock.unlock() }
        let (current, longest) = recalculateStreaks(asOf: date)
        let total = fetchTotalReadingDays()
        return (current, longest, total)
    }

    public func lifetimeReadingSeconds() -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT COALESCE(SUM(seconds_read), 0), COALESCE(SUM(ayahs_read), 0), COALESCE(SUM(pages_read), 0) FROM reading_days;"
        var stmt: OpaquePointer?
        var totalSeconds = 0
        var fallbackAyahs = 0
        var fallbackPages = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if sqlite3_step(stmt) == SQLITE_ROW {
                totalSeconds = Int(sqlite3_column_int64(stmt, 0))
                fallbackAyahs = Int(sqlite3_column_int64(stmt, 1))
                fallbackPages = Int(sqlite3_column_int64(stmt, 2))
            }
        }
        sqlite3_finalize(stmt)

        if totalSeconds > 0 {
            return totalSeconds
        }
        // Fallback estimation for legacy sessions if seconds were not tracked yet
        if fallbackAyahs > 0 { return fallbackAyahs * 20 }
        if fallbackPages > 0 { return fallbackPages * 75 }
        return 0
    }

    public func readingSeconds(for dateString: String) -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT seconds_read, ayahs_read, pages_read FROM reading_days WHERE date_string = ?;"
        var stmt: OpaquePointer?
        var sec = 0
        var ayahs = 0
        var pages = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (dateString as NSString).utf8String, -1, nil)
            if sqlite3_step(stmt) == SQLITE_ROW {
                sec = Int(sqlite3_column_int64(stmt, 0))
                ayahs = Int(sqlite3_column_int64(stmt, 1))
                pages = Int(sqlite3_column_int64(stmt, 2))
            }
        }
        sqlite3_finalize(stmt)

        if sec > 0 { return sec }
        if ayahs > 0 { return ayahs * 20 }
        if pages > 0 { return pages * 75 }
        return 0
    }

    public func readingSecondsMap(startingFrom: Date, endingAt: Date) -> [String: Int] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [:] }

        let startStr = Self.dayFormatter.string(from: startingFrom)
        let endStr = Self.dayFormatter.string(from: endingAt)
        let sql = "SELECT date_string, seconds_read, ayahs_read, pages_read FROM reading_days WHERE date_string >= ? AND date_string <= ?;"
        var stmt: OpaquePointer?
        var map: [String: Int] = [:]
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (startStr as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (endStr as NSString).utf8String, -1, nil)
            while sqlite3_step(stmt) == SQLITE_ROW {
                let dateStr = String(cString: sqlite3_column_text(stmt, 0))
                var sec = Int(sqlite3_column_int64(stmt, 1))
                let ayahs = Int(sqlite3_column_int64(stmt, 2))
                let pages = Int(sqlite3_column_int64(stmt, 3))
                if sec == 0 {
                    if ayahs > 0 { sec = ayahs * 20 }
                    else if pages > 0 { sec = pages * 75 }
                }
                map[dateStr] = sec
            }
        }
        sqlite3_finalize(stmt)
        return map
    }

    public func readingDaysSet(startingFrom: Date, endingAt: Date) -> Set<String> {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        let startStr = Self.dayFormatter.string(from: startingFrom)
        let endStr = Self.dayFormatter.string(from: endingAt)
        let sql = "SELECT date_string FROM reading_days WHERE date_string >= ? AND date_string <= ?;"
        var stmt: OpaquePointer?
        var set = Set<String>()
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (startStr as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (endStr as NSString).utf8String, -1, nil)
            while sqlite3_step(stmt) == SQLITE_ROW {
                set.insert(String(cString: sqlite3_column_text(stmt, 0)))
            }
        }
        sqlite3_finalize(stmt)
        return set
    }

    private func recalculateStreaks(asOf date: Date) -> (currentStreak: Int, longestStreak: Int) {
        guard let db = db else { return (0, 0) }

        // Fetch all distinct dates ordered ascending
        let sql = "SELECT date_string FROM reading_days ORDER BY date_string ASC;"
        var stmt: OpaquePointer?
        var days: [String] = []
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                days.append(String(cString: sqlite3_column_text(stmt, 0)))
            }
        }
        sqlite3_finalize(stmt)

        guard !days.isEmpty else { return (0, 0) }

        let calendar = Calendar.current
        var streak = 0
        var maxStreak = 0
        var prevDate: Date? = nil

        for dayStr in days {
            guard let curDate = Self.dayFormatter.date(from: dayStr) else { continue }
            if let prev = prevDate {
                let diff = calendar.dateComponents([.day], from: prev, to: curDate).day ?? 0
                if diff == 1 {
                    streak += 1
                } else if diff > 1 {
                    streak = 1
                }
            } else {
                streak = 1
            }
            maxStreak = max(maxStreak, streak)
            prevDate = curDate
        }

        // Now determine if current streak is still active today
        let todayStr = Self.dayFormatter.string(from: date)
        guard let lastRecordedStr = days.last,
              let lastRecordedDate = Self.dayFormatter.date(from: lastRecordedStr),
              let todayDate = Self.dayFormatter.date(from: todayStr) else {
            return (0, maxStreak)
        }

        let diffFromToday = calendar.dateComponents([.day], from: lastRecordedDate, to: todayDate).day ?? 0
        var activeStreak = 0
        if diffFromToday == 0 {
            // Read today
            activeStreak = streak
        } else if diffFromToday == 1 {
            // Read yesterday, today not yet finished
            activeStreak = streak
        } else {
            // Missed a full calendar day
            activeStreak = 0
        }

        // Store longest streak in metadata
        let metaSql = """
        INSERT INTO reading_metadata (key, value) VALUES ('longest_streak', '\(maxStreak)')
        ON CONFLICT(key) DO UPDATE SET value = MAX(CAST(value AS INTEGER), \(maxStreak));
        """
        sqlite3_exec(db, metaSql, nil, nil, nil)

        return (activeStreak, maxStreak)
    }

    private func fetchTotalReadingDays() -> Int {
        guard let db = db else { return 0 }
        let sql = "SELECT COUNT(*) FROM reading_days;"
        var stmt: OpaquePointer?
        var count = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if sqlite3_step(stmt) == SQLITE_ROW {
                count = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)
        return count
    }

    public func allReadingDays() -> [ReadingDayRecord] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        let sql = "SELECT date_string, ayahs_read, pages_read, seconds_read, last_read_at FROM reading_days ORDER BY date_string DESC;"
        var stmt: OpaquePointer?
        var records: [ReadingDayRecord] = []
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                let dateStr = String(cString: sqlite3_column_text(stmt, 0))
                let ayahs = Int(sqlite3_column_int64(stmt, 1))
                let pages = Int(sqlite3_column_int64(stmt, 2))
                var seconds = Int(sqlite3_column_int64(stmt, 3))
                if seconds == 0 {
                    if ayahs > 0 { seconds = ayahs * 20 }
                    else if pages > 0 { seconds = pages * 75 }
                }
                let lastRead = Self.isoFormatter.date(from: String(cString: sqlite3_column_text(stmt, 4))) ?? Date()
                records.append(ReadingDayRecord(dateString: dateStr, ayahsRead: ayahs, pagesRead: pages, secondsRead: seconds, lastReadAt: lastRead))
            }
        }
        sqlite3_finalize(stmt)
        return records
    }

    public func resetForTesting() {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        sqlite3_exec(db, "DELETE FROM khatma_read_ayahs; DELETE FROM khatmas; DELETE FROM reading_days; DELETE FROM reading_metadata; DELETE FROM bookmarks;", nil, nil, nil)
    }
}
