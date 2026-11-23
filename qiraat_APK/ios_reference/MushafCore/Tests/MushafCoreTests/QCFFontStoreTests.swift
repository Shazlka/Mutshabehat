import CoreText
import Foundation
import Testing
@testable import MushafCore

@Suite struct QCFFontStoreTests {
    let store = QCFFontStore(directory: generatedDirectory.appendingPathComponent("Fonts"), capacity: 2)

    @Test func loadsAPageFontFromWoff2WithoutRegisteringIt() throws {
        let font = try store.font(page: 50, size: 20)
        #expect(CTFontCopyPostScriptName(font) as String == "QCF2050")
        #expect(try store.advance(of: "\u{FC41}", page: 50, size: 20) > 0)
    }

    /// All 83,665 tokens: every glyph exists in its own page's font and measures wider than zero.
    @Test func everyTokenOnEveryPageRendersInItsOwnFont() throws {
        let db = try openDatabase()
        for n in 1...mushafPageCount {
            for word in try db.page(n).lines.flatMap(\.words) {
                #expect(try store.covers(word.glyph, page: n), "page \(n) \(word.id)")
                #expect(try store.advance(of: word.glyph, page: n, size: 20) > 0, "page \(n) \(word.id)")
            }
        }
    }

    @Test func rubAlHizbTokenWithASpaceMeasuresBothGlyphs() throws {
        // 2:26 «۞ إِنَّ» on page 5 is U+FC68 U+0020 U+FC69.
        let pair = try store.advance(of: "\u{FC68} \u{FC69}", page: 5, size: 20)
        let first = try store.advance(of: "\u{FC68}", page: 5, size: 20)
        let second = try store.advance(of: "\u{FC69}", page: 5, size: 20)
        #expect(pair > first + second)
    }

    @Test func cacheIsBoundedAndMostRecentlyUsedWins() throws {
        _ = try store.font(page: 1, size: 10)
        _ = try store.font(page: 2, size: 10)
        _ = try store.font(page: 1, size: 10)
        _ = try store.font(page: 50, size: 10)
        #expect(store.cachedPages == [1, 50])
    }

    @Test func prewarmDecodesNeighboursAndIgnoresOutOfRange() {
        let wide = QCFFontStore(directory: generatedDirectory.appendingPathComponent("Fonts"), capacity: 12)
        wide.prewarm(pages: QCFFontStore.neighbourhood(of: 1))
        #expect(wide.cachedPages == [1, 2, 3, 4, 5])
        wide.prewarm(pages: [0, 605])
        #expect(wide.cachedPages == [1, 2, 3, 4, 5])
        #expect(QCFFontStore.neighbourhood(of: 604) == 602...604)
    }

    @Test func missingFontIsAnErrorNotAFallback() throws {
        let empty = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: empty, withIntermediateDirectories: true)
        let bare = QCFFontStore(directory: empty)
        #expect(throws: QCFFontStore.Failure.missing(300)) { try bare.font(page: 300, size: 10) }
    }
}
