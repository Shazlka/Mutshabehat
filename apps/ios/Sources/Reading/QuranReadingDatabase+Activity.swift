import Foundation
import MushafCore
import SQLite3

// Daily reading activity, streaks and reading time.
extension QuranReadingDatabase {
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
        SQLiteBind.text(eventStatement, 1, id)
        SQLiteBind.text(eventStatement, 2, dateStr)
        sqlite3_bind_int64(eventStatement, 3, Int64(ayahsCount))
        sqlite3_bind_int64(eventStatement, 4, Int64(pagesCount))
        sqlite3_bind_int64(eventStatement, 5, Int64(seconds))
        SQLiteBind.text(eventStatement, 6, nowStr)
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
            SQLiteBind.text(stmt, 1, dateStr)
            sqlite3_bind_int64(stmt, 2, Int64(ayahsCount))
            sqlite3_bind_int64(stmt, 3, Int64(pagesCount))
            sqlite3_bind_int64(stmt, 4, Int64(seconds))
            SQLiteBind.text(stmt, 5, nowStr)
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
            SQLiteBind.text(stmt, 1, dateString)
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
            SQLiteBind.text(stmt, 1, startStr)
            SQLiteBind.text(stmt, 2, endStr)
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
            SQLiteBind.text(stmt, 1, startStr)
            SQLiteBind.text(stmt, 2, endStr)
            while sqlite3_step(stmt) == SQLITE_ROW {
                set.insert(String(cString: sqlite3_column_text(stmt, 0)))
            }
        }
        sqlite3_finalize(stmt)
        return set
    }

    func recalculateStreaks(asOf date: Date) -> (currentStreak: Int, longestStreak: Int) {
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

    func fetchTotalReadingDays() -> Int {
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
}
