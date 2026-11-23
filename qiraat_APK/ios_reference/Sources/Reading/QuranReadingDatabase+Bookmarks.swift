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

        // On a conflict the stored row keeps its own id, so the returned bookmark carries that one, not the new UUID.
        let storedID = storedBookmarkIDLocked(db, type: type, surah: surah, ayah: ayah, page: page) ?? id
        return QuranBookmark(id: storedID, type: type, surah: surah, ayah: ayah, page: page, note: note, createdAt: createdAt)
    }

    private func storedBookmarkIDLocked(_ db: OpaquePointer, type: BookmarkType, surah: Int, ayah: Int, page: Int) -> String? {
        var lookup: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT id FROM bookmarks WHERE type = ? AND surah = ? AND ayah = ? AND page = ? LIMIT 1;",
                                 -1, &lookup, nil) == SQLITE_OK else { return nil }
        defer { sqlite3_finalize(lookup) }
        SQLiteBind.text(lookup, 1, type.rawValue)
        sqlite3_bind_int64(lookup, 2, Int64(surah))
        sqlite3_bind_int64(lookup, 3, Int64(ayah))
        sqlite3_bind_int64(lookup, 4, Int64(page))
        guard sqlite3_step(lookup) == SQLITE_ROW else { return nil }
        return sqliteColumnText(lookup, 0)
    }

    /// Removes the bookmark the reader's own state check found. That check ignores the pressed ayah for a page
    /// bookmark (`isPageBookmarked(page:)`) and the pressed page for an ayah bookmark (`isAyahBookmarked`), so the
    /// rows are matched the same way, and each goes through `removeBookmark(id:)`, which writes the tombstone for
    /// the row as it was stored.
    public func removeBookmark(type: BookmarkType, surah: Int, ayah: Int, page: Int) {
        for id in bookmarkIDs(type: type, surah: surah, ayah: ayah, page: page) {
            removeBookmark(id: id)
        }
    }

    private func bookmarkIDs(type: BookmarkType, surah: Int, ayah: Int, page: Int) -> [String] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }
        let isPage = type == .page
        let sql = isPage
            ? "SELECT id FROM bookmarks WHERE type = 'page' AND page = ?;"
            : "SELECT id FROM bookmarks WHERE type = 'ayah' AND surah = ? AND ayah = ?;"
        var stmt: OpaquePointer?
        var ids: [String] = []
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            if isPage {
                sqlite3_bind_int64(stmt, 1, Int64(page))
            } else {
                sqlite3_bind_int64(stmt, 1, Int64(surah))
                sqlite3_bind_int64(stmt, 2, Int64(ayah))
            }
            while sqlite3_step(stmt) == SQLITE_ROW, let text = sqlite3_column_text(stmt, 0) {
                ids.append(String(cString: text))
            }
        }
        sqlite3_finalize(stmt)
        return ids
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
                let num = Int(Self.latinDigits(query.trimmingCharacters(in: .whitespacesAndNewlines))) ?? -1
                sqlite3_bind_int64(stmt, 2, Int64(num))
                sqlite3_bind_int64(stmt, 3, Int64(num))
            }

            while sqlite3_step(stmt) == SQLITE_ROW {
                let id = sqliteColumnText(stmt, 0)
                let typeStr = sqliteColumnText(stmt, 1)
                let bType = BookmarkType(rawValue: typeStr) ?? .ayah
                let surah = Int(sqlite3_column_int64(stmt, 2))
                let ayah = Int(sqlite3_column_int64(stmt, 3))
                let page = Int(sqlite3_column_int64(stmt, 4))
                var note: String? = nil
                if let notePtr = sqlite3_column_text(stmt, 5) {
                    note = String(cString: notePtr)
                }
                let dateStr = sqliteColumnText(stmt, 6)
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

    /// Arabic-Indic (٠-٩) and Persian (۰-۹) digits as Latin digits, so a number typed on an Arabic keyboard finds
    /// the surah or page it names.
    static func latinDigits(_ text: String) -> String {
        String(text.unicodeScalars.map { scalar -> Character in
            switch scalar.value {
            case 0x0660...0x0669: Character(Unicode.Scalar(scalar.value - 0x0660 + 0x30)!)
            case 0x06F0...0x06F9: Character(Unicode.Scalar(scalar.value - 0x06F0 + 0x30)!)
            default: Character(scalar)
            }
        })
    }
}
