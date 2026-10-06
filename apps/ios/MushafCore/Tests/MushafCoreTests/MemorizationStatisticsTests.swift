import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationStatisticsTests {
    private func records(_ keys: [AyahKey], _ status: MemorizationStatus) -> [AyahKey: AyahMemorizationRecord] {
        Dictionary(uniqueKeysWithValues: keys.map { key in
            var record = AyahMemorizationRecord.blank(key, now: Date(timeIntervalSince1970: 0))
            record.status = status
            return (key, record)
        })
    }

    // MARK: - Counts, surahs and juz

    @Test func emptyRecordsGiveZeroEverywhere() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let result = MemorizationStatisticsService.snapshot(records: [:], index: index)
        #expect(result.totalAyahs == 6236)
        #expect(result.strictPercent == 0 && result.learningPercent == 0)
        #expect(!result.strictPercent.isNaN && !result.learningPercent.isNaN)
        #expect(result.counts[.notMemorized] == 6236)
        #expect(result.counts.count == 4)
        #expect(result.surahs.count == 114)
        #expect(result.surahs.allSatisfy { $0.state == .none })
        #expect(result.completedJuz == 0)
        #expect(result.canReciteCount == 0 && result.completedSurahs == 0 && result.partialSurahs == 0)
        #expect(result.completeIncludingErrorsSurahs == 0)
        #expect(result.pagesFullyMastered == 0 && result.pageEquivalentMastered == 0)
    }

    @Test func fatihaMasteredIsOneCompleteSurah() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let result = MemorizationStatisticsService.snapshot(records: records(index.ayat(ofSurah: 1), .mastered), index: index)
        #expect(result.completedSurahs == 1)
        #expect(result.surahs.first?.strictPercent == 100)
        #expect(result.counts[.mastered] == 7)
        #expect(abs(result.strictPercent - 7.0 / 6236 * 100) < 1e-9)
    }

    @Test func oneErrorBreaksCompleteButNotIncludingErrors() throws {
        let index = try QuranIndex.load(from: openDatabase())
        var input = records(index.ayat(ofSurah: 1), .mastered)
        input[AyahKey(surah: 1, ayah: 7)]?.status = .memorizedWithErrors
        let result = MemorizationStatisticsService.snapshot(records: input, index: index)
        let surah = try #require(result.surahs.first)
        #expect(surah.state == .partial && surah.isCompleteIncludingErrors)
        #expect(result.completedSurahs == 0 && result.completeIncludingErrorsSurahs == 1)
        #expect(result.partialSurahs == 1)
        #expect(abs(surah.strictPercent - 6.0 / 7 * 100) < 1e-9)
        #expect(abs(surah.learningPercent - 6.75 / 7 * 100) < 1e-9)
    }

    @Test func weightedPercentUsesPolicy() throws {
        let index = try QuranIndex.load(from: openDatabase())
        var input = records(index.ayat(ofSurah: 1), .notMemorized)
        input[AyahKey(surah: 1, ayah: 1)]?.status = .mastered
        input[AyahKey(surah: 1, ayah: 2)]?.status = .memorizedWithErrors
        input[AyahKey(surah: 1, ayah: 3)]?.status = .needsMushaf
        let standard = MemorizationStatisticsService.snapshot(records: input, index: index)
        #expect(abs(try #require(standard.surahs.first).learningPercent - 2.15 / 7 * 100) < 1e-9)
        let policy = MemorizationPolicy(statusWeights: [.mastered: 1, .memorizedWithErrors: 0.5, .needsMushaf: 0.1, .notMemorized: 0], intervalLadderDays: [1], forgotIntervalDays: 1, mistakesIntervalDays: 2, confirmationAyahThreshold: 30, milestonePercents: [25])
        let custom = MemorizationStatisticsService.snapshot(records: input, index: index, policy: policy)
        #expect(abs(try #require(custom.surahs.first).learningPercent - 1.6 / 7 * 100) < 1e-9)
        #expect(abs(custom.learningPercent - 1.6 / 6236 * 100) < 1e-9)
    }

    @Test func canReciteCountsMasteredAndErrors() throws {
        let index = try QuranIndex.load(from: openDatabase())
        var input = records(index.ayat(ofSurah: 1), .needsMushaf)
        input[AyahKey(surah: 1, ayah: 1)]?.status = .mastered
        input[AyahKey(surah: 1, ayah: 2)]?.status = .memorizedWithErrors
        #expect(MemorizationStatisticsService.snapshot(records: input, index: index).canReciteCount == 2)
    }

    @Test func wholeJuzThirtyIsComplete() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let result = MemorizationStatisticsService.snapshot(records: records(index.ayat(ofJuz: 30), .mastered), index: index)
        #expect(result.completedJuz == 1)
        let juz = try #require(result.juz.first { $0.juz == 30 })
        #expect(juz.isComplete && juz.strictPercent == 100 && juz.learningPercent == 100)
        #expect(result.juz.map(\.juz) == Array(1...30))
    }

    // MARK: - Page progress

    @Test func weakestLinkStates() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let keys = index.ayat(onPage: 50)
        var input = records(keys, .mastered)
        #expect(MemorizationStatisticsService.pageProgress(page: 50, records: input, index: index).state == .mastered)
        for (offset, status) in [MemorizationStatus.memorizedWithErrors, .needsMushaf, .notMemorized].enumerated() {
            input[keys[offset]]?.status = status
            #expect(MemorizationStatisticsService.pageProgress(page: 50, records: input, index: index).state == status)
        }
        #expect(MemorizationStatisticsService.pageProgress(page: 50, records: [:], index: index).state == .notMemorized)
    }

    @Test func mixFractionsSumToOneAndMatchWeights() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let keys = index.ayat(onPage: 50)
        let mastered = Array(keys.prefix(keys.count / 2))
        let mix = MemorizationStatisticsService.pageProgress(page: 50, records: records(mastered, .mastered), index: index).mix
        #expect(mix.counts.count == 4 && mix.fractions.count == 4)
        #expect(mix.ayahCount == keys.count && mix.masteredAyahs == mastered.count)
        #expect(mix.counts[.notMemorized] == keys.count - mastered.count)
        #expect(abs(mix.fractions.values.reduce(0, +) - 1) < 1e-9)
        #expect(abs(try #require(mix.fractions[.mastered]) - mastered.reduce(0) { $0 + index.weight(of: $1) }) < 1e-9)
    }

    @Test func pagesFullyMasteredAgreesWithStates() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let keys = index.ayahKeys.enumerated().filter { $0.offset.isMultiple(of: 3) }.map(\.element)
        var input = records(keys, .mastered)
        input.merge(records(index.ayat(inPages: 1...10), .mastered)) { _, new in new }
        let result = MemorizationStatisticsService.snapshot(records: input, index: index)
        #expect(result.pagesFullyMastered == result.pages.filter { $0.state == .mastered }.count)
        #expect(result.pages.count == 604)
        #expect(result.pages.map(\.page) == Array(1...604))
        for page in result.pages {
            #expect(page == MemorizationStatisticsService.pageProgress(page: page.page, records: input, index: index))
        }
    }

    @Test func pageEquivalentOfWholeQuranIs604() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let result = MemorizationStatisticsService.snapshot(records: records(index.ayahKeys, .mastered), index: index)
        #expect(abs(result.pageEquivalentMastered - 604) < 1e-6)
        #expect(result.pagesFullyMastered == 604)
        #expect(result.completedSurahs == 114 && result.completedJuz == 30)
    }

    @Test func pageWithTwoSurahsCountsBoth() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let partial = MemorizationStatisticsService.pageProgress(page: 604, records: records(index.ayat(ofSurah: 112), .mastered), index: index)
        #expect(partial.state == .notMemorized && partial.mix.masteredAyahs == 4)
        let complete = MemorizationStatisticsService.pageProgress(page: 604, records: records(index.ayat(onPage: 604), .mastered), index: index)
        #expect(complete.state == .mastered)
    }

    @Test func emptyIndexAndUnknownPageHaveZeroProgress() {
        let index = QuranIndex(rows: [], pageJuz: [:])
        let result = MemorizationStatisticsService.snapshot(records: [:], index: index)
        #expect(result.totalAyahs == 0 && result.strictPercent == 0 && result.learningPercent == 0)
        #expect(result.counts.values.allSatisfy { $0 == 0 } && result.counts.count == 4)
        #expect(result.surahs.isEmpty && result.juz.isEmpty && result.pages.isEmpty)
        let page = MemorizationStatisticsService.pageProgress(page: 99, records: [:], index: index)
        #expect(page.state == .notMemorized && page.mix.ayahCount == 0)
        #expect(page.mix.fractions.count == 4 && page.mix.fractions.values.allSatisfy { $0 == 0 })
    }

    @Test func syntheticIndexKeepsSortedGroupsAndEmptyMetadata() throws {
        let first = AyahKey(surah: 9, ayah: 1)
        let second = AyahKey(surah: 2, ayah: 1)
        let index = QuranIndex(rows: [
            AyahLayoutRow(key: first, page: 80, wordCount: 0),
            AyahLayoutRow(key: second, page: 10, wordCount: 2)
        ], pageJuz: [80: 7, 10: 2, 90: 8])
        let input = records([first, second, AyahKey(surah: 114, ayah: 6)], .mastered)
        let result = MemorizationStatisticsService.snapshot(records: input, index: index)
        #expect(result.totalAyahs == 2 && result.counts[.mastered] == 2)
        #expect(result.surahs.map(\.surah) == [2, 9])
        #expect(result.juz.map(\.juz) == [2, 7, 8])
        #expect(result.pages.map(\.page) == [10, 80, 90])
        #expect(result.pageEquivalentMastered == 1 && result.pagesFullyMastered == 2)
        let emptyJuz = try #require(result.juz.last)
        #expect(!emptyJuz.isComplete && emptyJuz.strictPercent == 0 && emptyJuz.learningPercent == 0)
        let emptyPage = try #require(result.pages.last)
        #expect(emptyPage.state == .notMemorized && emptyPage.mix.ayahCount == 0)
        #expect(emptyPage == MemorizationStatisticsService.pageProgress(page: 90, records: input, index: index))
        for surah in result.surahs { #expect(surah.counts.count == 4) }
        for juz in result.juz { #expect(juz.counts.count == 4) }
    }
}
