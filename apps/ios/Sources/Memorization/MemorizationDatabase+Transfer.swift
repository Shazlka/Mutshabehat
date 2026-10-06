import Foundation
import MushafCore
import SQLite3

private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

extension MemorizationDatabase {
    // MARK: Export, replace, merge

    /// Everything memorization stores, as one document (the manual export file and the backup JSON).
    public func exportAll(now: Date) -> MemorizationExport {
        let moment = now.normalizedToMilliseconds
        let device = deviceID
        lock.lock()
        defer { lock.unlock() }
        return exportAllLocked(now: moment, deviceID: device)
    }

    /// Makes memorization exactly what `export` holds. All or nothing; this database's own device id and
    /// schema version are kept.
    public func replaceAll(with export: MemorizationExport) throws {
        lock.lock()
        defer { lock.unlock() }
        try replaceAllLocked(with: export)
    }

    /// Merges an export into the current data (the newer row of each ayah wins, history is unioned by id) in
    /// one step, so nothing can write in between the read and the write.
    public func merge(_ incoming: MemorizationExport, now: Date) throws {
        let moment = now.normalizedToMilliseconds
        let device = deviceID
        lock.lock()
        defer { lock.unlock() }
        let merged = MemorizationMerge.merge(local: exportAllLocked(now: moment, deviceID: device), incoming: incoming)
        try replaceAllLocked(with: merged)
    }

    private func exportAllLocked(now: Date, deviceID: String) -> MemorizationExport {
        var meta: [String: String] = [:]
        if let db {
            var statement: OpaquePointer?
            if sqlite3_prepare_v2(db, "SELECT key, value FROM memorization_meta", -1, &statement, nil) == SQLITE_OK {
                while sqlite3_step(statement) == SQLITE_ROW {
                    if let key = sqlite3_column_text(statement, 0), let value = sqlite3_column_text(statement, 1) {
                        meta[String(cString: key)] = String(cString: value)
                    }
                }
            }
            sqlite3_finalize(statement)
        }
        return MemorizationExport(
            exportedAt: now, deviceID: deviceID,
            records: loadRecordsLocked().values.sorted { ($0.surah, $0.ayah) < ($1.surah, $1.ayah) },
            batches: queryBatchesLocked(where: "1 = 1", order: "created_at ASC, id ASC"),
            events: eventsLocked(where: "1 = 1", order: "at ASC, id ASC"),
            goals: goalsLocked(), meta: meta)
    }

    private func replaceAllLocked(with export: MemorizationExport) throws {
        guard let db else { throw MemorizationError.writeFailed("database unavailable") }
        guard sqlite3_exec(db, "BEGIN IMMEDIATE;", nil, nil, nil) == SQLITE_OK else {
            throw MemorizationError.writeFailed(String(cString: sqlite3_errmsg(db)))
        }
        do {
            for table in ["memorization_events", "memorization_batches", "memorization_ayahs", "memorization_goals"] {
                try runLocked("DELETE FROM \(table)", db: db) { _ in }
            }
            for record in export.records { try upsertRowLocked(record, db: db) }
            for batch in export.batches { try insertBatchLocked(batch, db: db) }
            let encoder = BackupCoding.encoder()
            for event in export.events {
                try insertEventLocked(batchID: event.batchID, key: event.key, at: event.at, before: event.before,
                                      after: event.after, encoder: encoder, db: db)
            }
            for goal in export.goals { try saveGoalLocked(goal, db: db) }
            for (key, value) in export.meta where key != "device_id" && key != "schema_version" {
                try runLocked("INSERT INTO memorization_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                              db: db) { statement in
                    sqlite3_bind_text(statement, 1, key, -1, transient)
                    sqlite3_bind_text(statement, 2, value, -1, transient)
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

    // MARK: Goals

    public func goals() -> [GoalDefinition] {
        lock.lock()
        defer { lock.unlock() }
        return goalsLocked()
    }

    public func saveGoal(_ goal: GoalDefinition) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { throw MemorizationError.writeFailed("database unavailable") }
        try saveGoalLocked(goal, db: db)
    }

    public func deleteGoal(id: UUID) {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { return }
        try? runLocked("DELETE FROM memorization_goals WHERE id = ?", db: db) { statement in
            sqlite3_bind_text(statement, 1, id.uuidString, -1, transient)
        }
    }

    private func saveGoalLocked(_ goal: GoalDefinition, db: OpaquePointer) throws {
        let json = String(decoding: try BackupCoding.encoder().encode(goal), as: UTF8.self)
        try runLocked("INSERT INTO memorization_goals (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json",
                      db: db) { statement in
            sqlite3_bind_text(statement, 1, goal.id.uuidString, -1, transient)
            sqlite3_bind_text(statement, 2, json, -1, transient)
        }
    }

    private func goalsLocked() -> [GoalDefinition] {
        guard let db else { return [] }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT json FROM memorization_goals", -1, &statement, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(statement) }
        let decoder = BackupCoding.decoder()
        var goals: [GoalDefinition] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            if let text = sqlite3_column_text(statement, 0),
               let goal = try? decoder.decode(GoalDefinition.self, from: Data(String(cString: text).utf8)) { goals.append(goal) }
        }
        return goals.sorted { ($0.createdAt, $0.id.uuidString) < ($1.createdAt, $1.id.uuidString) }
    }
}
