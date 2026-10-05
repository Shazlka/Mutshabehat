import Foundation

public enum WordStatus: Sendable, Hashable { case reviewed, unreviewed, flagged }

/// Which pages `nextPage` looks for.
public enum PageNeed: Sendable { case unreviewed, flagged }

/// Pure navigation helpers of the review screen (ports of `findNextReviewWord` step 1 and `findNextPageWith`).
public enum ReviewNavigation {
    /// The state of every word of the page that a live row covers: flagged wins over unreviewed over reviewed.
    public static func wordStatuses(in page: ReviewPage) -> [String: WordStatus] {
        var result: [String: WordStatus] = [:]
        func rank(_ s: WordStatus) -> Int { s == .flagged ? 3 : s == .unreviewed ? 2 : 1 }
        for row in page.rows where row.isActive {
            let status: WordStatus = row.reviewStatus == .flagged ? .flagged : row.reviewStatus == .unreviewed ? .unreviewed : .reviewed
            for word in page.words where row.startKey <= word.key && word.key <= row.endKey {
                if let existing = result[word.key], rank(existing) >= rank(status) { continue }
                result[word.key] = status
            }
        }
        return result
    }

    /// The next word (after `current`, wrapping inside the page) that a face waiting for review covers.
    public static func nextReviewKey(in page: ReviewPage, after current: String?) -> String? {
        let waiting = page.rows.filter { $0.isActive && $0.reviewStatus != .reviewed }
        let words = page.words.filter { word in waiting.contains { $0.startKey <= word.key && word.key <= $0.endKey } }
        guard let first = words.first else { return nil }
        guard let current else { return first.key }
        if let after = words.first(where: { $0.key > current }) { return after.key }
        return first.key != current ? first.key : nil
    }

    /// The next page (after `current`, wrapping around the Mushaf) with something left to do.
    public static func nextPage(in overview: ReviewOverview, after current: Int, needing need: PageNeed) -> Int? {
        let sorted = overview.pages.sorted { $0.page < $1.page }
        func count(_ p: PageProgress) -> Int { need == .flagged ? p.flagged : p.unreviewed }
        if let ahead = sorted.first(where: { $0.page > current && count($0) > 0 }) { return ahead.page }
        return sorted.first { count($0) > 0 }?.page
    }
}
