import Foundation
import MushafCore
import os

/// Brings every page of the Qiraat layer up to date with the web app's database right after the app opens.
///
/// The bundled snapshot is only as new as the build, while the web database keeps gaining faces and
/// rulings (page 120 had half of its rulings in the snapshot). Without this, a page only got its live data
/// when it was on screen, one 1–4 s request at a time, so colours and variants filled in page by page as
/// the reader swiped. The versions index is fetched once, then only changed pages are fetched nearest-first
/// around the page being read; each changed page is installed beside the snapshot and redrawn
/// (`QiraatLiveSync.refresh`).
@MainActor
final class QiraatBulkSync {
    struct Summary: Equatable {
        var updated = 0
        var unchanged = 0
        var failed = 0
        /// Stopped early because the network looks unavailable (several failures in a row).
        var gaveUp = false
        /// The versions index was unavailable, so this pass used the all-page compatibility path.
        var usedFallback = false
    }

    private struct PageVersion: Codable, Equatable {
        var version: String?
        var etag: String?
    }

    private struct VersionFile: Codable {
        var pages: [String: PageVersion] = [:]

        subscript(page: Int) -> PageVersion? {
            get { pages[String(page)] }
            set { pages[String(page)] = newValue }
        }
    }

    static let shared = QiraatBulkSync()
    nonisolated static let lastCompletedKey = "qiraat:bulk-sync-completed:v1"
    nonisolated static let lastUsedFallbackKey = "qiraat:bulk-sync-used-fallback:v1"
    /// A pass that finished less than this long ago is not repeated on the next open or foreground.
    nonisolated static let repeatAfter: TimeInterval = 10 * 60
    /// When `/versions` is unavailable, avoid returning to the old ~600-request crawl every ten minutes.
    nonisolated static let fallbackRepeatAfter: TimeInterval = 6 * 60 * 60
    nonisolated static let concurrency = 4
    nonisolated static let giveUpAfterConsecutiveFailures = 6

    private static let log = Logger(subsystem: "com.shazlka.qiraat", category: "live-sync")

    private var task: Task<Void, Never>?
    private let defaults: UserDefaults
    private let versionsURL: URL

    init(defaults: UserDefaults = .standard,
         versionsURL: URL = QiraatLiveSync.overlayDirectory.appendingPathComponent("qiraat-versions.json")) {
        self.defaults = defaults
        self.versionsURL = versionsURL
    }

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
           Date().timeIntervalSince(last) < (defaults.bool(forKey: Self.lastUsedFallbackKey)
                                             ? Self.fallbackRepeatAfter : Self.repeatAfter) { return }
        task = Task { [weak self] in
            let summary = await self?.run(around: page, store: store, sync: sync)
            guard let self else { return }
            if let summary, summary.usedFallback || !summary.gaveUp {
                // A page the server keeps refusing does not make the pass worthless: every other page was reached, and
                // crawling all ~600 again on each open would not change that one. Failed pages are retried after
                // `repeatAfter`. A failed versions-index pass is also throttled even when offline, because retrying
                // the 604-page fallback on every foreground would recreate the request storm this index replaces.
                defaults.set(Date(), forKey: Self.lastCompletedKey)
                defaults.set(summary.usedFallback, forKey: Self.lastUsedFallbackKey)
                if summary.failed > 0 {
                    Self.log.error("bulk sync finished with \(summary.failed) failed page(s)")
                }
            }
            task = nil
        }
    }

    /// One pass. The versions index normally reduces this to changed pages; if that index is unavailable,
    /// the compatibility path checks every page. Failed pages are tried once more at the end.
    func run(around page: Int, store: QiraatStore, sync: QiraatLiveSync,
             concurrency: Int = QiraatBulkSync.concurrency, total: Int = mushafPageCount) async -> Summary {
        var summary = Summary()
        var failedPages: [Int] = []
        var consecutiveFailures = 0
        var saved = Self.loadVersions(from: versionsURL)
        let manifest: [Int: String]?
        do {
            manifest = try await sync.fetchVersions(total: total)
        } catch {
            manifest = nil
            summary.usedFallback = true
            Self.log.error("qiraat versions unavailable; using slow fallback: \(String(describing: error), privacy: .public)")
        }
        let pages = Self.order(around: page, total: total).filter { candidate in
            guard let manifest else { return true }
            return saved[candidate]?.version != manifest[candidate]
        }

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
            await withTaskGroup(of: (Int, QiraatLiveSync.PageRefreshResult).self) { group in
                func addNext() -> Bool {
                    guard !summary.gaveUp, let next = iterator.next() else { return false }
                    let previous = saved[next]
                    group.addTask {
                        let result = await sync.refreshPage(
                            page: next, store: store, force: true, announceProgress: false,
                            ifNoneMatch: previous?.etag ?? previous?.version)
                        return (next, result)
                    }
                    return true
                }
                for _ in 0..<max(1, concurrency) where addNext() {}
                for await (finished, result) in group {
                    absorb(result.outcome, page: finished, retrying: retrying)
                    if result.outcome == .updated || result.outcome == .unchanged {
                        let old = saved[finished]
                        saved[finished] = PageVersion(
                            version: manifest?[finished] ?? old?.version,
                            etag: result.etag ?? old?.etag ?? manifest?[finished])
                    }
                    if consecutiveFailures >= Self.giveUpAfterConsecutiveFailures {
                        summary.gaveUp = true
                        group.cancelAll()
                    }
                    _ = addNext()
                }
            }
        }

        await sweep(pages, retrying: false)
        if !summary.gaveUp, !failedPages.isEmpty {
            consecutiveFailures = 0
            await sweep(failedPages, retrying: true)
        }
        if summary.gaveUp { summary.failed += failedPages.count }
        do {
            try Self.saveVersions(saved, to: versionsURL)
        } catch {
            Self.log.error("could not save qiraat versions: \(String(describing: error), privacy: .public)")
        }
        return summary
    }

    private nonisolated static func loadVersions(from url: URL) -> VersionFile {
        guard let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(VersionFile.self, from: data) else { return VersionFile() }
        return file
    }

    private nonisolated static func saveVersions(_ file: VersionFile, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(file).write(to: url, options: .atomic)
    }
}
