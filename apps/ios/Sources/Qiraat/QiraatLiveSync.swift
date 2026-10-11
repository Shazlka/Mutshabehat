import Combine
import Foundation
import MushafCore

extension Notification.Name {
    /// A page's Qiraat data changed after a live fetch; `userInfo["page"]` is the page number.
    static let qiraatPageDidChange = Notification.Name("qiraatPageDidChange")
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

    nonisolated static let baseURL = URL(string: "https://mutshabehat-v2.vercel.app")!
    static let shared = QiraatLiveSync()
    /// The overlay lives in Application Support, next to the imported backup directory.
    static let overlayDirectory: URL = {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return root.appendingPathComponent("QiraatLive", isDirectory: true)
    }()

    private let fetch: (URL) async throws -> Data
    private let minInterval: TimeInterval
    private var lastChecked: [Int: Date] = [:]
    private var inFlight: Set<Int> = []
    @Published private(set) var pageStates: [Int: PageState] = [:]

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
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Qiraat-iOS-Live", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return data
    }

    @discardableResult
    func refresh(page: Int, store: QiraatStore?, force: Bool = false) async -> Outcome {
        guard let store, !inFlight.contains(page) else { return record(.skipped, for: page) }
        if !force, let last = lastChecked[page], Date().timeIntervalSince(last) < minInterval {
            return record(.skipped, for: page)
        }
        inFlight.insert(page)
        defer { inFlight.remove(page) }
        lastChecked[page] = Date()
        do {
            let data = try await fetch(Self.liveURL(page: page))
            guard try store.applyLivePage(data, number: page) else { return record(.unchanged, for: page) }
            let outcome = record(.updated, for: page)
            NotificationCenter.default.post(name: .qiraatPageDidChange, object: nil, userInfo: ["page": page])
            return outcome
        } catch {
            return record(.failed, for: page)
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
}
