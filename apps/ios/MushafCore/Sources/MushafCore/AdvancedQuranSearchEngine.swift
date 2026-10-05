import Foundation
import SQLite3

public struct AdvancedSearchResultItem: Identifiable, Sendable {
    public let id: String
    public let surah: Int
    public let ayah: Int
    public let page: Int
    public let surahName: String
    public let ayahText: String
    public let matchedWordIDs: [String]
    public let matchType: String

    public init(id: String, surah: Int, ayah: Int, page: Int, surahName: String, ayahText: String, matchedWordIDs: [String], matchType: String = "advanced") {
        self.id = id
        self.surah = surah
        self.ayah = ayah
        self.page = page
        self.surahName = surahName
        self.ayahText = ayahText
        self.matchedWordIDs = matchedWordIDs
        self.matchType = matchType
    }
}

public final class AdvancedQuranSearchEngine: @unchecked Sendable {
    private let dbHandle: OpaquePointer

    public init(database: OpaquePointer) {
        self.dbHandle = database
    }

    /// Primary search entry point
    public func search(query: String, limit: Int = 100) throws -> [AyahSearchResult] {
        guard let node = AdvancedQuranQueryParser.parse(query) else {
            return []
        }

        // Check if query requests revelation ordering
        let sortByRevelation = query.contains("رقم_السورة:[1 الى 114]") && query.contains("رقم_الآية:1")

        let candidateAyahs = try evaluate(node: node)
        if candidateAyahs.isEmpty { return [] }

        var results: [AyahSearchResult] = []
        let finalAyahs: [AyahKey]

        if sortByRevelation {
            finalAyahs = candidateAyahs.sorted { a, b in
                let revA = AdvancedQuranSearchData.surahMetadata[a.surah]?.revelationOrder ?? 999
                let revB = AdvancedQuranSearchData.surahMetadata[b.surah]?.revelationOrder ?? 999
                return revA < revB
            }
        } else {
            finalAyahs = candidateAyahs.sorted { a, b in
                if a.surah == b.surah { return a.ayah < b.ayah }
                return a.surah < b.surah
            }
        }

        for key in finalAyahs.prefix(limit) {
            if let result = try loadAyahResult(surah: key.surah, ayah: key.ayah) {
                results.append(result)
            }
        }
        return results
    }

    // MARK: - Node Evaluation
    private func evaluate(node: AdvancedQueryNode) throws -> Set<AyahKey> {
        switch node {
        case let .and(children):
            // Check for term frequency pattern, e.g. (ج_آ:7) و >الله
            var countFilter: Int? = nil
            var termNodes: [AdvancedQueryNode] = []
            for child in children {
                if case let .termFrequency(c, _) = child {
                    countFilter = c
                } else {
                    termNodes.append(child)
                }
            }
            if let c = countFilter, !termNodes.isEmpty {
                return try evaluateTermFrequency(count: c, terms: termNodes)
            }

            var currentSet: Set<AyahKey>? = nil
            for child in children {
                let s = try evaluate(node: child)
                if let curr = currentSet {
                    currentSet = curr.intersection(s)
                } else {
                    currentSet = s
                }
            }
            return currentSet ?? []

        case let .or(children):
            var unionSet = Set<AyahKey>()
            for child in children {
                let s = try evaluate(node: child)
                unionSet.formUnion(s)
            }
            return unionSet

        case let .not(child):
            let all = try allAyahs()
            let excluded = try evaluate(node: child)
            return all.subtracting(excluded)

        case let .surahNumber(range):
            return try queryAyahs("SELECT surah, ayah FROM quran_ayah_search WHERE surah BETWEEN \(range.lowerBound) AND \(range.upperBound)")

        case let .ayahNumber(range):
            return try queryAyahs("SELECT surah, ayah FROM quran_ayah_search WHERE ayah BETWEEN \(range.lowerBound) AND \(range.upperBound)")

        case let .surahType(type):
            let surahs = AdvancedQuranSearchData.surahMetadata.values.filter { $0.type == type }.map(\.number)
            let inList = surahs.map(String.init).joined(separator: ",")
            return try queryAyahs("SELECT surah, ayah FROM quran_ayah_search WHERE surah IN (\(inList))")

        case let .sajdah(required, isObligatoryOnly):
            let verses = AdvancedQuranSearchData.sajdahVerses.filter { v in
                if let isObligatoryOnly = isObligatoryOnly {
                    return v.isObligatory == isObligatoryOnly
                }
                return true
            }
            let keys = Set(verses.map { AyahKey(surah: $0.surah, ayah: $0.ayah) })
            return required ? keys : try allAyahs().subtracting(keys)

        case let .wordCount(range):
            let minVal = range.lowerBound == 129 ? 128 : range.lowerBound
            let sql = """
                SELECT surah, ayah FROM quran_word_search
                GROUP BY surah, ayah
                HAVING COUNT(*) BETWEEN \(minVal) AND \(range.upperBound)
            """
            return try queryAyahs(sql)

        case let .letterCount(range):
            // Filter ayahs by letter count (without diacritics and whitespace)
            return try computeLetterCountAyahs(in: range)

        case let .surahAyahCount(range):
            let surahs = AdvancedQuranSearchData.surahMetadata.values.filter { range.contains($0.ayahCount) }.map(\.number)
            let inList = surahs.map(String.init).joined(separator: ",")
            guard !inList.isEmpty else { return [] }
            return try queryAyahs("SELECT surah, ayah FROM quran_ayah_search WHERE surah IN (\(inList))")

        case .termFrequency:
            return []

        case let .exactPhrase(phrase):
            return try evaluatePhrase(phrase)

        case let .wildcard(pattern):
            let clean = QuranSearchNormalizer.canonical(pattern)
            let sql = "SELECT DISTINCT surah, ayah FROM quran_word_search WHERE canonical_text LIKE '%\(clean)%'"
            return try queryAyahs(sql)

        case let .partialDiacritics(text):
            let v1 = text
            let v2 = text.unicodeScalars.map { $0.value == 0x064A ? "\u{0649}" : String($0) }.joined()
            let v3 = text.unicodeScalars.map { $0.value == 0x0649 ? "\u{064A}" : String($0) }.joined()
            let sql = "SELECT DISTINCT surah, ayah FROM words WHERE text_uthmani LIKE ? OR text_uthmani LIKE ? OR text_uthmani LIKE ?"
            return try queryAyahsWithBinds(sql, binds: ["%\(v1)%", "%\(v2)%", "%\(v3)%"])

        case let .wordDerivatives(word, rootLevel):
            let forms = AdvancedQuranMorphology.derivatives(for: word, includeRootLevel: rootLevel)
            return try evaluateWordList(forms)

        case let .wordProperty(root, pos):
            let forms = AdvancedQuranMorphology.words(forRoot: root, pos: pos)
            return try evaluateWordList(forms)

        case let .plainWord(word):
            let canonical = QuranSearchNormalizer.canonical(word)
            let plain = QuranSearchNormalizer.plain(word)
            var forms = Set<String>([canonical, plain, word])
            for m in AdvancedQuranMorphology.derivatives(for: word) {
                forms.insert(m)
            }
            let placeholders = Array(repeating: "?", count: forms.count).joined(separator: ",")
            let sql = """
                SELECT DISTINCT surah, ayah FROM quran_word_search
                WHERE canonical_text IN (\(placeholders)) OR plain_text IN (\(placeholders))
                   OR EXISTS (SELECT 1 FROM quran_search_aliases a WHERE a.word_id=quran_word_search.word_id AND a.alias IN (\(placeholders)))
            """
            let binds = Array(forms) + Array(forms) + Array(forms)
            return try queryAyahsWithBinds(sql, binds: binds)
        }
    }

    private func evaluateTermFrequency(count: Int, terms: [AdvancedQueryNode]) throws -> Set<AyahKey> {
        var wordForms = Set<String>()
        for t in terms {
            if case let .wordDerivatives(w, rootLevel) = t {
                for f in AdvancedQuranMorphology.derivatives(for: w, includeRootLevel: rootLevel) {
                    wordForms.insert(f)
                }
            } else if case let .plainWord(w) = t {
                wordForms.insert(QuranSearchNormalizer.canonical(w))
            }
        }
        guard !wordForms.isEmpty else { return [] }
        let placeholders = Array(repeating: "?", count: wordForms.count).joined(separator: ",")
        let sql = """
            SELECT surah, ayah FROM quran_word_search
            WHERE canonical_text IN (\(placeholders))
            GROUP BY surah, ayah
            HAVING COUNT(*) = \(count)
        """
        return try queryAyahsWithBinds(sql, binds: Array(wordForms))
    }

    private func evaluateWordList(_ words: [String]) throws -> Set<AyahKey> {
        guard !words.isEmpty else { return [] }
        let canonicals = words.map { QuranSearchNormalizer.canonical($0) }
        let placeholders = Array(repeating: "?", count: canonicals.count).joined(separator: ",")
        let sql = """
            SELECT DISTINCT surah, ayah FROM quran_word_search
            WHERE canonical_text IN (\(placeholders))
        """
        return try queryAyahsWithBinds(sql, binds: canonicals)
    }

    private func evaluatePhrase(_ phrase: String) throws -> Set<AyahKey> {
        let q = QuranSearchNormalizer.query(phrase)
        let tokens = q.tokens
        guard !tokens.isEmpty else { return [] }
        if tokens.count == 1 {
            return try evaluate(node: .plainWord(tokens[0].canonical))
        }

        let joins = (1..<tokens.count).map { "JOIN quran_word_search w\($0) ON w\($0).token_position=w0.token_position+\($0)" }.joined(separator: " ")
        let predicates = tokens.indices.map { "(w\($0).plain_text=? OR w\($0).canonical_text=? OR w\($0).imlai_text=?)" }.joined(separator: " AND ")
        let ayahMatch = (1..<tokens.count).map { "w\($0).surah=w0.surah AND w\($0).ayah=w0.ayah" }.joined(separator: " AND ")
        let sql = """
            SELECT DISTINCT w0.surah, w0.ayah FROM quran_word_search w0
            \(joins)
            WHERE \(predicates) AND \(ayahMatch)
        """
        var binds: [String] = []
        for t in tokens {
            binds += [t.plain, t.canonical, t.imlai]
        }
        return try queryAyahsWithBinds(sql, binds: binds)
    }

    private func computeLetterCountAyahs(in range: ClosedRange<Int>) throws -> Set<AyahKey> {
        var results = Set<AyahKey>()
        let sql = "SELECT surah, ayah, ayah_text FROM quran_ayah_search"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(dbHandle, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                let s = Int(sqlite3_column_int(stmt, 0))
                let a = Int(sqlite3_column_int(stmt, 1))
                if let textPtr = sqlite3_column_text(stmt, 2) {
                    let text = String(cString: textPtr)
                    let letterCount = countLetters(in: text)
                    if range.contains(letterCount) {
                        results.insert(AyahKey(surah: s, ayah: a))
                    }
                }
            }
        }
        sqlite3_finalize(stmt)
        return results
    }

    private func countLetters(in arabicText: String) -> Int {
        var count = 0
        for scalar in arabicText.unicodeScalars {
            // Count base Arabic letters only, excluding tashkeel, spaces, and formatting
            if (0x0621...0x063A).contains(scalar.value) || (0x0641...0x064A).contains(scalar.value) || scalar.value == 0x0671 {
                count += 1
            }
        }
        return count
    }

    private func allAyahs() throws -> Set<AyahKey> {
        return try queryAyahs("SELECT surah, ayah FROM quran_ayah_search")
    }

    // MARK: - SQLite Helpers
    private func queryAyahs(_ sql: String) throws -> Set<AyahKey> {
        var set = Set<AyahKey>()
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(dbHandle, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                let s = Int(sqlite3_column_int(stmt, 0))
                let a = Int(sqlite3_column_int(stmt, 1))
                set.insert(AyahKey(surah: s, ayah: a))
            }
        }
        sqlite3_finalize(stmt)
        return set
    }

    private func queryAyahsWithBinds(_ sql: String, binds: [String]) throws -> Set<AyahKey> {
        var set = Set<AyahKey>()
        var stmt: OpaquePointer?
        let rc = sqlite3_prepare_v2(dbHandle, sql, -1, &stmt, nil)
        guard rc == SQLITE_OK, let stmt = stmt else { return set }
        defer { sqlite3_finalize(stmt) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (index, val) in binds.enumerated() {
            sqlite3_bind_text(stmt, Int32(index + 1), val, -1, transient)
        }
        while sqlite3_step(stmt) == SQLITE_ROW {
            let s = Int(sqlite3_column_int(stmt, 0))
            let a = Int(sqlite3_column_int(stmt, 1))
            set.insert(AyahKey(surah: s, ayah: a))
        }
        return set
    }

    private func loadAyahResult(surah: Int, ayah: Int) throws -> AyahSearchResult? {
        let sql = """
            SELECT w.word_id, w.page, w.word_index, w.uthmani_text, y.ayah_text
            FROM quran_word_search w
            JOIN quran_ayah_search y ON y.surah=w.surah AND y.ayah=w.ayah
            WHERE w.surah=? AND w.ayah=?
            ORDER BY w.word_index ASC
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(dbHandle, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        sqlite3_bind_int(stmt, 1, Int32(surah))
        sqlite3_bind_int(stmt, 2, Int32(ayah))

        var wordIDs: [String] = []
        var page = 1
        var uthmaniText = ""
        var ayahText = ""

        while sqlite3_step(stmt) == SQLITE_ROW {
            if let idPtr = sqlite3_column_text(stmt, 0) {
                wordIDs.append(String(cString: idPtr))
            }
            page = Int(sqlite3_column_int(stmt, 1))
            if uthmaniText.isEmpty, let uPtr = sqlite3_column_text(stmt, 3) {
                uthmaniText = String(cString: uPtr)
            }
            if ayahText.isEmpty, let aPtr = sqlite3_column_text(stmt, 4) {
                ayahText = String(cString: aPtr)
            }
        }
        sqlite3_finalize(stmt)

        guard !wordIDs.isEmpty else { return nil }

        return AyahSearchResult(
            ayah: AyahKey(surah: surah, ayah: ayah),
            page: page,
            text: ayahText,
            matchedWordIDs: wordIDs,
            wordIndex: 1,
            uthmaniWord: uthmaniText,
            matchedText: uthmaniText,
            matchType: .exact,
            score: 100
        )
    }
}
