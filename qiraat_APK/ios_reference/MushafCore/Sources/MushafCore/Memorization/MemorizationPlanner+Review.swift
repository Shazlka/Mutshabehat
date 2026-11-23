import Foundation

extension MemorizationPlanner {
    /// Plans a review result for every selected ayah that is at least started. Ayat with no record or
    /// that are not memorized at all are left out of `changes` (they show up in `unchangedCount`).
    public static func planReview(selection: MemorizationSelection, label: String, result: ReviewResult,
                                  records: [AyahKey: AyahMemorizationRecord], index: QuranIndex, now: Date,
                                  policy: MemorizationPolicy = .standard) -> BatchPlan {
        let keys = selection.resolve(in: index)
        var changes: [AyahChange] = []
        for key in keys {
            guard let current = records[key], current.status != .notMemorized else { continue }
            changes.append(AyahChange(key: key, before: current,
                                      after: ReviewEngine.apply(result, to: current, now: now, policy: policy)))
        }
        return BatchPlan(kind: .review, label: label, scopeJSON: selection.scopeJSON, selectionCount: keys.count,
                         changes: changes, countsForStreak: !changes.isEmpty, gainAyahs: 0)
    }
}
