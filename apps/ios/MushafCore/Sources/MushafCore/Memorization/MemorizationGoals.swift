import Foundation

/// How far a goal is: a fraction from 0 to 1, what remains, and whether it has been reached. For the
/// per-day goal `remainingAyat` is the rest of today's target and for the per-week goal
/// `remainingPageEquivalents` is the rest of the week's; the other remaining figure is 0 there.
public struct GoalProgress: Equatable, Sendable {
    public let fraction: Double
    public let remainingAyat: Int
    public let remainingPageEquivalents: Double
    public let remainingDays: Int?
    public let isReached: Bool

    public init(fraction: Double, remainingAyat: Int, remainingPageEquivalents: Double, remainingDays: Int?, isReached: Bool) {
        self.fraction = fraction
        self.remainingAyat = remainingAyat
        self.remainingPageEquivalents = remainingPageEquivalents
        self.remainingDays = remainingDays
        self.isReached = isReached
    }
}

public enum GoalEngine {
    public static func progress(_ goal: GoalDefinition, snapshot: MemorizationSnapshot,
                                records: [AyahKey: AyahMemorizationRecord], events: [ChangeEvent],
                                index: QuranIndex, now rawNow: Date, calendar: Calendar) -> GoalProgress {
        let now = rawNow.normalizedToMilliseconds
        switch goal.kind {
        case let .ayatPerDay(target):
            let gained = HistoryAnalytics.gains(from: instantBefore(calendar.startOfDay(for: now)), to: now,
                                                current: records, events: events, index: index).newAyat
            return GoalProgress(fraction: capped(Double(gained), target: Double(target)),
                                remainingAyat: max(0, target - gained), remainingPageEquivalents: 0,
                                remainingDays: nil, isReached: target > 0 && gained >= target)

        case let .pageEquivalentsPerWeek(target):
            let weekStart = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? calendar.startOfDay(for: now)
            let gained = HistoryAnalytics.gains(from: instantBefore(weekStart), to: now,
                                                current: records, events: events, index: index).pageEquivalents
            return GoalProgress(fraction: capped(gained, target: target), remainingAyat: 0,
                                remainingPageEquivalents: max(0, target - gained), remainingDays: nil,
                                isReached: target > 0 && gained >= target - 1e-9)

        case let .completeSurah(surah):
            return mastery(of: index.ayat(ofSurah: surah), records: records, index: index, remainingDays: nil)

        case let .completeJuz(juz):
            return mastery(of: index.ayat(ofJuz: juz), records: records, index: index, remainingDays: nil)

        case let .completeQuranBy(date):
            let today = calendar.startOfDay(for: now)
            let days = calendar.dateComponents([.day], from: today, to: calendar.startOfDay(for: date)).day ?? 0
            return mastery(of: index.ayahKeys, records: records, index: index, remainingDays: max(0, days))
        }
    }

    private static func instantBefore(_ date: Date) -> Date {
        Date(epochMilliseconds: date.epochMilliseconds - 1)
    }

    private static func capped(_ value: Double, target: Double) -> Double {
        guard target > 0 else { return 0 }
        return min(1, max(0, value / target))
    }

    /// Share of `keys` that is mastered, with what is left to master (ayat and page-equivalents).
    private static func mastery(of keys: [AyahKey], records: [AyahKey: AyahMemorizationRecord], index: QuranIndex,
                                remainingDays: Int?) -> GoalProgress {
        guard !keys.isEmpty else {
            return GoalProgress(fraction: 0, remainingAyat: 0, remainingPageEquivalents: 0, remainingDays: remainingDays,
                                isReached: false)
        }
        var mastered = 0
        var remainingPages = 0.0
        for key in keys {
            if records[key]?.status == .mastered { mastered += 1 } else { remainingPages += index.weight(of: key) }
        }
        return GoalProgress(fraction: Double(mastered) / Double(keys.count), remainingAyat: keys.count - mastered,
                            remainingPageEquivalents: remainingPages, remainingDays: remainingDays,
                            isReached: mastered == keys.count)
    }
}
