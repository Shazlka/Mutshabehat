import Foundation
import MushafCore
import SQLite3

// Merging another device's reading snapshot (bookmarks, days, khatmas, read ayahs, deletions).
extension QuranReadingDatabase {
    /// Merges reading data (bookmarks, reading days, khatmas, read ayahs) from another database snapshot.
    /// This is an additive, union-based merge:
    /// - Khatmas with matching numbers are unified: if marked completed in either, it is completed.
    /// - Read ayahs from both databases are unioned.
    /// - Reading days take the maximum counts/seconds per date.
    /// - Bookmarks are unioned by (type, surah, ayah, page).
    @discardableResult
    public func mergeDatabase(from sourceURL: URL) throws -> (khatmasMerged: Int, ayahsMerged: Int, daysMerged: Int) {
        do { try SQLiteFile.validate(at: sourceURL, requiredTables: Self.requiredTables) } catch {
            throw TransferError.invalidDatabase
        }

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
                    SQLiteBind.text(updStmt, 1, completedDateStr)
                    SQLiteBind.text(updStmt, 2, existingId)
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
                SQLiteBind.text(insStmt, 1, srcKhatma.id)
                sqlite3_bind_int64(insStmt, 2, Int64(srcKhatma.number))
                SQLiteBind.text(insStmt, 3, srcKhatma.startedAt)
                if let comp = srcKhatma.completedAt {
                    SQLiteBind.text(insStmt, 4, comp)
                } else {
                    sqlite3_bind_null(insStmt, 4)
                }
                SQLiteBind.text(insStmt, 5, srcKhatma.status)
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
            SQLiteBind.text(copyStmt, 1, targetId)
            SQLiteBind.text(copyStmt, 2, srcKhatma.id)
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
            SQLiteBind.text(insActiveStmt, 1, newId)
            sqlite3_bind_int64(insActiveStmt, 2, Int64(nextNum))
            SQLiteBind.text(insActiveStmt, 3, nowStr)
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

    func mergeDailyActivity(_ db: OpaquePointer) throws {
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

    func mergeDeletionTombstones(_ db: OpaquePointer) throws {
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
}
