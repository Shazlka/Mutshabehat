import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

final class HistorySummaryTests: XCTestCase {
    private let now = Date(epochMilliseconds: 1_790_000_000_000)
    private let batchID = UUID()

    private func makeEvent(
        surah: Int, ayah: Int,
        beforeStatus: MemorizationStatus?,
        afterStatus: MemorizationStatus
    ) -> ChangeEvent {
        let before: AyahMemorizationRecord? = beforeStatus.map {
            AyahMemorizationRecord(
                surah: surah, ayah: ayah, status: $0,
                reviewStrength: .notReviewed, isCurrentlyLearning: false, updatedAt: now
            )
        }
        let after = AyahMemorizationRecord(
            surah: surah, ayah: ayah, status: afterStatus,
            reviewStrength: .notReviewed, isCurrentlyLearning: false, updatedAt: now
        )
        return ChangeEvent(batchID: batchID, surah: surah, ayah: ayah, at: now, before: before, after: after)
    }

    func testNoEventsReturnsNil() {
        XCTAssertNil(HistorySummary.dominantTransition(events: []))
    }

    func testSingleEventReturnsItsTransition() {
        let event = makeEvent(surah: 1, ayah: 1, beforeStatus: .notMemorized, afterStatus: .mastered)
        let transition = HistorySummary.dominantTransition(events: [event])
        XCTAssertEqual(transition?.from, .notMemorized)
        XCTAssertEqual(transition?.to, .mastered)
    }

    func testNilBeforeDefaultsToNotMemorized() {
        let event = makeEvent(surah: 1, ayah: 1, beforeStatus: nil, afterStatus: .memorizedWithErrors)
        let transition = HistorySummary.dominantTransition(events: [event])
        XCTAssertEqual(transition?.from, .notMemorized)
        XCTAssertEqual(transition?.to, .memorizedWithErrors)
    }

    func testMostFrequentTransitionWins() {
        let events = [
            makeEvent(surah: 1, ayah: 1, beforeStatus: .needsMushaf, afterStatus: .mastered),
            makeEvent(surah: 1, ayah: 2, beforeStatus: .notMemorized, afterStatus: .memorizedWithErrors),
            makeEvent(surah: 1, ayah: 3, beforeStatus: .notMemorized, afterStatus: .memorizedWithErrors)
        ]
        let transition = HistorySummary.dominantTransition(events: events)
        XCTAssertEqual(transition?.from, .notMemorized)
        XCTAssertEqual(transition?.to, .memorizedWithErrors)
    }

    func testTieBrokenByLowerFromRawValue() {
        // Pair A: (from: .mastered = 1, to: .memorizedWithErrors = 2) count 1
        // Pair B: (from: .memorizedWithErrors = 2, to: .mastered = 1) count 1
        // Both count 1. 1 < 2, so Pair A wins!
        let events = [
            makeEvent(surah: 1, ayah: 1, beforeStatus: .mastered, afterStatus: .memorizedWithErrors),
            makeEvent(surah: 1, ayah: 2, beforeStatus: .memorizedWithErrors, afterStatus: .mastered)
        ]
        let transition = HistorySummary.dominantTransition(events: events)
        XCTAssertEqual(transition?.from, .mastered)
        XCTAssertEqual(transition?.to, .memorizedWithErrors)
    }

    func testTieWithSameFromBrokenByLowerToRawValue() {
        // Pair A: (from: .needsMushaf = 3, to: .mastered = 1) count 1
        // Pair B: (from: .needsMushaf = 3, to: .memorizedWithErrors = 2) count 1
        // Same from (3). 1 < 2, so Pair A wins!
        let events = [
            makeEvent(surah: 1, ayah: 1, beforeStatus: .needsMushaf, afterStatus: .mastered),
            makeEvent(surah: 1, ayah: 2, beforeStatus: .needsMushaf, afterStatus: .memorizedWithErrors)
        ]
        let transition = HistorySummary.dominantTransition(events: events)
        XCTAssertEqual(transition?.from, .needsMushaf)
        XCTAssertEqual(transition?.to, .mastered)
    }
}
