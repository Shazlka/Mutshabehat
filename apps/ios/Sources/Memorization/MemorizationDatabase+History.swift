import Foundation
import MushafCore
import SQLite3

private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

/// One ayah row a batch writes: the new row, or its deletion (undoing an ayah that had no row before).
private struct RowWrite {
    let key: AyahKey
    let before: AyahMemorizationRecord?
    let after: AyahMemorizationRecord
    let deletesRow: Bool
}

extension MemorizationDatabase {
    // MARK: Applying

    /// Writes a plan as one batch: the ayah rows, the batch and one change event per ayah, all or nothing.
    public func apply(_ plan: BatchPlan, now rawNow: Date) throws -> BatchRecord {
        guard !plan.changes.isEmpty else { throw MemorizationError.nothingToApply }
        let now = rawNow.normalizedToMilliseconds
        let batch = BatchRecord(id: UUID(), createdAt: now, kind: plan.kind, label: plan.label, scopeJSON: plan.scopeJSON,
                                ayahCount: plan.changes.count, deviceID: deviceID, countsForStreak: plan.countsForStreak,
                                gainAyahs: plan.gainAyahs, undoneAt: nil, undoesBatchID: nil)
        let writes = plan.changes.map { RowWrite(key: $0.key, before: $0.before, after: $0.after, deletesRow: false) }
        lock.lock()
        defer { lock.unlock() }
        try commitLocked(batch: batch, writes: writes, at: now, markUndone: nil)
        return batch
    }

    // MARK: Reading history

    public func batches(limit: Int, offset: Int) -> [BatchRecord] {
        lock.lock()
        defer { lock.unlock() }
        return queryBatchesLocked(where: "1 = 1", order: "created_at DESC, rowid DESC", limit: limit, offset: offset)
    }

    public func batch(id: UUID) -> BatchRecord? {
        lock.lock()
        defer { lock.unlock() }
        return batchLocked(id: id)
    }

    public func events(since: Date?) -> [ChangeEvent] {
        lock.lock()
        defer { lock.unlock() }
        return eventsLocked(where: since == nil ? "1 = 1" : "at >= \(since!.epochMilliseconds)", order: "at ASC, id ASC")
    }

    public func events(batchID: UUID) -> [ChangeEvent] {
        lock.lock()
        defer { lock.unlock() }
        return eventsLocked(batchID: batchID)
    }

    /// Later batches that were not undone and touched any ayah this batch touched, oldest first.
    public func undoConflicts(batchID: UUID) -> [BatchRecord] {
        lock.lock()
        defer { lock.unlock() }
        return conflictsLocked(batchID: batchID)
    }

    /// Days with at least one batch that counts for the memorization streak and was not undone.
    public func qualifyingDays(calendar: Calendar) -> Set<Date> {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return [] }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT created_at FROM memorization_batches WHERE counts_for_streak = 1 AND undone_at IS NULL",
                                 -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        var days = Set<Date>()
        while sqlite3_step(statement) == SQLITE_ROW {
            days.insert(calendar.startOfDay(for: Date(epochMilliseconds: sqlite3_column_int64(statement, 0))))
        }
        return days
    }

    // MARK: Undo

    /// Restores every ayah of a batch to what it was before, in one transaction, and records the undo as a
    /// batch of its own. Newer overlapping batches stop it unless `force`.
    public func undo(batchID: UUID, force: Bool, now rawNow: Date) throws -> BatchRecord {
        let now = rawNow.normalizedToMilliseconds
        let device = deviceID
        lock.lock()
        defer { lock.unlock() }
        guard let original = batchLocked(id: batchID) else { throw MemorizationError.notFound }
        guard original.undoneAt == nil else { throw MemorizationError.alreadyUndone }
        guard original.kind != .undo else { throw MemorizationError.notUndoable }
        let conflicts = conflictsLocked(batchID: batchID)
        if !conflicts.isEmpty, !force { throw MemorizationError.hasNewerChanges(conflicts) }

        let originalEvents = eventsLocked(batchID: batchID)
        // A batch whose change events cannot all be read must never be reported as undone.
        guard originalEvents.count == original.ayahCount else {
            throw MemorizationError.writeFailed("بيانات التراجع ناقصة")
        }
        let writes = originalEvents.map { event -> RowWrite in
            let current = recordLocked(event.key)
            if let before = event.before {
                return RowWrite(key: event.key, before: current, after: before, deletesRow: false)
            }
            return RowWrite(key: event.key, before: current, after: AyahMemorizationRecord.blank(event.key, now: now), deletesRow: true)
        }
        let undoBatch = BatchRecord(id: UUID(), createdAt: now, kind: .undo, label: "تراجع: " + original.label,
                                    scopeJSON: original.scopeJSON, ayahCount: writes.count, deviceID: device,
                                    countsForStreak: false, gainAyahs: 0, undoneAt: nil, undoesBatchID: original.id)
        try commitLocked(batch: undoBatch, writes: writes, at: now, markUndone: original.id)
        return undoBatch
    }

    // MARK: Transaction

    private func commitLocked(batch: BatchRecord, writes: [RowWrite], at now: Date, markUndone: UUID?) throws {
        guard let db else { throw MemorizationError.writeFailed("database unavailable") }
        guard sqlite3_exec(db, "BEGIN IMMEDIATE;", nil, nil, nil) == SQLITE_OK else {
            throw MemorizationError.writeFailed(String(cString: sqlite3_errmsg(db)))
        }
        do {
            try insertBatchLocked(batch, db: db)
            let encoder = BackupCoding.encoder()
            for write in writes {
                if write.deletesRow {
                    try runLocked("DELETE FROM memorization_ayahs WHERE surah = ? AND ayah = ?", db: db) { statement in
                        sqlite3_bind_int64(statement, 1, Int64(write.key.surah))
                        sqlite3_bind_int64(statement, 2, Int64(write.key.ayah))
                    }
                } else {
                    try upsertRowLocked(write.after, db: db)
                }
                try insertEventLocked(batchID: batch.id, key: write.key, at: now, before: write.before, after: write.after,
                                      encoder: encoder, db: db)
            }
            if let markUndone {
                try runLocked("UPDATE memorization_batches SET undone_at = ? WHERE id = ?", db: db) { statement in
                    sqlite3_bind_int64(statement, 1, now.epochMilliseconds)
                    sqlite3_bind_text(statement, 2, markUndone.uuidString, -1, transient)
                }
            }
            guard sqlite3_exec(db, "COMMIT;", nil, nil, nil) == SQLITE_OK else {
                throw MemorizationError.writeFailed(String(cString: sqlite3_errmsg(db)))
            }
        } catch {
            sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
            throw error as? MemorizationError ?? MemorizationError.writeFailed(error.localizedDescription)
        }
    }

    // MARK: Statements (all expect the lock to be held)

    func runLocked(_ sql: String, db: OpaquePointer, bind: (OpaquePointer) -> Void) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw MemorizationError.writeFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }
        bind(statement)
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw MemorizationError.writeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    func insertBatchLocked(_ batch: BatchRecord, db: OpaquePointer) throws {
        try runLocked("""
            INSERT INTO memorization_batches (id, created_at, kind, label, scope_json, ayah_count, device_id,
                                              counts_for_streak, gain_ayahs, undone_at, undoes_batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, db: db) { statement in
            sqlite3_bind_text(statement, 1, batch.id.uuidString, -1, transient)
            sqlite3_bind_int64(statement, 2, batch.createdAt.epochMilliseconds)
            sqlite3_bind_text(statement, 3, batch.kind.rawValue, -1, transient)
            sqlite3_bind_text(statement, 4, batch.label, -1, transient)
            sqlite3_bind_text(statement, 5, batch.scopeJSON, -1, transient)
            sqlite3_bind_int64(statement, 6, Int64(batch.ayahCount))
            sqlite3_bind_text(statement, 7, batch.deviceID, -1, transient)
            sqlite3_bind_int64(statement, 8, batch.countsForStreak ? 1 : 0)
            sqlite3_bind_int64(statement, 9, Int64(batch.gainAyahs))
            if let undone = batch.undoneAt { sqlite3_bind_int64(statement, 10, undone.epochMilliseconds) } else { sqlite3_bind_null(statement, 10) }
            if let target = batch.undoesBatchID { sqlite3_bind_text(statement, 11, target.uuidString, -1, transient) } else { sqlite3_bind_null(statement, 11) }
        }
    }

    func upsertRowLocked(_ record: AyahMemorizationRecord, db: OpaquePointer) throws {
        try runLocked("""
            INSERT INTO memorization_ayahs (surah, ayah, status, review_strength, is_learning, first_memorized_at,
                last_status_changed_at, last_reviewed_at, next_review_at, review_count, successful_review_count,
                consecutive_successful_reviews, error_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(surah, ayah) DO UPDATE SET status = excluded.status, review_strength = excluded.review_strength,
                is_learning = excluded.is_learning, first_memorized_at = excluded.first_memorized_at,
                last_status_changed_at = excluded.last_status_changed_at, last_reviewed_at = excluded.last_reviewed_at,
                next_review_at = excluded.next_review_at, review_count = excluded.review_count,
                successful_review_count = excluded.successful_review_count,
                consecutive_successful_reviews = excluded.consecutive_successful_reviews,
                error_count = excluded.error_count, updated_at = excluded.updated_at
            """, db: db) { statement in
            sqlite3_bind_int64(statement, 1, Int64(record.surah))
            sqlite3_bind_int64(statement, 2, Int64(record.ayah))
            sqlite3_bind_int64(statement, 3, Int64(record.status.rawValue))
            sqlite3_bind_int64(statement, 4, Int64(record.reviewStrength.rawValue))
            sqlite3_bind_int64(statement, 5, record.isCurrentlyLearning ? 1 : 0)
            func bind(_ index: Int32, _ date: Date?) {
                if let date { sqlite3_bind_int64(statement, index, date.epochMilliseconds) } else { sqlite3_bind_null(statement, index) }
            }
            bind(6, record.firstMemorizedAt)
            bind(7, record.lastStatusChangedAt)
            bind(8, record.lastReviewedAt)
            bind(9, record.nextReviewAt)
            sqlite3_bind_int64(statement, 10, Int64(record.reviewCount))
            sqlite3_bind_int64(statement, 11, Int64(record.successfulReviewCount))
            sqlite3_bind_int64(statement, 12, Int64(record.consecutiveSuccessfulReviews))
            sqlite3_bind_int64(statement, 13, Int64(record.errorCount))
            sqlite3_bind_int64(statement, 14, record.updatedAt.epochMilliseconds)
        }
    }

    func insertEventLocked(batchID: UUID, key: AyahKey, at: Date, before: AyahMemorizationRecord?,
                           after: AyahMemorizationRecord, encoder: JSONEncoder, db: OpaquePointer) throws {
        let beforeJSON = try before.map { String(decoding: try encoder.encode($0), as: UTF8.self) }
        let afterJSON = String(decoding: try encoder.encode(after), as: UTF8.self)
        try runLocked("""
            INSERT INTO memorization_events (batch_id, surah, ayah, at, old_status, new_status, old_strength, new_strength,
                                             before_json, after_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, db: db) { statement in
            sqlite3_bind_text(statement, 1, batchID.uuidString, -1, transient)
            sqlite3_bind_int64(statement, 2, Int64(key.surah))
            sqlite3_bind_int64(statement, 3, Int64(key.ayah))
            sqlite3_bind_int64(statement, 4, at.epochMilliseconds)
            if let before {
                sqlite3_bind_int64(statement, 5, Int64(before.status.rawValue))
                sqlite3_bind_int64(statement, 7, Int64(before.reviewStrength.rawValue))
            } else {
                sqlite3_bind_null(statement, 5)
                sqlite3_bind_null(statement, 7)
            }
            sqlite3_bind_int64(statement, 6, Int64(after.status.rawValue))
            sqlite3_bind_int64(statement, 8, Int64(after.reviewStrength.rawValue))
            if let beforeJSON { sqlite3_bind_text(statement, 9, beforeJSON, -1, transient) } else { sqlite3_bind_null(statement, 9) }
            sqlite3_bind_text(statement, 10, afterJSON, -1, transient)
        }
    }

    // MARK: Queries (lock held)

    private static let batchColumns = """
        id, created_at, kind, label, scope_json, ayah_count, device_id, counts_for_streak, gain_ayahs, undone_at, undoes_batch_id
        """

    private func readBatch(_ statement: OpaquePointer) -> BatchRecord? {
        guard let idText = sqlite3_column_text(statement, 0), let id = UUID(uuidString: String(cString: idText)),
              let kindText = sqlite3_column_text(statement, 2), let kind = BatchKind(rawValue: String(cString: kindText)) else { return nil }
        func text(_ index: Int32) -> String { sqlite3_column_text(statement, index).map { String(cString: $0) } ?? "" }
        let undone: Date? = sqlite3_column_type(statement, 9) == SQLITE_NULL ? nil : Date(epochMilliseconds: sqlite3_column_int64(statement, 9))
        let target: UUID? = sqlite3_column_type(statement, 10) == SQLITE_NULL ? nil : UUID(uuidString: text(10))
        return BatchRecord(id: id, createdAt: Date(epochMilliseconds: sqlite3_column_int64(statement, 1)), kind: kind,
                           label: text(3), scopeJSON: text(4), ayahCount: Int(sqlite3_column_int64(statement, 5)),
                           deviceID: text(6), countsForStreak: sqlite3_column_int64(statement, 7) != 0,
                           gainAyahs: Int(sqlite3_column_int64(statement, 8)), undoneAt: undone, undoesBatchID: target)
    }

    func queryBatchesLocked(where clause: String, order: String, limit: Int? = nil, offset: Int = 0) -> [BatchRecord] {
        guard let db else { return [] }
        var sql = "SELECT \(Self.batchColumns) FROM memorization_batches WHERE \(clause) ORDER BY \(order)"
        if let limit { sql += " LIMIT \(max(0, limit)) OFFSET \(max(0, offset))" }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        var result: [BatchRecord] = []
        while sqlite3_step(statement) == SQLITE_ROW, let batch = readBatch(statement!) { result.append(batch) }
        return result
    }

    func batchLocked(id: UUID) -> BatchRecord? {
        guard let db else { return nil }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT \(Self.batchColumns) FROM memorization_batches WHERE id = ?", -1, &statement, nil) == SQLITE_OK else { return nil }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, id.uuidString, -1, transient)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        return readBatch(statement!)
    }

    private func conflictsLocked(batchID: UUID) -> [BatchRecord] {
        guard let db else { return [] }
        let columns = Self.batchColumns.split(separator: ",").map { "b2." + $0.trimmingCharacters(in: .whitespacesAndNewlines) }.joined(separator: ", ")
        let sql = """
            SELECT \(columns) FROM memorization_batches b1
            JOIN memorization_batches b2 ON b2.id != b1.id AND b2.undone_at IS NULL
                 AND (b2.created_at > b1.created_at OR (b2.created_at = b1.created_at AND b2.rowid > b1.rowid))
            WHERE b1.id = ? AND EXISTS (
                SELECT 1 FROM memorization_events e2 JOIN memorization_events e1 ON e1.surah = e2.surah AND e1.ayah = e2.ayah
                WHERE e2.batch_id = b2.id AND e1.batch_id = b1.id)
            ORDER BY b2.created_at ASC, b2.rowid ASC
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, batchID.uuidString, -1, transient)
        var result: [BatchRecord] = []
        while sqlite3_step(statement) == SQLITE_ROW, let batch = readBatch(statement!) { result.append(batch) }
        return result
    }

    func eventsLocked(batchID: UUID) -> [ChangeEvent] {
        eventsLocked(where: "batch_id = '\(batchID.uuidString)'", order: "id ASC")
    }

    func eventsLocked(where clause: String, order: String) -> [ChangeEvent] {
        guard let db else { return [] }
        let sql = "SELECT batch_id, surah, ayah, at, before_json, after_json FROM memorization_events WHERE \(clause) ORDER BY \(order)"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        let decoder = BackupCoding.decoder()
        var result: [ChangeEvent] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            guard let idText = sqlite3_column_text(statement, 0), let id = UUID(uuidString: String(cString: idText)),
                  let afterText = sqlite3_column_text(statement, 5),
                  let after = try? decoder.decode(AyahMemorizationRecord.self, from: Data(String(cString: afterText).utf8)) else { continue }
            var before: AyahMemorizationRecord?
            if let beforeText = sqlite3_column_text(statement, 4) {
                before = try? decoder.decode(AyahMemorizationRecord.self, from: Data(String(cString: beforeText).utf8))
            }
            result.append(ChangeEvent(batchID: id, surah: Int(sqlite3_column_int64(statement, 1)),
                                      ayah: Int(sqlite3_column_int64(statement, 2)),
                                      at: Date(epochMilliseconds: sqlite3_column_int64(statement, 3)), before: before, after: after))
        }
        return result
    }

    func recordLocked(_ key: AyahKey) -> AyahMemorizationRecord? {
        loadRecordsLocked(where: "surah = \(key.surah) AND ayah = \(key.ayah)")[key]
    }
}
