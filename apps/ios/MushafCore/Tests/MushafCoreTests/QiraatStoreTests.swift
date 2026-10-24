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

    // MARK: Live pages (the web app is the source of truth; a fetched page is kept next to the snapshot)

    private let liveVariantPage = #"{"pageNumber":7,"variants":[{"id":"v-live","surah":2,"ayah":51,"startToken":11,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q06-R01"]}],"rulings":[],"rules":[]}"#

    @Test func aLivePageReplacesTheSnapshotPageAndSurvivesARelaunch() throws {
        let dir = try temporaryStoreDirectory(pages: [7: #"{"pageNumber":7,"variants":[],"rulings":[],"rules":[]}"#])
        let overlay = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir); try? FileManager.default.removeItem(at: overlay) }
        let store = try QiraatStore(directory: dir, overlayDirectory: overlay)
        #expect(store.page(7)?.variants.isEmpty == true)

        #expect(try store.applyLivePage(Data(liveVariantPage.utf8), number: 7) == true)
        #expect(store.page(7)?.variants.map(\.id) == ["v-live"])
        #expect(store.marks(page: 7) != nil)
        // Same bytes again: nothing changed, so nothing needs redrawing.
        #expect(try store.applyLivePage(Data(liveVariantPage.utf8), number: 7) == false)

        let relaunched = try QiraatStore(directory: dir, overlayDirectory: overlay)
        #expect(relaunched.page(7)?.variants.map(\.id) == ["v-live"])
        // The snapshot itself is untouched.
        #expect(try QiraatStore(directory: dir).page(7)?.variants.isEmpty == true)
    }

    @Test func aLivePageForAPageTheSnapshotLacksIsShown() throws {
        let dir = try temporaryStoreDirectory(pages: [:])
        let overlay = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir); try? FileManager.default.removeItem(at: overlay) }
        let store = try QiraatStore(directory: dir, overlayDirectory: overlay)
        #expect(store.page(7) == nil)
        #expect(try store.applyLivePage(Data(liveVariantPage.utf8), number: 7))
        #expect(store.page(7)?.variants.count == 1)
    }

    /// A bad response (another page, truncated, wrong shape) must never replace good data.
    @Test func anInvalidLivePageIsRejectedAndKeepsWhatWasThere() throws {
        let dir = try temporaryStoreDirectory(pages: [7: #"{"pageNumber":7,"variants":[],"rulings":[],"rules":[]}"#])
        let overlay = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir); try? FileManager.default.removeItem(at: overlay) }
        let store = try QiraatStore(directory: dir, overlayDirectory: overlay)
        try store.applyLivePage(Data(liveVariantPage.utf8), number: 7)

        #expect(throws: QiraatStore.LiveFailure.invalidPage) { try store.applyLivePage(Data(liveVariantPage.utf8), number: 8) }
        #expect(throws: QiraatStore.LiveFailure.invalidPage) { try store.applyLivePage(Data("{ truncated".utf8), number: 7) }
        #expect(throws: QiraatStore.LiveFailure.invalidPage) { try store.applyLivePage(Data(liveVariantPage.utf8), number: 0) }
        #expect(store.page(7)?.variants.map(\.id) == ["v-live"])
    }

    private func page7(variants count: Int) -> String {
        let rows = (1...max(count, 1)).prefix(count).map {
            #"{"id":"v\#($0)","surah":2,"ayah":51,"startToken":\#($0),"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q06-R01"]}"#
        }
        return #"{"pageNumber":7,"variants":[\#(rows.joined(separator: ","))],"rulings":[],"rules":[]}"#
    }

    /// The web route falls back to old fixtures when its database is down and says nothing; such an answer must not
    /// replace a fuller page, but a small trim or a growing page is fine.
    @Test func aMuchSmallerLivePageIsRejectedUnlessAllowed() throws {
        let dir = try temporaryStoreDirectory(pages: [7: page7(variants: 20)])
        let overlay = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir); try? FileManager.default.removeItem(at: overlay) }
        let store = try QiraatStore(directory: dir, overlayDirectory: overlay)

        #expect(throws: QiraatStore.LiveFailure.suspiciousShrink) { try store.applyLivePage(Data(page7(variants: 10).utf8), number: 7) }
        #expect(store.page(7)?.variants.count == 20)
        #expect(try store.applyLivePage(Data(page7(variants: 17).utf8), number: 7), "a trim of under a fifth is an edit")
        #expect(try store.applyLivePage(Data(page7(variants: 30).utf8), number: 7), "growth is always accepted")
        #expect(try store.applyLivePage(Data(page7(variants: 5).utf8), number: 7, allowShrink: true))
        #expect(store.page(7)?.variants.count == 5)
    }

    @Test func clearingTheOverlayGoesBackToTheSnapshot() throws {
        let dir = try temporaryStoreDirectory(pages: [7: #"{"pageNumber":7,"variants":[],"rulings":[],"rules":[]}"#])
        let overlay = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir); try? FileManager.default.removeItem(at: overlay) }
        let store = try QiraatStore(directory: dir, overlayDirectory: overlay)
        try store.applyLivePage(Data(liveVariantPage.utf8), number: 7)
        store.clearOverlay()
        #expect(store.page(7)?.variants.isEmpty == true)
    }

    // MARK: Hiding أصول (the reader keeps only فرش)

    private let mixedPage7 = #"{"pageNumber":7,"variants":[{"id":"v1","surah":2,"ayah":51,"startToken":11,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q06-R01"]}],"rulings":[{"id":"r1","surah":2,"ayah":51,"startToken":3,"baseText":"x"}],"rules":[]}"#

    @Test func hidingUsulDropsRulingsButKeepsVariantsAndComesBack() throws {
        let dir = try temporaryStoreDirectory(pages: [7: mixedPage7])
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = try QiraatStore(directory: dir)
        #expect(store.page(7)?.rulings.map(\.id) == ["r1"])

        store.hidesUsul = true
        #expect(store.page(7)?.rulings.isEmpty == true)
        #expect(store.page(7)?.variants.map(\.id) == ["v1"])
        #expect(store.marks(page: 7) != nil)

        store.hidesUsul = false
        #expect(store.page(7)?.rulings.map(\.id) == ["r1"], "the rulings are only hidden, never lost")
    }

    /// A live page is compared with the page held, not with what is shown, so hiding أصول must not make every
    /// poll look like a change, nor trip the shrink guard.
    @Test func hidingUsulDoesNotDisturbLiveUpdates() throws {
        let dir = try temporaryStoreDirectory(pages: [7: mixedPage7])
        let overlay = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: dir); try? FileManager.default.removeItem(at: overlay) }
        let store = try QiraatStore(directory: dir, overlayDirectory: overlay)
        store.hidesUsul = true
        #expect(try store.applyLivePage(Data(mixedPage7.utf8), number: 7) == false, "the same page as the snapshot is no change")
        store.hidesUsul = false
        #expect(store.page(7)?.rulings.map(\.id) == ["r1"])
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
