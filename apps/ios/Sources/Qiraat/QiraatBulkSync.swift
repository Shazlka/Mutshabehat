import Foundation
import MushafCore

/// Brings every page of the Qiraat layer up to date with the web app's database right after the app opens.
///
/// The bundled snapshot is only as new as the build, while the web database keeps gaining faces and
/// rulings (page 120 had half of its rulings in the snapshot). Without this, a page only got its live data
/// when it was on screen, one 1–4 s request at a time, so colours and variants filled in page by page as
/// the reader swiped. Here the pages are fetched nearest-first around the page being read, a few at a
/// time; each page that changed is installed beside the snapshot and redrawn (`QiraatLiveSync.refresh`).
/// A full pass is about 600 small gzip responses (~6 KB each).
@MainActor
final class QiraatBulkSync {
    struct Summary: Equatable {
        var updated = 0
        var unchanged = 0
        var failed = 0
        /// Stopped early because the network looks unavailable (several failures in a row).
        var gaveUp = false
    }

    static let shared = QiraatBulkSync()
    nonisolated static let lastCompletedKey = "qiraat:bulk-sync-completed:v1"
    /// A pass that finished less than this long ago is not repeated on the next open or foreground.
    nonisolated static let repeatAfter: TimeInterval = 10 * 60
    nonisolated static let concurrency = 4
    nonisolated static let giveUpAfterConsecutiveFailures = 6

    private var task: Task<Void, Never>?
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    var isRunning: Bool { task != nil }

    /// Every page number once, the page being read first, then alternating outwards (p, p+1, p−1, p+2, …).
    nonisolated static func order(around page: Int, total: Int = mushafPageCount) -> [Int] {
        let start = min(max(page, 1), total)
        var result = [start]
        var offset = 1
        while result.count < total {
            if start + offset <= total { result.append(start + offset) }
            if start - offset >= 1 { result.append(start - offset) }
            offset += 1
        }
        return result
    }

    /// Starts a pass unless one is running or one finished recently. Never blocks the caller.
    func start(around page: Int, store: QiraatStore?, sync: QiraatLiveSync = .shared) {
        guard task == nil, let store else { return }
        if let last = defaults.object(forKey: Self.lastCompletedKey) as? Date,
           Date().timeIntervalSince(last) < Self.repeatAfter { return }
        task = Task { [weak self] in
            let summary = await self?.run(around: page, store: store, sync: sync)
            guard let self else { return }
            if let summary, !summary.gaveUp, summary.failed == 0 {
                defaults.set(Date(), forKey: Self.lastCompletedKey)
            }
            task = nil
        }
    }

    /// One full pass. Failed pages are tried once more at the end; a run of failures in a row means the
    /// network is unavailable, so it stops instead of waiting out 600 timeouts.
    func run(around page: Int, store: QiraatStore, sync: QiraatLiveSync,
             concurrency: Int = QiraatBulkSync.concurrency) async -> Summary {
        var summary = Summary()
        var failedPages: [Int] = []
        var consecutiveFailures = 0

        func absorb(_ outcome: QiraatLiveSync.Outcome, page: Int, retrying: Bool) {
            switch outcome {
            case .updated: summary.updated += 1; consecutiveFailures = 0
            case .unchanged: summary.unchanged += 1; consecutiveFailures = 0
            case .skipped: consecutiveFailures = 0   // another fetch of that page is already in flight
            case .failed:
                consecutiveFailures += 1
                if retrying { summary.failed += 1 } else { failedPages.append(page) }
            }
        }

        func sweep(_ pages: [Int], retrying: Bool) async {
            var iterator = pages.makeIterator()
            await withTaskGroup(of: (Int, QiraatLiveSync.Outcome).self) { group in
                func addNext() -> Bool {
                    guard !summary.gaveUp, let next = iterator.next() else { return false }
                    group.addTask { (next, await sync.refresh(page: next, store: store, force: true, announceProgress: false)) }
                    return true
                }
                for _ in 0..<max(1, concurrency) where addNext() {}
                for await (finished, outcome) in group {
                    absorb(outcome, page: finished, retrying: retrying)
                    if consecutiveFailures >= Self.giveUpAfterConsecutiveFailures {
                        summary.gaveUp = true
                        group.cancelAll()
                    }
                    _ = addNext()
                }
            }
        }

        await sweep(Self.order(around: page), retrying: false)
        if !summary.gaveUp, !failedPages.isEmpty {
            consecutiveFailures = 0
            await sweep(failedPages, retrying: true)
        }
        if summary.gaveUp { summary.failed += failedPages.count }
        return summary
    }
}
