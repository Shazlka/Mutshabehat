import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationHistoryTests {
    private let index: QuranIndex
    private let base: Int64 = 1_790_000_000_000

    init() throws {
        index = try QuranIndex.load(from: openDatabase())
    }

    private func at(_ seconds: Int64) -> Date { Date(epochMilliseconds: base + seconds * 1000) }
    private func key(_ surah: Int, _ ayah: Int) -> AyahKey { AyahKey(surah: surah, ayah: ayah) }

    private func record(_ key: AyahKey, _ status: MemorizationStatus, updated: Date) -> AyahMemorizationRecord {
        var r = AyahMemorizationRecord.blank(key, now: updated)
        r.status = status
        return r
    }

    private func event(_ key: AyahKey, from old: MemorizationStatus?, to new: MemorizationStatus, at time: Date) -> ChangeEvent {
        ChangeEvent(batchID: UUID(), surah: key.surah, ayah: key.ayah, at: time,
                    before: old.map { record(key, $0, updated: time.addingTimeInterval(-1)) },
                    after: record(key, new, updated: time))
    }

    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    // MARK: - Rollback

    @Test func rollbackRestoresPriorRows() {
        let k = key(1, 1)
        let current = [k: record(k, .mastered, updated: at(20))]
        let events = [event(k, from: .needsMushaf, to: .mastered, at: at(20))]
        #expect(HistoryAnalytics.records(asOf: at(10), current: current, events: events)[k]?.status == .needsMushaf)
        #expect(HistoryAnalytics.records(asOf: at(30), current: current, events: events)[k]?.status == .mastered)
        #expect(HistoryAnalytics.records(asOf: at(20), current: current, events: events)[k]?.status == .mastered)
    }

    @Test func removesRecordCreatedAfterDate() {
        let k = key(1, 1)
        let current = [k: record(k, .mastered, updated: at(20))]
        let events = [event(k, from: nil, to: .mastered, at: at(20))]
        #expect(HistoryAnalytics.records(asOf: at(10), current: current, events: events)[k] == nil)
    }

    @Test func earliestLaterEventWins() {
        let k = key(1, 1)
        let current = [k: record(k, .mastered, updated: at(30))]
        let events = [event(k, from: .needsMushaf, to: .memorizedWithErrors, at: at(20)),
                      event(k, from: .memorizedWithErrors, to: .mastered, at: at(30))]
        #expect(HistoryAnalytics.records(asOf: at(10), current: current, events: events)[k]?.status == .needsMushaf)
        #expect(HistoryAnalytics.records(asOf: at(25), current: current, events: events)[k]?.status == .memorizedWithErrors)
    }

    @Test func twoEventsSameTimestampKeepInputOrder() {
        // Calendar edge: equal timestamps resolve by the order the events were given.
        let k = key(1, 1)
        let current = [k: record(k, .mastered, updated: at(20))]
        let events = [event(k, from: .needsMushaf, to: .memorizedWithErrors, at: at(20)),
                      event(k, from: .memorizedWithErrors, to: .mastered, at: at(20))]
        #expect(HistoryAnalytics.records(asOf: at(10), current: current, events: events)[k]?.status == .needsMushaf)
    }

    @Test func deviceClockBackwardsEventsStillRollBack() {
        let k = key(1, 1)
        let current = [k: record(k, .mastered, updated: at(30))]
        let ascending = [event(k, from: .needsMushaf, to: .memorizedWithErrors, at: at(20)),
                         event(k, from: .memorizedWithErrors, to: .mastered, at: at(30))]
        let descending = Array(ascending.reversed())
        #expect(HistoryAnalytics.records(asOf: at(10), current: current, events: descending)
                == HistoryAnalytics.records(asOf: at(10), current: current, events: ascending))
    }

    // MARK: - Gains

    @Test func gainsAreNet() {
        let k = key(1, 1)
        let events = [event(k, from: .notMemorized, to: .mastered, at: at(20)),
                      event(k, from: .mastered, to: .notMemorized, at: at(30))]
        let gains = HistoryAnalytics.gains(from: at(10), to: at(40), current: [:], events: events, index: index)
        #expect(gains.newAyat == 0)
        #expect(gains.pageEquivalents == 0)
    }

    @Test func gainsCountNewAyatAndPageEquivalents() {
        let keys = index.ayat(onPage: 50)
        var current: [AyahKey: AyahMemorizationRecord] = [:]
        var events: [ChangeEvent] = []
        for k in keys {
            current[k] = record(k, .mastered, updated: at(20))
            events.append(event(k, from: nil, to: .mastered, at: at(20)))
        }
        let gains = HistoryAnalytics.gains(from: at(10), to: at(30), current: current, events: events, index: index)
        #expect(gains.newAyat == keys.count)
        #expect(abs(gains.pageEquivalents - 1.0) < 1e-9)
    }

    @Test func gainsCountSurahsCompletedInPeriod() {
        let fatiha = index.ayat(ofSurah: 1)
        var current: [AyahKey: AyahMemorizationRecord] = [:]
        var events: [ChangeEvent] = []
        for k in fatiha {
            current[k] = record(k, .mastered, updated: at(20))
            events.append(event(k, from: nil, to: .mastered, at: at(20)))
        }
        #expect(HistoryAnalytics.gains(from: at(10), to: at(30), current: current, events: events, index: index).surahsCompleted == 1)
        // Already complete before the period → 0.
        #expect(HistoryAnalytics.gains(from: at(25), to: at(30), current: current, events: events, index: index).surahsCompleted == 0)
    }

    @Test func errorsToMasteredIsNotANewAyah() {
        let k = key(1, 1)
        let current = [k: record(k, .mastered, updated: at(20))]
        let events = [event(k, from: .memorizedWithErrors, to: .mastered, at: at(20))]
        #expect(HistoryAnalytics.gains(from: at(10), to: at(30), current: current, events: events, index: index).newAyat == 0)
    }

    @Test func needsMushafToErrorsIsANewAyah() {
        let k = key(1, 1)
        let current = [k: record(k, .memorizedWithErrors, updated: at(20))]
        let events = [event(k, from: .needsMushaf, to: .memorizedWithErrors, at: at(20))]
        #expect(HistoryAnalytics.gains(from: at(10), to: at(30), current: current, events: events, index: index).newAyat == 1)
    }

    // MARK: - Sample dates

    @Test func sampleDatesShapes() {
        let now = Date(epochMilliseconds: 1_790_000_000_123)
        let calendar = utc
        func dates(_ range: ProgressRange, first: Date? = nil) -> [Date] {
            HistoryAnalytics.sampleDates(range: range, now: now, firstEventAt: first, calendar: calendar)
        }
        #expect(dates(.days7).count == 7)
        #expect(dates(.days30).count == 30)
        #expect(dates(.months3).count == 13)
        #expect(dates(.months6).count == 26)
        #expect(dates(.year).count == 12)
        for range in [ProgressRange.days7, .days30, .months3, .months6, .year] {
            let list = dates(range)
            #expect(list == list.sorted())
            #expect(list.last == now.normalizedToMilliseconds)
        }
        let startOfToday = calendar.startOfDay(for: now)
        let secondToLast = dates(.days7)[5]
        #expect(secondToLast == Date(epochMilliseconds: startOfToday.epochMilliseconds - 1))

        let fiveMonthsAgo = calendar.date(byAdding: .month, value: -5, to: now)!
        #expect(dates(.all, first: fiveMonthsAgo).count == 6)
        #expect(dates(.all, first: nil) == [now.normalizedToMilliseconds])
    }

    // MARK: - Series

    @Test func seriesEqualsRecomputation() {
        let now = Date(epochMilliseconds: 1_790_000_000_000)
        let day: Int64 = 86_400
        let keys = (1...6).map { key(2, $0) }
        var current: [AyahKey: AyahMemorizationRecord] = [:]
        var events: [ChangeEvent] = []
        var state: [AyahKey: MemorizationStatus] = [:]
        // 40 events over 20 days, including downgrades.
        let script: [(Int, Int, MemorizationStatus)] = [
            (1, 0, .needsMushaf), (2, 1, .mastered), (3, 2, .memorizedWithErrors), (4, 0, .mastered), (5, 3, .mastered),
            (6, 1, .needsMushaf), (7, 4, .mastered), (8, 5, .memorizedWithErrors), (9, 2, .notMemorized), (10, 0, .mastered),
            (11, 1, .memorizedWithErrors), (12, 3, .needsMushaf), (13, 4, .notMemorized), (14, 5, .mastered), (15, 0, .mastered),
            (16, 2, .mastered), (17, 3, .mastered), (18, 1, .notMemorized), (19, 4, .mastered), (20, 5, .notMemorized)
        ]
        for (daysAgo, keyIndex, status) in script {
            let k = keys[keyIndex]
            let time = Date(epochMilliseconds: now.epochMilliseconds - Int64(21 - daysAgo) * day * 1000)
            events.append(ChangeEvent(batchID: UUID(), surah: k.surah, ayah: k.ayah, at: time,
                                      before: state[k].map { record(k, $0, updated: time) },
                                      after: record(k, status, updated: time)))
            state[k] = status
        }
        for (k, status) in state { current[k] = record(k, status, updated: now) }

        let points = HistoryAnalytics.series(range: .days30, now: now, current: current, events: events, index: index, calendar: utc)
        #expect(points.count == 30)
        for point in points {
            let past = MemorizationStatisticsService.snapshot(
                records: HistoryAnalytics.records(asOf: point.date, current: current, events: events), index: index)
            #expect(abs(point.strictPercent - past.strictPercent) < 1e-9)
            #expect(abs(point.learningPercent - past.learningPercent) < 1e-9)
        }
        #expect(points.contains { $0.strictPercent > 0 })
    }

    @Test func seriesOnEmptyHistoryIsFlatZero() {
        for range in [ProgressRange.days7, .days30, .months3, .months6, .year, .all] {
            let points = HistoryAnalytics.series(range: range, now: at(0), current: [:], events: [], index: index, calendar: utc)
            #expect(!points.isEmpty)
            #expect(points.allSatisfy { $0.strictPercent == 0 && $0.learningPercent == 0 })
        }
    }

    @Test func seriesWithOnlyCurrentStateIsFlat() {
        let keys = Array(index.ayahKeys.prefix(10))
        var current: [AyahKey: AyahMemorizationRecord] = [:]
        for k in keys { current[k] = record(k, .mastered, updated: at(0)) }
        let points = HistoryAnalytics.series(range: .days7, now: at(0), current: current, events: [], index: index, calendar: utc)
        let expected = 10.0 / 6236.0 * 100
        #expect(points.allSatisfy { abs($0.strictPercent - expected) < 1e-9 && abs($0.learningPercent - expected) < 1e-9 })
    }

    @Test func seriesIgnoresRecordsOutsideTheIndex() {
        let stray = key(200, 1)
        let current = [stray: record(stray, .mastered, updated: at(0))]
        let points = HistoryAnalytics.series(range: .days7, now: at(0), current: current, events: [], index: index, calendar: utc)
        #expect(points.allSatisfy { $0.strictPercent == 0 })
    }
}
