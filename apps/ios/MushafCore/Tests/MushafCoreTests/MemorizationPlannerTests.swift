import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationPlannerTests {
    private let index: QuranIndex
    private let now = Date(epochMilliseconds: 1_790_000_000_000)

    init() throws {
        index = try QuranIndex.load(from: openDatabase())
    }

    private func key(_ surah: Int, _ ayah: Int) -> AyahKey { AyahKey(surah: surah, ayah: ayah) }

    private func record(_ key: AyahKey, _ status: MemorizationStatus, learning: Bool = false,
                        first: Date? = nil) -> AyahMemorizationRecord {
        var r = AyahMemorizationRecord.blank(key, now: now.addingTimeInterval(-1000))
        r.status = status
        r.isCurrentlyLearning = learning
        r.firstMemorizedAt = first
        return r
    }

    private func plan(_ selection: MemorizationSelection, _ status: MemorizationStatus, learning: Bool? = nil,
                      records: [AyahKey: AyahMemorizationRecord] = [:]) -> BatchPlan {
        MemorizationPlanner.planUpdate(selection: selection, label: "test", status: status, learning: learning,
                                       records: records, index: index, now: now)
    }

    @Test func plansOnlyChangedAyat() {
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        for ayah in 1...2 { records[key(1, ayah)] = record(key(1, ayah), .mastered) }
        let result = plan(.surah(1), .mastered, records: records)
        #expect(result.selectionCount == 7)
        #expect(result.changes.count == 5)
        #expect(result.unchangedCount == 2)
        #expect(result.kind == .update)
        #expect(result.label == "test")
        #expect(result.changes.allSatisfy { $0.after.status == .mastered && $0.before == nil })
    }

    @Test func sameStatusIsNoOpEvenWithLearningNil() {
        let k = key(1, 1)
        let result = plan(.ayahRange(surah: 1, from: 1, to: 1), .mastered, records: [k: record(k, .mastered, learning: true)])
        #expect(result.changes.isEmpty)
        #expect(result.unchangedCount == 1)
    }

    @Test func notMemorizedOnUntouchedAyahCreatesNoRow() {
        let result = plan(.surah(1), .notMemorized)
        #expect(result.changes.isEmpty)
    }

    @Test func firstMemorizedAtIsSetOnceAndKept() {
        let k = key(2, 5)
        let withErrors = plan(.ayahRange(surah: 2, from: 5, to: 5), .memorizedWithErrors).changes[0].after
        #expect(withErrors.firstMemorizedAt == now)
        var records = [k: withErrors]
        let later = now.addingTimeInterval(500)
        let mastered = MemorizationPlanner.planUpdate(selection: .ayahRange(surah: 2, from: 5, to: 5), label: "t",
                                                      status: .mastered, learning: nil, records: records, index: index, now: later)
            .changes[0].after
        #expect(mastered.firstMemorizedAt == now)
        #expect(mastered.lastStatusChangedAt == later)
        records[k] = mastered
        let down = MemorizationPlanner.planUpdate(selection: .ayahRange(surah: 2, from: 5, to: 5), label: "t",
                                                  status: .notMemorized, learning: nil, records: records, index: index,
                                                  now: later.addingTimeInterval(500)).changes[0].after
        #expect(down.firstMemorizedAt == now)
        #expect(down.status == .notMemorized)
    }

    @Test func needsMushafDoesNotSetFirstMemorized() {
        let after = plan(.ayahRange(surah: 2, from: 5, to: 5), .needsMushaf).changes[0].after
        #expect(after.firstMemorizedAt == nil)
        #expect(after.lastStatusChangedAt == now)
    }

    @Test func masteredClearsLearningFlag() {
        let k = key(36, 1)
        let after = plan(.ayahRange(surah: 36, from: 1, to: 1), .mastered,
                         records: [k: record(k, .needsMushaf, learning: true)]).changes[0].after
        #expect(after.isCurrentlyLearning == false)
    }

    @Test func explicitLearningTrueKeepsItAndNilLeavesOtherStatusesAlone() {
        let k = key(36, 1)
        let kept = plan(.ayahRange(surah: 36, from: 1, to: 1), .mastered, learning: true,
                        records: [k: record(k, .needsMushaf, learning: true)]).changes[0].after
        #expect(kept.isCurrentlyLearning == true)
        let untouched = plan(.ayahRange(surah: 36, from: 1, to: 1), .memorizedWithErrors,
                             records: [k: record(k, .needsMushaf, learning: true)]).changes[0].after
        #expect(untouched.isCurrentlyLearning == true)
    }

    @Test func learningOnlyChangeIsNotANoOp() {
        let k = key(36, 1)
        let result = plan(.ayahRange(surah: 36, from: 1, to: 1), .needsMushaf, learning: true,
                          records: [k: record(k, .needsMushaf)])
        #expect(result.changes.count == 1)
        #expect(result.changes[0].after.isCurrentlyLearning)
        #expect(result.changes[0].after.lastStatusChangedAt == nil)   // the status itself did not change
        #expect(result.countsForStreak == false)
    }

    @Test func downgradeDoesNotCountForStreakOrGain() {
        let k = key(1, 1)
        let result = plan(.ayahRange(surah: 1, from: 1, to: 1), .needsMushaf, records: [k: record(k, .mastered)])
        #expect(result.countsForStreak == false)
        #expect(result.gainAyahs == 0)
    }

    @Test func upgradeCountsForStreakAndGain() {
        let result = plan(.surah(1), .mastered)
        #expect(result.countsForStreak == true)
        #expect(result.gainAyahs == 7)
    }

    @Test func errorsToMasteredCountsForStreakButIsNotANewAyah() {
        let k = key(1, 1)
        let result = plan(.ayahRange(surah: 1, from: 1, to: 1), .mastered, records: [k: record(k, .memorizedWithErrors)])
        #expect(result.countsForStreak == true)
        #expect(result.gainAyahs == 0)
    }

    @Test func needsMushafIsNotAnUpgradeIntoMemorized() {
        let result = plan(.surah(1), .needsMushaf)
        #expect(result.countsForStreak == false)
        #expect(result.gainAyahs == 0)
        #expect(result.changes.count == 7)
    }

    @Test func confirmationRule() {
        func needs(_ selection: MemorizationSelection) -> Bool {
            let p = plan(selection, .mastered)
            return MemorizationPlanner.needsConfirmation(selection: selection, plan: p, index: index)
        }
        #expect(needs(.surah(36)))                                              // whole surah
        #expect(needs(.surah(1)))                                               // a small whole surah still asks
        #expect(!needs(.ayahRange(surah: 2, from: 1, to: 30)))                  // exactly 30
        #expect(needs(.ayahRange(surah: 2, from: 1, to: 31)))                   // 31
        #expect(!needs(.ayahRange(surah: 2, from: 1, to: 5)))
    }

    @Test func scopeJSONDescribesTheSelection() {
        #expect(plan(.surah(36), .mastered).scopeJSON.contains("\"surah\""))
        #expect(plan(.pageRange(582...589), .mastered).scopeJSON.contains("582"))
        #expect(plan(.juz(30), .mastered).scopeJSON.contains("30"))
        #expect(!plan(.surah(36), .mastered).scopeJSON.isEmpty)
    }

    @Test func nowIsNormalizedToMilliseconds() {
        let precise = Date(timeIntervalSince1970: 1_790_000_000.1234567)
        let after = MemorizationPlanner.planUpdate(selection: .surah(1), label: "t", status: .mastered, learning: nil,
                                                   records: [:], index: index, now: precise).changes[0].after
        #expect(after.updatedAt == Date(epochMilliseconds: 1_790_000_000_123))
        #expect(after.updatedAt.normalizedToMilliseconds == after.updatedAt)
    }

    @Test func wholeQuranPlanReturnsEveryAyah() {
        let result = plan(.span(from: index.ayahKeys.first!, to: index.ayahKeys.last!), .mastered)
        #expect(result.changes.count == 6236)
        #expect(result.gainAyahs == 6236)
    }
}
