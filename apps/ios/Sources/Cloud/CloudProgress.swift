import CryptoKit
import Foundation
import SQLite3

typealias ProgressSnapshot = [String: [[String?]]]

enum ProgressDataset: String, CaseIterable {
    case khatma, memorization

    var tables: [String] {
        switch self {
        case .khatma: ["khatmas", "khatma_read_ayahs", "reading_days", "reading_days_legacy",
                       "reading_activity_events", "reading_deletions"]
        case .memorization: ["memorization_ayahs", "memorization_batches", "memorization_events",
                             "memorization_goals", "memorization_meta"]
        }
    }

    var title: String { self == .khatma ? "الختمة" : "الحفظ" }

    /// The columns of every synced table, in the one order the cloud format uses. They are read and written by name,
    /// never with `SELECT *`: a table keeps the column order it was created or migrated with, and that differs between
    /// installs (an older iPhone database has `last_read_at` before `seconds_read` in `reading_days`).
    static let columns: [String: [String]] = [
        "khatmas": ["id", "khatma_number", "started_at", "completed_at", "status", "percent_complete"],
        "khatma_read_ayahs": ["khatma_id", "surah", "ayah", "page", "read_at"],
        "reading_days": ["date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"],
        "reading_days_legacy": ["date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"],
        "reading_activity_events": ["id", "date_string", "ayahs_read", "pages_read", "seconds_read", "recorded_at"],
        "reading_deletions": ["kind", "khatma_number", "surah", "ayah", "page", "deleted_at"],
        "memorization_ayahs": ["surah", "ayah", "status", "review_strength", "is_learning", "first_memorized_at",
                               "last_status_changed_at", "last_reviewed_at", "next_review_at", "review_count",
                               "successful_review_count", "consecutive_successful_reviews", "error_count", "updated_at"],
        "memorization_batches": ["id", "created_at", "kind", "label", "scope_json", "ayah_count", "device_id",
                                 "counts_for_streak", "gain_ayahs", "undone_at", "undoes_batch_id"],
        "memorization_events": ["id", "batch_id", "surah", "ayah", "at", "old_status", "new_status", "old_strength",
                                "new_strength", "before_json", "after_json"],
        "memorization_goals": ["id", "json"],
        "memorization_meta": ["key", "value"],
    ]

    private static func list(_ table: String) -> String {
        (columns[table] ?? []).map { "\"\($0)\"" }.joined(separator: ", ")
    }

    func hasProgress(_ snapshot: ProgressSnapshot) -> Bool {
        tables.contains { table in
            switch table {
            case "khatmas": snapshot[table, default: []].contains { $0[4] == "completed" }
            case "memorization_meta": !snapshot[table, default: []].isEmpty
            default: !snapshot[table, default: []].isEmpty
            }
        }
    }

    func capture(_ db: OpaquePointer) throws -> ProgressSnapshot {
        var result: ProgressSnapshot = [:]
        for table in tables {
            let filter = table == "memorization_meta" ? " WHERE key IN ('milestones_seen','quran_completed_at')" : ""
            var statement: OpaquePointer?
            defer { sqlite3_finalize(statement) }
            try check(sqlite3_prepare_v2(db, "SELECT \(Self.list(table)) FROM \(table)\(filter)", -1, &statement, nil))
            let count = sqlite3_column_count(statement)
            var rows: [[String?]] = []
            var status = sqlite3_step(statement)
            while status == SQLITE_ROW {
                rows.append((0..<count).map { index in
                    guard let bytes = sqlite3_column_text(statement, index) else { return nil }
                    return String(decoding: UnsafeBufferPointer(start: bytes, count: Int(sqlite3_column_bytes(statement, index))), as: UTF8.self)
                })
                status = sqlite3_step(statement)
            }
            try check(status, expected: SQLITE_DONE)
            result[table] = rows.sorted { left, right in
                left.lexicographicallyPrecedes(right) { ($0 ?? "") < ($1 ?? "") }
            }
        }
        return result
    }

    func replace(_ snapshot: ProgressSnapshot, in db: OpaquePointer) throws {
        guard Set(snapshot.keys) == Set(tables) else { throw CloudError.invalidData }
        try check(sqlite3_exec(db, "BEGIN IMMEDIATE", nil, nil, nil))
        do {
            for table in tables.reversed() {
                let filter = table == "memorization_meta" ? " WHERE key IN ('milestones_seen','quran_completed_at')" : ""
                try check(sqlite3_exec(db, "DELETE FROM \(table)\(filter)", nil, nil, nil))
            }
            for table in tables {
                for row in snapshot[table, default: []] {
                    if table == "memorization_meta",
                       !["milestones_seen", "quran_completed_at"].contains(row.first.flatMap { $0 } ?? "") {
                        throw CloudError.invalidData
                    }
                    guard row.count == Self.columns[table]?.count else { throw CloudError.invalidData }
                    let placeholders = Array(repeating: "?", count: row.count).joined(separator: ",")
                    var statement: OpaquePointer?
                    defer { sqlite3_finalize(statement) }
                    try check(sqlite3_prepare_v2(db, "INSERT INTO \(table) (\(Self.list(table))) VALUES (\(placeholders))", -1, &statement, nil))
                    for (index, value) in row.enumerated() {
                        let slot = Int32(index + 1)
                        if let value {
                            try check(sqlite3_bind_text(statement, slot, value, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self)))
                        } else {
                            try check(sqlite3_bind_null(statement, slot))
                        }
                    }
                    try check(sqlite3_step(statement), expected: SQLITE_DONE)
                }
            }
            try check(sqlite3_exec(db, "COMMIT", nil, nil, nil))
        } catch {
            sqlite3_exec(db, "ROLLBACK", nil, nil, nil)
            throw error
        }
    }

    static func fingerprint(_ snapshot: ProgressSnapshot) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return SHA256.hash(data: try encoder.encode(snapshot)).map { String(format: "%02x", $0) }.joined()
    }

    private func check(_ status: Int32, expected: Int32 = SQLITE_OK) throws {
        guard status == expected else { throw CloudError.invalidData }
    }
}

extension QuranReadingDatabase {
    func cloudSnapshot(replacing snapshot: ProgressSnapshot? = nil) throws -> ProgressSnapshot {
        lock.lock()
        defer { lock.unlock() }
        guard let db else { throw CloudError.invalidData }
        if let snapshot { try ProgressDataset.khatma.replace(snapshot, in: db) }
        return try ProgressDataset.khatma.capture(db)
    }
}

extension MemorizationDatabase {
    func cloudSnapshot(replacing snapshot: ProgressSnapshot? = nil) throws -> ProgressSnapshot {
        lock.lock()
        defer { lock.unlock() }
        let db = try writableDatabaseLocked()
        if let snapshot { try ProgressDataset.memorization.replace(snapshot, in: db) }
        return try ProgressDataset.memorization.capture(db)
    }
}
