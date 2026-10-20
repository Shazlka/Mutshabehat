import Foundation
import Testing
@testable import MushafCore

@Suite struct UsulIndexTests {
    /// The snapshot is refreshed from the live web database, so nothing here pins its size: every expectation is
    /// derived from the raw page files.
    @Test func bundledSnapshotAggregatesRowsIntoNavigablePlacesWithoutLosingDetails() throws {
        let result = try buildBundledIndex()
        let raw = try rawCategoryCounts()

        #expect(Set(result.categories.map(\.code)) == Set(raw.keys))
        #expect(result.rawRulingCount == raw.values.reduce(0, +))
        for category in result.categories {
            #expect(category.places.flatMap(\.rulings).count == raw[category.code], "Lost rulings in \(category.code)")
        }

        let places = result.categories.flatMap(\.places)
        #expect(!places.isEmpty)
        #expect(places.count <= result.rawRulingCount)
        #expect(places.flatMap(\.rulings).count == result.rawRulingCount)

        for category in result.categories {
            let loci = category.places.map {
                "\($0.surah):\($0.ayah):\($0.startToken)-\($0.endAyah):\($0.endToken)"
            }
            #expect(Set(loci).count == loci.count, "Duplicate locus in \(category.code)")
        }
    }

    @Test func pagesComeFromQuranCoordinatesInsteadOfSnapshotBuckets() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let wordPages = try openDatabase().wordPageIndex()
        let categories = UsulIndex.build(store: store, wordPages: wordPages)
        let placePage = Dictionary(
            categories.flatMap(\.places).flatMap { place in place.rulings.map { ($0.id, place.page) } },
            uniquingKeysWith: { first, _ in first })

        // Real snapshot: whatever page file a ruling sits in, its place is on the page its words are on.
        for page in 1...mushafPageCount {
            for ruling in store.page(page)?.rulings ?? [] {
                guard let resolved = wordPages[coordinate(of: ruling)] else { continue }
                #expect(placePage[ruling.id] == resolved, "\(ruling.id) filed under the wrong page")
            }
        }
    }

    /// The case the real snapshot no longer contains (the web database fixed its misfiled rulings): a ruling stored
    /// in page 1's file whose words are on another page.
    @Test func aRulingFiledInTheWrongPageFileIsPlacedByItsWords() throws {
        let wordPages = try openDatabase().wordPageIndex()
        let target = MushafWordCoordinate(surah: 2, ayah: 40, token: 1)
        let resolved = try #require(wordPages[target])
        #expect(resolved != 1)

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let catalogURL = try #require(Bundle.module.url(forResource: "qiraat-catalog", withExtension: "json", subdirectory: "Fixtures"))
        try FileManager.default.copyItem(at: catalogURL, to: directory.appendingPathComponent("catalog.json"))
        let page = #"{"pageNumber":1,"variants":[],"rules":[],"rulings":[{"id":"misfiled","category":"IMALAH_TAQLIL","surah":2,"ayah":40,"startToken":1,"endToken":1,"baseText":"x"}]}"#
        try Data(page.utf8).write(to: directory.appendingPathComponent("page-001.json"))

        let categories = UsulIndex.build(store: try QiraatStore(directory: directory), wordPages: wordPages)
        let place = try #require(categories.flatMap(\.places).first { $0.rulings.contains { $0.id == "misfiled" } })
        #expect(place.page == resolved)
    }

    @Test func categoriesAndPlacesHaveDeterministicReadingOrder() throws {
        let categories = try buildBundledIndex().categories

        for pair in zip(categories, categories.dropFirst()) {
            #expect(pair.0.count > pair.1.count ||
                    (pair.0.count == pair.1.count && pair.0.code < pair.1.code))
        }

        for category in categories {
            for pair in zip(category.places, category.places.dropFirst()) {
                #expect(isInReadingOrder(pair.0, pair.1),
                        "Reading-order inversion in \(category.code)")
            }
        }
    }

    @Test func everyCategoryAndPlaceHasValidProperties() throws {
        let categories = try buildBundledIndex().categories

        var seenCodes = Set<String>()
        for category in categories {
            #expect(!category.code.isEmpty)
            #expect(!category.categoryAr.isEmpty)
            #expect(!category.color.isEmpty)
            #expect(category.count == category.places.count)
            #expect(category.count > 0)
            #expect(seenCodes.insert(category.code).inserted, "Duplicate category code: \(category.code)")

            for place in category.places {
                #expect(!place.id.isEmpty)
                #expect((1...mushafPageCount).contains(place.page))
                #expect((1...114).contains(place.surah))
                #expect(place.ayah >= 1)
                #expect(place.startToken >= 1)
                #expect(place.endAyah >= place.ayah)
                #expect(place.endToken >= 1)
                #expect(!place.rulings.isEmpty)
            }
        }

        // Rows whose source text is empty stay in the index; no Quran text is invented for them.
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let sourceEmpty = (1...mushafPageCount).flatMap { store.page($0)?.rulings ?? [] }
            .filter { $0.baseText.isEmpty }.map(\.id).sorted()
        let indexedEmpty = categories.flatMap(\.places).flatMap(\.rulings)
            .filter { $0.baseText.isEmpty }.map(\.id).sorted()
        #expect(indexedEmpty == sourceEmpty)
    }

    @Test func emptyStateWhenStoreHasNoPages() throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let catalogURL = try #require(Bundle.module.url(forResource: "qiraat-catalog", withExtension: "json", subdirectory: "Fixtures"))
        try FileManager.default.copyItem(at: catalogURL, to: tempDir.appendingPathComponent("catalog.json"))

        let store = try QiraatStore(directory: tempDir)
        let categories = UsulIndex.build(store: store, wordPages: try openDatabase().wordPageIndex())
        #expect(categories.isEmpty)
    }

    @Test func emptyStateWhenStoreHasPagesWithNoRulings() throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let catalogURL = try #require(Bundle.module.url(forResource: "qiraat-catalog", withExtension: "json", subdirectory: "Fixtures"))
        try FileManager.default.copyItem(at: catalogURL, to: tempDir.appendingPathComponent("catalog.json"))

        let page1Data = #"{"pageNumber":1,"variants":[],"rulings":[],"rules":[]}"#
        try Data(page1Data.utf8).write(to: tempDir.appendingPathComponent("page-001.json"))

        let store = try QiraatStore(directory: tempDir)
        let categories = UsulIndex.build(store: store, wordPages: try openDatabase().wordPageIndex())
        #expect(categories.isEmpty)
    }

    @Test func emptyStateWhenStoreIsNil() {
        let categories = UsulIndex.build(store: nil, wordPages: [:])
        #expect(categories.isEmpty)
    }

    @Test func cacheReusesTheFirstOffMainBuild() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let qiraatDirectory = directory.appendingPathComponent("Qiraat")
        try FileManager.default.createDirectory(at: qiraatDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        try FileManager.default.copyItem(
            at: generatedDirectory.appendingPathComponent("Qiraat/catalog.json"),
            to: qiraatDirectory.appendingPathComponent("catalog.json")
        )
        let pageURL = qiraatDirectory.appendingPathComponent("page-001.json")
        try FileManager.default.copyItem(
            at: generatedDirectory.appendingPathComponent("Qiraat/page-001.json"),
            to: pageURL
        )
        let databaseURL = directory.appendingPathComponent("mushaf.sqlite")
        try FileManager.default.copyItem(
            at: generatedDirectory.appendingPathComponent("mushaf.sqlite"),
            to: databaseURL
        )

        let store = try QiraatStore(directory: qiraatDirectory)
        let cache = UsulIndexCache()
        let first = await cache.categories(store: store, databaseURL: databaseURL)
        #expect(!first.isEmpty)

        try FileManager.default.removeItem(at: pageURL)
        try FileManager.default.removeItem(at: databaseURL)
        let second = await cache.categories(store: store, databaseURL: databaseURL)
        #expect(second == first)
    }
}

private func buildBundledIndex() throws -> (
    categories: [UsulCategory],
    rawRulingCount: Int
) {
    let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
    let wordPages = try openDatabase().wordPageIndex()
    let rawRulingCount = (1...mushafPageCount).reduce(into: 0) { count, page in
        count += store.page(page)?.rulings.count ?? 0
    }
    return (UsulIndex.build(store: store, wordPages: wordPages), rawRulingCount)
}

/// Ruling count per category code, read straight from the page JSON files (not through `QiraatStore`).
private func rawCategoryCounts() throws -> [String: Int] {
    var counts: [String: Int] = [:]
    for page in 1...mushafPageCount {
        let url = generatedDirectory.appendingPathComponent(String(format: "Qiraat/page-%03d.json", page))
        let raw = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        for row in raw["rulings"] as? [[String: Any]] ?? [] {
            counts[row["category"] as? String ?? "OTHER", default: 0] += 1
        }
    }
    return counts
}

private func coordinate(of ruling: QiraatRuling) -> MushafWordCoordinate {
    MushafWordCoordinate(surah: ruling.surah, ayah: ruling.ayah, token: ruling.startToken)
}

private func isInReadingOrder(_ lhs: UsulPlace, _ rhs: UsulPlace) -> Bool {
    let left = [lhs.page, lhs.surah, lhs.ayah, lhs.startToken, lhs.endAyah, lhs.endToken]
    let right = [rhs.page, rhs.surah, rhs.ayah, rhs.startToken, rhs.endAyah, rhs.endToken]
    for (leftValue, rightValue) in zip(left, right) where leftValue != rightValue {
        return leftValue < rightValue
    }
    return true
}
