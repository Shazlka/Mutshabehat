import Foundation
import Testing
@testable import MushafCore

@Suite struct ReviewWordKeysTests {
    /// The web review page lists words as `SSS:AAA:WWW` over the web's own page-word fixtures. If the app's
    /// database numbered a word differently, a face would hang on the wrong word, so every page is checked.
    @Test func everyWordKeyMatchesTheWebFixturesOnAll604Pages() throws {
        let database = try openDatabase()
        var mismatches: [String] = []
        for number in 1...mushafPageCount {
            let page = try database.page(number)
            let mine = page.lines.flatMap(\.words).compactMap { word -> (String, String)? in
                ReviewWordKeys.key(for: word).map { ($0, word.textUthmani) }
            }
            let web = try ReviewGolden.pageWords(number).map {
                (String(format: "%03d:%03d:%03d", $0.surah, $0.ayah, $0.word), $0.text)
            }
            if mine.count != web.count || zip(mine, web).contains(where: { $0.0 != $1.0 || $0.1 != $1.1 }) {
                mismatches.append("page \(number): \(mine.count) vs \(web.count)")
            }
        }
        #expect(mismatches.isEmpty, "\(mismatches.count) pages differ, first: \(mismatches.first ?? "")")
    }

    @Test func markersAndPausesHaveNoKey() throws {
        let page = try openDatabase().page(2)
        let others = page.lines.flatMap(\.words).filter { $0.charType != .word }
        #expect(!others.isEmpty)
        #expect(others.allSatisfy { ReviewWordKeys.key(for: $0) == nil })
    }

    @Test func indexFindsTheWordByKey() throws {
        let page = try openDatabase().page(8)
        let index = ReviewWordKeys.index(page: page)
        let word = try #require(index["002:049:001"])
        #expect(word.textUthmani == "وَإِذْ")
        #expect(word.page == 8)
    }

    @Test func keyFormatIsZeroPadded() {
        #expect(ReviewWordKeys.key(surah: 2, ayah: 5, word: 12) == "002:005:012")
    }
}
