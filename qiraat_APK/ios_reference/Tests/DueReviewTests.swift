import MushafCore
import XCTest
@testable import Mutshabehat

final class DueReviewTests: XCTestCase {
    private let now = Date(epochMilliseconds: 1_800_000_000_000)
    private let day: TimeInterval = 86_400

    private func record(_ surah: Int, _ ayah: Int, _ status: MemorizationStatus = .mastered,
                        nextReview: Date? = nil, firstMemorized: Date? = nil) -> AyahMemorizationRecord {
        var record = AyahMemorizationRecord.blank(AyahKey(surah: surah, ayah: ayah), now: now)
        record.status = status
        record.nextReviewAt = nextReview
        record.firstMemorizedAt = firstMemorized
        return record
    }

    private func map(_ records: [AyahMemorizationRecord]) -> [AyahKey: AyahMemorizationRecord] {
        Dictionary(uniqueKeysWithValues: records.map { ($0.key, $0) })
    }

    func testNeverReviewedMemorizedAyatAreDueAndSorted() {
        let records = map([record(2, 5), record(1, 3), record(1, 1)])
        XCTAssertEqual(DueReview.dueAyat(records: records, now: now),
                       [AyahKey(surah: 1, ayah: 1), AyahKey(surah: 1, ayah: 3), AyahKey(surah: 2, ayah: 5)])
    }

    func testNotMemorizedAndNotYetDueAreExcluded() {
        let records = map([
            record(1, 1, .notMemorized),
            record(1, 2, nextReview: now.addingTimeInterval(day)),
            record(1, 3, nextReview: now.addingTimeInterval(-day)),
        ])
        XCTAssertEqual(DueReview.dueAyat(records: records, now: now), [AyahKey(surah: 1, ayah: 3)])
    }

    func testMostOverdueSurahsOrderedByAverageThenSurahNumber() {
        let records = map([
            record(2, 1, nextReview: now.addingTimeInterval(-10 * day)),
            record(2, 2, nextReview: now.addingTimeInterval(-20 * day)),
            record(3, 1, nextReview: now.addingTimeInterval(-15 * day)),
            record(5, 1, nextReview: now.addingTimeInterval(-15 * day)),
            record(7, 1, nextReview: now.addingTimeInterval(-1 * day)),
        ])
        let rows = DueReview.mostOverdueSurahs(records: records, now: now, limit: 10)
        XCTAssertEqual(rows.map(\.surah), [2, 3, 5, 7])
        XCTAssertEqual(rows[0].dueCount, 2)
        XCTAssertEqual(rows[0].averageOverdueDays, 15, accuracy: 0.001)
    }

    func testNeverScheduledUsesFirstMemorizedDateAndIsNeverNegative() {
        let records = map([
            record(2, 1, firstMemorized: now.addingTimeInterval(-4 * day)),
            record(3, 1, firstMemorized: now.addingTimeInterval(2 * day)),
        ])
        let rows = DueReview.mostOverdueSurahs(records: records, now: now, limit: 10)
        XCTAssertEqual(rows.first(where: { $0.surah == 2 })?.averageOverdueDays ?? 0, 4, accuracy: 0.001)
        XCTAssertEqual(rows.first(where: { $0.surah == 3 })?.averageOverdueDays ?? -1, 0, accuracy: 0.001)
    }

    func testLimitAndEmpty() {
        let records = map([record(1, 1), record(2, 1), record(3, 1)])
        XCTAssertEqual(DueReview.mostOverdueSurahs(records: records, now: now, limit: 2).count, 2)
        XCTAssertEqual(DueReview.mostOverdueSurahs(records: records, now: now, limit: 0).count, 0)
        XCTAssertTrue(DueReview.mostOverdueSurahs(records: [:], now: now, limit: 3).isEmpty)
    }
}
