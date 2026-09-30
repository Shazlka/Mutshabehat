import Foundation
import SQLite3

public enum MushafDatabaseError: Error, Equatable {
    case openFailed(String)
    case queryFailed(String)
    case pageOutOfRange(Int)
    case unsupportedSchema(Int)
}

/// Read-only access to the bundled mushaf.sqlite (built by scripts/ios/build_mushaf_db.py).
/// Not thread-safe by itself; `MushafRepository` serialises access.
public final class MushafDatabase {
    public static let supportedSchemaVersion = 1
    private var handle: OpaquePointer?

    public init(url: URL) throws {
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX
        guard sqlite3_open_v2(url.path, &handle, flags, nil) == SQLITE_OK else {
            let message = handle.map { String(cString: sqlite3_errmsg($0)) } ?? "no handle"
            sqlite3_close(handle)
            throw MushafDatabaseError.openFailed(message)
        }
        let version = Int(try scalar("SELECT value FROM meta WHERE key = 'schema_version'") ?? "0") ?? 0
        guard version == Self.supportedSchemaVersion else { throw MushafDatabaseError.unsupportedSchema(version) }
    }

    deinit { sqlite3_close(handle) }

    public func surahs() throws -> [Surah] {
        try rows("SELECT number, name, ayah_count, first_page, last_page FROM surahs ORDER BY number") { s in
            Surah(number: s.int(0), name: s.text(1), ayahCount: s.int(2), firstPage: s.int(3), lastPage: s.int(4))
        }
    }

    public func page(_ number: Int) throws -> MushafPage {
        guard (1...mushafPageCount).contains(number) else { throw MushafDatabaseError.pageOutOfRange(number) }
        let metadata = try rows("""
            SELECT first_ayah_key, last_ayah_key, surah_names, juz, hizb, rub_in_juz FROM pages WHERE number = ?
            """, bind: [number]) { s in
            PageMetadata(page: number, firstAyah: AyahKey(s.text(0))!, lastAyah: AyahKey(s.text(1))!,
                         surahNames: s.text(2).split(separator: "|").map(String.init),
                         juz: s.int(3), hizb: s.int(4), rubInJuz: s.int(5))
        }.first!
        var decorations: [Int: LineDecoration] = [:]
        for (line, deco) in try rows("SELECT line, surah_header, basmala FROM decorations WHERE page = ?", bind: [number], { s in
            (s.int(0), LineDecoration(surahHeader: s.optionalInt(1), basmala: s.int(2) == 1))
        }) { decorations[line] = deco }
        let words = try rows("""
            SELECT id, line, index_in_line, surah, ayah, index_in_ayah, char_type, glyph, text_uthmani
            FROM words WHERE page = ? ORDER BY line, index_in_line
            """, bind: [number]) { s in
            MushafWord(id: s.text(0), page: number, line: s.int(1), indexInLine: s.int(2),
                       ayahKey: AyahKey(surah: s.int(3), ayah: s.int(4)), indexInAyah: s.int(5),
                       charType: CharType(rawValue: s.text(6)) ?? .other, glyph: s.text(7), textUthmani: s.text(8))
        }
        let byLine = Dictionary(grouping: words, by: \.line)
        let lines = (1...mushafLinesPerPage).map { n in
            MushafLine(number: n, words: byLine[n] ?? [], decoration: decorations[n])
        }
        return MushafPage(number: number, lines: lines, metadata: metadata)
    }

    /// First page of each juz, 1…30.
    public func juzStartPages() throws -> [Int: Int] {
        Dictionary(uniqueKeysWithValues: try rows("SELECT juz, MIN(number) FROM pages GROUP BY juz") { s in (s.int(0), s.int(1)) })
    }

    /// The page that contains the first word of an ayah (used by "go to ayah" and group links).
    public func page(of ayah: AyahKey) throws -> Int? {
        try rows("SELECT MIN(page) FROM words WHERE surah = ? AND ayah = ?", bind: [ayah.surah, ayah.ayah]) { s in
            s.optionalInt(0)
        }.first ?? nil
    }

    // MARK: - Minimal statement helpers

    struct Row {
        let stmt: OpaquePointer
        func int(_ i: Int32) -> Int { Int(sqlite3_column_int64(stmt, i)) }
        func optionalInt(_ i: Int32) -> Int? { sqlite3_column_type(stmt, i) == SQLITE_NULL ? nil : int(i) }
        func text(_ i: Int32) -> String { sqlite3_column_text(stmt, i).map { String(cString: $0) } ?? "" }
    }

    private func rows<T>(_ sql: String, bind: [Int] = [], _ map: (Row) throws -> T) throws -> [T] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else {
            throw MushafDatabaseError.queryFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(stmt) }
        for (i, value) in bind.enumerated() { sqlite3_bind_int64(stmt, Int32(i + 1), Int64(value)) }
        var result: [T] = []
        while true {
            let rc = sqlite3_step(stmt)
            if rc == SQLITE_DONE { break }
            guard rc == SQLITE_ROW else { throw MushafDatabaseError.queryFailed(String(cString: sqlite3_errmsg(handle))) }
            result.append(try map(Row(stmt: stmt)))
        }
        return result
    }

    private func scalar(_ sql: String) throws -> String? {
        try rows(sql) { $0.text(0) }.first
    }
}
