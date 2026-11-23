import Foundation
import Testing
@testable import MushafCore

/// Statistics are a pure function of the ayah records and the Hafs index: no Qiraat input exists to differ.
@Suite struct MemorizationIndependenceTests {
    @Test func statisticsDependOnlyOnRecordsAndTheHafsIndex() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let again = try QuranIndex.load(from: openDatabase())
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        for key in index.ayahKeys.prefix(500) {
            var record = AyahMemorizationRecord.blank(key, now: Date(epochMilliseconds: 1_800_000_000_000))
            record.status = .mastered
            records[key] = record
        }
        #expect(MemorizationStatisticsService.snapshot(records: records, index: index)
                == MemorizationStatisticsService.snapshot(records: records, index: again))
    }
}

// Timing is meaningless in a debug build. Run with `make perf` (swift test -c release).
#if !DEBUG
@Suite struct MemorizationPerformanceTests {
    private let now = Date(epochMilliseconds: 1_800_000_000_000)

    private func randomRecords(_ index: QuranIndex, count: Int) -> [AyahKey: AyahMemorizationRecord] {
        var generator = SystemRandomNumberGenerator()
        let keys = Array(index.ayahKeys)
        var records: [AyahKey: AyahMemorizationRecord] = [:]
        let statuses: [MemorizationStatus] = [.mastered, .memorizedWithErrors, .needsMushaf]
        while records.count < count {
            let key = keys[Int.random(in: 0..<keys.count, using: &generator)]
            var record = AyahMemorizationRecord.blank(key, now: now)
            record.status = statuses[Int.random(in: 0..<statuses.count, using: &generator)]
            records[key] = record
        }
        return records
    }

    private func milliseconds(_ body: () -> Void) -> Double {
        var best = Double.infinity
        for _ in 1...3 {
            let start = ContinuousClock.now
            body()
            best = min(best, Double((ContinuousClock.now - start).components.attoseconds) / 1e15)
        }
        return best
    }

    @Test func snapshotBudget() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let records = randomRecords(index, count: 3_000)
        let time = milliseconds { _ = MemorizationStatisticsService.snapshot(records: records, index: index) }
        print("memorization snapshot (3,000 records): \(String(format: "%.2f", time)) ms")
        #expect(time <= 20)
    }

    @Test func pageProgressBudget() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let records = randomRecords(index, count: 3_000)
        let time = milliseconds {
            for page in 1...604 { _ = MemorizationStatisticsService.pageProgress(page: page, records: records, index: index) }
        }
        print("memorization page progress (604 pages): \(String(format: "%.2f", time)) ms")
        #expect(time <= 10)
    }

    @Test func wholeQuranPlanBudget() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let records = randomRecords(index, count: 3_000)
        var plan: BatchPlan?
        let time = milliseconds {
            plan = MemorizationPlanner.planUpdate(selection: .pageRange(1...604), label: "all", status: .mastered,
                                                  learning: nil, records: records, index: index, now: now)
        }
        print("memorization whole-Quran plan: \(String(format: "%.2f", time)) ms (\(plan?.changes.count ?? 0) changes)")
        #expect((plan?.changes.count ?? 0) > 4_000)   // the already-mastered ayat are no-ops
        #expect(time <= 300)
    }
}
#endif
