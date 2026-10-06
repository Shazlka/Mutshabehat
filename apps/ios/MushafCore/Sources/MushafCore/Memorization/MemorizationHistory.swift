import Foundation

public struct PeriodGains: Equatable, Sendable {
    public let newAyat: Int
    public let pageEquivalents: Double
    public let surahsCompleted: Int

    public init(newAyat: Int, pageEquivalents: Double, surahsCompleted: Int) {
        self.newAyat = newAyat
        self.pageEquivalents = pageEquivalents
        self.surahsCompleted = surahsCompleted
    }
}

public enum ProgressRange: Sendable {
    case days7, days30, months3, months6, year, all
}

public struct ProgressPoint: Equatable, Sendable {
    public let date: Date
    public let strictPercent: Double
    public let learningPercent: Double

    public init(date: Date, strictPercent: Double, learningPercent: Double) {
        self.date = date
        self.strictPercent = strictPercent
        self.learningPercent = learningPercent
    }
}

/// Past states, gains and the progress-over-time series, all derived from the change log: the state at any
/// earlier moment is the current state with the later events rolled back.
public enum HistoryAnalytics {
    // MARK: Rollback

    /// Events in chronological order. Equal timestamps keep the order they were given in, and the input
    /// order is never trusted otherwise (a device clock can have been set backwards).
    private static func chronological(_ events: [ChangeEvent]) -> [ChangeEvent] {
        events.enumerated().sorted { ($0.element.at, $0.offset) < ($1.element.at, $1.offset) }.map(\.element)
    }

    /// `current` with every event after `date` rolled back: per ayah the earliest later event's `before`
    /// becomes the record, and a `nil` `before` removes it.
    public static func records(asOf date: Date, current: [AyahKey: AyahMemorizationRecord],
                               events: [ChangeEvent]) -> [AyahKey: AyahMemorizationRecord] {
        var result = current
        var restored = Set<AyahKey>()
        for event in chronological(events) where event.at > date {
            guard restored.insert(event.key).inserted else { continue }
            result[event.key] = event.before
        }
        return result
    }

    // MARK: Gains

    /// Net change between two instants: ayat that moved from needs-Mushaf / not-memorized to mastered /
    /// with-errors (an ayah that went up and back down counts nothing), their page-equivalents, and the
    /// surahs that became fully mastered.
    public static func gains(from: Date, to: Date, current: [AyahKey: AyahMemorizationRecord], events: [ChangeEvent],
                             index: QuranIndex, policy: MemorizationPolicy = .standard) -> PeriodGains {
        let start = records(asOf: from, current: current, events: events)
        let end = records(asOf: to, current: current, events: events)
        var newAyat = 0
        var pageEquivalents = 0.0
        for key in index.ayahKeys {
            let before = start[key]?.status ?? .notMemorized
            let after = end[key]?.status ?? .notMemorized
            if isUnrecitable(before), isRecitable(after) {
                newAyat += 1
                pageEquivalents += index.weight(of: key)
            }
        }
        let completedBefore = Set(MemorizationStatisticsService.snapshot(records: start, index: index, policy: policy)
            .surahs.filter { $0.state == .complete }.map(\.surah))
        let completedAfter = MemorizationStatisticsService.snapshot(records: end, index: index, policy: policy)
            .surahs.filter { $0.state == .complete }.map(\.surah)
        return PeriodGains(newAyat: newAyat, pageEquivalents: pageEquivalents,
                           surahsCompleted: completedAfter.filter { !completedBefore.contains($0) }.count)
    }

    private static func isRecitable(_ status: MemorizationStatus) -> Bool {
        status == .mastered || status == .memorizedWithErrors
    }

    private static func isUnrecitable(_ status: MemorizationStatus) -> Bool {
        status == .notMemorized || status == .needsMushaf
    }

    // MARK: Series

    /// The instants a chart is sampled at, ascending, ending at `now`. Daily ranges use the end of each
    /// earlier day, weekly and monthly ranges step back from `now`, and `.all` runs month by month from
    /// the first event.
    public static func sampleDates(range: ProgressRange, now rawNow: Date, firstEventAt: Date?,
                                   calendar: Calendar) -> [Date] {
        let now = rawNow.normalizedToMilliseconds
        func endOfDay(daysBefore days: Int) -> Date {
            let startOfLaterDay = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -(days - 1), to: now) ?? now)
            return Date(epochMilliseconds: startOfLaterDay.epochMilliseconds - 1)
        }
        var dates: [Date]
        switch range {
        case .days7:
            dates = (1...6).reversed().map(endOfDay(daysBefore:)) + [now]
        case .days30:
            dates = (1...29).reversed().map(endOfDay(daysBefore:)) + [now]
        case .months3:
            dates = (1...12).reversed().compactMap { calendar.date(byAdding: .day, value: -7 * $0, to: now)?.normalizedToMilliseconds } + [now]
        case .months6:
            dates = (1...25).reversed().compactMap { calendar.date(byAdding: .day, value: -7 * $0, to: now)?.normalizedToMilliseconds } + [now]
        case .year:
            dates = (1...11).reversed().compactMap { calendar.date(byAdding: .month, value: -$0, to: now)?.normalizedToMilliseconds } + [now]
        case .all:
            guard let first = firstEventAt,
                  let firstMonth = calendar.dateInterval(of: .month, for: first)?.start,
                  let currentMonth = calendar.dateInterval(of: .month, for: now)?.start else { return [now] }
            dates = []
            var month = firstMonth
            while month < currentMonth {
                guard let next = calendar.date(byAdding: .month, value: 1, to: month) else { break }
                dates.append(Date(epochMilliseconds: next.epochMilliseconds - 1))
                month = next
            }
            dates.append(now)
        }
        var seen = Set<Date>()
        return dates.sorted().filter { seen.insert($0).inserted }
    }

    /// Strict and learning percentages at every sample date, from one backwards pass over the log:
    /// start at the current state and undo events from newest to oldest as the sample dates go back.
    public static func series(range: ProgressRange, now: Date, current: [AyahKey: AyahMemorizationRecord],
                              events: [ChangeEvent], index: QuranIndex, policy: MemorizationPolicy = .standard,
                              calendar: Calendar) -> [ProgressPoint] {
        let samples = sampleDates(range: range, now: now, firstEventAt: events.map(\.at).min(), calendar: calendar)
        let total = Double(index.totalAyahs)

        var state = current
        var mastered = 0
        var weighted = 0.0
        for (key, record) in current where index.ordinal(of: key) != nil {
            if record.status == .mastered { mastered += 1 }
            weighted += policy.weight(record.status)
        }

        let newestFirst = Array(chronological(events).reversed())
        var cursor = 0
        var points: [ProgressPoint] = []
        for date in samples.reversed() {
            while cursor < newestFirst.count, newestFirst[cursor].at > date {
                let event = newestFirst[cursor]
                cursor += 1
                if index.ordinal(of: event.key) != nil {
                    if let existing = state[event.key] {
                        if existing.status == .mastered { mastered -= 1 }
                        weighted -= policy.weight(existing.status)
                    }
                    if let before = event.before {
                        if before.status == .mastered { mastered += 1 }
                        weighted += policy.weight(before.status)
                    }
                }
                state[event.key] = event.before
            }
            points.append(ProgressPoint(date: date,
                                        strictPercent: total > 0 ? Double(mastered) / total * 100 : 0,
                                        learningPercent: total > 0 ? weighted / total * 100 : 0))
        }
        return points.reversed()
    }
}
