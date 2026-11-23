import Foundation
import SQLite3

public struct MemorizationMigration: Sendable {
    public let version: Int
    public let apply: @Sendable (OpaquePointer) throws -> Void

    public init(version: Int, apply: @Sendable @escaping (OpaquePointer) throws -> Void) {
        self.version = version
        self.apply = apply
    }

    public init(version: Int, apply: @Sendable @escaping () throws -> Void) {
        self.version = version
        self.apply = { _ in try apply() }
    }
}

public enum MemorizationMigrations: Sendable {
    public static let all: [MemorizationMigration] = [
        MemorizationMigration(version: 1) { db in
            let schemaSQL = """
            CREATE TABLE memorization_ayahs (
              surah INTEGER NOT NULL, ayah INTEGER NOT NULL,
              status INTEGER NOT NULL CHECK(status BETWEEN 1 AND 4),
              review_strength INTEGER NOT NULL CHECK(review_strength BETWEEN 1 AND 5),
              is_learning INTEGER NOT NULL DEFAULT 0,
              first_memorized_at INTEGER, last_status_changed_at INTEGER, last_reviewed_at INTEGER, next_review_at INTEGER,
              review_count INTEGER NOT NULL DEFAULT 0, successful_review_count INTEGER NOT NULL DEFAULT 0,
              consecutive_successful_reviews INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0,
              updated_at INTEGER NOT NULL, PRIMARY KEY (surah, ayah));
            CREATE TABLE memorization_batches (
              id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, scope_json TEXT NOT NULL,
              ayah_count INTEGER NOT NULL, device_id TEXT NOT NULL, counts_for_streak INTEGER NOT NULL DEFAULT 0,
              gain_ayahs INTEGER NOT NULL DEFAULT 0, undone_at INTEGER, undoes_batch_id TEXT);
            CREATE TABLE memorization_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              batch_id TEXT NOT NULL REFERENCES memorization_batches(id) ON DELETE CASCADE,
              surah INTEGER NOT NULL, ayah INTEGER NOT NULL, at INTEGER NOT NULL,
              old_status INTEGER, new_status INTEGER NOT NULL, old_strength INTEGER, new_strength INTEGER NOT NULL,
              before_json TEXT, after_json TEXT NOT NULL);
            CREATE TABLE memorization_goals (id TEXT PRIMARY KEY, json TEXT NOT NULL);
            CREATE TABLE memorization_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE INDEX idx_mem_batches_created ON memorization_batches(created_at);
            CREATE INDEX idx_mem_events_at ON memorization_events(at);
            CREATE INDEX idx_mem_events_batch ON memorization_events(batch_id);
            CREATE INDEX idx_mem_events_ayah ON memorization_events(surah, ayah);
            """
            let rc = sqlite3_exec(db, schemaSQL, nil, nil, nil)
            guard rc == SQLITE_OK else {
                let message = String(cString: sqlite3_errmsg(db))
                throw NSError(domain: "MemorizationMigration", code: Int(rc), userInfo: [NSLocalizedDescriptionKey: message])
            }
        }
    ]
}
