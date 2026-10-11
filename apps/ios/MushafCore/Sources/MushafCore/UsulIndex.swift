import Foundation

/// One occurrence of an أصول ruling in the Mushaf.
public struct UsulPlace: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let page: Int
    public let surah: Int
    public let ayah: Int
    public let startToken: Int
    public let baseText: String

    public var token: Int { startToken }

    public init(id: String? = nil, page: Int, surah: Int, ayah: Int, startToken: Int, baseText: String) {
        self.id = id ?? "\(page)-\(surah)-\(ayah)-\(startToken)"
        self.page = page
        self.surah = surah
        self.ayah = ayah
        self.startToken = startToken
        self.baseText = baseText
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

    /// Builds the list of Usul categories from all 604 pages of the provided Qiraat store.
    /// Categories are ordered by count descending (with category code as a tie-breaker).
    public static func build(store: QiraatStore) -> [UsulCategory] {
        build(store: Optional.some(store))
    }

    /// Builds the list of Usul categories from the store, returning an empty list if nil.
    public static func build(store: QiraatStore?) -> [UsulCategory] {
        guard let store else { return [] }

        struct CategoryAccumulator {
            var categoryAr: String
            var color: String
            var places: [UsulPlace]
        }

        var map: [String: CategoryAccumulator] = [:]

        for pageNumber in 1...mushafPageCount {
            guard let pageData = store.page(pageNumber) else { continue }
            for ruling in pageData.rulings {
                let place = UsulPlace(
                    id: ruling.id,
                    page: pageNumber,
                    surah: ruling.surah,
                    ayah: ruling.ayah,
                    startToken: ruling.startToken,
                    baseText: ruling.baseText
                )

                if var existing = map[ruling.category] {
                    existing.places.append(place)
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
                        places: [place]
                    )
                }
            }
        }

        var categories = map.map { code, acc in
            UsulCategory(
                code: code,
                categoryAr: acc.categoryAr,
                color: acc.color,
                count: acc.places.count,
                places: acc.places
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
}
