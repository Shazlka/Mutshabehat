import Foundation
import MushafCore

/// Which memorized ayat are due for review and which surahs are the most overdue (pure, for the dashboard).
enum DueReview {
    struct SurahDue: Equatable {
        let surah: Int
        let dueCount: Int
        let averageOverdueDays: Double
    }

    static func dueAyat(records: [AyahKey: AyahMemorizationRecord], now: Date) -> [AyahKey] {
        records.values.filter { ReviewEngine.isDue($0, now: now) }
            .map(\.key)
            .sorted { ($0.surah, $0.ayah) < ($1.surah, $1.ayah) }
    }

    static func mostOverdueSurahs(records: [AyahKey: AyahMemorizationRecord], now: Date, limit: Int) -> [SurahDue] {
        let due = records.values.filter { ReviewEngine.isDue($0, now: now) }
        let grouped = Dictionary(grouping: due, by: \.surah)
        let rows = grouped.map { surah, items -> SurahDue in
            let total = items.map { overdueDays($0, now: now) }.reduce(0, +)
            return SurahDue(surah: surah, dueCount: items.count, averageOverdueDays: total / Double(items.count))
        }
        let sorted = rows.sorted { lhs, rhs in
            lhs.averageOverdueDays != rhs.averageOverdueDays ? lhs.averageOverdueDays > rhs.averageOverdueDays : lhs.surah < rhs.surah
        }
        return Array(sorted.prefix(max(0, limit)))
    }

    private static func overdueDays(_ record: AyahMemorizationRecord, now: Date) -> Double {
        let reference = record.nextReviewAt ?? record.firstMemorizedAt ?? record.lastStatusChangedAt ?? record.updatedAt
        return max(0, now.timeIntervalSince(reference)) / 86_400
    }
}
