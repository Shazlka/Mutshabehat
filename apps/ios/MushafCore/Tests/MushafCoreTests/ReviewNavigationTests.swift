#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct ReviewNavigationTests {
    private func page(words: Int, rows: [(start: Int, end: Int, status: String, deleted: Bool)]) throws -> ReviewPage {
        let wordJSON = (1...words).map {
            #"{"key":"\#(ReviewWordKeys.key(surah: 2, ayah: 1, word: $0))","surah":2,"ayah":1,"word":\#($0),"line":1,"text":"w\#($0)"}"#
        }.joined(separator: ",")
        let rowJSON = rows.enumerated().map { i, r in
            """
            {"entryId":"r\(i)","locationId":"l","version":"v","kind":"usul","surah":2,"ayah":1,"startWord":\(r.start),"endAyah":1,"endWord":\(r.end),
             "startKey":"\(ReviewWordKeys.key(surah: 2, ayah: 1, word: r.start))","endKey":"\(ReviewWordKeys.key(surah: 2, ayah: 1, word: r.end))",
             "reviewStatus":"\(r.status)","deleted":\(r.deleted),"narrators":[],"flags":[]}
            """
        }.joined(separator: ",")
        return try JSONDecoder().decode(ReviewPage.self, from: Data("""
        {"page":8,"words":[\(wordJSON)],"rows":[\(rowJSON)],"stats":{},"narrators":[],"categories":[],"variantTypes":[]}
        """.utf8))
    }

    private func key(_ w: Int) -> String { ReviewWordKeys.key(surah: 2, ayah: 1, word: w) }

    @Test func nextReviewKeySkipsReviewedAndDeletedRows() throws {
        let p = try page(words: 6, rows: [(2, 2, "reviewed", false), (4, 4, "unreviewed", false), (5, 5, "unreviewed", true), (6, 6, "flagged", false)])
        #expect(ReviewNavigation.nextReviewKey(in: p, after: nil) == key(4))
        #expect(ReviewNavigation.nextReviewKey(in: p, after: key(4)) == key(6))
        #expect(ReviewNavigation.nextReviewKey(in: p, after: key(1)) == key(4))
    }

    @Test func nextReviewKeyWrapsWithinThePageAndStopsWhenNothingIsLeft() throws {
        let p = try page(words: 6, rows: [(2, 3, "unreviewed", false)])
        #expect(ReviewNavigation.nextReviewKey(in: p, after: key(3)) == key(2))      // wraps to the first needing word
        #expect(ReviewNavigation.nextReviewKey(in: p, after: key(2)) == key(3))      // a two-word face covers both words
        let done = try page(words: 6, rows: [(2, 3, "reviewed", false)])
        #expect(ReviewNavigation.nextReviewKey(in: done, after: nil) == nil)
        // The only word needing review is the current one: nothing else to move to.
        let single = try page(words: 6, rows: [(2, 2, "unreviewed", false)])
        #expect(ReviewNavigation.nextReviewKey(in: single, after: key(2)) == nil)
    }

    @Test func wordStatusPriorityIsFlaggedThenUnreviewedThenReviewed() throws {
        let p = try page(words: 4, rows: [(1, 3, "reviewed", false), (2, 2, "unreviewed", false), (3, 3, "flagged", false)])
        let statuses = ReviewNavigation.wordStatuses(in: p)
        #expect(statuses[key(1)] == .reviewed)
        #expect(statuses[key(2)] == .unreviewed)
        #expect(statuses[key(3)] == .flagged)
        #expect(statuses[key(4)] == nil)
    }

    @Test func nextPageWithWrapsAroundTheMushaf() {
        let pages = [1, 2, 3, 4].map { PageProgress(page: $0, total: 1, unreviewed: $0 == 2 ? 3 : 0, reviewed: 0, flagged: $0 == 4 ? 1 : 0) }
        let overview = ReviewOverview(isEditor: true, pages: pages)
        #expect(ReviewNavigation.nextPage(in: overview, after: 1, needing: .unreviewed) == 2)
        #expect(ReviewNavigation.nextPage(in: overview, after: 2, needing: .unreviewed) == 2)   // wraps back to itself only if it is the sole page
        #expect(ReviewNavigation.nextPage(in: overview, after: 2, needing: .flagged) == 4)
        #expect(ReviewNavigation.nextPage(in: overview, after: 4, needing: .flagged) == 4)
        #expect(ReviewNavigation.nextPage(in: ReviewOverview(isEditor: true, pages: []), after: 1, needing: .flagged) == nil)
    }
}
#endif
