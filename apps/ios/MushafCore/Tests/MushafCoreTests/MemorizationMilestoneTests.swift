import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationMilestoneTests {
    private let index: QuranIndex
    private let now = Date(epochMilliseconds: 1_790_000_000_000)

    init() throws {
        index = try QuranIndex.load(from: openDatabase())
    }

    private func snapshot(mastered keys: [AyahKey]) -> MemorizationSnapshot {
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        for key in keys {
            var record = AyahMemorizationRecord.blank(key, now: now)
            record.status = .mastered
            records[key] = record
        }
        return MemorizationStatisticsService.snapshot(records: records, index: index)
    }

    @Test func surahCompletionFiresOnce() {
        let fatiha = index.ayat(ofSurah: 1)
        let before = snapshot(mastered: [])
        let after = snapshot(mastered: fatiha)
        #expect(MemorizationPlanner.milestones(before: before, after: after) == [.surahCompleted(1)])
        #expect(MemorizationPlanner.milestones(before: after, after: after).isEmpty)
    }

    @Test func partialSurahFiresNothing() {
        let before = snapshot(mastered: [])
        let after = snapshot(mastered: Array(index.ayat(ofSurah: 1).prefix(6)))
        #expect(MemorizationPlanner.milestones(before: before, after: after).isEmpty)
    }

    @Test func juzCompletionAlsoReportsItsSurahs() {
        let before = snapshot(mastered: [])
        let after = snapshot(mastered: index.ayat(ofJuz: 30))
        let milestones = MemorizationPlanner.milestones(before: before, after: after)
        #expect(milestones.contains(.juzCompleted(30)))
        #expect(milestones.contains(.surahCompleted(78)))
        #expect(milestones.contains(.surahCompleted(114)))
        // Order: surahs ascending, then juz, then percents.
        let surahs = milestones.compactMap { milestone -> Int? in
            if case let .surahCompleted(n) = milestone { n } else { nil }
        }
        #expect(surahs == surahs.sorted())
        let juzIndex = milestones.firstIndex(of: .juzCompleted(30))!
        #expect(milestones.firstIndex(of: .surahCompleted(114))! < juzIndex)
    }

    @Test func percentMilestonesAtThresholds() {
        let keys = index.ayahKeys
        let before = snapshot(mastered: Array(keys.prefix(1558)))     // 24.98 %
        let after = snapshot(mastered: Array(keys.prefix(1559)))      // exactly 25 %
        let milestones = MemorizationPlanner.milestones(before: before, after: after)
        #expect(milestones.contains(.percent(25)))
        #expect(!milestones.contains(.percent(50)))
        #expect(MemorizationPlanner.milestones(before: after, after: after).isEmpty)
    }

    @Test func crossingSeveralThresholdsReportsEachInOrder() {
        let keys = index.ayahKeys
        let milestones = MemorizationPlanner.milestones(before: snapshot(mastered: []), after: snapshot(mastered: Array(keys.prefix(3200))))
        let percents = milestones.compactMap { milestone -> Int? in
            if case let .percent(p) = milestone { p } else { nil }
        }
        #expect(percents == [25, 50])
    }

    @Test func wholeQuranGivesQuranCompletedAndNoPercentHundred() {
        let keys = index.ayahKeys
        let before = snapshot(mastered: Array(keys.dropLast()))
        let after = snapshot(mastered: keys)
        let milestones = MemorizationPlanner.milestones(before: before, after: after)
        #expect(milestones.contains(.quranCompleted))
        #expect(!milestones.contains(.percent(100)))
        #expect(milestones.last == .quranCompleted)
    }

    @Test func downgradeFiresNothing() {
        let before = snapshot(mastered: index.ayat(ofSurah: 1))
        let after = snapshot(mastered: [])
        #expect(MemorizationPlanner.milestones(before: before, after: after).isEmpty)
    }

    @Test func customPolicyThresholdsAreUsed() {
        var policy = MemorizationPolicy.standard
        policy.milestonePercents = [10, 100]
        let keys = index.ayahKeys
        let milestones = MemorizationPlanner.milestones(before: snapshot(mastered: []),
                                                        after: snapshot(mastered: Array(keys.prefix(700))), policy: policy)
        #expect(milestones.contains(.percent(10)))
        #expect(!milestones.contains(.percent(25)))
    }
}
