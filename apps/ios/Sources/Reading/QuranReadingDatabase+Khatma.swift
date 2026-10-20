import Foundation
import MushafCore
import SQLite3

// Khatma progress: read ayahs, completion, per-surah counts.
extension QuranReadingDatabase {
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
            SQLiteBind.text(insertStmt, 1, newId)
            sqlite3_bind_int64(insertStmt, 2, Int64(nextNumber))
            SQLiteBind.text(insertStmt, 3, nowStr)
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
                SQLiteBind.text(stmt, 1, khatmaId)
                sqlite3_bind_int64(stmt, 2, Int64(item.surah))
                sqlite3_bind_int64(stmt, 3, Int64(item.ayah))
                sqlite3_bind_int64(stmt, 4, Int64(item.page))
                SQLiteBind.text(stmt, 5, dateStr)
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
            SQLiteBind.text(stmt, 1, khatmaId)
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
            SQLiteBind.text(stmt, 1, khatmaId)
            if sqlite3_step(stmt) == SQLITE_ROW {
                count = Int(sqlite3_column_int64(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)
        return count
    }

    public func readAyahsCountsBySurah(khatmaId: String) -> [Int: Int] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [:] }

        let sql = "SELECT surah, COUNT(DISTINCT ayah) FROM khatma_read_ayahs WHERE khatma_id = ? GROUP BY surah;"
        var stmt: OpaquePointer?
        var counts: [Int: Int] = [:]
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            SQLiteBind.text(stmt, 1, khatmaId)
            while sqlite3_step(stmt) == SQLITE_ROW {
                let surah = Int(sqlite3_column_int64(stmt, 0))
                let count = Int(sqlite3_column_int64(stmt, 1))
                counts[surah] = count
            }
        }
        sqlite3_finalize(stmt)
        return counts
    }

    public func readAyahsCountForSurah(khatmaId: String, surah: Int) -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        let sql = "SELECT COUNT(DISTINCT ayah) FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;"
        var stmt: OpaquePointer?
        var count = 0
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            SQLiteBind.text(stmt, 1, khatmaId)
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
            SQLiteBind.text(stmt, 1, khatmaId)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
            while sqlite3_step(stmt) == SQLITE_ROW {
                ayahs.insert(Int(sqlite3_column_int64(stmt, 0)))
            }
        }
        sqlite3_finalize(stmt)
        return ayahs
    }

    public func completedSurahsCount(khatmaId: String, surahAyahCounts: [Int: Int]) -> Int {
        let counts = readAyahsCountsBySurah(khatmaId: khatmaId)
        var completed = 0
        for (surah, total) in surahAyahCounts {
            let read = counts[surah] ?? 0
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
            SQLiteBind.text(numberStatement, 1, khatmaId)
            if sqlite3_step(numberStatement) == SQLITE_ROW {
                khatmaNumber = Int(sqlite3_column_int64(numberStatement, 0))
            }
        }
        sqlite3_finalize(numberStatement)
        guard let khatmaNumber else { return }
        deleteWithTombstone(db, kind: "surah", khatmaNumber: khatmaNumber, surah: surah,
                            sql: "DELETE FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;") { stmt in
            SQLiteBind.text(stmt, 1, khatmaId)
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
            SQLiteBind.text(stmt, 1, nowStr)
            SQLiteBind.text(stmt, 2, khatmaId)
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
            SQLiteBind.text(selectStmt, 1, khatmaId)
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
}
