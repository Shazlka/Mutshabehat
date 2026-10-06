import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationReviewTests {
    private let now = Date(epochMilliseconds: 1_790_000_000_000)
    private let day: TimeInterval = 86_400
    private let index: QuranIndex
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "UTC")!
        return value
    }

    init() throws { index = try QuranIndex.load(from: openDatabase()) }

    private func record(_ surah: Int = 1, _ ayah: Int = 1,
                        status: MemorizationStatus = .mastered) -> AyahMemorizationRecord {
        var value = AyahMemorizationRecord.blank(AyahKey(surah: surah, ayah: ayah), now: now)
        value.status = status
        return value
    }

    private func streak(_ offsets: [Int]) -> StreakSummary {
        StreakCalculator.summary(qualifyingDays: Set(offsets.map {
            calendar.date(byAdding: .day, value: $0, to: now)!
        }), now: now, calendar: calendar)
    }

    private func suggestion(_ values: [AyahMemorizationRecord]) -> Suggestion? {
        SuggestionEngine.suggest(records: Dictionary(uniqueKeysWithValues: values.map { ($0.key, $0) }),
                                 index: index, now: now, calendar: calendar)
    }

    private func due(_ surah: Int, _ ayah: Int = 1, overdue: Int) -> AyahMemorizationRecord {
        var value = record(surah, ayah)
        value.nextReviewAt = now.addingTimeInterval(-Double(overdue) * day)
        value.lastReviewedAt = value.nextReviewAt!.addingTimeInterval(-7 * day)
        value.reviewStrength = .strong
        return value
    }

    @Test func ladderAfterConsecutiveSuccesses() {
        var value = record()
        for (offset, days) in [1, 3, 7, 14, 30, 60, 60].enumerated() {
            value = ReviewEngine.apply(.excellent, to: value, now: now)
            #expect(value.nextReviewAt == now.addingTimeInterval(Double(days) * day))
            #expect(value.consecutiveSuccessfulReviews == offset + 1)
        }
        #expect(value.successfulReviewCount == 7)
        #expect(value.reviewCount == 7)
        #expect(value.lastReviewedAt == now)
        #expect(value.updatedAt == now)
        #expect(value.reviewStrength == .strong)
    }

    @Test func goodAlsoCountsAsSuccess() {
        let value = ReviewEngine.apply(.good, to: record(), now: now)
        #expect(value.reviewStrength == .good)
        #expect(value.successfulReviewCount == 1)
        #expect(value.consecutiveSuccessfulReviews == 1)
        #expect(value.nextReviewAt == now.addingTimeInterval(day))
    }

    @Test func failureResetsConsecutiveAndSetsShortInterval() {
        var value = record()
        for _ in 0..<3 { value = ReviewEngine.apply(.excellent, to: value, now: now) }
        for result in [ReviewResult.forgot, .mistakes] {
            let failed = ReviewEngine.apply(result, to: value, now: now)
            #expect(failed.consecutiveSuccessfulReviews == 0)
            #expect(failed.errorCount == 1)
            #expect(failed.successfulReviewCount == 3)
            #expect(failed.reviewCount == 4)
            #expect(failed.nextReviewAt == now.addingTimeInterval(result == .forgot ? day : 2 * day))
            #expect(failed.reviewStrength == (result == .forgot ? .weak : .needsReview))
        }
    }

    @Test func reviewNeverChangesStatus() {
        for status in [MemorizationStatus.mastered, .memorizedWithErrors, .needsMushaf] {
            for result in ReviewResult.allCases {
                #expect(ReviewEngine.apply(result, to: record(status: status), now: now).status == status)
            }
        }
    }

    @Test func agedStrengthStaysMasteredButShowsWeak() {
        let value = due(1, overdue: 33)
        #expect(value.lastReviewedAt == now.addingTimeInterval(-40 * day))
        #expect(ReviewEngine.displayedStrength(of: value, now: now) == .weak)
        #expect(value.status == .mastered)
    }

    @Test func slightlyOverdueShowsNeedsReview() {
        for strength in [ReviewStrength.strong, .good, .weak] {
            var value = due(1, overdue: 3)
            value.reviewStrength = strength
            #expect(ReviewEngine.displayedStrength(of: value, now: now) == (strength == .weak ? .weak : .needsReview))
        }
    }

    @Test func notOverdueShowsStoredStrength() {
        var value = due(1, overdue: -1)
        #expect(ReviewEngine.displayedStrength(of: value, now: now) == .strong)
        value.nextReviewAt = now
        #expect(ReviewEngine.displayedStrength(of: value, now: now) == .strong)
        #expect(ReviewEngine.isDue(value, now: now))
        value.nextReviewAt = nil
        #expect(ReviewEngine.displayedStrength(of: value, now: now) == .strong)
    }

    @Test func neverReviewedMemorizedIsDueAndNotReviewed() {
        for status in [MemorizationStatus.mastered, .memorizedWithErrors] {
            var value = record(status: status)
            value.reviewStrength = .strong
            #expect(ReviewEngine.displayedStrength(of: value, now: now) == .notReviewed)
            #expect(ReviewEngine.isDue(value, now: now))
        }
    }

    @Test func notMemorizedIsNotDue() {
        for status in [MemorizationStatus.notMemorized, .needsMushaf] {
            var value = due(1, overdue: 100)
            value.status = status
            #expect(!ReviewEngine.isDue(value, now: now))
            #expect(ReviewEngine.displayedStrength(of: value, now: now) == .strong)
        }
    }

    @Test func dueWhenNextReviewIsPast() {
        #expect(ReviewEngine.isDue(due(1, overdue: 1), now: now))
    }

    @Test func notDueWhenNextReviewIsFuture() {
        #expect(!ReviewEngine.isDue(due(1, overdue: -1), now: now))
    }

    @Test func planReviewSkipsUnmemorized() {
        let first = record()
        let second = record(1, 2, status: .notMemorized)
        let selection = MemorizationSelection.surah(1)
        let plan = MemorizationPlanner.planReview(selection: selection, label: "review", result: .good,
            records: [first.key: first, second.key: second], index: index, now: now)
        #expect(plan.changes.count == 1)
        #expect(plan.selectionCount == 7)
        #expect(plan.unchangedCount == 6)
        #expect(plan.kind == .review)
        #expect(plan.countsForStreak)
        #expect(plan.gainAyahs == 0)
        #expect(plan.label == "review")
        #expect(plan.scopeJSON == selection.scopeJSON)
        #expect(plan.changes.first?.before == first)
        #expect(plan.changes.first?.after == ReviewEngine.apply(.good, to: first, now: now))
        let empty = MemorizationPlanner.planReview(selection: selection, label: "", result: .good,
            records: [second.key: second], index: index, now: now)
        #expect(empty.changes.isEmpty)
        #expect(!empty.countsForStreak)
    }

    @Test func consecutiveDaysCount() { #expect(streak([0, -1, -2]).current == 3) }
    @Test func yesterdayKeepsStreakAlive() { #expect(streak([-1, -2]).current == 2) }
    @Test func gapBreaksStreak() { #expect(streak([0, -3]).current == 1) }
    @Test func noDaysIsZero() {
        #expect(streak([]).current == 0)
        #expect(streak([]).longest == 0)
    }
    @Test func longestIsTracked() {
        let value = streak([-20, -19, -18, -10, -9, -8, -7, -6])
        #expect(value.longest == 5)
        #expect(value.current == 0)
    }
    @Test func futureDaysDoNotInflateCurrent() {
        #expect(streak([1, 2, 3]).current == 0)
        #expect(streak([1, 2, 3]).longest == 3)
        #expect(streak([-1, 0, 1, 2]).current == 2)
    }

    @Test func streakAcrossMidnightAndDST() {
        var local = Calendar(identifier: .gregorian)
        local.timeZone = TimeZone(identifier: "America/New_York")!
        func date(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
            local.date(from: DateComponents(year: 2026, month: 3, day: day, hour: hour, minute: minute))!
        }
        let days = Set([7, 8, 9].map { local.startOfDay(for: date($0, 12)) })
        let result = StreakCalculator.summary(qualifyingDays: days, now: date(9, 12), calendar: local)
        #expect(result.current == 3)
        #expect(result.longest == 3)
        let midnight = StreakCalculator.summary(qualifyingDays: [date(7, 23, 30), date(8, 0, 30)],
                                               now: date(8, 12), calendar: local)
        #expect(midnight.current == 2)
        #expect(midnight.longest == 2)
    }

    @Test func suggestionPrefersLearningRange() {
        var values = (1...5).map { record(36, $0, status: .needsMushaf) }
        for i in values.indices { values[i].isCurrentlyLearning = true }
        values.append(due(1, overdue: 20))
        #expect(suggestion(values) == .continueLearning(surah: 36, remaining: 5))
        var earlier = record(2, status: .notMemorized)
        earlier.isCurrentlyLearning = true
        values.append(earlier)
        #expect(suggestion(values) == .continueLearning(surah: 2, remaining: 1))
    }

    @Test func learningAyatThatAreMasteredDoNotCount() {
        var value = due(36, overdue: -1)
        value.isCurrentlyLearning = true
        #expect(suggestion([value]) == nil)
    }

    @Test func suggestionFallsBackToMostOverdueSurah() {
        let values = [due(36, 1, overdue: 6), due(36, 2, overdue: 10), due(1, overdue: 2)]
        #expect(suggestion(values) == .review(surah: 36, daysSinceReview: 13))
        var never = record(67)
        never.firstMemorizedAt = now.addingTimeInterval(-30 * day)
        #expect(suggestion(values + [never]) == .review(surah: 67, daysSinceReview: nil))
    }

    @Test func suggestionTieGoesToLowestSurah() {
        #expect(suggestion([due(36, overdue: 8), due(1, overdue: 8)]) == .review(surah: 1, daysSinceReview: 15))
    }
    @Test func suggestionNilWhenNothingMemorized() {
        #expect(suggestion([]) == nil)
        #expect(suggestion([record(status: .notMemorized), record(2, status: .needsMushaf)]) == nil)
    }
    @Test func suggestionNilWhenNothingIsDue() {
        #expect(suggestion([due(1, overdue: -2)]) == nil)
    }

    @Test func reviewNormalizesDatesAndPreservesOtherFields() {
        var value = record(status: .needsMushaf)
        value.isCurrentlyLearning = true
        value.firstMemorizedAt = now.addingTimeInterval(-day)
        value.lastStatusChangedAt = now.addingTimeInterval(-2 * day)
        let precise = now.addingTimeInterval(0.123456)
        let plan = MemorizationPlanner.planReview(selection: .surah(1), label: "", result: .excellent,
            records: [value.key: value], index: index, now: precise)
        let after = plan.changes[0].after
        #expect(after.updatedAt == precise.normalizedToMilliseconds)
        #expect(after.lastReviewedAt == precise.normalizedToMilliseconds)
        #expect(after.nextReviewAt == Date(epochMilliseconds: precise.epochMilliseconds + 86_400_000))
        #expect(after.firstMemorizedAt == value.firstMemorizedAt)
        #expect(after.lastStatusChangedAt == value.lastStatusChangedAt)
        #expect(after.isCurrentlyLearning)
        #expect(after.status == .needsMushaf)
    }

    @Test func agingThresholdIsStrictAndIntervalHasOneDayMinimum() {
        var value = due(1, overdue: 14)
        #expect(ReviewEngine.displayedStrength(of: value, now: now) == .needsReview)
        #expect(ReviewEngine.displayedStrength(of: value, now: now.addingTimeInterval(1)) == .weak)
        value.nextReviewAt = now.addingTimeInterval(-2 * day)
        value.lastReviewedAt = value.nextReviewAt
        #expect(ReviewEngine.displayedStrength(of: value, now: now) == .needsReview)
        #expect(ReviewEngine.displayedStrength(of: value, now: now.addingTimeInterval(1)) == .weak)
    }

    @Test func suggestionUsesFallbackDatesAndLatestReviewAcrossSurah() {
        var older = record(36)
        older.lastStatusChangedAt = now.addingTimeInterval(-10 * day)
        var newer = due(36, 2, overdue: -5)
        newer.lastReviewedAt = now.addingTimeInterval(-day)
        #expect(suggestion([older, newer, due(1, overdue: 2)]) == .review(surah: 36, daysSinceReview: 1))
        older.lastStatusChangedAt = nil
        older.updatedAt = now.addingTimeInterval(-10 * day)
        #expect(suggestion([older, due(1, overdue: 2)]) == .review(surah: 36, daysSinceReview: nil))
    }
}
