import Foundation
import Testing
@testable import MushafCore

@Suite struct UsulIndexTests {
    @Test func bundledSnapshotAggregatesRowsIntoNavigablePlacesWithoutLosingDetails() throws {
        let result = try buildBundledIndex()

        #expect(result.categories.count == 23)
        #expect(result.rawRulingCount == 12_506)

        let places = result.categories.flatMap(\.places)
        #expect(places.count == 12_297)
        #expect(places.filter { $0.rulings.count > 1 }.count == 93)
        #expect(places.map { $0.rulings.count }.max() == 11)
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
        let database = try openDatabase()
        let wordPages = try database.wordPageIndex()
        let categories = UsulIndex.build(store: store, wordPages: wordPages)

        let pageOneRulings = try #require(store.page(1)?.rulings)
        let incorrectlyFiled = pageOneRulings.filter { ruling in
            wordPages[coordinate(of: ruling)] != 1
        }
        #expect(incorrectlyFiled.count == 5)
        #expect(Set(incorrectlyFiled.compactMap { wordPages[coordinate(of: $0)] }) == [3, 4, 7])

        let places = categories.flatMap(\.places)
        for ruling in incorrectlyFiled {
            let place = try #require(places.first { $0.rulings.contains { $0.id == ruling.id } })
            #expect(place.page == wordPages[coordinate(of: ruling)])
        }
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

        // Keep the two source rows whose text is empty; do not invent Quran text for them.
        let missingText = categories.flatMap(\.places).flatMap(\.rulings)
            .filter { $0.baseText.isEmpty }.map(\.id).sorted()
        #expect(missingText == ["r-l-2-33-16-6c3ade", "r-l-2-33-16-b8236e"])
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
