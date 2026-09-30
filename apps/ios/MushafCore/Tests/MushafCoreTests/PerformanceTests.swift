import CoreGraphics
import Foundation
import Testing
@testable import MushafCore

// Timing is meaningless in a debug build (~5x slower). Run with `make perf` (swift test -c release).
#if !DEBUG
@Suite struct PerformanceTests {
    /// A page turn must never wait on data: with the page's font already decoded (the reader
    /// pre-warms neighbours), loading + laying out a page stays far inside one 120 Hz frame (8.3 ms).
    /// Baseline on the MacBook Air, 2026-09-30: mean ~0.8 ms, p99 under 2 ms; cold woff2 decode 2.2 ms.
    /// Each page is timed three times and the fastest pass counts, so the test measures the code
    /// rather than the scheduler: single passes on a loaded laptop (a build running) pushed p99 to
    /// 7 ms. The single worst page is printed, not asserted.
    @Test func warmPageLoadAndLayoutWithinBudget() throws {
        let db = try openDatabase()
        let fonts = QCFFontStore(directory: generatedDirectory.appendingPathComponent("Fonts"), capacity: mushafPageCount)
        let counts = Dictionary(uniqueKeysWithValues: try db.surahs().map { ($0.number, $0.ayahCount) })
        let size = CGSize(width: 440, height: 440 / PageLayoutConstants.pageAspect * 1.18)
        for n in 1...mushafPageCount { _ = try fonts.font(page: n, size: 20) }

        var times: [Double] = []
        for n in 1...mushafPageCount {
            var best = Double.infinity
            for _ in 1...3 {
                let start = ContinuousClock.now
                let page = try db.page(n)
                _ = PageLayout(page: page, pageSize: size, surahAyahCounts: counts) { word, s in
                    (try? fonts.advance(of: word.glyph, page: n, size: s)) ?? 0
                }
                best = min(best, Double((ContinuousClock.now - start).components.attoseconds) / 1e15)
            }
            times.append(best)
        }
        times.sort()
        let mean = times.reduce(0, +) / Double(times.count)
        let p99 = times[Int(Double(times.count) * 0.99)]
        print("warm page load+layout: mean \(String(format: "%.2f", mean)) ms, p99 \(String(format: "%.2f", p99)) ms, worst \(String(format: "%.2f", times.last!)) ms")
        #expect(mean < 1.5)
        #expect(p99 < 4)
    }
}
#endif
