import Foundation

public struct StreakSummary: Equatable, Sendable {
    public let current: Int
    public let longest: Int

    public init(current: Int, longest: Int) {
        self.current = current
        self.longest = longest
    }
}

public enum StreakCalculator {
    /// `qualifyingDays` holds a moment on each day that counts (it is reduced to the start of that day).
    /// The current streak runs back from today, or from yesterday while today has no entry yet; days after
    /// today (a clock that was set back) never extend it. The longest streak is the longest run overall.
    /// Consecutive days are found with the calendar, so a daylight-saving change cannot break a run.
    public static func summary(qualifyingDays: Set<Date>, now: Date, calendar: Calendar) -> StreakSummary {
        let days = Set(qualifyingDays.map { calendar.startOfDay(for: $0) })
        guard !days.isEmpty else { return StreakSummary(current: 0, longest: 0) }

        var longest = 0
        var run = 0
        var previous: Date?
        for day in days.sorted() {
            if let previous, calendar.date(byAdding: .day, value: 1, to: previous) == day { run += 1 } else { run = 1 }
            longest = max(longest, run)
            previous = day
        }

        let today = calendar.startOfDay(for: now)
        var cursor: Date?
        if days.contains(today) {
            cursor = today
        } else if let yesterday = calendar.date(byAdding: .day, value: -1, to: today), days.contains(yesterday) {
            cursor = yesterday
        }
        var current = 0
        while let day = cursor, days.contains(day) {
            current += 1
            cursor = calendar.date(byAdding: .day, value: -1, to: day)
        }
        return StreakSummary(current: current, longest: longest)
    }
}
