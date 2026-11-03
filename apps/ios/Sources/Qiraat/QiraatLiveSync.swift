import Combine
import Foundation
import MushafCore
import os

extension Notification.Name {
    /// A page's Qiraat data changed after a live fetch; `userInfo["page"]` is the page number.
    static let qiraatPageDidChange = Notification.Name("qiraatPageDidChange")
    /// Mutoon verses or symbols changed after a live fetch.
    static let mutoonDidChange = Notification.Name("mutoonDidChange")
}

/// Keeps the Qiraat layer in step with the web app's database, which is the only source of truth: a page
/// being read is fetched from the same endpoint the web reader uses, validated, kept beside the bundled
/// snapshot (`QiraatStore.applyLivePage`) and redrawn only when it actually changed. Offline, or on any
/// failure, the page keeps showing what it had. Nothing here ever writes to the web app.
@MainActor
final class QiraatLiveSync: ObservableObject {
    enum Outcome: Equatable { case updated, unchanged, skipped, failed }

    struct PageState: Equatable {
        let latestOutcome: Outcome?
        let lastConfirmation: Date?
    }

    nonisolated static let baseURL = AppEndpoints.webApp
    static let shared = QiraatLiveSync()
    /// The overlay lives in Application Support, next to the imported backup directory.
    static let overlayDirectory: URL = {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return root.appendingPathComponent("QiraatLive", isDirectory: true)
    }()

    private static let log = Logger(subsystem: "com.shazlka.qiraat", category: "live-sync")

    private let fetch: (URL) async throws -> Data
    private let minInterval: TimeInterval
    private var lastChecked: [Int: Date] = [:]
    private var inFlight: Set<Int> = []
    @Published private(set) var pageStates: [Int: PageState] = [:]
    @Published private(set) var liveMutoonLibrary: MatnLibrary?

    init(fetch: @escaping (URL) async throws -> Data = QiraatLiveSync.fetchFromWeb, minInterval: TimeInterval = 5) {
        self.fetch = fetch
        self.minInterval = minInterval
    }

    /// How soon a page on screen checks again: soon after it appears, then less often while nothing
    /// changes (doubling up to five minutes), and soon again once a change arrives. A page that sat
    /// still used to be fetched every 10 s: 360 requests an hour, 720 on an iPad spread.
    nonisolated static let firstPollInterval: TimeInterval = 10
    nonisolated static let maxPollInterval: TimeInterval = 300

    nonisolated static func nextPollInterval(after outcome: Outcome, current: TimeInterval) -> TimeInterval {
        outcome == .updated ? firstPollInterval : min(maxPollInterval, current * 2)
    }

    nonisolated static func liveURL(page: Int) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/mushaf-1441/qiraat"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "page", value: String(page))]
        return components.url!
    }

    func pageState(for page: Int) -> PageState {
        pageStates[page] ?? PageState(latestOutcome: nil, lastConfirmation: nil)
    }

    /// The site signs a visitor in with a cookie on the first request and redirects back; the shared
    /// session keeps the cookie and follows the redirect. The response is never cached.
    nonisolated static func fetchFromWeb(_ url: URL) async throws -> Data {
#if DEBUG
        // Simulator regression runs use the existing snapshot and cannot contact production.
        if ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" {
            throw URLError(.notConnectedToInternet)
        }
#endif
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Qiraat-iOS-Live", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return data
    }

    /// `announceProgress: false` is for the background pass over every page (`QiraatBulkSync`): it still installs
    /// and announces changed pages, but leaves `pageStates` alone so the open word card does not re-render
    /// for every one of the ~600 pages.
    @discardableResult
    func refresh(page: Int, store: QiraatStore?, force: Bool = false, announceProgress: Bool = true) async -> Outcome {
        func note(_ outcome: Outcome) -> Outcome { announceProgress ? record(outcome, for: page) : outcome }
        guard let store, !inFlight.contains(page) else { return note(.skipped) }
        if !force, let last = lastChecked[page], Date().timeIntervalSince(last) < minInterval {
            return note(.skipped)
        }
        inFlight.insert(page)
        defer { inFlight.remove(page) }
        lastChecked[page] = Date()
        do {
            let data = try await fetch(Self.liveURL(page: page))
            // The web review page is the only source of truth and is edited all the time: variants are changed, added and
            // deleted there. A page with fewer records is a deletion, so a shrink is never refused here. The install
            // reads and writes files, so it runs off the main actor.
            let changed = try await Task.detached(priority: .utility) {
                try store.applyLivePage(data, number: page, allowShrink: true)
            }.value
            guard changed else { return note(.unchanged) }
            let outcome = note(.updated)
            NotificationCenter.default.post(name: .qiraatPageDidChange, object: nil, userInfo: ["page": page])
            return outcome
        } catch {
            // Offline, a refused answer (`invalidPage`, `suspiciousShrink`) and a full disk all end as «failed»; the
            // reason is only in the log, so keep it there.
            Self.log.error("live page \(page) failed: \(String(describing: error), privacy: .public)")
            return note(.failed)
        }
    }

    @discardableResult
    private func record(_ outcome: Outcome, for page: Int, now: Date = Date()) -> Outcome {
        // A skipped check changes nothing the reader can see; recording it would re-render every observer
        // (the word sheet) each time a page flips faster than the minimum interval.
        if outcome == .skipped, pageStates[page] != nil { return outcome }
        let lastConfirmation: Date?
        switch outcome {
        case .updated, .unchanged:
            lastConfirmation = now
        case .skipped, .failed:
            lastConfirmation = pageStates[page]?.lastConfirmation
        }
        pageStates[page] = PageState(latestOutcome: outcome, lastConfirmation: lastConfirmation)
        return outcome
    }

    /// Brings the live copy of the متون up to date with the web database and returns the reloaded library when something
    /// changed. The first call (or a stale copy) takes one snapshot; later calls ask only for the verses that changed
    /// since the stored sequence, so an edit in the web editor arrives in a few kilobytes. Returns nil when nothing
    /// changed or the web app cannot be reached; the copy on disk is then left as it was.
    @discardableResult
    func syncMutoon() async -> MatnLibrary? {
#if DEBUG
        if ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" ||
           ProcessInfo.processInfo.arguments.contains("-mutoon-fixture") {
            return nil
        }
#endif
        let liveDir = Self.overlayDirectory.appendingPathComponent("QiraatMutoon", isDirectory: true)
        let bundleMutoonURL = Bundle.main.url(forResource: "QiraatMutoon", withExtension: nil)
        let fetch = self.fetch
        do {
            var changed = false
            if let seq = MatnOverlay.seq(in: liveDir) {
                var components = URLComponents(url: Self.baseURL.appendingPathComponent("api/mushaf-1441/mutoon"), resolvingAgainstBaseURL: false)!
                components.queryItems = [URLQueryItem(name: "since", value: String(seq))]
                let data = try await fetch(components.url!)
                let result = try await Task.detached(priority: .utility) { () -> MatnOverlay.DeltaResult in
                    guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return .needsSnapshot }
                    return try MatnOverlay.applyDelta(json, to: liveDir)
                }.value
                switch result {
                case .unchanged: return nil
                case .applied: changed = true
                case .needsSnapshot: changed = try await takeSnapshot(into: liveDir, fetch: fetch)
                }
            } else {
                changed = try await takeSnapshot(into: liveDir, fetch: fetch)
            }
            guard changed else { return nil }
            let loaded = await Task.detached(priority: .utility) {
                MatnOverlay.loadUsable(directory: liveDir, sharhDirectory: bundleMutoonURL)
            }.value
            guard let loaded else {
                Self.log.error("live mutoon copy loads as nothing; keeping the current library and taking a fresh snapshot next time")
                return nil
            }
            self.liveMutoonLibrary = loaded
            NotificationCenter.default.post(name: .mutoonDidChange, object: nil)
            return loaded
        } catch {
            Self.log.error("mutoon sync failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func takeSnapshot(into directory: URL, fetch: @escaping (URL) async throws -> Data) async throws -> Bool {
        let url = Self.baseURL.appendingPathComponent("api/mushaf-1441/mutoon")
        let data = try await fetch(url)
        return try await Task.detached(priority: .utility) { () -> Bool in
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
            try MatnOverlay.writeSnapshot(json, to: directory)
            return true
        }.value
    }
}
