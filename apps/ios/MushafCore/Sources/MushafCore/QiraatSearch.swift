import Foundation

public enum QiraatSearchQuery: Hashable, Sendable {
    case authority(String)
    case word(String, ignoreTashkeel: Bool = true)
    case category(String)
}

public enum QiraatSearchKind: String, Hashable, Sendable {
    case farsh = "فرش"
    case usul = "أصول"
}

/// One navigable locus. Multiword spans open at their source start token; text is never split or
/// reconstructed. Multiple matching faces/families at that anchor share one result and identifier.
public struct QiraatSearchResult: Identifiable, Hashable, Sendable {
    public let page: Int
    public let surah: Int
    public let ayah: Int
    public let token: Int
    public let displayText: String
    public let kinds: [QiraatSearchKind]
    public let recordCount: Int
    public var id: String { "\(page)-\(surah)-\(ayah)-\(token)" }
}

public struct QiraatSearchCategory: Identifiable, Hashable, Sendable {
    public let id: String
    public let nameAr: String
    /// Raw ruling count, including multiple rulings at one location and page-level conventions.
    public let rulingCount: Int
}

public struct QiraatSearchPageGroup: Identifiable, Sendable {
    public let page: Int
    public let results: [QiraatSearchResult]
    public var id: Int { page }
}

public struct QiraatSearchSurahGroup: Identifiable, Sendable {
    public let surah: Int
    public let pages: [QiraatSearchPageGroup]
    public var id: Int { surah }
}

/// Immutable offline snapshot. Construct on a background task (or use `QiraatSearch` below).
/// Queries perform no IO and do not alter the store, its live overlays, or authoritative text.
public final class QiraatSearchIndex: Sendable {
    public let categories: [QiraatSearchCategory]
    public let missingPages: [Int]
    private let entries: [Entry]
    private let locations: [QiraatSearchResult]
    private let entryLocations: [Int]
    private let authorityEntries: [String: [Int]]
    private let categoryEntries: [String: [Int]]

    private struct Entry: Sendable {
        let page: Int
        let surah: Int
        let ayah: Int
        let token: Int
        let displayText: String
        let texts: [String]
        let normalizedTexts: [[UInt8]]
        let kind: QiraatSearchKind
        let wordAnchored: Bool
        var id: String { "\(page)-\(surah)-\(ayah)-\(token)" }
    }

    public init(store: QiraatStore, wordPages: [MushafWordCoordinate: Int]) {
        var entries: [Entry] = []
        var authorities: [String: [Int]] = [:]
        var categoryEntries: [String: [Int]] = [:]
        var names: [String: String] = [:]
        var missing: [Int] = []
        let catalog = store.catalog

        func append(page: Int, surah: Int, ayah: Int, token: Int, text: String, alternatives: [String],
                    kind: QiraatSearchKind, wordAnchored: Bool, readingIds: [String], category: String? = nil) {
            let offset = entries.count
            let texts = ([text] + alternatives).filter { !$0.isEmpty }
            entries.append(Entry(page: page, surah: surah, ayah: ayah, token: token, displayText: text,
                                 texts: texts.map { $0.precomposedStringWithCanonicalMapping },
                                 normalizedTexts: texts.map { Array(QuranSearchNormalizer.canonical($0).utf8) },
                                 kind: kind, wordAnchored: wordAnchored))
            if let category { categoryEntries[category, default: []].append(offset) }
            guard wordAnchored else { return }
            var filterKeys: Set<String> = []
            for id in readingIds {
                if let narrator = catalog.narrator(id) {
                    filterKeys.insert(id)
                    filterKeys.insert(narrator.readerId)
                }
            }
            for id in filterKeys { authorities[id, default: []].append(offset) }
        }

        let resolved = QiraatResolvedPageIndex(store: store, wordPages: wordPages)
        missing = resolved.missingSnapshotPages
        for number in 1...mushafPageCount {
            guard let page = resolved.page(number) else { continue }
            for variant in page.variants {
                append(page: number, surah: variant.surah, ayah: variant.ayah, token: variant.startToken,
                       text: variant.hafsText, alternatives: [variant.variantText], kind: .farsh,
                       wordAnchored: true, readingIds: variant.readingIds)
            }
            for ruling in page.rulings {
                names[ruling.category] = names[ruling.category] ?? ruling.categoryAr
                append(page: number, surah: ruling.surah, ayah: ruling.ayah, token: ruling.startToken,
                       text: ruling.baseText, alternatives: [], kind: .usul, wordAnchored: ruling.wordAnchored,
                       readingIds: ruling.readings.map(\.readingId),
                       category: ruling.category)
            }
        }
        self.entries = entries
        // Establish navigation order once. Queries aggregate integer offsets instead of rebuilding
        // string keys and sorting thousands of locations on each keystroke.
        let grouped = Dictionary(grouping: entries.indices, by: { entries[$0].id })
        let ordered = grouped.values.compactMap(\.first).sorted {
            let lhs = entries[$0], rhs = entries[$1]
            return (lhs.surah, lhs.page, lhs.ayah, lhs.token) < (rhs.surah, rhs.page, rhs.ayah, rhs.token)
        }
        var entryLocations = Array(repeating: 0, count: entries.count)
        self.locations = ordered.enumerated().map { location, offset in
            let entry = entries[offset]
            for member in grouped[entry.id] ?? [] { entryLocations[member] = location }
            return QiraatSearchResult(page: entry.page, surah: entry.surah, ayah: entry.ayah,
                                      token: entry.token, displayText: entry.displayText, kinds: [], recordCount: 0)
        }
        self.entryLocations = entryLocations
        self.authorityEntries = authorities
        self.categoryEntries = categoryEntries
        self.missingPages = missing
        self.categories = names.keys.sorted().map {
            QiraatSearchCategory(id: $0, nameAr: names[$0] ?? $0, rulingCount: categoryEntries[$0]?.count ?? 0)
        }
    }

    /// Word scope is a substring search across source Hafs/variant text, with optional normalized
    /// matching. Disabling ignoreTashkeel preserves all marks (canonical Unicode composition only).
    public func search(_ query: QiraatSearchQuery) -> [QiraatSearchResult] {
        let offsets: [Int]
        switch query {
        case .authority(let id): offsets = authorityEntries[id] ?? []
        case .category(let id): offsets = categoryEntries[id] ?? []
        case .word(let text, let ignoreTashkeel):
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            let needle = ignoreTashkeel ? QuranSearchNormalizer.canonical(trimmed)
                : trimmed.precomposedStringWithCanonicalMapping
            guard !needle.isEmpty else { return [] }
            let bytes = Array(needle.utf8)
            offsets = entries.indices.filter { offset in
                let entry = entries[offset]
                guard entry.wordAnchored else { return false }
                if ignoreTashkeel {
                    return entry.normalizedTexts.contains { Self.contains($0, bytes) }
                }
                return entry.texts.contains { $0.contains(needle) }
            }
        }

        var counts = Array(repeating: 0, count: locations.count)
        var kinds = Array(repeating: UInt8(0), count: locations.count)
        // Prefer a match that carries source text; a few bundled rulings have an empty baseText and
        // their display text stays empty (never reconstructed).
        var firstMatches = Array(repeating: -1, count: locations.count)
        for offset in offsets {
            let location = entryLocations[offset]
            counts[location] += 1
            kinds[location] |= entries[offset].kind == .farsh ? 1 : 2
            if firstMatches[location] == -1 || (entries[firstMatches[location]].displayText.isEmpty
                                                  && !entries[offset].displayText.isEmpty) {
                firstMatches[location] = offset
            }
        }
        return locations.indices.compactMap { offset in
            guard counts[offset] > 0 else { return nil }
            let location = locations[offset]
            return QiraatSearchResult(page: location.page, surah: location.surah, ayah: location.ayah,
                                      token: location.token, displayText: entries[firstMatches[offset]].displayText,
                                      kinds: [.farsh, .usul].filter {
                                          kinds[offset] & ($0 == .farsh ? 1 : 2) != 0
                                      }, recordCount: counts[offset])
        }
    }

    /// Canonical search text has no combining marks; UTF-8 substring matching avoids repeated
    /// Unicode collation on the already-normalized corpus. Display strings remain untouched.
    private static func contains(_ text: [UInt8], _ needle: [UInt8]) -> Bool {
        guard !needle.isEmpty, text.count >= needle.count else { return false }
        for start in 0...(text.count - needle.count) where text[start] == needle[0] {
            var matches = true
            for index in 1..<needle.count where text[start + index] != needle[index] {
                matches = false
                break
            }
            if matches { return true }
        }
        return false
    }

    public static func group(_ results: [QiraatSearchResult]) -> [QiraatSearchSurahGroup] {
        let surahs = Dictionary(grouping: results, by: \.surah)
        return surahs.keys.sorted().map { surah in
            let pages = Dictionary(grouping: surahs[surah] ?? [], by: \.page)
            return QiraatSearchSurahGroup(surah: surah, pages: pages.keys.sorted().map { page in
                QiraatSearchPageGroup(page: page, results: (pages[page] ?? []).sorted {
                    ($0.ayah, $0.token) < ($1.ayah, $1.token)
                })
            })
        }
    }
}

/// Retain one service per search session/store. Concurrent callers share one background build.
/// The index is a point-in-time snapshot; create a new service after replacing the source store.
public actor QiraatSearch {
    private let store: QiraatStore
    private let databaseURL: URL
    private var build: Task<QiraatSearchIndex, Never>?

    public init(store: QiraatStore, databaseURL: URL) {
        self.store = store
        self.databaseURL = databaseURL
    }

    public func index() async -> QiraatSearchIndex {
        if let build { return await build.value }
        let store = self.store
        let databaseURL = self.databaseURL
        let task = Task.detached(priority: .userInitiated) {
            let wordPages = (try? MushafDatabase(url: databaseURL).wordPageIndex()) ?? [:]
            return QiraatSearchIndex(store: store, wordPages: wordPages)
        }
        build = task
        return await task.value
    }

    public func search(_ query: QiraatSearchQuery) async -> [QiraatSearchSurahGroup] {
        let index = await index()
        return QiraatSearchIndex.group(index.search(query))
    }
}
