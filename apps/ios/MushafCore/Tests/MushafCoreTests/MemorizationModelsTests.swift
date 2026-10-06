import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationModelsTests {
    private let now = Date(timeIntervalSince1970: 1_790_000_000)

    @Test func statusRawValuesAreStable() {
        #expect(MemorizationStatus.mastered.rawValue == 1)
        #expect(MemorizationStatus.memorizedWithErrors.rawValue == 2)
        #expect(MemorizationStatus.needsMushaf.rawValue == 3)
        #expect(MemorizationStatus.notMemorized.rawValue == 4)
        #expect(ReviewStrength.strong.rawValue == 1)
        #expect(ReviewStrength.good.rawValue == 2)
        #expect(ReviewStrength.needsReview.rawValue == 3)
        #expect(ReviewStrength.weak.rawValue == 4)
        #expect(ReviewStrength.notReviewed.rawValue == 5)
        #expect(ReviewResult.excellent.rawValue == 1)
        #expect(ReviewResult.forgot.rawValue == 4)
    }

    @Test func blankRecordIsNotMemorized() {
        let record = AyahMemorizationRecord.blank(AyahKey(surah: 1, ayah: 1), now: now)
        #expect(record.status == .notMemorized)
        #expect(record.reviewStrength == .notReviewed)
        #expect(record.isCurrentlyLearning == false)
        #expect(record.firstMemorizedAt == nil)
        #expect(record.lastStatusChangedAt == nil)
        #expect(record.lastReviewedAt == nil)
        #expect(record.nextReviewAt == nil)
        #expect(record.reviewCount == 0 && record.successfulReviewCount == 0)
        #expect(record.consecutiveSuccessfulReviews == 0 && record.errorCount == 0)
        #expect(record.updatedAt == now)
        #expect(record.key == AyahKey(surah: 1, ayah: 1))
    }

    private func coder() -> (JSONEncoder, JSONDecoder) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (encoder, decoder)
    }

    @Test func recordCodableRoundTrip() throws {
        var record = AyahMemorizationRecord.blank(AyahKey(surah: 2, ayah: 255), now: Date(timeIntervalSince1970: 1_790_000_000))
        record.status = .memorizedWithErrors
        record.reviewStrength = .good
        record.isCurrentlyLearning = true
        record.firstMemorizedAt = Date(timeIntervalSince1970: 1_780_000_000)
        record.nextReviewAt = Date(timeIntervalSince1970: 1_790_100_000)
        record.reviewCount = 4
        let (encoder, decoder) = coder()
        let decoded = try decoder.decode(AyahMemorizationRecord.self, from: try encoder.encode(record))
        #expect(decoded == record)
    }

    @Test func changeEventCodableRoundTripWithNilBefore() throws {
        let key = AyahKey(surah: 36, ayah: 1)
        var after = AyahMemorizationRecord.blank(key, now: now)
        after.status = .mastered
        let event = ChangeEvent(batchID: UUID(), surah: 36, ayah: 1, at: now, before: nil, after: after)
        let (encoder, decoder) = coder()
        let decoded = try decoder.decode(ChangeEvent.self, from: try encoder.encode(event))
        #expect(decoded == event)
        #expect(decoded.key == key)
        #expect(decoded.before == nil)
    }

    @Test func batchRecordCodableRoundTrip() throws {
        let batch = BatchRecord(id: UUID(), createdAt: now, kind: .import, label: "سورة يس", scopeJSON: "{}",
                                ayahCount: 83, deviceID: "device", countsForStreak: false, gainAyahs: 0,
                                undoneAt: nil, undoesBatchID: nil)
        let (encoder, decoder) = coder()
        #expect(try decoder.decode(BatchRecord.self, from: try encoder.encode(batch)) == batch)
        #expect(BatchKind.update.rawValue == "update")
        #expect(BatchKind.import.rawValue == "import")
    }

    @Test func policyStandardValues() {
        let policy = MemorizationPolicy.standard
        #expect(policy.weight(.mastered) == 1.0)
        #expect(policy.weight(.memorizedWithErrors) == 0.75)
        #expect(policy.weight(.needsMushaf) == 0.4)
        #expect(policy.weight(.notMemorized) == 0.0)
        #expect(policy.intervalLadderDays == [1, 3, 7, 14, 30, 60])
        #expect(policy.forgotIntervalDays == 1)
        #expect(policy.mistakesIntervalDays == 2)
        #expect(policy.confirmationAyahThreshold == 30)
        #expect(policy.milestonePercents == [25, 50, 75, 100])
    }
}
