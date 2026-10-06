import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationGoalsTests {
    private let index: QuranIndex
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "UTC")!
        value.firstWeekday = 1   // Sunday
        return value
    }

    init() throws {
        index = try QuranIndex.load(from: openDatabase())
    }

    private func date(_ day: Int, _ hour: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour))!.normalizedToMilliseconds
    }

    private var now: Date { date(7, 12) }   // Wednesday; the week began on Sunday the 4th

    private func record(_ key: AyahKey, _ status: MemorizationStatus) -> AyahMemorizationRecord {
        var r = AyahMemorizationRecord.blank(key, now: now)
        r.status = status
        return r
    }

    private func world(mastered keys: [AyahKey], at time: Date? = nil) -> (records: [AyahKey: AyahMemorizationRecord], events: [ChangeEvent]) {
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        var events: [ChangeEvent] = []
        for key in keys {
            let after = record(key, .mastered)
            records[key] = after
            if let time {
                events.append(ChangeEvent(batchID: UUID(), surah: key.surah, ayah: key.ayah, at: time, before: nil, after: after))
            }
        }
        return (records, events)
    }

    private func progress(_ kind: GoalKind, records: [AyahKey: AyahMemorizationRecord],
                          events: [ChangeEvent]) -> GoalProgress {
        let goal = GoalDefinition(id: UUID(), kind: kind, createdAt: now)
        let snapshot = MemorizationStatisticsService.snapshot(records: records, index: index)
        return GoalEngine.progress(goal, snapshot: snapshot, records: records, events: events, index: index,
                                   now: now, calendar: calendar)
    }

    @Test func ayatPerDayFraction() {
        let keys = Array(index.ayat(ofSurah: 2).prefix(4))
        let w = world(mastered: keys, at: date(7, 9))          // 4 ayat today
        let result = progress(.ayatPerDay(10), records: w.records, events: w.events)
        #expect(abs(result.fraction - 0.4) < 1e-9)
        #expect(result.remainingAyat == 6)
        #expect(!result.isReached)
    }

    @Test func ayatPerDayIgnoresYesterdayAndIsCappedWhenReached() {
        let keys = Array(index.ayat(ofSurah: 2).prefix(12))
        let yesterday = world(mastered: keys, at: date(6, 20))
        #expect(progress(.ayatPerDay(10), records: yesterday.records, events: yesterday.events).fraction == 0)
        let today = world(mastered: keys, at: date(7, 8))
        let reached = progress(.ayatPerDay(10), records: today.records, events: today.events)
        #expect(reached.fraction == 1)
        #expect(reached.isReached)
        #expect(reached.remainingAyat == 0)
    }

    @Test func weeklyPageEquivalents() {
        let keys = index.ayat(onPage: 50)
        let w = world(mastered: keys, at: date(6, 12))          // Tuesday: inside this week
        let result = progress(.pageEquivalentsPerWeek(4), records: w.records, events: w.events)
        #expect(abs(result.fraction - 0.25) < 1e-9)
        #expect(abs(result.remainingPageEquivalents - 3) < 1e-9)
        let lastWeek = world(mastered: keys, at: date(3, 12))   // Saturday: before the week began
        #expect(progress(.pageEquivalentsPerWeek(4), records: lastWeek.records, events: lastWeek.events).fraction == 0)
    }

    @Test func completeSurahProgress() {
        let fatiha = index.ayat(ofSurah: 1)
        let w = world(mastered: Array(fatiha.prefix(3)))
        let result = progress(.completeSurah(1), records: w.records, events: w.events)
        #expect(abs(result.fraction - 3.0 / 7.0) < 1e-9)
        #expect(result.remainingAyat == 4)
        #expect(result.remainingPageEquivalents > 0 && result.remainingPageEquivalents < 1)
        #expect(!result.isReached)
        let all = world(mastered: fatiha)
        #expect(progress(.completeSurah(1), records: all.records, events: all.events).isReached)
    }

    @Test func completeJuzReached() {
        let w = world(mastered: index.ayat(ofJuz: 30))
        let result = progress(.completeJuz(30), records: w.records, events: w.events)
        #expect(result.isReached)
        #expect(result.fraction == 1)
        #expect(result.remainingAyat == 0)
        #expect(progress(.completeJuz(30), records: [:], events: []).fraction == 0)
    }

    @Test func completeQuranByDateRemainingDays() {
        let w = world(mastered: Array(index.ayahKeys.prefix(3118)))   // exactly half
        let future = progress(.completeQuranBy(date(17, 12)), records: w.records, events: w.events)
        #expect(abs(future.fraction - 0.5) < 1e-9)
        #expect(future.remainingDays == 10)
        #expect(future.remainingAyat == 6236 - 3118)
        #expect(future.remainingPageEquivalents > 0)
        let past = progress(.completeQuranBy(date(1, 12)), records: w.records, events: w.events)
        #expect(past.remainingDays == 0)
        #expect(!past.isReached)
    }

    @Test func completeQuranReachedWhenEverythingIsMastered() {
        let w = world(mastered: index.ayahKeys)
        let result = progress(.completeQuranBy(date(17, 12)), records: w.records, events: w.events)
        #expect(result.isReached)
        #expect(result.fraction == 1)
        #expect(abs(result.remainingPageEquivalents) < 1e-6)
    }

    @Test func unknownSurahAndJuzAreEmptyGoals() {
        let result = progress(.completeSurah(500), records: [:], events: [])
        #expect(result.fraction == 0)
        #expect(!result.isReached)
        #expect(progress(.completeJuz(99), records: [:], events: []).fraction == 0)
    }
}
