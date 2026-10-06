import Foundation
import MushafCore
@testable import MushafCore
@testable import Mutshabehat
import XCTest

final class SurahListQueryTests: XCTestCase {
    private let surahs: [Surah] = [
        Surah(number: 1, name: "الفاتحة", ayahCount: 7, firstPage: 1, lastPage: 1),
        Surah(number: 2, name: "البقرة", ayahCount: 286, firstPage: 2, lastPage: 49),
        Surah(number: 3, name: "آل عمران", ayahCount: 200, firstPage: 50, lastPage: 76),
        Surah(number: 4, name: "النساء", ayahCount: 176, firstPage: 77, lastPage: 106)
    ]

    private var progressMap: [Int: SurahProgress] {
        [
            1: SurahProgress(
                surah: 1, ayahCount: 7, counts: [.mastered: 7],
                strictPercent: 100, learningPercent: 100, state: .complete,
                isCompleteIncludingErrors: true
            ),
            2: SurahProgress(
                surah: 2, ayahCount: 286, counts: [.mastered: 143, .notMemorized: 143],
                strictPercent: 50, learningPercent: 50, state: .partial,
                isCompleteIncludingErrors: false
            ),
            3: SurahProgress(
                surah: 3, ayahCount: 200, counts: [.notMemorized: 200],
                strictPercent: 0, learningPercent: 0, state: .none,
                isCompleteIncludingErrors: false
            ),
            4: SurahProgress(
                surah: 4, ayahCount: 176, counts: [.mastered: 88, .notMemorized: 88],
                strictPercent: 50, learningPercent: 50, state: .partial,
                isCompleteIncludingErrors: false
            )
        ]
    }

    func testSortByMushafOrder() {
        let result = SurahListQuery.apply(
            surahs: surahs.reversed(),
            progress: progressMap,
            records: [:],
            searchText: "",
            sort: .mushafOrder,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [1, 2, 3, 4])
    }

    func testSortByMostMemorized() {
        // Strict percents: 1 -> 100, 2 -> 50, 4 -> 50, 3 -> 0
        // Ties between 2 and 4 broken by surah number ascending (2 < 4)
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "",
            sort: .mostMemorized,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [1, 2, 4, 3])
    }

    func testSortByLeastMemorized() {
        // Strict percents: 3 -> 0, 2 -> 50, 4 -> 50, 1 -> 100
        // Ties between 2 and 4 broken by surah number ascending (2 < 4)
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "",
            sort: .leastMemorized,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [3, 2, 4, 1])
    }

    func testFilterAll() {
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "",
            sort: .mushafOrder,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [1, 2, 3, 4])
    }

    func testFilterComplete() {
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "",
            sort: .mushafOrder,
            filter: .complete
        )
        XCTAssertEqual(result.map(\.number), [1])
    }

    func testFilterIncomplete() {
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "",
            sort: .mushafOrder,
            filter: .incomplete
        )
        XCTAssertEqual(result.map(\.number), [2, 3, 4])
    }

    func testFilterCurrentlyLearning() {
        let key = AyahKey(surah: 2, ayah: 5)
        var record = AyahMemorizationRecord.blank(key, now: Date())
        record.isCurrentlyLearning = true

        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [key: record],
            searchText: "",
            sort: .mushafOrder,
            filter: .currentlyLearning
        )
        XCTAssertEqual(result.map(\.number), [2])
    }

    func testFilterNeedsReview() {
        let now = Date()
        let key = AyahKey(surah: 3, ayah: 10)
        var record = AyahMemorizationRecord.blank(key, now: now)
        record.status = .mastered
        record.lastReviewedAt = now.addingTimeInterval(-86400 * 10)
        record.nextReviewAt = now.addingTimeInterval(-86400) // overdue

        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [key: record],
            searchText: "",
            sort: .mushafOrder,
            filter: .needsReview,
            now: now
        )
        XCTAssertEqual(result.map(\.number), [3])
    }

    func testArabicSearchMatchesWithoutDiacriticsAndWithTaMarbutaVariant() {
        // «البقره» finds «البقرة»
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "البقره",
            sort: .mushafOrder,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [2])
    }

    func testArabicSearchWithDiacritics() {
        // «ٱلْبَقَرَةِ» finds «البقرة»
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "ٱلْبَقَرَةِ",
            sort: .mushafOrder,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [2])
    }

    func testArabicSearchWithAlefVariant() {
        // «ال عمران» without madda finds «آل عمران»
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "ال عمران",
            sort: .mushafOrder,
            filter: .all
        )
        XCTAssertEqual(result.map(\.number), [3])
    }

    func testArabicSearchNonMatchingReturnsEmpty() {
        let result = SurahListQuery.apply(
            surahs: surahs,
            progress: progressMap,
            records: [:],
            searchText: "يس",
            sort: .mushafOrder,
            filter: .all
        )
        XCTAssertTrue(result.isEmpty)
    }
}
