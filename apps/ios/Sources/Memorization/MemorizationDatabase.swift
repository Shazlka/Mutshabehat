import Foundation
import MushafCore
import SQLite3

public final class MemorizationDatabase: @unchecked Sendable {
    /// The handle and lock are internal so the history and transfer extensions in sibling files share them.
    var db: OpaquePointer?
    let lock = NSLock()
    public let fileURL: URL

    public init(url: URL? = nil, migrations: [MemorizationMigration] = MemorizationMigrations.all) {
        let targetURL: URL
        if let url = url {
            targetURL = url
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            targetURL = appSupport.appendingPathComponent("mushaf_memorization.sqlite")
        }
        try? FileManager.default.createDirectory(at: targetURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        self.fileURL = targetURL

        if sqlite3_open(targetURL.path, &db) != SQLITE_OK {
            db = nil
            return
        }

        executePragmas()
        runMigrations(migrations)

        if readSchemaVersionLocked() >= 1 {
            _ = getOrCreateDeviceIDLocked()
        }
    }

    deinit {
        if let db = db {
            sqlite3_close(db)
        }
    }

    private func executePragmas() {
        guard let db = db else { return }
        sqlite3_exec(db, "PRAGMA journal_mode = WAL;", nil, nil, nil)
        sqlite3_exec(db, "PRAGMA foreign_keys = ON;", nil, nil, nil)
    }

    private func runMigrations(_ migrations: [MemorizationMigration]) {
        guard let db = db else { return }
        let currentVersion = readSchemaVersionLocked()
        let pending = migrations
            .filter { $0.version > currentVersion }
            .sorted { $0.version < $1.version }

        for migration in pending {
            guard sqlite3_exec(db, "BEGIN IMMEDIATE;", nil, nil, nil) == SQLITE_OK else {
                break
            }
            do {
                try migration.apply(db)
                try setMetaDirect("schema_version", String(migration.version), on: db)
                guard sqlite3_exec(db, "COMMIT;", nil, nil, nil) == SQLITE_OK else {
                    sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
                    break
                }
            } catch {
                sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
                break
            }
        }
    }

    public var schemaVersion: Int {
        lock.lock()
        defer { lock.unlock() }
        return readSchemaVersionLocked()
    }

    func readSchemaVersionLocked() -> Int {
        guard let value = getMetaLocked("schema_version") else { return 0 }
        return Int(value) ?? 0
    }

    public func meta(_ key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return getMetaLocked(key)
    }

    func getMetaLocked(_ key: String) -> String? {
        guard let db = db else { return nil }
        let sql = "SELECT value FROM memorization_meta WHERE key = ? LIMIT 1;"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            return nil
        }
        defer { sqlite3_finalize(stmt) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_text(stmt, 1, key, -1, transient)
        if sqlite3_step(stmt) == SQLITE_ROW {
            if let textPtr = sqlite3_column_text(stmt, 0) {
                return String(cString: textPtr)
            }
        }
        return nil
    }

    public func setMeta(_ key: String, _ value: String) {
        lock.lock()
        defer { lock.unlock() }
        setMetaLocked(key, value)
    }

    func setMetaLocked(_ key: String, _ value: String) {
        guard let db = db else { return }
        try? setMetaDirect(key, value, on: db)
    }

    private func setMetaDirect(_ key: String, _ value: String, on db: OpaquePointer) throws {
        let sql = """
        INSERT INTO memorization_meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let msg = String(cString: sqlite3_errmsg(db))
            throw NSError(domain: "MemorizationDatabase", code: Int(sqlite3_errcode(db)), userInfo: [NSLocalizedDescriptionKey: msg])
        }
        defer { sqlite3_finalize(stmt) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_text(stmt, 1, key, -1, transient)
        sqlite3_bind_text(stmt, 2, value, -1, transient)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            let msg = String(cString: sqlite3_errmsg(db))
            throw NSError(domain: "MemorizationDatabase", code: Int(sqlite3_errcode(db)), userInfo: [NSLocalizedDescriptionKey: msg])
        }
    }

    public var deviceID: String {
        lock.lock()
        defer { lock.unlock() }
        return getOrCreateDeviceIDLocked()
    }

    func getOrCreateDeviceIDLocked() -> String {
        if let existing = getMetaLocked("device_id"), !existing.isEmpty {
            return existing
        }
        let newID = UUID().uuidString
        setMetaLocked("device_id", newID)
        return newID
    }

    public func loadRecords() -> [AyahKey: AyahMemorizationRecord] {
        lock.lock()
        defer { lock.unlock() }
        return loadRecordsLocked()
    }

    /// All ayah rows (or those matching a SQL condition). The lock must be held.
    func loadRecordsLocked(where condition: String? = nil) -> [AyahKey: AyahMemorizationRecord] {
        guard let db = db else { return [:] }

        let sql = """
        SELECT
          surah, ayah, status, review_strength, is_learning,
          first_memorized_at, last_status_changed_at, last_reviewed_at, next_review_at,
          review_count, successful_review_count, consecutive_successful_reviews, error_count,
          updated_at
        FROM memorization_ayahs\(condition.map { " WHERE " + $0 } ?? "");
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            return [:]
        }
        defer { sqlite3_finalize(stmt) }

        var results: [AyahKey: AyahMemorizationRecord] = [:]
        while sqlite3_step(stmt) == SQLITE_ROW {
            let surah = Int(sqlite3_column_int64(stmt, 0))
            let ayah = Int(sqlite3_column_int64(stmt, 1))
            let statusRaw = Int(sqlite3_column_int64(stmt, 2))
            let strengthRaw = Int(sqlite3_column_int64(stmt, 3))
            let isLearning = sqlite3_column_int64(stmt, 4) != 0

            let firstMemorizedAt: Date? = sqlite3_column_type(stmt, 5) == SQLITE_NULL ? nil : Date(epochMilliseconds: sqlite3_column_int64(stmt, 5))
            let lastStatusChangedAt: Date? = sqlite3_column_type(stmt, 6) == SQLITE_NULL ? nil : Date(epochMilliseconds: sqlite3_column_int64(stmt, 6))
            let lastReviewedAt: Date? = sqlite3_column_type(stmt, 7) == SQLITE_NULL ? nil : Date(epochMilliseconds: sqlite3_column_int64(stmt, 7))
            let nextReviewAt: Date? = sqlite3_column_type(stmt, 8) == SQLITE_NULL ? nil : Date(epochMilliseconds: sqlite3_column_int64(stmt, 8))

            let reviewCount = Int(sqlite3_column_int64(stmt, 9))
            let successfulReviewCount = Int(sqlite3_column_int64(stmt, 10))
            let consecutiveSuccessfulReviews = Int(sqlite3_column_int64(stmt, 11))
            let errorCount = Int(sqlite3_column_int64(stmt, 12))
            let updatedAt = Date(epochMilliseconds: sqlite3_column_int64(stmt, 13))

            guard let status = MemorizationStatus(rawValue: statusRaw),
                  let strength = ReviewStrength(rawValue: strengthRaw) else {
                continue
            }

            let record = AyahMemorizationRecord(
                surah: surah,
                ayah: ayah,
                status: status,
                reviewStrength: strength,
                isCurrentlyLearning: isLearning,
                firstMemorizedAt: firstMemorizedAt,
                lastStatusChangedAt: lastStatusChangedAt,
                lastReviewedAt: lastReviewedAt,
                nextReviewAt: nextReviewAt,
                reviewCount: reviewCount,
                successfulReviewCount: successfulReviewCount,
                consecutiveSuccessfulReviews: consecutiveSuccessfulReviews,
                errorCount: errorCount,
                updatedAt: updatedAt
            )
            results[record.key] = record
        }
        return results
    }

    func upsertRecordForTesting(_ record: AyahMemorizationRecord) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }

        let sql = """
        INSERT INTO memorization_ayahs (
          surah, ayah, status, review_strength, is_learning,
          first_memorized_at, last_status_changed_at, last_reviewed_at, next_review_at,
          review_count, successful_review_count, consecutive_successful_reviews, error_count,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(surah, ayah) DO UPDATE SET
          status = excluded.status,
          review_strength = excluded.review_strength,
          is_learning = excluded.is_learning,
          first_memorized_at = excluded.first_memorized_at,
          last_status_changed_at = excluded.last_status_changed_at,
          last_reviewed_at = excluded.last_reviewed_at,
          next_review_at = excluded.next_review_at,
          review_count = excluded.review_count,
          successful_review_count = excluded.successful_review_count,
          consecutive_successful_reviews = excluded.consecutive_successful_reviews,
          error_count = excluded.error_count,
          updated_at = excluded.updated_at;
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            return
        }
        defer { sqlite3_finalize(stmt) }

        sqlite3_bind_int64(stmt, 1, Int64(record.surah))
        sqlite3_bind_int64(stmt, 2, Int64(record.ayah))
        sqlite3_bind_int64(stmt, 3, Int64(record.status.rawValue))
        sqlite3_bind_int64(stmt, 4, Int64(record.reviewStrength.rawValue))
        sqlite3_bind_int64(stmt, 5, record.isCurrentlyLearning ? 1 : 0)

        if let d = record.firstMemorizedAt {
            sqlite3_bind_int64(stmt, 6, d.epochMilliseconds)
        } else {
            sqlite3_bind_null(stmt, 6)
        }

        if let d = record.lastStatusChangedAt {
            sqlite3_bind_int64(stmt, 7, d.epochMilliseconds)
        } else {
            sqlite3_bind_null(stmt, 7)
        }

        if let d = record.lastReviewedAt {
            sqlite3_bind_int64(stmt, 8, d.epochMilliseconds)
        } else {
            sqlite3_bind_null(stmt, 8)
        }

        if let d = record.nextReviewAt {
            sqlite3_bind_int64(stmt, 9, d.epochMilliseconds)
        } else {
            sqlite3_bind_null(stmt, 9)
        }

        sqlite3_bind_int64(stmt, 10, Int64(record.reviewCount))
        sqlite3_bind_int64(stmt, 11, Int64(record.successfulReviewCount))
        sqlite3_bind_int64(stmt, 12, Int64(record.consecutiveSuccessfulReviews))
        sqlite3_bind_int64(stmt, 13, Int64(record.errorCount))
        sqlite3_bind_int64(stmt, 14, record.updatedAt.epochMilliseconds)

        _ = sqlite3_step(stmt)
    }
}
