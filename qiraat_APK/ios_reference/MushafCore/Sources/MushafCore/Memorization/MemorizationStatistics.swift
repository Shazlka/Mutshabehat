// MARK: - Part A: Counts, surahs and juz

public enum SurahState: Equatable, Sendable {
    case complete, partial, none
}

public struct SurahProgress: Equatable, Sendable {
    public let surah: Int
    public let ayahCount: Int
    public let counts: [MemorizationStatus: Int]
    public let strictPercent: Double
    public let learningPercent: Double
    public let state: SurahState
    public let isCompleteIncludingErrors: Bool

    public init(surah: Int, ayahCount: Int, counts: [MemorizationStatus: Int], strictPercent: Double,
                learningPercent: Double, state: SurahState, isCompleteIncludingErrors: Bool) {
        self.surah = surah
        self.ayahCount = ayahCount
        self.counts = counts
        self.strictPercent = strictPercent
        self.learningPercent = learningPercent
        self.state = state
        self.isCompleteIncludingErrors = isCompleteIncludingErrors
    }
}

public struct JuzProgress: Equatable, Sendable {
    public let juz: Int
    public let counts: [MemorizationStatus: Int]
    public let strictPercent: Double
    public let learningPercent: Double
    public let isComplete: Bool
}

public struct MemorizationSnapshot: Equatable, Sendable {
    public let totalAyahs: Int
    public let counts: [MemorizationStatus: Int]
    public let strictPercent: Double
    public let learningPercent: Double
    public let canReciteCount: Int
    public let surahs: [SurahProgress]
    public let juz: [JuzProgress]
    public let completedSurahs: Int
    public let partialSurahs: Int
    public let completeIncludingErrorsSurahs: Int
    public let completedJuz: Int
    public let pages: [MemorizationPageProgress]
    public let pagesFullyMastered: Int
    public let pageEquivalentMastered: Double
}

public enum MemorizationStatisticsService {
    public static func snapshot(
        records: [AyahKey: AyahMemorizationRecord], index: QuranIndex,
        policy: MemorizationPolicy = .standard
    ) -> MemorizationSnapshot {
        var total = StatusTotals()
        var surahTotals: [Int: StatusTotals] = [:]
        var juzTotals: [Int: StatusTotals] = [:]
        var pageTotals: [Int: PageTotals] = [:]
        var pageEquivalentMastered = 0.0

        for key in index.ayahKeys {
            let status = records[key]?.status ?? .notMemorized
            let learningWeight = policy.weight(status)
            total.add(status, learningWeight: learningWeight)
            surahTotals[key.surah, default: StatusTotals()].add(status, learningWeight: learningWeight)
            if let page = index.page(of: key) {
                let wordShare = index.weight(of: key)
                pageTotals[page, default: PageTotals()].add(status, wordShare: wordShare)
                if status == .mastered { pageEquivalentMastered += wordShare }
                if let juz = index.juz(ofPage: page) {
                    juzTotals[juz, default: StatusTotals()].add(status, learningWeight: learningWeight)
                }
            }
        }

        let surahs = index.surahNumbers.map { surah in
            let value = surahTotals[surah, default: StatusTotals()]
            let state: SurahState = value.isComplete ? .complete
                : (value.counts[.notMemorized] == value.ayahCount ? .none : .partial)
            return SurahProgress(
                surah: surah, ayahCount: value.ayahCount, counts: value.counts,
                strictPercent: value.strictPercent, learningPercent: value.learningPercent,
                state: state, isCompleteIncludingErrors: value.ayahCount > 0 && value.canReciteCount == value.ayahCount
            )
        }
        let juz = index.juzNumbers.map { juz in
            let value = juzTotals[juz, default: StatusTotals()]
            return JuzProgress(juz: juz, counts: value.counts, strictPercent: value.strictPercent,
                               learningPercent: value.learningPercent, isComplete: value.isComplete)
        }
        let pages = index.pageNumbers.map { page in
            pageTotals[page, default: PageTotals()].progress(page: page)
        }
        return MemorizationSnapshot(
            totalAyahs: total.ayahCount, counts: total.counts,
            strictPercent: total.strictPercent, learningPercent: total.learningPercent,
            canReciteCount: total.canReciteCount, surahs: surahs, juz: juz,
            completedSurahs: surahs.filter { $0.state == .complete }.count,
            partialSurahs: surahs.filter { $0.state == .partial }.count,
            completeIncludingErrorsSurahs: surahs.filter(\.isCompleteIncludingErrors).count,
            completedJuz: juz.filter(\.isComplete).count, pages: pages,
            pagesFullyMastered: pages.filter { $0.state == .mastered }.count,
            pageEquivalentMastered: pageEquivalentMastered
        )
    }
}

private struct StatusTotals {
    var counts = Dictionary(uniqueKeysWithValues: MemorizationStatus.allCases.map { ($0, 0) })
    var ayahCount = 0
    var learningWeight = 0.0

    var mastered: Int { counts[.mastered, default: 0] }
    var canReciteCount: Int { mastered + counts[.memorizedWithErrors, default: 0] }
    var isComplete: Bool { ayahCount > 0 && mastered == ayahCount }
    var strictPercent: Double { percent(Double(mastered)) }
    var learningPercent: Double { percent(learningWeight) }

    mutating func add(_ status: MemorizationStatus, learningWeight: Double) {
        counts[status, default: 0] += 1
        ayahCount += 1
        self.learningWeight += learningWeight
    }

    private func percent(_ value: Double) -> Double {
        guard ayahCount > 0 else { return 0 }
        return value / Double(ayahCount) * 100
    }
}

// MARK: - Part B: Page progress and word-share mix

public struct PageMix: Equatable, Sendable {
    public let counts: [MemorizationStatus: Int]
    public let fractions: [MemorizationStatus: Double]
    public let ayahCount: Int
    public let masteredAyahs: Int

    public init(counts: [MemorizationStatus: Int], fractions: [MemorizationStatus: Double], ayahCount: Int, masteredAyahs: Int) {
        self.counts = counts
        self.fractions = fractions
        self.ayahCount = ayahCount
        self.masteredAyahs = masteredAyahs
    }
}

/// One page's state (weakest link of its ayat) and the mix of ayah statuses behind it.
public struct MemorizationPageProgress: Equatable, Sendable {
    public let page: Int
    public let state: MemorizationStatus
    public let mix: PageMix

    public init(page: Int, state: MemorizationStatus, mix: PageMix) {
        self.page = page
        self.state = state
        self.mix = mix
    }
}

extension MemorizationStatisticsService {
    public static func pageProgress(
        page: Int, records: [AyahKey: AyahMemorizationRecord], index: QuranIndex
    ) -> MemorizationPageProgress {
        var total = PageTotals()
        for key in index.ayat(onPage: page) {
            total.add(records[key]?.status ?? .notMemorized, wordShare: index.weight(of: key))
        }
        return total.progress(page: page)
    }
}

private struct PageTotals {
    var counts = Dictionary(uniqueKeysWithValues: MemorizationStatus.allCases.map { ($0, 0) })
    var fractions = Dictionary(uniqueKeysWithValues: MemorizationStatus.allCases.map { ($0, 0.0) })
    var ayahCount = 0
    var weakest: MemorizationStatus = .mastered

    mutating func add(_ status: MemorizationStatus, wordShare: Double) {
        counts[status, default: 0] += 1
        fractions[status, default: 0] += wordShare
        ayahCount += 1
        if status.rawValue > weakest.rawValue { weakest = status }
    }

    func progress(page: Int) -> MemorizationPageProgress {
        MemorizationPageProgress(
            page: page, state: ayahCount == 0 ? .notMemorized : weakest,
            mix: PageMix(counts: counts, fractions: fractions, ayahCount: ayahCount,
                         masteredAyahs: counts[.mastered, default: 0])
        )
    }
}
