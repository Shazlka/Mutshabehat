import Foundation
import Testing
@testable import MushafCore

@Suite struct QiraatStoreTests {
    private func temporaryStoreDirectory(pages: [Int: String], catalog: Bool = true) throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        if catalog {
            let url = try #require(Bundle.module.url(forResource: "qiraat-catalog", withExtension: "json", subdirectory: "Fixtures"))
            try FileManager.default.copyItem(at: url, to: dir.appendingPathComponent("catalog.json"))
        }
        for (page, body) in pages {
            try Data(body.utf8).write(to: dir.appendingPathComponent(String(format: "page-%03d.json", page)))
        }
        return dir
    }

    @Test func loadsPagesAndCatalogFromADirectory() throws {
        let dir = try temporaryStoreDirectory(pages: [7: #"{"pageNumber":7,"variants":[],"rulings":[],"rules":[]}"#])
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = try QiraatStore(directory: dir)
        #expect(store.catalog.readers.count == 10)
        #expect(store.page(7)?.pageNumber == 7)
        #expect(store.marks(page: 7) != nil)
    }

    /// One bad or missing page shows no Qiraat marks on that page; it never takes the reader down.
    @Test func anUndecodableOrMissingPageIsNilNotACrash() throws {
        let dir = try temporaryStoreDirectory(pages: [
            1: #"{"pageNumber":1,"variants":[{"id":"x"}]}"#,
            2: "{ truncated",
            3: #"{"pageNumber":4,"variants":[],"rulings":[],"rules":[]}"#,
        ])
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = try QiraatStore(directory: dir)
        #expect(store.page(1) == nil)
        #expect(store.page(2) == nil)
        #expect(store.page(3) == nil, "a file whose pageNumber is another page's is rejected")
        #expect(store.page(5) == nil)
        #expect(store.page(0) == nil)
        #expect(store.page(605) == nil)
    }

    @Test func aMissingCatalogIsAnError() throws {
        let dir = try temporaryStoreDirectory(pages: [:], catalog: false)
        defer { try? FileManager.default.removeItem(at: dir) }
        #expect(throws: QiraatStore.Failure.missingCatalog) { try QiraatStore(directory: dir) }
    }

    /// The bundled snapshot of the live web data: every page decodes and every marker computes.
    @Test func everySnapshotPageDecodesAndMarksWithoutUnknownReadings() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        #expect(store.catalog.pageCount == mushafPageCount)
        let db = try openDatabase()
        var variants = 0, rulings = 0, markedWords = 0
        for n in 1...mushafPageCount {
            let page = try #require(store.page(n), "page \(n)")
            variants += page.variants.count
            rulings += page.rulings.count
            let marks = try #require(store.marks(page: n))
            for word in try db.page(n).lines.flatMap(\.words) where marks.wordMarks(for: word, filter: .all) != nil {
                markedWords += 1
            }
        }
        #expect(variants > 0 && rulings > 0 && markedWords > 0)
        print("Qiraat snapshot: \(variants) variants, \(rulings) rulings, \(markedWords) marked words")
    }
}
