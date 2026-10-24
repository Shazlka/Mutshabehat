import Foundation

/// One occurrence of an أصول ruling in the Mushaf.
public struct UsulPlace: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let page: Int
    public let surah: Int
    public let ayah: Int
    public let startToken: Int
    public let endAyah: Int
    public let endToken: Int
    public let baseText: String
    /// All narrator/reader-specific faces recorded for this one navigable locus.
    public let rulings: [QiraatRuling]

    public var token: Int { startToken }

    public init(
        id: String? = nil,
        page: Int,
        surah: Int,
        ayah: Int,
        startToken: Int,
        endAyah: Int? = nil,
        endToken: Int? = nil,
        baseText: String,
        rulings: [QiraatRuling] = []
    ) {
        let resolvedEndAyah = endAyah ?? ayah
        let resolvedEndToken = endToken ?? startToken
        self.id = id ?? "\(page)-\(surah)-\(ayah)-\(startToken)-\(resolvedEndAyah)-\(resolvedEndToken)"
        self.page = page
        self.surah = surah
        self.ayah = ayah
        self.startToken = startToken
        self.endAyah = resolvedEndAyah
        self.endToken = resolvedEndToken
        self.baseText = baseText
        self.rulings = rulings
    }
}

/// An أصول category (باب من أبواب الأصول) aggregating all its occurrences across the Mushaf.
public struct UsulCategory: Codable, Sendable, Hashable, Identifiable {
    public var id: String { code }
    public let code: String
    public var category: String { code }
    public let categoryAr: String
    public let color: String
    public let count: Int
    public let places: [UsulPlace]

    public init(
        code: String,
        categoryAr: String,
        color: String,
        count: Int? = nil,
        places: [UsulPlace] = []
    ) {
        self.code = code
        self.categoryAr = categoryAr
        self.color = color
        self.count = count ?? places.count
        self.places = places
    }

    public init(
        category: String,
        categoryAr: String,
        color: String,
        places: [UsulPlace]
    ) {
        self.code = category
        self.categoryAr = categoryAr
        self.color = color
        self.count = places.count
        self.places = places
    }
}

/// Aggregates and indexes all 23 أصول categories across all 604 pages of the Mushaf.
public struct UsulIndex: Sendable {
    public let categories: [UsulCategory]

    public var count: Int {
        categories.reduce(0) { $0 + $1.count }
    }

    public init(categories: [UsulCategory] = []) {
        self.categories = categories
    }

    private struct LocusKey: Hashable {
        let surah: Int
        let ayah: Int
        let startToken: Int
        let endAyah: Int
        let endToken: Int
    }

    /// Builds the list from all 604 snapshot files. The database-derived `wordPages` map is the
    /// authority for navigation; records whose start coordinate is absent are not navigable and are
    /// therefore omitted. Rows sharing a category and complete locus span become one place while
    /// their reader/narrator-specific details remain available in `UsulPlace.rulings`.
    public static func build(
        store: QiraatStore?,
        wordPages: [MushafWordCoordinate: Int]
    ) -> [UsulCategory] {
        guard let store else { return [] }

        struct CategoryAccumulator {
            var categoryAr: String
            var color: String
            var rulingsByLocus: [LocusKey: [QiraatRuling]]
        }

        var map: [String: CategoryAccumulator] = [:]

        for pageNumber in 1...mushafPageCount {
            guard let pageData = store.page(pageNumber) else { continue }
            for ruling in pageData.rulings {
                let coordinate = MushafWordCoordinate(
                    surah: ruling.surah,
                    ayah: ruling.ayah,
                    token: ruling.startToken
                )
                guard wordPages[coordinate] != nil else { continue }

                let locus = LocusKey(
                    surah: ruling.surah,
                    ayah: ruling.ayah,
                    startToken: ruling.startToken,
                    endAyah: ruling.endAyah ?? ruling.ayah,
                    endToken: ruling.endToken
                )

                if var existing = map[ruling.category] {
                    existing.rulingsByLocus[locus, default: []].append(ruling)
                    if existing.categoryAr.isEmpty && !ruling.categoryAr.isEmpty {
                        existing.categoryAr = ruling.categoryAr
                    }
                    if existing.color.isEmpty && !ruling.color.isEmpty {
                        existing.color = ruling.color
                    }
                    map[ruling.category] = existing
                } else {
                    map[ruling.category] = CategoryAccumulator(
                        categoryAr: ruling.categoryAr,
                        color: ruling.color,
                        rulingsByLocus: [locus: [ruling]]
                    )
                }
            }
        }

        var categories = map.map { code, acc in
            let places = acc.rulingsByLocus.map { locus, rulings in
                let coordinate = MushafWordCoordinate(
                    surah: locus.surah,
                    ayah: locus.ayah,
                    token: locus.startToken
                )
                let baseText = rulings.lazy.map(\.baseText).first { !$0.isEmpty } ?? ""
                return UsulPlace(
                    id: "\(code)-\(locus.surah)-\(locus.ayah)-\(locus.startToken)-\(locus.endAyah)-\(locus.endToken)",
                    page: wordPages[coordinate]!,
                    surah: locus.surah,
                    ayah: locus.ayah,
                    startToken: locus.startToken,
                    endAyah: locus.endAyah,
                    endToken: locus.endToken,
                    baseText: baseText,
                    rulings: rulings.sorted { $0.id < $1.id }
                )
            }.sorted(by: placePrecedes)

            return UsulCategory(
                code: code,
                categoryAr: acc.categoryAr,
                color: acc.color,
                count: places.count,
                places: places
            )
        }

        // Order by count descending; stable tie-breaker on category code
        categories.sort { a, b in
            if a.count != b.count {
                return a.count > b.count
            }
            return a.code < b.code
        }

        return categories
    }

    private static func placePrecedes(_ lhs: UsulPlace, _ rhs: UsulPlace) -> Bool {
        if lhs.page != rhs.page { return lhs.page < rhs.page }
        if lhs.surah != rhs.surah { return lhs.surah < rhs.surah }
        if lhs.ayah != rhs.ayah { return lhs.ayah < rhs.ayah }
        if lhs.startToken != rhs.startToken { return lhs.startToken < rhs.startToken }
        if lhs.endAyah != rhs.endAyah { return lhs.endAyah < rhs.endAyah }
        return lhs.endToken < rhs.endToken
    }
}

/// Builds the expensive 604-file index once per store/database pair and shares concurrent callers.
public actor UsulIndexCache {
    public static let shared = UsulIndexCache()

    private struct Key: Hashable {
        let store: ObjectIdentifier
        let databasePath: String
        let hidesUsul: Bool
    }

    private var cached: [Key: [UsulCategory]] = [:]
    private var inFlight: [Key: Task<[UsulCategory], Never>] = [:]

    public init() {}

    public func categories(store: QiraatStore?, databaseURL: URL) async -> [UsulCategory] {
        guard let store else { return [] }
        let key = Key(store: ObjectIdentifier(store), databasePath: databaseURL.standardizedFileURL.path,
                      hidesUsul: store.hidesUsul)
        if let categories = cached[key] { return categories }
        if let task = inFlight[key] { return await task.value }

        let task = Task.detached(priority: .userInitiated) { () -> [UsulCategory] in
            guard let database = try? MushafDatabase(url: databaseURL),
                  let wordPages = try? database.wordPageIndex() else { return [] }
            return UsulIndex.build(store: store, wordPages: wordPages)
        }
        inFlight[key] = task
        let categories = await task.value
        inFlight[key] = nil
        cached[key] = categories
        return categories
    }
}
