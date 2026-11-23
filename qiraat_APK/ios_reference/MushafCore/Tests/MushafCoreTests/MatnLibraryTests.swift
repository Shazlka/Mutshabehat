import Foundation
import Testing
@testable import MushafCore

/// All text below is synthetic. The real متون come from `Generated/QiraatMutoon/mutoon.json`.
private let sample = """
{"schemaVersion":1,"generatedAt":"2026-10-27T00:00:00Z","works":[
 {"work":"shatibiyyah","title":"كتاب أ","author":"مؤلف أ","bookId":1,"chapters":[
   {"title":"باب أول","farsh":false,"verses":[
     {"number":1,"lines":["وَمَالِكِ بَيْتٌ تَجْرِيبِيٌّ","وَالشَّطْرُ الثَّانِي"],"printedPage":"9","pageId":15},
     {"number":2,"lines":["بَيْتٌ آخَرُ","وَٱلصِّرَاطَ هُنَا"],"printedPage":"9","pageId":15}]},
   {"title":"سورة البقرة","farsh":true,"verses":[
     {"number":3,"lines":["يُخَادِعُونَ فِي الْفَرْشِ","تَجْرِبَةٌ"],"printedPage":"36","pageId":42}]}]},
 {"work":"durrah","title":"كتاب ب","author":"مؤلف ب","bookId":2,"chapters":[
   {"title":"باب","farsh":false,"verses":[{"number":1,"lines":["مَالِكِ حُزْ","تَجْرِبَةٌ"],"printedPage":"14","pageId":3}]}]},
 {"work":"unknown","title":"كتاب","author":"","chapters":[]}
]}
"""

private func directory(with text: String?) throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("mutoon-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    if let text { try Data(text.utf8).write(to: url.appendingPathComponent(MatnLibrary.fileName)) }
    return url
}

@Suite struct MatnLibraryTests {
    @Test func readsTheWorksInTheirOwnOrderAndSkipsAnUnknownOne() throws {
        let library = MatnLibrary(directory: try directory(with: sample))
        #expect(library.works.map(\.work) == [.shatibiyyah, .durrah])
        let shatibiyyah = try #require(library.work(.shatibiyyah))
        #expect(shatibiyyah.chapters.count == 2 && shatibiyyah.verseCount == 3)
        #expect(shatibiyyah.chapters[1].farsh)
        #expect(library.work(.tayyibah) == nil)
    }

    @Test func aMissingBrokenOrNewerFileGivesAnEmptyLibrary() throws {
        #expect(MatnLibrary(directory: try directory(with: nil)).isEmpty)
        #expect(MatnLibrary(directory: try directory(with: "")).isEmpty)
        #expect(MatnLibrary(directory: try directory(with: "not json")).isEmpty)
        #expect(MatnLibrary(directory: try directory(with: #"{"schemaVersion":2,"works":[]}"#)).isEmpty)
        #expect(MatnLibrary.empty.search("مالك").isEmpty)
    }

    @Test func findsAVerseByItsNumberInAWork() throws {
        let library = MatnLibrary(directory: try directory(with: sample))
        let found = try #require(library.verse(.shatibiyyah, number: 3))
        #expect(found.chapter == "سورة البقرة" && found.verse.lines.first == "يُخَادِعُونَ فِي الْفَرْشِ")
        #expect(library.verse(.durrah, number: 3) == nil)
    }

    @Test func searchIgnoresDiacriticsAndAlefFormsAndSpansBothHemistichs() throws {
        let library = MatnLibrary(directory: try directory(with: sample))
        // «مالك» without marks finds both books; ٱ and ا are one letter; a phrase can cross the hemistich break.
        #expect(library.search("مالك").map(\.work) == [.shatibiyyah, .durrah])
        #expect(library.search("الصراط").map(\.verse.number) == [2])
        #expect(library.search("آخر والصراط").map(\.verse.number) == [2])
        #expect(library.search("   ").isEmpty)
    }

    @Test func aNumberSearchFindsThatVerseInEachBook() throws {
        let library = MatnLibrary(directory: try directory(with: sample))
        #expect(library.search("١").map(\.work) == [.shatibiyyah, .durrah])
        #expect(library.search("3").map(\.verse.number) == [3])
    }

    @Test func searchStopsAtItsLimit() throws {
        let library = MatnLibrary(directory: try directory(with: sample))
        #expect(library.search("تجربة", limit: 1).count == 1)
    }
}
