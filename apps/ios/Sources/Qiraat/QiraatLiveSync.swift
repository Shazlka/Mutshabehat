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
/// being read is fetched from the cookie-less public endpoint, validated, kept beside the bundled
/// snapshot (`QiraatStore.applyLivePage`) and redrawn only when it actually changed. Offline, or on any
/// failure, the page keeps showing what it had. Nothing here ever writes to the web app.
@MainActor
final class QiraatLiveSync: ObservableObject {
    enum Outcome: Equatable { case updated, unchanged, skipped, failed }

    struct FetchResponse: Sendable {
        let data: Data
        let statusCode: Int
        let etag: String?

        init(data: Data, statusCode: Int = 200, etag: String? = nil) {
            self.data = data
            self.statusCode = statusCode
            self.etag = etag
        }
    }

    struct PageRefreshResult: Equatable {
        let outcome: Outcome
        let etag: String?
    }

    enum VersionsError: Error { case invalidShape, incomplete }

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

    private let fetch: (URLRequest) async throws -> FetchResponse
    private let minInterval: TimeInterval
    private let route: LiveSyncRoute
    private var lastChecked: [Int: Date] = [:]
    private var pageETags: [Int: String] = [:]
    private var inFlight: Set<Int> = []
    @Published private(set) var pageStates: [Int: PageState] = [:]
    @Published private(set) var liveMutoonLibrary: MatnLibrary?

    init(fetch: @escaping (URLRequest) async throws -> FetchResponse = QiraatLiveSync.fetchFromWeb,
         minInterval: TimeInterval = 5, route: LiveSyncRoute = .current) {
        self.fetch = fetch
        self.minInterval = minInterval
        self.route = route
    }

    /// How soon a page on screen checks again: soon after it appears, then less often while nothing
    /// changes (doubling up to five minutes), and soon again once a change arrives. A page that sat
    /// still used to be fetched every 10 s: 360 requests an hour, 720 on an iPad spread.
#if DEBUG
    /// Development builds poll the open page every few seconds while the owner is reviewing on the web.
    nonisolated static let firstPollInterval: TimeInterval = 5
    nonisolated static let maxPollInterval: TimeInterval = 15
#else
    nonisolated static let firstPollInterval: TimeInterval = 10
    nonisolated static let maxPollInterval: TimeInterval = 300
#endif

    nonisolated static func nextPollInterval(after outcome: Outcome, current: TimeInterval) -> TimeInterval {
        outcome == .updated ? firstPollInterval : min(maxPollInterval, current * 2)
    }

    nonisolated static func liveURL(page: Int, route: LiveSyncRoute = .current) -> URL {
        AppEndpoints.liveQiraatPage(page, route: route)
    }

    func pageState(for page: Int) -> PageState {
        pageStates[page] ?? PageState(latestOutcome: nil, lastConfirmation: nil)
    }

    nonisolated static func request(url: URL, etag: String? = nil) -> URLRequest {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Qiraat-iOS-Live", forHTTPHeaderField: "User-Agent")
        if let etag { request.setValue(etag, forHTTPHeaderField: "If-None-Match") }
        return request
    }

    /// Public live-sync requests use a dedicated ephemeral session that cannot accept or persist cookies.
    nonisolated static func fetchFromWeb(_ request: URLRequest) async throws -> FetchResponse {
#if DEBUG
        // Simulator regression runs use the existing snapshot and cannot contact production.
        if ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" {
            throw URLError(.notConnectedToInternet)
        }
#endif
#if DEBUG
        // The review routes need the site's own sign-in cookie, as the developer review editor does; the public API
        // must never see one.
        let session = request.url?.path.hasPrefix("/api/public/") == true ? PublicLiveSyncSession.shared : URLSession.shared
#else
        let session = PublicLiveSyncSession.shared
#endif
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return FetchResponse(data: data, statusCode: response.statusCode,
                             etag: response.value(forHTTPHeaderField: "ETag"))
    }

    /// `announceProgress: false` is for the background pass over every page (`QiraatBulkSync`): it still installs
    /// and announces changed pages, but leaves `pageStates` alone so the open word card does not re-render
    /// for every one of the ~600 pages.
    @discardableResult
    func refresh(page: Int, store: QiraatStore?, force: Bool = false, announceProgress: Bool = true) async -> Outcome {
        await refreshPage(page: page, store: store, force: force, announceProgress: announceProgress).outcome
    }

    /// Response-aware form used by the bulk pass to make conditional requests and persist the returned strong ETag.
    func refreshPage(page: Int, store: QiraatStore?, force: Bool = false, announceProgress: Bool = true,
                     ifNoneMatch etag: String? = nil) async -> PageRefreshResult {
        func note(_ outcome: Outcome) -> Outcome { announceProgress ? record(outcome, for: page) : outcome }
        guard let store, !inFlight.contains(page) else { return PageRefreshResult(outcome: note(.skipped), etag: nil) }
        if !force, let last = lastChecked[page], Date().timeIntervalSince(last) < minInterval {
            return PageRefreshResult(outcome: note(.skipped), etag: nil)
        }
        inFlight.insert(page)
        defer { inFlight.remove(page) }
        lastChecked[page] = Date()
        do {
            let conditionalETag = etag ?? pageETags[page]
            let response = try await fetch(Self.request(url: Self.liveURL(page: page, route: route), etag: conditionalETag))
            if response.statusCode == 304 {
                let confirmedETag = response.etag ?? conditionalETag
                pageETags[page] = confirmedETag
                return PageRefreshResult(outcome: note(.unchanged), etag: confirmedETag)
            }
            guard response.statusCode == 200 else { throw URLError(.badServerResponse) }
            if let etag = response.etag { pageETags[page] = etag }
            // The web review page is edited all the time while development builds read it: a page with fewer records is
            // a deletion there, so those builds never refuse a shrink. The public API the store build reads is cached,
            // so a much smaller page is as likely a stale or truncated answer: the store's shrink guard stays on.
            // The install reads and writes files, so it runs off the main actor.
            let allowShrink = route == .reviewRoutes
            let changed = try await Task.detached(priority: .utility) {
                try store.applyLivePage(response.data, number: page, allowShrink: allowShrink)
            }.value
            guard changed else { return PageRefreshResult(outcome: note(.unchanged), etag: response.etag) }
            let outcome = note(.updated)
            NotificationCenter.default.post(name: .qiraatPageDidChange, object: nil, userInfo: ["page": page])
            return PageRefreshResult(outcome: outcome, etag: response.etag)
        } catch {
            // Offline, a refused answer (`invalidPage`, `suspiciousShrink`) and a full disk all end as «failed»; the
            // reason is only in the log, so keep it there.
            Self.log.error("live page \(page) failed: \(String(describing: error), privacy: .public)")
            return PageRefreshResult(outcome: note(.failed), etag: nil)
        }
    }

    func fetchVersions(total: Int = mushafPageCount) async throws -> [Int: String] {
        let response = try await fetch(Self.request(url: AppEndpoints.publicQiraatVersions))
        guard response.statusCode == 200 else { throw URLError(.badServerResponse) }
        let versions = try Self.decodeVersions(response.data)
        guard (1...total).allSatisfy({ versions[$0] != nil }) else { throw VersionsError.incomplete }
        return versions
    }

    nonisolated static func decodeVersions(_ data: Data) throws -> [Int: String] {
        var json = try JSONSerialization.jsonObject(with: data)
        // The deployed endpoint wraps the array: {"pages": [{"page": 1, "version": "…"}, …]}.
        if let wrapped = (json as? [String: Any])?["pages"] { json = wrapped }
        var result: [Int: String] = [:]
        func token(_ value: Any) -> String? {
            if let value = value as? String { return value }
            if let value = value as? NSNumber { return value.stringValue }
            return nil
        }
        if let object = json as? [String: Any] {
            for (key, value) in object {
                guard let page = Int(key), let version = token(value) else { throw VersionsError.invalidShape }
                result[page] = version
            }
        } else if let array = json as? [[String: Any]] {
            for item in array {
                guard let page = (item["page"] as? NSNumber)?.intValue,
                      let version = item["version"].flatMap(token) else { throw VersionsError.invalidShape }
                result[page] = version
            }
        } else {
            throw VersionsError.invalidShape
        }
        guard !result.isEmpty else { throw VersionsError.invalidShape }
        return result
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
                let response = try await fetch(Self.request(url: AppEndpoints.liveMutoon(since: seq, route: route)))
                guard response.statusCode == 200 else { throw URLError(.badServerResponse) }
                let result = try await Task.detached(priority: .utility) { () -> MatnOverlay.DeltaResult in
                    guard let json = try JSONSerialization.jsonObject(with: response.data) as? [String: Any] else { return .needsSnapshot }
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

    private func takeSnapshot(into directory: URL,
                              fetch: @escaping (URLRequest) async throws -> FetchResponse) async throws -> Bool {
        let response = try await fetch(Self.request(url: AppEndpoints.liveMutoon(route: route)))
        guard response.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try await Task.detached(priority: .utility) { () -> Bool in
            guard let json = try JSONSerialization.jsonObject(with: response.data) as? [String: Any] else { return false }
            try MatnOverlay.writeSnapshot(json, to: directory)
            return true
        }.value
    }
}
