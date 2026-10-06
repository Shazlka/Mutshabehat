import Foundation

/// Something worth celebrating once: a finished surah or juz, or a strict-percentage threshold.
public enum Milestone: Hashable, Sendable {
    case surahCompleted(Int)
    case juzCompleted(Int)
    case percent(Int)
    case quranCompleted
}

extension MemorizationPlanner {
    /// What the change from `before` to `after` crossed: surahs and juz that became fully mastered,
    /// the policy's strict-percentage thresholds below 100, and `.quranCompleted` at 100. Ordered
    /// surahs, juz, percents, then the completion. Nothing fires for a downgrade or when nothing changed.
    public static func milestones(before: MemorizationSnapshot, after: MemorizationSnapshot,
                                  policy: MemorizationPolicy = .standard) -> [Milestone] {
        var result: [Milestone] = []

        let surahsBefore = Dictionary(uniqueKeysWithValues: before.surahs.map { ($0.surah, $0.state) })
        for surah in after.surahs where surah.state == .complete && surahsBefore[surah.surah] != .complete {
            result.append(.surahCompleted(surah.surah))
        }

        let juzBefore = Dictionary(uniqueKeysWithValues: before.juz.map { ($0.juz, $0.isComplete) })
        for juz in after.juz where juz.isComplete && juzBefore[juz.juz] != true {
            result.append(.juzCompleted(juz.juz))
        }

        let epsilon = 1e-9
        for percent in policy.milestonePercents.sorted() where percent < 100 {
            let threshold = Double(percent)
            if before.strictPercent < threshold - epsilon, after.strictPercent >= threshold - epsilon {
                result.append(.percent(percent))
            }
        }

        let beforeComplete = before.totalAyahs > 0 && before.counts[.mastered] == before.totalAyahs
        let afterComplete = after.totalAyahs > 0 && after.counts[.mastered] == after.totalAyahs
        if afterComplete, !beforeComplete { result.append(.quranCompleted) }
        return result
    }
}
