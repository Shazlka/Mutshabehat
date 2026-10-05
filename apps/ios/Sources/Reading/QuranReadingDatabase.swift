import Foundation
import MushafCore
import SQLite3

public final class QuranReadingDatabase: @unchecked Sendable {
    public static let shared = QuranReadingDatabase()

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

        CREATE TABLE IF NOT EXISTS reading_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(type);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_page ON bookmarks(page);
        CREATE INDEX IF NOT EXISTS idx_khatma_surah ON khatma_read_ayahs(khatma_id, surah);
        CREATE INDEX IF NOT EXISTS idx_khatma_page ON khatma_read_ayahs(khatma_id, page);
        """)

        // Safely migrate existing databases that might not have seconds_read column yet
        execute("ALTER TABLE reading_days ADD COLUMN seconds_read INTEGER NOT NULL DEFAULT 0;")
    }

    private func execute(_ sql: String) {
        guard let db = db else { return }
        sqlite3_exec(db, sql, nil, nil, nil)
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
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (type.rawValue as NSString).utf8String, -1, nil)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
            sqlite3_bind_int64(stmt, 3, Int64(ayah))
            sqlite3_bind_int64(stmt, 4, Int64(page))
            _ = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)
    }

    public func removeBookmark(id: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }

        let sql = "DELETE FROM bookmarks WHERE id = ?;"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            _ = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)
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
