import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

final class AyahListQueryTests: XCTestCase {
    private let now = Date(epochMilliseconds: 1_790_000_000_000)

    /// Synthetic index: 7 ayat of Surah 1 on page 1, 3 ayat of Surah 2 on page 2.
    private let index = QuranIndex(
        rows: (1...7).map { AyahLayoutRow(key: AyahKey(surah: 1, ayah: $0), page: 1, wordCount: 3) }
            + (1...3).map { AyahLayoutRow(key: AyahKey(surah: 2, ayah: $0), page: 2, wordCount: 3) },
        pageJuz: [1: 1, 2: 1]
    )

    func testStatusFiltersReturnMatchingAyat() {
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        // 1:1 mastered
        records[AyahKey(surah: 1, ayah: 1)] = AyahMemorizationRecord(
            surah: 1, ayah: 1, status: .mastered, reviewStrength: .strong,
            isCurrentlyLearning: false, updatedAt: now
        )
        // 1:2 memorizedWithErrors
        records[AyahKey(surah: 1, ayah: 2)] = AyahMemorizationRecord(
            surah: 1, ayah: 2, status: .memorizedWithErrors, reviewStrength: .good,
            isCurrentlyLearning: false, updatedAt: now
        )
        // 1:3 needsMushaf
        records[AyahKey(surah: 1, ayah: 3)] = AyahMemorizationRecord(
            surah: 1, ayah: 3, status: .needsMushaf, reviewStrength: .needsReview,
            isCurrentlyLearning: false, updatedAt: now
        )
        // 1:4 explicitly notMemorized
        records[AyahKey(surah: 1, ayah: 4)] = AyahMemorizationRecord(
            surah: 1, ayah: 4, status: .notMemorized, reviewStrength: .notReviewed,
            isCurrentlyLearning: false, updatedAt: now
        )
        // 1:5..7 and 2:1..3 have no record (implicitly notMemorized)

        let mastered = AyahListQuery.keys(filter: .status(.mastered), records: records, index: index, now: now)
        XCTAssertEqual(mastered, [AyahKey(surah: 1, ayah: 1)])

        let errors = AyahListQuery.keys(filter: .status(.memorizedWithErrors), records: records, index: index, now: now)
        XCTAssertEqual(errors, [AyahKey(surah: 1, ayah: 2)])

        let needs = AyahListQuery.keys(filter: .status(.needsMushaf), records: records, index: index, now: now)
        XCTAssertEqual(needs, [AyahKey(surah: 1, ayah: 3)])

        let notMemorized = AyahListQuery.keys(filter: .status(.notMemorized), records: records, index: index, now: now)
        let expectedNotMemo = [
            AyahKey(surah: 1, ayah: 4), AyahKey(surah: 1, ayah: 5),
            AyahKey(surah: 1, ayah: 6), AyahKey(surah: 1, ayah: 7),
            AyahKey(surah: 2, ayah: 1), AyahKey(surah: 2, ayah: 2), AyahKey(surah: 2, ayah: 3)
        ]
        XCTAssertEqual(notMemorized, expectedNotMemo)
    }

    func testUnmemorizedAyatWithNoRecordAreReturnedForNotMemorized() {
        let result = AyahListQuery.keys(filter: .status(.notMemorized), records: [:], index: index, now: now)
        XCTAssertEqual(result.count, 10)
        XCTAssertEqual(result, index.ayahKeys)
    }

    func testDueForReviewExcludesUnmemorizedAndNotYetDueAyat() {
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        // 1:1 mastered, nextReviewAt nil -> due
        records[AyahKey(surah: 1, ayah: 1)] = AyahMemorizationRecord(
            surah: 1, ayah: 1, status: .mastered, reviewStrength: .strong,
            isCurrentlyLearning: false, nextReviewAt: nil, updatedAt: now
        )
        // 1:2 mastered, nextReviewAt <= now -> due
        records[AyahKey(surah: 1, ayah: 2)] = AyahMemorizationRecord(
            surah: 1, ayah: 2, status: .mastered, reviewStrength: .strong,
            isCurrentlyLearning: false, nextReviewAt: now.addingTimeInterval(-100), updatedAt: now
        )
        // 1:3 mastered, nextReviewAt > now -> NOT due
        records[AyahKey(surah: 1, ayah: 3)] = AyahMemorizationRecord(
            surah: 1, ayah: 3, status: .mastered, reviewStrength: .strong,
            isCurrentlyLearning: false, nextReviewAt: now.addingTimeInterval(86400), updatedAt: now
        )
        // 1:4 needsMushaf, nextReviewAt nil -> NOT due (not memorized)
        records[AyahKey(surah: 1, ayah: 4)] = AyahMemorizationRecord(
            surah: 1, ayah: 4, status: .needsMushaf, reviewStrength: .needsReview,
            isCurrentlyLearning: false, nextReviewAt: nil, updatedAt: now
        )
        // 1:5 notMemorized -> NOT due
        records[AyahKey(surah: 1, ayah: 5)] = AyahMemorizationRecord(
            surah: 1, ayah: 5, status: .notMemorized, reviewStrength: .notReviewed,
            isCurrentlyLearning: false, nextReviewAt: nil, updatedAt: now
        )
        // unrecorded ayat 1:6..7, 2:1..3 -> NOT due

        let due = AyahListQuery.keys(filter: .dueForReview, records: records, index: index, now: now)
        XCTAssertEqual(due, [AyahKey(surah: 1, ayah: 1), AyahKey(surah: 1, ayah: 2)])
    }

    func testCurrentlyLearningFilter() {
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        records[AyahKey(surah: 1, ayah: 1)] = AyahMemorizationRecord(
            surah: 1, ayah: 1, status: .needsMushaf, reviewStrength: .notReviewed,
            isCurrentlyLearning: true, updatedAt: now
        )
        records[AyahKey(surah: 1, ayah: 2)] = AyahMemorizationRecord(
            surah: 1, ayah: 2, status: .mastered, reviewStrength: .strong,
            isCurrentlyLearning: false, updatedAt: now
        )

        let learning = AyahListQuery.keys(filter: .currentlyLearning, records: records, index: index, now: now)
        XCTAssertEqual(learning, [AyahKey(surah: 1, ayah: 1)])
    }
}
