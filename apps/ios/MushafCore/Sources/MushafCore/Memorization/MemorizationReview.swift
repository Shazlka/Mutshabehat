import Foundation

public enum ReviewEngine {
    private static let day: Int64 = 86_400_000

    private static func isMemorized(_ status: MemorizationStatus) -> Bool {
        status == .mastered || status == .memorizedWithErrors
    }

    /// Records one review. The stored strength becomes the result, the counters and the next due date
    /// follow the policy's interval ladder, and the memorization status never changes.
    public static func apply(_ result: ReviewResult, to record: AyahMemorizationRecord, now rawNow: Date,
                             policy: MemorizationPolicy = .standard) -> AyahMemorizationRecord {
        let now = rawNow.normalizedToMilliseconds
        var updated = record
        updated.reviewCount += 1
        updated.lastReviewedAt = now
        updated.updatedAt = now

        let intervalDays: Int
        switch result {
        case .excellent, .good:
            updated.successfulReviewCount += 1
            updated.consecutiveSuccessfulReviews += 1
            let ladder = policy.intervalLadderDays
            intervalDays = ladder.isEmpty ? 1 : ladder[min(updated.consecutiveSuccessfulReviews, ladder.count) - 1]
            updated.reviewStrength = result == .excellent ? .strong : .good
        case .mistakes:
            updated.consecutiveSuccessfulReviews = 0
            updated.errorCount += 1
            intervalDays = policy.mistakesIntervalDays
            updated.reviewStrength = .needsReview
        case .forgot:
            updated.consecutiveSuccessfulReviews = 0
            updated.errorCount += 1
            intervalDays = policy.forgotIntervalDays
            updated.reviewStrength = .weak
        }
        updated.nextReviewAt = Date(epochMilliseconds: now.epochMilliseconds + Int64(intervalDays) * day)
        return updated
    }

    /// The strength to show: a memorized ayah that is past its due date is at most "needs review", and
    /// well past it (more than twice its last interval) "weak", even though its status stays the same.
    public static func displayedStrength(of record: AyahMemorizationRecord, now: Date) -> ReviewStrength {
        guard isMemorized(record.status) else { return record.reviewStrength }
        guard let lastReviewed = record.lastReviewedAt else { return .notReviewed }
        guard let due = record.nextReviewAt, now > due else { return record.reviewStrength }
        let interval = max(due.timeIntervalSince(lastReviewed), 86_400)
        if now.timeIntervalSince(due) > 2 * interval { return .weak }
        return record.reviewStrength.rawValue < ReviewStrength.needsReview.rawValue ? .needsReview : record.reviewStrength
    }

    /// A memorized ayah is due when it has never been scheduled or its next review date has come.
    public static func isDue(_ record: AyahMemorizationRecord, now: Date) -> Bool {
        guard isMemorized(record.status) else { return false }
        guard let due = record.nextReviewAt else { return true }
        return due <= now
    }
}
