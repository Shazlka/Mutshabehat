import Foundation

public enum RetentionPlanner {
    /// Of the backup sets in `existing`, returns those to delete: only the newest set of each local day is
    /// kept, and only for the last `keepDays` days including today.
    public static func datesToDelete(existing: [Date], now: Date, keepDays: Int = 14, calendar: Calendar) -> [Date] {
        let today = calendar.startOfDay(for: now)
        let cutoff = calendar.date(byAdding: .day, value: -(max(keepDays, 1) - 1), to: today) ?? today
        var byDay: [Date: [Date]] = [:]
        for date in existing { byDay[calendar.startOfDay(for: date), default: []].append(date) }
        var doomed: [Date] = []
        for (day, dates) in byDay {
            let newestFirst = dates.sorted(by: >)
            doomed += day >= cutoff ? Array(newestFirst.dropFirst()) : newestFirst
        }
        return doomed.sorted()
    }
}
