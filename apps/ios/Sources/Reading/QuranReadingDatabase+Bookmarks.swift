import Foundation
import MushafCore
import SQLite3

// Bookmarks of ayahs and pages.
extension QuranReadingDatabase {
    // MARK: - Bookmarks

    @discardableResult
    public func addBookmark(
        type: BookmarkType,
        surah: Int,
        ayah: Int,
        page: Int,
        note: String? = nil,
        createdAt: Date = Date()
    ) -> QuranBookmark? {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return nil }

        let id = UUID().uuidString
        let dateStr = Self.isoFormatter.string(from: createdAt)
        let sql = """
        INSERT INTO bookmarks (id, type, surah, ayah, page, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(type, surah, ayah, page) DO UPDATE SET
            note = excluded.note,
            created_at = excluded.created_at;
        """
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            SQLiteBind.text(stmt, 1, id)
            SQLiteBind.text(stmt, 2, type.rawValue)
            sqlite3_bind_int64(stmt, 3, Int64(surah))
            sqlite3_bind_int64(stmt, 4, Int64(ayah))
            sqlite3_bind_int64(stmt, 5, Int64(page))
            if let note = note {
                SQLiteBind.text(stmt, 6, note)
            } else {
                sqlite3_bind_null(stmt, 6)
            }
            SQLiteBind.text(stmt, 7, dateStr)
            _ = sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)

        return QuranBookmark(id: id, type: type, surah: surah, ayah: ayah, page: page, note: note, createdAt: createdAt)
    }

    public func removeBookmark(type: BookmarkType, surah: Int, ayah: Int, page: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        let sql = "DELETE FROM bookmarks WHERE type = ? AND surah = ? AND ayah = ? AND page = ?;"
        deleteWithTombstone(db, kind: "bookmark:\(type.rawValue)", surah: surah, ayah: ayah, page: page, sql: sql) { stmt in
            SQLiteBind.text(stmt, 1, type.rawValue)
            sqlite3_bind_int64(stmt, 2, Int64(surah))
            sqlite3_bind_int64(stmt, 3, Int64(ayah))
            sqlite3_bind_int64(stmt, 4, Int64(page))
        }
    }

    public func removeBookmark(id: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        var deletion: (kind: String, surah: Int, ayah: Int, page: Int)?
        var lookup: OpaquePointer?
        if sqlite3_prepare_v2(db, "SELECT type, surah, ayah, page FROM bookmarks WHERE id = ?", -1, &lookup, nil) == SQLITE_OK {
            SQLiteBind.text(lookup, 1, id)
            if sqlite3_step(lookup) == SQLITE_ROW, let typeText = sqlite3_column_text(lookup, 0) {
                deletion = ("bookmark:\(String(cString: typeText))",
                            Int(sqlite3_column_int64(lookup, 1)),
                            Int(sqlite3_column_int64(lookup, 2)),
                            Int(sqlite3_column_int64(lookup, 3)))
            }
        }
        sqlite3_finalize(lookup)

        guard let deletion else { return }
        deleteWithTombstone(db, kind: deletion.kind, surah: deletion.surah,
                            ayah: deletion.ayah, page: deletion.page,
                            sql: "DELETE FROM bookmarks WHERE id = ?;") { stmt in
            SQLiteBind.text(stmt, 1, id)
        }
    }

    public func isAyahBookmarked(surah: Int, ayah: Int) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return false }

        let sql = "SELECT 1 FROM bookmarks WHERE type = 'ayah' AND surah = ? AND ayah = ? LIMIT 1;"
        var stmt: OpaquePointer?
        var found = false
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(stmt, 1, Int64(surah))
            sqlite3_bind_int64(stmt, 2, Int64(ayah))
            if sqlite3_step(stmt) == SQLITE_ROW {
                found = true
            }
        }
        sqlite3_finalize(stmt)
        return found
    }

    public func isPageBookmarked(page: Int) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return false }

        let sql = "SELECT 1 FROM bookmarks WHERE type = 'page' AND page = ? LIMIT 1;"
        var stmt: OpaquePointer?
        var found = false
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(stmt, 1, Int64(page))
            if sqlite3_step(stmt) == SQLITE_ROW {
                found = true
            }
        }
        sqlite3_finalize(stmt)
        return found
    }

    public func bookmarkedAyahs(on page: Int) -> Set<AyahKey> {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        let sql = "SELECT surah, ayah FROM bookmarks WHERE type = 'ayah' AND page = ?;"
        var stmt: OpaquePointer?
        var results = Set<AyahKey>()
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(stmt, 1, Int64(page))
            while sqlite3_step(stmt) == SQLITE_ROW {
                let surah = Int(sqlite3_column_int64(stmt, 0))
                let ayah = Int(sqlite3_column_int64(stmt, 1))
                results.insert(AyahKey(surah: surah, ayah: ayah))
            }
        }
        sqlite3_finalize(stmt)
        return results
    }

    public func allBookmarks(type: BookmarkType? = nil, query: String? = nil) -> [QuranBookmark] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        var sql = "SELECT id, type, surah, ayah, page, note, created_at FROM bookmarks WHERE 1=1"
        if let type = type {
            sql += " AND type = '\(type.rawValue)'"
        }
        if let query = query, !query.trimmingCharacters(in: .whitespaces).isEmpty {
            sql += " AND (note LIKE ? OR surah = ? OR page = ?)"
        }
        sql += " ORDER BY created_at DESC;"

        var stmt: OpaquePointer?
        var results: [QuranBookmark] = []
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if let query = query, !query.trimmingCharacters(in: .whitespaces).isEmpty {
                let pattern = "%\(query)%"
                SQLiteBind.text(stmt, 1, pattern)
                let num = Int(query) ?? -1
                sqlite3_bind_int64(stmt, 2, Int64(num))
                sqlite3_bind_int64(stmt, 3, Int64(num))
            }

            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(stmt, 0))
                let typeStr = String(cString: sqlite3_column_text(stmt, 1))
                let bType = BookmarkType(rawValue: typeStr) ?? .ayah
                let surah = Int(sqlite3_column_int64(stmt, 2))
                let ayah = Int(sqlite3_column_int64(stmt, 3))
                let page = Int(sqlite3_column_int64(stmt, 4))
                var note: String? = nil
                if let notePtr = sqlite3_column_text(stmt, 5) {
                    note = String(cString: notePtr)
                }
                let dateStr = String(cString: sqlite3_column_text(stmt, 6))
                let date = Self.isoFormatter.date(from: dateStr) ?? Date()

                results.append(QuranBookmark(
                    id: id,
                    type: bType,
                    surah: surah,
                    ayah: ayah,
                    page: page,
                    note: note,
                    createdAt: date
                ))
            }
        }
        sqlite3_finalize(stmt)
        return results
    }
}
