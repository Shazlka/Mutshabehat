import Foundation
import Testing
@testable import MushafCore

@Suite struct UsulIndexTests {
    @Test func bundledSnapshotHasTwentyThreeCategoriesAndTwelveThousandFiveHundredSixRulings() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let categories = UsulIndex.build(store: store)

        #expect(categories.count == 23)
        let totalCount = categories.reduce(0) { $0 + $1.count }
        #expect(totalCount == 12_506)

        let totalPlaces = categories.reduce(0) { $0 + $1.places.count }
        #expect(totalPlaces == 12_506)
    }

    @Test func categoriesAreOrderedByCountDescending() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let categories = UsulIndex.build(store: store)

        #expect(!categories.isEmpty)
        for i in 0..<(categories.count - 1) {
            #expect(categories[i].count >= categories[i + 1].count)
        }
    }

    @Test func everyCategoryAndPlaceHasValidProperties() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let categories = UsulIndex.build(store: store)

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
            }
        }
        // The live data carries exactly two rulings without a base text (2:33 word 16, النقل and السكت);
        // the index keeps them rather than dropping or inventing text.
        let missingText = categories.flatMap(\.places).filter { $0.baseText.isEmpty }.map(\.id).sorted()
        #expect(missingText == ["r-l-2-33-16-6c3ade", "r-l-2-33-16-b8236e"])
    }

    @Test func placesPreserveQuranicReadingOrder() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let categories = UsulIndex.build(store: store)

        for category in categories {
            for i in 0..<(category.places.count - 1) {
                #expect(category.places[i].page <= category.places[i + 1].page)
            }
        }
    }

    @Test func emptyStateWhenStoreHasNoPages() throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let catalogURL = try #require(Bundle.module.url(forResource: "qiraat-catalog", withExtension: "json", subdirectory: "Fixtures"))
        try FileManager.default.copyItem(at: catalogURL, to: tempDir.appendingPathComponent("catalog.json"))

        let store = try QiraatStore(directory: tempDir)
        let categories = UsulIndex.build(store: store)
        #expect(categories.isEmpty)
        #expect(categories.count == 0)
        #expect(categories.reduce(0) { $0 + $1.count } == 0)
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
        let categories = UsulIndex.build(store: store)
        #expect(categories.isEmpty)
    }

    @Test func emptyStateWhenStoreIsNil() {
        let categories = UsulIndex.build(store: nil)
        #expect(categories.isEmpty)
    }
}
