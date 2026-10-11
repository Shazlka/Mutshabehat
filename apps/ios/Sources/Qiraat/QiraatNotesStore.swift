import Foundation
import MushafCore
import Observation
import SQLite3

struct QiraatNote: Identifiable, Equatable, Sendable {
    let id: String
    let surah: Int
    let ayah: Int
    let token: Int
    let page: Int
    let favorite: Bool
    let note: String
    let createdAt: Date
    let updatedAt: Date
}

/// Personal annotations only. The Quran and Qiraat stores remain read-only.
@MainActor
@Observable
final class QiraatNotesStore {
    static let shared = QiraatNotesStore()
    let fileURL: URL
    private(set) var notes: [QiraatNote] = []
    private(set) var loadError: String?
    @ObservationIgnored var onDataChanged: (() -> Void)?
    @ObservationIgnored private var connection: Connection?

    // SQLite is accessed on the main actor; the wrapper also closes failed opens and deinitialized stores.
    private final class Connection: @unchecked Sendable {
        var handle: OpaquePointer?
        deinit { sqlite3_close(handle) }
    }

    init(url: URL? = nil) {
        let target: URL
        if let url {
            target = url
        } else {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-qiraat-notes-fresh") {
                target = FileManager.default.temporaryDirectory
                    .appendingPathComponent("qiraat-notes-\(UUID())", isDirectory: true)
                    .appendingPathComponent("mushaf_qiraat_notes.sqlite")
            } else {
                target = Self.defaultURL
            }
            #else
            target = Self.defaultURL
            #endif
        }
        fileURL = target
        do {
            try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            let opened = Connection()
            guard sqlite3_open(target.path, &opened.handle) == SQLITE_OK else { throw Self.failure() }
            connection = opened
            sqlite3_busy_timeout(opened.handle, 3_000)
            try execute("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
            let version = try schemaVersion(on: opened.handle)
            guard version <= 1 else { throw Self.failure("إصدار قاعدة الملاحظات أحدث من التطبيق.") }
            if version == 0 {
                try transaction {
                    try execute("""
                    CREATE TABLE qiraat_notes (
                        id TEXT PRIMARY KEY NOT NULL,
                        surah INTEGER NOT NULL CHECK(surah BETWEEN 1 AND 114),
                        ayah INTEGER NOT NULL CHECK(ayah BETWEEN 1 AND 286),
                        token INTEGER NOT NULL CHECK(token > 0),
                        page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
                        favorite INTEGER NOT NULL CHECK(favorite IN (0, 1)),
                        note TEXT NOT NULL,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL,
                        UNIQUE(surah, ayah, token)
                    );
                    PRAGMA user_version = 1;
                    """)
                }
            }
            notes = try readNotes(on: opened.handle)
        } catch {
            connection = nil
            loadError = error.localizedDescription
        }
    }

    private static var defaultURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("mushaf_qiraat_notes.sqlite")
    }

    func list() throws -> [QiraatNote] {
        guard let connection else { throw Self.failure(loadError) }
        return try readNotes(on: connection.handle)
    }

    func note(surah: Int, ayah: Int, token: Int) -> QiraatNote? {
        notes.first { $0.surah == surah && $0.ayah == ayah && $0.token == token }
    }

    func setFavorite(_ favorite: Bool, page: Int, surah: Int, ayah: Int, token: Int) throws {
        try save(page: page, surah: surah, ayah: ayah, token: token, favorite: favorite,
                 text: note(surah: surah, ayah: ayah, token: token)?.note ?? "")
    }

    func setNote(_ text: String, page: Int, surah: Int, ayah: Int, token: Int) throws {
        try save(page: page, surah: surah, ayah: ayah, token: token,
                 favorite: note(surah: surah, ayah: ayah, token: token)?.favorite ?? false, text: text)
    }

    func delete(id: String) throws {
        try statement("DELETE FROM qiraat_notes WHERE id = ?") { statement in
            bind(id, to: statement, at: 1)
            guard sqlite3_step(statement) == SQLITE_DONE else { throw Self.failure() }
        }
        try didChange()
    }

    private func save(page: Int, surah: Int, ayah: Int, token: Int, favorite: Bool, text: String) throws {
        guard Self.validAnchor(page: page, surah: surah, ayah: ayah, token: token), !text.contains("\0") else {
            throw Self.failure("موضع الكلمة أو الملاحظة غير صالح.")
        }
        let old = note(surah: surah, ayah: ayah, token: token)
        if !favorite && text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            if let old { try delete(id: old.id) }
            else if connection == nil { throw Self.failure(loadError) }
            return
        }
        let now = Date().normalizedToMilliseconds
        let row = QiraatNote(id: old?.id ?? UUID().uuidString, surah: surah, ayah: ayah, token: token, page: page,
                            favorite: favorite, note: text, createdAt: old?.createdAt ?? now, updatedAt: now)
        try write(row)
        try didChange()
    }

    /// Validate the incoming file before replacing rows in one transaction, retaining the live WAL handle.
    func importDatabase(_ data: Data) throws {
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("notes-import-\(UUID()).sqlite")
        defer {
            for suffix in ["", "-wal", "-shm"] { try? FileManager.default.removeItem(atPath: temporary.path + suffix) }
        }
        try data.write(to: temporary)
        guard SQLiteSnapshot.integrityCheck(at: temporary) else { throw Self.failure("ملف الملاحظات غير صالح.") }
        let incoming = Connection()
        guard sqlite3_open_v2(temporary.path, &incoming.handle, SQLITE_OPEN_READONLY, nil) == SQLITE_OK,
              try schemaVersion(on: incoming.handle) == 1 else { throw Self.failure("إصدار ملف الملاحظات غير مدعوم.") }
        let rows = try readNotes(on: incoming.handle)
        try transaction {
            try execute("DELETE FROM qiraat_notes;")
            for row in rows { try write(row, upsert: false) }
        }
        try didChange()
    }

    private func didChange() throws {
        notes = try list()
        onDataChanged?()
    }

    private func transaction(_ body: () throws -> Void) throws {
        try execute("BEGIN IMMEDIATE;")
        do {
            try body()
            try execute("COMMIT;")
        } catch {
            try? execute("ROLLBACK;")
            throw error
        }
    }

    private func execute(_ sql: String) throws {
        guard let connection, sqlite3_exec(connection.handle, sql, nil, nil, nil) == SQLITE_OK else {
            throw Self.failure(loadError)
        }
    }

    private func statement(_ sql: String, _ body: (OpaquePointer) throws -> Void) throws {
        guard let connection else { throw Self.failure(loadError) }
        var prepared: OpaquePointer?
        guard sqlite3_prepare_v2(connection.handle, sql, -1, &prepared, nil) == SQLITE_OK, let prepared else {
            throw Self.failure()
        }
        defer { sqlite3_finalize(prepared) }
        try body(prepared)
    }

    private func write(_ row: QiraatNote, upsert: Bool = true) throws {
        let conflict = upsert ? """
            ON CONFLICT(surah, ayah, token) DO UPDATE SET page = excluded.page,
            favorite = excluded.favorite, note = excluded.note, updated_at = excluded.updated_at
            """ : ""
        try statement("INSERT INTO qiraat_notes (id, surah, ayah, token, page, favorite, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \(conflict)") { stmt in
            bind(row.id, to: stmt, at: 1)
            for (offset, value) in [row.surah, row.ayah, row.token, row.page, row.favorite ? 1 : 0].enumerated() {
                sqlite3_bind_int64(stmt, Int32(offset + 2), Int64(value))
            }
            bind(row.note, to: stmt, at: 7)
            sqlite3_bind_int64(stmt, 8, row.createdAt.epochMilliseconds)
            sqlite3_bind_int64(stmt, 9, row.updatedAt.epochMilliseconds)
            guard sqlite3_step(stmt) == SQLITE_DONE else { throw Self.failure() }
        }
    }

    private func bind(_ value: String, to statement: OpaquePointer, at index: Int32) {
        sqlite3_bind_text(statement, index, value, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    }

    private func schemaVersion(on db: OpaquePointer?) throws -> Int {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "PRAGMA user_version", -1, &stmt, nil) == SQLITE_OK else { throw Self.failure() }
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_step(stmt) == SQLITE_ROW else { throw Self.failure() }
        return Int(sqlite3_column_int(stmt, 0))
    }

    private func readNotes(on db: OpaquePointer?) throws -> [QiraatNote] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT id, surah, ayah, token, page, favorite, note, created_at, updated_at FROM qiraat_notes ORDER BY page, surah, ayah, token", -1, &stmt, nil) == SQLITE_OK else { throw Self.failure() }
        defer { sqlite3_finalize(stmt) }
        var result: [QiraatNote] = []
        var step = sqlite3_step(stmt)
        while step == SQLITE_ROW {
            guard sqlite3_column_type(stmt, 0) == SQLITE_TEXT, sqlite3_column_type(stmt, 6) == SQLITE_TEXT,
                  [1, 2, 3, 4, 5, 7, 8].allSatisfy({ sqlite3_column_type(stmt, Int32($0)) == SQLITE_INTEGER }) else { throw Self.failure() }
            let favorite = sqlite3_column_int64(stmt, 5)
            guard (0...1).contains(favorite) else { throw Self.failure() }
            let row = QiraatNote(id: try readText(stmt, column: 0), surah: Int(sqlite3_column_int64(stmt, 1)),
                ayah: Int(sqlite3_column_int64(stmt, 2)), token: Int(sqlite3_column_int64(stmt, 3)),
                page: Int(sqlite3_column_int64(stmt, 4)), favorite: favorite == 1,
                note: try readText(stmt, column: 6), createdAt: try readDate(stmt, column: 7),
                updatedAt: try readDate(stmt, column: 8))
            guard UUID(uuidString: row.id) != nil,
                  Self.validAnchor(page: row.page, surah: row.surah, ayah: row.ayah, token: row.token) else { throw Self.failure() }
            result.append(row)
            step = sqlite3_step(stmt)
        }
        guard step == SQLITE_DONE else { throw Self.failure() }
        return result
    }

    private func readText(_ statement: OpaquePointer?, column: Int32) throws -> String {
        guard let bytes = sqlite3_column_text(statement, column) else { throw Self.failure() }
        let buffer = UnsafeBufferPointer(start: bytes, count: Int(sqlite3_column_bytes(statement, column)))
        guard let text = String(bytes: buffer, encoding: .utf8), !text.contains("\0") else { throw Self.failure() }
        return text
    }

    private func readDate(_ statement: OpaquePointer?, column: Int32) throws -> Date {
        let milliseconds = sqlite3_column_int64(statement, column)
        let date = Date(epochMilliseconds: milliseconds)
        // Reject values that would overflow or lose precision when restored through Date.
        guard Int64(exactly: (date.timeIntervalSince1970 * 1_000).rounded()) == milliseconds else {
            throw Self.failure()
        }
        return date
    }

    private static func validAnchor(page: Int, surah: Int, ayah: Int, token: Int) -> Bool {
        (1...604).contains(page) && (1...114).contains(surah) && (1...286).contains(ayah) && token > 0
    }

    private static func failure(_ message: String? = nil) -> NSError {
        NSError(domain: "QiraatNotes", code: 1,
                userInfo: [NSLocalizedDescriptionKey: message ?? "تعذر قراءة الملاحظات أو حفظها. أعد المحاولة."])
    }
}
