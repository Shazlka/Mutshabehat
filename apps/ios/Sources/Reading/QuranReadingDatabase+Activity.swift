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

        // The event row and the day row are one transaction: both are stored, or neither.
        _ = transactionLocked(db) {
            insertActivityLocked(db, ayahsCount: ayahsCount, pagesCount: pagesCount, seconds: seconds, on: date)
        }

        return recalculateStreaks(asOf: date)
    }

    /// The activity event and the day's totals; false when either step fails. Lock held, inside a transaction.
    func insertActivityLocked(_ db: OpaquePointer, ayahsCount: Int, pagesCount: Int, seconds: Int, on date: Date) -> Bool {
        let dateStr = Self.dayFormatter.string(from: date)
        let nowStr = Self.isoFormatter.string(from: date)

        let eventSQL = "INSERT INTO reading_activity_events(id, date_string, ayahs_read, pages_read, seconds_read, recorded_at) VALUES (?, ?, ?, ?, ?, ?);"
        var eventStatement: OpaquePointer?
        guard sqlite3_prepare_v2(db, eventSQL, -1, &eventStatement, nil) == SQLITE_OK else { return false }
        SQLiteBind.text(eventStatement, 1, UUID().uuidString)
        SQLiteBind.text(eventStatement, 2, dateStr)
        sqlite3_bind_int64(eventStatement, 3, Int64(ayahsCount))
        sqlite3_bind_int64(eventStatement, 4, Int64(pagesCount))
        sqlite3_bind_int64(eventStatement, 5, Int64(seconds))
        SQLiteBind.text(eventStatement, 6, nowStr)
        let eventSaved = sqlite3_step(eventStatement) == SQLITE_DONE
        sqlite3_finalize(eventStatement)
        guard eventSaved else { return false }

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
        guard sqlite3_prepare_v2(db, upsertSql, -1, &stmt, nil) == SQLITE_OK else { return false }
        defer { sqlite3_finalize(stmt) }
        SQLiteBind.text(stmt, 1, dateStr)
        sqlite3_bind_int64(stmt, 2, Int64(ayahsCount))
        sqlite3_bind_int64(stmt, 3, Int64(pagesCount))
        sqlite3_bind_int64(stmt, 4, Int64(seconds))
        SQLiteBind.text(stmt, 5, nowStr)
        return sqlite3_step(stmt) == SQLITE_DONE
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
                let dateStr = sqliteColumnText(stmt, 0)
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
                set.insert(sqliteColumnText(stmt, 0))
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
                days.append(sqliteColumnText(stmt, 0))
            }
        }
        sqlite3_finalize(stmt)

        guard !days.isEmpty else { return (0, 0) }

        let calendar = Calendar.autoupdatingCurrent
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
        if diffFromToday <= 0 {
            // Read today (or a clock moved back leaves the last day ahead of today)
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
                let dateStr = sqliteColumnText(stmt, 0)
                let ayahs = Int(sqlite3_column_int64(stmt, 1))
                let pages = Int(sqlite3_column_int64(stmt, 2))
                var seconds = Int(sqlite3_column_int64(stmt, 3))
                if seconds == 0 {
                    if ayahs > 0 { seconds = ayahs * 20 }
                    else if pages > 0 { seconds = pages * 75 }
                }
                let lastRead = Self.parseReadingDate(sqliteColumnText(stmt, 4)) ?? Date()
                records.append(ReadingDayRecord(dateString: dateStr, ayahsRead: ayahs, pagesRead: pages, secondsRead: seconds, lastReadAt: lastRead))
            }
        }
        sqlite3_finalize(stmt)
        return records
    }

    public func dayDetail(for dateString: String, khatmaId: String) -> ReadingDayDetail {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else {
            return ReadingDayDetail(dateString: dateString, summary: nil, completedSurahs: [], activityEvents: [], legacyActivity: nil)
        }

        let summary = fetchReadingDayLocked(db, table: "reading_days", dateString: dateString)
        let legacy = fetchReadingDayLocked(db, table: "reading_days_legacy", dateString: dateString)

        var surahMap: [Int: (ayahs: [Int], pages: [Int])] = [:]
        var ayahStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT surah, ayah, page, read_at FROM khatma_read_ayahs WHERE khatma_id = ? ORDER BY surah ASC, ayah ASC;", -1, &ayahStmt, nil) == SQLITE_OK {
            SQLiteBind.text(ayahStmt, 1, khatmaId)
            while sqlite3_step(ayahStmt) == SQLITE_ROW {
                let readAtStr = sqliteColumnText(ayahStmt, 3)
                guard let readAtDate = Self.parseReadingDate(readAtStr),
                      Self.dayFormatter.string(from: readAtDate) == dateString else { continue }
                let surah = Int(sqlite3_column_int64(ayahStmt, 0))
                let ayah = Int(sqlite3_column_int64(ayahStmt, 1))
                let page = Int(sqlite3_column_int64(ayahStmt, 2))
                var entry = surahMap[surah] ?? (ayahs: [], pages: [])
                entry.ayahs.append(ayah)
                entry.pages.append(page)
                surahMap[surah] = entry
            }
        }
        sqlite3_finalize(ayahStmt)

        let completedSurahs = surahMap.keys.sorted().map { surah in
            let entry = surahMap[surah]!
            return CompletedSurahDayItem(surahNumber: surah, ayahs: entry.ayahs, pages: entry.pages)
        }

        var events: [ReadingActivityEventRecord] = []
        var evStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT id, date_string, ayahs_read, pages_read, seconds_read, recorded_at FROM reading_activity_events WHERE date_string = ? ORDER BY recorded_at DESC;", -1, &evStmt, nil) == SQLITE_OK {
            SQLiteBind.text(evStmt, 1, dateString)
            while sqlite3_step(evStmt) == SQLITE_ROW {
                let id = sqliteColumnText(evStmt, 0)
                let dStr = sqliteColumnText(evStmt, 1)
                let ayahs = Int(sqlite3_column_int64(evStmt, 2))
                let pages = Int(sqlite3_column_int64(evStmt, 3))
                let secs = Int(sqlite3_column_int64(evStmt, 4))
                let recAt = Self.parseReadingDate(sqliteColumnText(evStmt, 5)) ?? Date()
                events.append(ReadingActivityEventRecord(id: id, dateString: dStr, ayahsRead: ayahs, pagesRead: pages, secondsRead: secs, recordedAt: recAt))
            }
        }
        sqlite3_finalize(evStmt)

        return ReadingDayDetail(
            dateString: dateString,
            summary: summary,
            completedSurahs: completedSurahs,
            activityEvents: events,
            legacyActivity: legacy
        )
    }

    @discardableResult
    public func applyDayEdits(
        khatmaId: String,
        dateString: String,
        removedSurahAyahs: [(surah: Int, ayahs: [Int], pageCount: Int)],
        removedEventIds: [String],
        removeLegacy: Bool,
        additions: [PendingDayReadingAddition],
        on date: Date
    ) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return false }

        var khatmaNumber = 1
        var numStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT khatma_number FROM khatmas WHERE id = ?;", -1, &numStmt, nil) == SQLITE_OK {
            SQLiteBind.text(numStmt, 1, khatmaId)
            if sqlite3_step(numStmt) == SQLITE_ROW {
                khatmaNumber = Int(sqlite3_column_int64(numStmt, 0))
            }
        }
        sqlite3_finalize(numStmt)

        let saved = transactionLocked(db) {
            for eventId in removedEventIds {
                var delEv: OpaquePointer?
                guard sqlite3_prepare_v2(db, "DELETE FROM reading_activity_events WHERE id = ?;", -1, &delEv, nil) == SQLITE_OK else { return false }
                SQLiteBind.text(delEv, 1, eventId)
                let ok = sqlite3_step(delEv) == SQLITE_DONE
                sqlite3_finalize(delEv)
                guard ok else { return false }
            }

            if removeLegacy {
                var delLeg: OpaquePointer?
                guard sqlite3_prepare_v2(db, "DELETE FROM reading_days_legacy WHERE date_string = ?;", -1, &delLeg, nil) == SQLITE_OK else { return false }
                SQLiteBind.text(delLeg, 1, dateString)
                let ok = sqlite3_step(delLeg) == SQLITE_DONE
                sqlite3_finalize(delLeg)
                guard ok else { return false }
            }

            var subtractedAyahs = 0
            var subtractedPages = 0
            for removal in removedSurahAyahs where !removal.ayahs.isEmpty {
                var delAyah: OpaquePointer?
                guard sqlite3_prepare_v2(db, "DELETE FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ? AND ayah = ?;", -1, &delAyah, nil) == SQLITE_OK else { return false }
                for ayah in removal.ayahs {
                    guard recordDeletion(db, kind: "ayah", khatmaNumber: khatmaNumber, surah: removal.surah, ayah: ayah) else {
                        sqlite3_finalize(delAyah)
                        return false
                    }
                    sqlite3_reset(delAyah)
                    SQLiteBind.text(delAyah, 1, khatmaId)
                    sqlite3_bind_int64(delAyah, 2, Int64(removal.surah))
                    sqlite3_bind_int64(delAyah, 3, Int64(ayah))
                    guard sqlite3_step(delAyah) == SQLITE_DONE else {
                        sqlite3_finalize(delAyah)
                        return false
                    }
                    if sqlite3_changes(db) > 0 { subtractedAyahs += 1 }
                }
                sqlite3_finalize(delAyah)
                subtractedPages += removal.pageCount
            }

            // Adjust remaining activity totals only for surah removals not already covered by explicit session deletions.
            if subtractedAyahs > 0 && removedEventIds.isEmpty && !removeLegacy {
                guard trimDayActivityLocked(db, dateString: dateString, ayahsToRemove: subtractedAyahs, pagesToRemove: subtractedPages) else {
                    return false
                }
            }

            for addition in additions where !addition.items.isEmpty {
                guard let inserted = insertReadAyahsLocked(db, khatmaId: khatmaId, items: addition.items, at: date) else {
                    return false
                }
                let activityAyahs = max(1, inserted > 0 ? inserted : addition.items.count)
                let seconds = max(60, addition.durationMinutes * 60)
                guard insertActivityLocked(db, ayahsCount: activityAyahs, pagesCount: addition.pageCount, seconds: seconds, on: date) else {
                    return false
                }
            }

            guard recomputeReadingDayLocked(db, dateString: dateString) else { return false }
            return true
        }

        if saved {
            _ = recalculateStreaks(asOf: Date())
        }
        return saved
    }

    private func fetchReadingDayLocked(_ db: OpaquePointer, table: String, dateString: String) -> ReadingDayRecord? {
        let sql = "SELECT date_string, ayahs_read, pages_read, seconds_read, last_read_at FROM \(table) WHERE date_string = ?;"
        var stmt: OpaquePointer?
        var record: ReadingDayRecord?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            SQLiteBind.text(stmt, 1, dateString)
            if sqlite3_step(stmt) == SQLITE_ROW {
                let ayahs = Int(sqlite3_column_int64(stmt, 1))
                let pages = Int(sqlite3_column_int64(stmt, 2))
                let seconds = Int(sqlite3_column_int64(stmt, 3))
                let lastRead = Self.parseReadingDate(sqliteColumnText(stmt, 4)) ?? Date()
                if ayahs > 0 || pages > 0 || seconds > 0 {
                    record = ReadingDayRecord(dateString: dateString, ayahsRead: ayahs, pagesRead: pages, secondsRead: seconds, lastReadAt: lastRead)
                }
            }
        }
        sqlite3_finalize(stmt)
        return record
    }

    private func trimDayActivityLocked(_ db: OpaquePointer, dateString: String, ayahsToRemove: Int, pagesToRemove: Int) -> Bool {
        var remainingAyahs = ayahsToRemove
        var remainingPages = pagesToRemove

        var evRows: [(id: String, ayahs: Int, pages: Int, seconds: Int)] = []
        var selStmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT id, ayahs_read, pages_read, seconds_read FROM reading_activity_events WHERE date_string = ? ORDER BY recorded_at DESC;", -1, &selStmt, nil) == SQLITE_OK else {
            return false
        }
        SQLiteBind.text(selStmt, 1, dateString)
        while sqlite3_step(selStmt) == SQLITE_ROW {
            evRows.append((
                id: sqliteColumnText(selStmt, 0),
                ayahs: Int(sqlite3_column_int64(selStmt, 1)),
                pages: Int(sqlite3_column_int64(selStmt, 2)),
                seconds: Int(sqlite3_column_int64(selStmt, 3))
            ))
        }
        sqlite3_finalize(selStmt)

        for row in evRows where remainingAyahs > 0 || remainingPages > 0 {
            let cutA = min(row.ayahs, remainingAyahs)
            let cutP = min(row.pages, remainingPages)
            remainingAyahs -= cutA
            remainingPages -= cutP
            let newA = row.ayahs - cutA
            let newP = row.pages - cutP
            let ratio = row.ayahs > 0 ? Double(newA) / Double(row.ayahs) : 0.0
            let newS = newA > 0 ? Int((Double(row.seconds) * ratio).rounded()) : 0

            if newA <= 0 && newP <= 0 {
                var delStmt: OpaquePointer?
                guard sqlite3_prepare_v2(db, "DELETE FROM reading_activity_events WHERE id = ?;", -1, &delStmt, nil) == SQLITE_OK else { return false }
                SQLiteBind.text(delStmt, 1, row.id)
                let ok = sqlite3_step(delStmt) == SQLITE_DONE
                sqlite3_finalize(delStmt)
                guard ok else { return false }
            } else {
                var updStmt: OpaquePointer?
                guard sqlite3_prepare_v2(db, "UPDATE reading_activity_events SET ayahs_read = ?, pages_read = ?, seconds_read = ? WHERE id = ?;", -1, &updStmt, nil) == SQLITE_OK else { return false }
                sqlite3_bind_int64(updStmt, 1, Int64(newA))
                sqlite3_bind_int64(updStmt, 2, Int64(newP))
                sqlite3_bind_int64(updStmt, 3, Int64(newS))
                SQLiteBind.text(updStmt, 4, row.id)
                let ok = sqlite3_step(updStmt) == SQLITE_DONE
                sqlite3_finalize(updStmt)
                guard ok else { return false }
            }
        }

        if (remainingAyahs > 0 || remainingPages > 0), let legacy = fetchReadingDayLocked(db, table: "reading_days_legacy", dateString: dateString) {
            let newA = max(0, legacy.ayahsRead - remainingAyahs)
            let newP = max(0, legacy.pagesRead - remainingPages)
            let ratio = legacy.ayahsRead > 0 ? Double(newA) / Double(legacy.ayahsRead) : 0.0
            let newS = newA > 0 ? Int((Double(legacy.secondsRead) * ratio).rounded()) : 0
            if newA <= 0 && newP <= 0 {
                var delLeg: OpaquePointer?
                guard sqlite3_prepare_v2(db, "DELETE FROM reading_days_legacy WHERE date_string = ?;", -1, &delLeg, nil) == SQLITE_OK else { return false }
                SQLiteBind.text(delLeg, 1, dateString)
                let ok = sqlite3_step(delLeg) == SQLITE_DONE
                sqlite3_finalize(delLeg)
                guard ok else { return false }
            } else {
                var updLeg: OpaquePointer?
                guard sqlite3_prepare_v2(db, "UPDATE reading_days_legacy SET ayahs_read = ?, pages_read = ?, seconds_read = ? WHERE date_string = ?;", -1, &updLeg, nil) == SQLITE_OK else { return false }
                sqlite3_bind_int64(updLeg, 1, Int64(newA))
                sqlite3_bind_int64(updLeg, 2, Int64(newP))
                sqlite3_bind_int64(updLeg, 3, Int64(newS))
                SQLiteBind.text(updLeg, 4, dateString)
                let ok = sqlite3_step(updLeg) == SQLITE_DONE
                sqlite3_finalize(updLeg)
                guard ok else { return false }
            }
        }

        return true
    }

    private func recomputeReadingDayLocked(_ db: OpaquePointer, dateString: String) -> Bool {
        let legacy = fetchReadingDayLocked(db, table: "reading_days_legacy", dateString: dateString)

        var evAyahs = 0
        var evPages = 0
        var evSeconds = 0
        var evLast = ""
        var sumStmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT COALESCE(SUM(ayahs_read), 0), COALESCE(SUM(pages_read), 0), COALESCE(SUM(seconds_read), 0), COALESCE(MAX(recorded_at), '') FROM reading_activity_events WHERE date_string = ?;", -1, &sumStmt, nil) == SQLITE_OK else {
            return false
        }
        SQLiteBind.text(sumStmt, 1, dateString)
        if sqlite3_step(sumStmt) == SQLITE_ROW {
            evAyahs = Int(sqlite3_column_int64(sumStmt, 0))
            evPages = Int(sqlite3_column_int64(sumStmt, 1))
            evSeconds = Int(sqlite3_column_int64(sumStmt, 2))
            evLast = sqliteColumnText(sumStmt, 3)
        }
        sqlite3_finalize(sumStmt)

        let totalAyahs = (legacy?.ayahsRead ?? 0) + evAyahs
        let totalPages = (legacy?.pagesRead ?? 0) + evPages
        let totalSeconds = (legacy?.secondsRead ?? 0) + evSeconds
        let legacyLast = legacy.map { Self.isoFormatter.string(from: $0.lastReadAt) } ?? ""
        let latestAt = max(legacyLast, evLast)

        if totalAyahs <= 0 && totalPages <= 0 && totalSeconds <= 0 {
            var delStmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, "DELETE FROM reading_days WHERE date_string = ?;", -1, &delStmt, nil) == SQLITE_OK else { return false }
            SQLiteBind.text(delStmt, 1, dateString)
            let ok = sqlite3_step(delStmt) == SQLITE_DONE
            sqlite3_finalize(delStmt)
            return ok
        }

        let upsertSQL = """
        INSERT INTO reading_days(date_string, ayahs_read, pages_read, seconds_read, last_read_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date_string) DO UPDATE SET
            ayahs_read = excluded.ayahs_read,
            pages_read = excluded.pages_read,
            seconds_read = excluded.seconds_read,
            last_read_at = excluded.last_read_at;
        """
        var updStmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, upsertSQL, -1, &updStmt, nil) == SQLITE_OK else { return false }
        defer { sqlite3_finalize(updStmt) }
        SQLiteBind.text(updStmt, 1, dateString)
        sqlite3_bind_int64(updStmt, 2, Int64(totalAyahs))
        sqlite3_bind_int64(updStmt, 3, Int64(totalPages))
        sqlite3_bind_int64(updStmt, 4, Int64(totalSeconds))
        SQLiteBind.text(updStmt, 5, latestAt.isEmpty ? Self.isoFormatter.string(from: Date()) : latestAt)
        return sqlite3_step(updStmt) == SQLITE_DONE
    }
}
