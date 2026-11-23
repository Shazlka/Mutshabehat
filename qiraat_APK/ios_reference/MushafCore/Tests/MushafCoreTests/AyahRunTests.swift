import Foundation
import Testing
@testable import MushafCore

@Suite struct AyahRunTests {
    @Test func runsSplitOnStatusChanges() throws {
        let index = try QuranIndex.load(from: openDatabase())
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        let now = Date(timeIntervalSince1970: 0)

        for a in 1...20 {
            let key = AyahKey(surah: 2, ayah: a)
            var record = AyahMemorizationRecord.blank(key, now: now)
            record.status = .mastered
            records[key] = record
        }
        for a in 21...35 {
            let key = AyahKey(surah: 2, ayah: a)
            var record = AyahMemorizationRecord.blank(key, now: now)
            record.status = .memorizedWithErrors
            records[key] = record
        }
        for a in 36...50 {
            let key = AyahKey(surah: 2, ayah: a)
            var record = AyahMemorizationRecord.blank(key, now: now)
            record.status = .needsMushaf
            records[key] = record
        }

        let runs = MemorizationStatisticsService.runs(forSurah: 2, records: records, index: index)
        #expect(runs == [
            AyahRun(status: .mastered, from: 1, to: 20),
            AyahRun(status: .memorizedWithErrors, from: 21, to: 35),
            AyahRun(status: .needsMushaf, from: 36, to: 50),
            AyahRun(status: .notMemorized, from: 51, to: 286)
        ])
    }

    @Test func runsOfEmptySurahIsOneNotMemorizedRun() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let runs = MemorizationStatisticsService.runs(forSurah: 1, records: [:], index: index)
        #expect(runs == [
            AyahRun(status: .notMemorized, from: 1, to: 7)
        ])
    }

    @Test func runsCoverEveryAyahOnce() throws {
        let index = try QuranIndex.load(from: openDatabase())
        for surah in 1...114 {
            let total = index.ayahCount(surah: surah)
            let runs = MemorizationStatisticsService.runs(forSurah: surah, records: [:], index: index)
            let totalCovered = runs.reduce(0) { $0 + ($1.to - $1.from + 1) }
            #expect(totalCovered == total)
            #expect(runs.first?.from == 1)
            #expect(runs.last?.to == total)
        }
    }

    @Test func unknownSurahHasNoRuns() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(MemorizationStatisticsService.runs(forSurah: 0, records: [:], index: index) == [])
        #expect(MemorizationStatisticsService.runs(forSurah: 115, records: [:], index: index) == [])
        #expect(MemorizationStatisticsService.runs(forSurah: -1, records: [:], index: index) == [])
    }
}
