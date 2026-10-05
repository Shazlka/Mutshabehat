import Foundation
import SQLite3

public enum MushafDatabaseError: Error, Equatable {
    case openFailed(String)
    case queryFailed(String)
    case pageOutOfRange(Int)
    case unsupportedSchema(Int)
}

/// Read-only access to the bundled mushaf.sqlite (built by scripts/build_mushaf_db.py).
/// Not thread-safe; callers must serialise access (the app uses the main actor).
public final class MushafDatabase {
    public static let supportedSchemaVersion = 2
    private var handle: OpaquePointer?

    public init(url: URL) throws {
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX
        guard sqlite3_open_v2(url.path, &handle, flags, nil) == SQLITE_OK else {
            let message = handle.map { String(cString: sqlite3_errmsg($0)) } ?? "no handle"
            sqlite3_close(handle)
            handle = nil
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
        let metadataRows = try rows("""
            SELECT first_ayah_key, last_ayah_key, surah_names, juz, hizb, rub_in_juz FROM pages WHERE number = ?
            """, bind: [number]) { s in
            guard let firstAyah = AyahKey(s.text(0)) else {
                throw MushafDatabaseError.queryFailed("Invalid first ayah key '\(s.text(0))' on page \(number)")
            }
            guard let lastAyah = AyahKey(s.text(1)) else {
                throw MushafDatabaseError.queryFailed("Invalid last ayah key '\(s.text(1))' on page \(number)")
            }
            return PageMetadata(page: number, firstAyah: firstAyah, lastAyah: lastAyah,
                         surahNames: s.text(2).split(separator: "|").map(String.init),
                         juz: s.int(3), hizb: s.int(4), rubInJuz: s.int(5))
        }
        guard let metadata = metadataRows.first else {
            throw MushafDatabaseError.queryFailed("Missing metadata for page \(number)")
        }
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

    /// Indexed offline Quran search. All matching happens against derived columns; authoritative
    /// `words.text_uthmani` is returned unchanged for display.
    public func searchAyaat(matching text: String, mode: QuranSearchMode = .smart,
                            limit: Int = 50, surah: Int? = nil) throws -> [AyahSearchResult] {
        if let handle = handle, isAdvancedQuery(text) {
            let engine = AdvancedQuranSearchEngine(database: handle)
            return try engine.search(query: text, limit: limit)
        }

        let query = QuranSearchNormalizer.query(text)
        guard !query.tokens.isEmpty, limit > 0 else { return [] }
        if query.tokens.count > 1 {
            return try phraseSearch(query, mode: mode, limit: limit, surah: surah)
        }
        let token = query.tokens[0]
        var results = try exactWordSearch(token, original: query.original, mode: mode, limit: limit, surah: surah)
        if results.isEmpty, mode != .exact {
            results = try fuzzyWordSearch(token, includeRasm: mode == .broad, limit: limit, surah: surah)
        }
        return results
    }

    private func isAdvancedQuery(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.contains(":") || t.contains(">") || t.contains("\"") || t.contains("”") ||
               t.contains("“") || t.contains("«") || t.contains("»") || t.contains("{") ||
               t.contains("[") || t.contains("*") || t.contains(" و ") || t.contains(" أو ") ||
               t.contains(" او ") || t.contains("ليس") || t.contains("(") || t.contains(")") ||
               t.contains("الم المص")
    }

    private func exactWordSearch(_ token: QuranSearchToken, original: String, mode: QuranSearchMode,
                                 limit: Int, surah: Int?) throws -> [AyahSearchResult] {
        let scope = surah.map { " AND w.surah = \($0)" } ?? ""
        let whereClause = mode == .exact
            ? "(w.uthmani_text=? OR w.plain_text=?)"
            : "(w.uthmani_text=? OR w.plain_text=? OR w.imlai_text=? OR w.canonical_text=? OR EXISTS (SELECT 1 FROM quran_search_aliases a WHERE a.word_id=w.word_id AND a.alias=?))"
        let sql = """
            SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text,
              CASE WHEN w.uthmani_text=? THEN 'exact' WHEN w.plain_text=? THEN 'plain'
                   WHEN w.imlai_text=? THEN 'imlai' WHEN w.canonical_text=? THEN 'canonical'
                   ELSE 'alias' END,
              CASE WHEN w.uthmani_text=? THEN 100 WHEN w.plain_text=? THEN 95
                   WHEN w.imlai_text=? THEN 90 WHEN w.canonical_text=? THEN 85 ELSE 75 END
            FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah
            WHERE \(whereClause)\(scope)
            ORDER BY 9 DESC,w.surah,w.ayah,w.word_index LIMIT ?
            """
        var binds = [original, token.plain, token.imlai, token.canonical,
                     original, token.plain, token.imlai, token.canonical]
        if mode == .exact {
            binds += [original, token.plain]
        } else {
            binds += [original, token.plain, token.imlai, token.canonical, token.imlai]
        }
        binds.append(String(limit))
        return try searchRows(sql, binds: binds)
    }

    private func phraseSearch(_ query: QuranSearchQuery, mode: QuranSearchMode,
                              limit: Int, surah: Int?) throws -> [AyahSearchResult] {
        let tokens = query.tokens
        let joins = (1..<tokens.count).map { "JOIN quran_word_search w\($0) ON w\($0).token_position=w0.token_position+\($0)" }.joined(separator: " ")
        let ids = (0..<tokens.count).map { "w\($0).word_id" }.joined(separator: "||'|'||")
        let texts = (0..<tokens.count).map { "w\($0).uthmani_text" }.joined(separator: "||' '||")
        let predicates = tokens.indices.map { index in
            if mode == .exact { return "w\(index).plain_text=?" }
            return "(w\(index).plain_text=? OR w\(index).canonical_text=? OR w\(index).imlai_text=? OR EXISTS (SELECT 1 FROM quran_search_aliases a\(index) WHERE a\(index).word_id=w\(index).word_id AND a\(index).alias=?))"
        }.joined(separator: " AND ")
        let scope = surah.map { " AND w0.surah = \($0)" } ?? ""
        let sql = """
            SELECT w0.word_id,w0.surah,w0.ayah,w0.page,w0.word_index,w0.uthmani_text,y.ayah_text,
                   'imlai',90,\(ids),\(texts)
            FROM quran_word_search w0 \(joins) JOIN quran_ayah_search y ON y.surah=w0.surah AND y.ayah=w0.ayah
            WHERE \(predicates)\(scope) AND \((1..<tokens.count).map { "w\($0).surah=w0.surah AND w\($0).ayah=w0.ayah" }.joined(separator: " AND "))
            ORDER BY w0.surah,w0.ayah,w0.word_index LIMIT ?
            """
        var binds: [String] = []
        for token in tokens {
            if mode == .exact { binds.append(token.plain) }
            else { binds += [token.plain, token.canonical, token.imlai, token.imlai] }
        }
        binds.append(String(limit))
        return try searchRows(sql, binds: binds, idsColumn: 9, textColumn: 10)
    }

    private func fuzzyWordSearch(_ token: QuranSearchToken, includeRasm: Bool,
                                 limit: Int, surah: Int?) throws -> [AyahSearchResult] {
        // A repeated/extra character is the common mobile typo. Deleting one character produces a
        // small bounded set and keeps this first fallback on the canonical B-tree index.
        let characters = Array(token.canonical)
        let deletionForms = Set(characters.indices.map { index in
            String(characters.enumerated().compactMap { $0.offset == index ? nil : $0.element })
        }).filter { $0.count >= 3 }
        if !deletionForms.isEmpty {
            let placeholders = Array(repeating: "?", count: deletionForms.count).joined(separator: ",")
            let scope = surah.map { " AND w.surah = \($0)" } ?? ""
            let deletionMatches = try searchRows("""
                SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text,'fuzzy',70
                FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah
                WHERE w.canonical_text IN (\(placeholders))\(scope)
                ORDER BY w.surah,w.ayah,w.word_index LIMIT ?
                """, binds: Array(deletionForms) + [String(limit)])
            if !deletionMatches.isEmpty { return deletionMatches }
        }
        if includeRasm, token.rasmKey.count >= 3 {
            let scope = surah.map { " AND w.surah = \($0)" } ?? ""
            let rasm = try searchRows("""
                SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text,'rasm',50
                FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah
                WHERE w.rasm_key=?\(scope)
                ORDER BY surah,ayah,word_index LIMIT ?
                """, binds: [token.rasmKey, String(limit)])
            if !rasm.isEmpty { return rasm }
        }
        let length = token.canonical.count
        let forms = try textRows("""
            SELECT DISTINCT canonical_text FROM quran_word_search
            WHERE length(canonical_text) BETWEEN ? AND ?
            """, binds: [String(max(1, length - 2)), String(length + 2)])
        let threshold = length <= 4 ? 0.84 : 0.72
        let candidates = forms.map { ($0, QuranSearchNormalizer.similarity(token.canonical, $0)) }
            .filter { $0.1 >= threshold }.sorted { $0.1 > $1.1 }.prefix(512)
        guard !candidates.isEmpty else { return [] }
        let values = candidates.map(\.0)
        let placeholders = Array(repeating: "?", count: values.count).joined(separator: ",")
        let scope = surah.map { " AND w.surah = \($0)" } ?? ""
        var matches = try searchRows("""
            SELECT w.word_id,w.surah,w.ayah,w.page,w.word_index,w.uthmani_text,y.ayah_text,'fuzzy',65
            FROM quran_word_search w JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah
            WHERE w.canonical_text IN (\(placeholders))\(scope)
            ORDER BY surah,ayah,word_index LIMIT ?
            """, binds: values + [String(limit)])
        let scores = Dictionary(uniqueKeysWithValues: candidates.map { ($0.0, Int(($0.1 * 20).rounded()) + 55) })
        matches = matches.map { result in
            let form = QuranSearchNormalizer.canonical(result.uthmaniWord)
            return AyahSearchResult(ayah: result.ayah, page: result.page, text: result.text,
                                    matchedWordIDs: result.matchedWordIDs, wordIndex: result.wordIndex,
                                    uthmaniWord: result.uthmaniWord, matchedText: result.matchedText,
                                    matchType: .fuzzy, score: scores[form] ?? 65)
        }
        return matches.sorted { $0.score == $1.score ? $0.ayah.description < $1.ayah.description : $0.score > $1.score }
    }

    private func searchRows(_ sql: String, binds: [String], idsColumn: Int32? = nil,
                            textColumn: Int32? = nil) throws -> [AyahSearchResult] {
        try textBoundRows(sql, binds: binds) { row in
            let type = QuranSearchMatchType(rawValue: row.text(7)) ?? .canonical
            let ids = idsColumn.map { row.text($0).split(separator: "|").map(String.init) } ?? [row.text(0)]
            return AyahSearchResult(ayah: AyahKey(surah: row.int(1), ayah: row.int(2)), page: row.int(3),
                                    text: row.text(6), matchedWordIDs: ids, wordIndex: row.int(4),
                                    uthmaniWord: row.text(5), matchedText: textColumn.map { row.text($0) } ?? row.text(5),
                                    matchType: type, score: row.int(8))
        }
    }

    private func textRows(_ sql: String, binds: [String]) throws -> [String] {
        try textBoundRows(sql, binds: binds) { $0.text(0) }
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

    private func textBoundRows<T>(_ sql: String, binds: [String], _ map: (Row) throws -> T) throws -> [T] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else {
            throw MushafDatabaseError.queryFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(stmt) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (index, value) in binds.enumerated() {
            guard sqlite3_bind_text(stmt, Int32(index + 1), value, -1, transient) == SQLITE_OK else {
                throw MushafDatabaseError.queryFailed(String(cString: sqlite3_errmsg(handle)))
            }
        }
        var result: [T] = []
        while true {
            let code = sqlite3_step(stmt)
            if code == SQLITE_DONE { break }
            guard code == SQLITE_ROW else {
                throw MushafDatabaseError.queryFailed(String(cString: sqlite3_errmsg(handle)))
            }
            result.append(try map(Row(stmt: stmt)))
        }
        return result
    }

    private func scalar(_ sql: String) throws -> String? {
        try rows(sql) { $0.text(0) }.first
    }
}
