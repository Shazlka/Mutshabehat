import Foundation

// The external reference data of the review editor: nquran.com «فروقات القراء» and
// «الشامل في قراءات الأئمة العشر». Display-only on the web and here: it informs the reviewer and is
// never written anywhere by itself. The JSON files are the web app's own (Generated/Review/reference).

public struct NquranReaderGroup: Codable, Hashable, Sendable {
    public let readers: [String]
    public let reading: String

    public init(readers: [String], reading: String) { self.readers = readers; self.reading = reading }
}

public struct NquranDifference: Codable, Hashable, Sendable {
    public let location: String
    public let groups: [NquranReaderGroup]

    public init(location: String, groups: [NquranReaderGroup]) { self.location = location; self.groups = groups }
}

public struct NquranAyahEntry: Codable, Hashable, Sendable {
    public let surah: String
    public let surahNumber: Int
    public let ayah: Int
    public let ayahText: String?
    public let sourceUrl: String
    public let differences: [NquranDifference]

    public init(surah: String = "", surahNumber: Int, ayah: Int, ayahText: String? = nil,
                sourceUrl: String = "", differences: [NquranDifference]) {
        self.surah = surah; self.surahNumber = surahNumber; self.ayah = ayah
        self.ayahText = ayahText; self.sourceUrl = sourceUrl; self.differences = differences
    }
}

public enum ReferenceCondition: String, Codable, Sendable, Hashable { case both, wasl, waqf }

public struct ShamilWajh: Codable, Hashable, Sendable {
    public let id: String
    public let wajh: Int
    public let description: String
    public let readingText: String?
    public let condition: ReferenceCondition
    public let conditionBasis: String
    /// الشامل narrator keys (`qalun`, `warsh`, …); see `ShamilMatching.narratorIds`.
    public let narrators: [String]
    public let type: ReadingKind
    public let category: String

    enum CodingKeys: String, CodingKey {
        case id, wajh, description, readingText, condition, conditionBasis, narrators, type, category
    }

    public init(id: String, wajh: Int = 1, description: String, readingText: String? = nil,
                condition: ReferenceCondition = .both, conditionBasis: String = "", narrators: [String],
                type: ReadingKind, category: String = "") {
        self.id = id; self.wajh = wajh; self.description = description; self.readingText = readingText
        self.condition = condition; self.conditionBasis = conditionBasis; self.narrators = narrators
        self.type = type; self.category = category
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        wajh = try c.decodeIfPresent(Int.self, forKey: .wajh) ?? 1
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        readingText = try c.decodeIfPresent(String.self, forKey: .readingText)
        condition = (try? c.decode(ReferenceCondition.self, forKey: .condition)) ?? .both
        conditionBasis = try c.decodeIfPresent(String.self, forKey: .conditionBasis) ?? ""
        narrators = try c.decodeIfPresent([String].self, forKey: .narrators) ?? []
        type = (try? c.decode(ReadingKind.self, forKey: .type)) ?? .usul
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
    }
}

public struct ShamilEntry: Codable, Hashable, Sendable {
    public enum Scope: String, Codable, Sendable, Hashable { case thisWord = "this_word", allQuran = "all_quran" }

    public let entryId: String
    public let page: Int
    public let ayahs: [Int]
    public let words: [String]
    public let type: ReadingKind?
    public let category: String?
    public let sourceDifference: NquranDifference?
    public let sourceUrl: String?
    public let scope: Scope
    public let sourceText: String
    public let flags: [String]
    public let wajhs: [ShamilWajh]

    enum CodingKeys: String, CodingKey {
        case entryId, page, ayahs, words, type, category, sourceDifference, sourceUrl, scope, sourceText, flags, wajhs
    }

    public init(entryId: String, page: Int = 0, ayahs: [Int], words: [String], type: ReadingKind? = nil,
                category: String? = nil, sourceDifference: NquranDifference? = nil, sourceUrl: String? = nil,
                scope: Scope = .thisWord, sourceText: String = "", flags: [String] = [], wajhs: [ShamilWajh] = []) {
        self.entryId = entryId; self.page = page; self.ayahs = ayahs; self.words = words; self.type = type
        self.category = category; self.sourceDifference = sourceDifference; self.sourceUrl = sourceUrl
        self.scope = scope; self.sourceText = sourceText; self.flags = flags; self.wajhs = wajhs
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        entryId = try c.decode(String.self, forKey: .entryId)
        page = try c.decodeIfPresent(Int.self, forKey: .page) ?? 0
        ayahs = try c.decodeIfPresent([Int].self, forKey: .ayahs) ?? []
        words = try c.decodeIfPresent([String].self, forKey: .words) ?? []
        type = try? c.decode(ReadingKind.self, forKey: .type)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        sourceDifference = try c.decodeIfPresent(NquranDifference.self, forKey: .sourceDifference)
        sourceUrl = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        scope = (try? c.decode(Scope.self, forKey: .scope)) ?? .thisWord
        sourceText = try c.decodeIfPresent(String.self, forKey: .sourceText) ?? ""
        flags = try c.decodeIfPresent([String].self, forKey: .flags) ?? []
        wajhs = try c.decodeIfPresent([ShamilWajh].self, forKey: .wajhs) ?? []
    }
}

/// Lazy, cached, thread-safe access to the per-surah reference files. Loading a surah decodes up to
/// about 1 MB of JSON, so callers on the main actor should hop to a background task first.
public final class ReferenceLibrary: @unchecked Sendable {
    private let directory: URL
    private let lock = NSLock()
    private var nquranCache: [Int: [NquranAyahEntry]] = [:]
    private var shamilCache: [Int: [ShamilEntry]] = [:]
    private lazy var shamilSurahs: Set<Int> = loadShamilIndex()

    public init(directory: URL) { self.directory = directory }

    /// nquran covers all 114 surahs; anything outside 1…114 has no reference (empty, not an error).
    public func nquran(surah: Int) throws -> [NquranAyahEntry] {
        guard (1...114).contains(surah) else { return [] }
        if let cached = lock.withLock({ nquranCache[surah] }) { return cached }
        let entries = try decode([NquranAyahEntry].self, name: "nquran/surah-\(Self.file(surah)).json")
        lock.withLock { nquranCache[surah] = entries }
        return entries
    }

    /// Coverage comes from `shamil/index.json`, not from 1…114: a missing file is not an error.
    public func hasShamil(surah: Int) -> Bool { lock.withLock { shamilSurahs.contains(surah) } }

    public func shamil(surah: Int) throws -> [ShamilEntry]? {
        guard hasShamil(surah: surah) else { return nil }
        if let cached = lock.withLock({ shamilCache[surah] }) { return cached }
        let entries = try decode([ShamilEntry].self, name: "shamil/surah-\(Self.file(surah)).json")
        lock.withLock { shamilCache[surah] = entries }
        return entries
    }

    private static func file(_ surah: Int) -> String { String(format: "%03d", surah) }

    private func decode<T: Decodable>(_ type: T.Type, name: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(contentsOf: directory.appendingPathComponent(name)))
    }

    private func loadShamilIndex() -> Set<Int> {
        struct Index: Decodable { let surahs: [String: JSONValue] }
        guard let index = try? decode(Index.self, name: "shamil/index.json") else { return [] }
        return Set(index.surahs.keys.compactMap(Int.init))
    }
}
