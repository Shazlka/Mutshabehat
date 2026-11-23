import Foundation

public enum Suggestion: Equatable, Sendable {
    case continueLearning(surah: Int, remaining: Int)
    case review(surah: Int, daysSinceReview: Int?)
}

public enum SuggestionEngine {
    /// What to do next, from local data only: finish the range being learned, else review the memorized
    /// surah that is the most overdue (ties go to the lowest surah number), else nothing.
    public static func suggest(records: [AyahKey: AyahMemorizationRecord], index: QuranIndex, now: Date,
                               calendar: Calendar) -> Suggestion? {
        let learning = Dictionary(grouping: records.values.filter { $0.isCurrentlyLearning && $0.status != .mastered },
                                  by: \.surah)
        if let surah = learning.keys.min() {
            return .continueLearning(surah: surah, remaining: learning[surah]?.count ?? 0)
        }

        let bySurah = Dictionary(grouping: records.values, by: \.surah)
        var best: (surah: Int, overdue: Double)?
        for (surah, surahRecords) in bySurah {
            let due = surahRecords.filter { ReviewEngine.isDue($0, now: now) }
            guard !due.isEmpty else { continue }
            let overdue = due.map { overdueDays($0, now: now) }.reduce(0, +) / Double(due.count)
            if let current = best {
                if overdue > current.overdue || (overdue == current.overdue && surah < current.surah) {
                    best = (surah, overdue)
                }
            } else {
                best = (surah, overdue)
            }
        }
        guard let best else { return nil }

        let lastReview = bySurah[best.surah]?.compactMap(\.lastReviewedAt).max()
        let sinceReview = lastReview.flatMap { calendar.dateComponents([.day], from: $0, to: now).day }
        return .review(surah: best.surah, daysSinceReview: sinceReview)
    }

    private static func overdueDays(_ record: AyahMemorizationRecord, now: Date) -> Double {
        let reference = record.nextReviewAt ?? record.firstMemorizedAt ?? record.lastStatusChangedAt ?? record.updatedAt
        return max(0, now.timeIntervalSince(reference)) / 86_400
    }
}
