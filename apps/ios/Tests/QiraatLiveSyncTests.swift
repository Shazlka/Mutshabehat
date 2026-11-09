import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

/// Pages announced by the notification, safe to append from whichever thread posts it.
private final class AnnouncementLog: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [Int] = []
    func append(_ page: Int) { lock.withLock { values.append(page) } }
    var pages: [Int] { lock.withLock { values } }
}

@MainActor
final class QiraatLiveSyncTests: XCTestCase {
    // XCTest calls setUp/tearDown off the main actor, so the fixture state is declared non-isolated.
    nonisolated(unsafe) private var directory: URL!
    nonisolated(unsafe) private var overlay: URL!
    nonisolated(unsafe) private var store: QiraatStore!

    private let emptyPage = #"{"pageNumber":8,"variants":[],"rulings":[],"rules":[]}"#
    private let pageWithVariant = #"{"pageNumber":8,"variants":[{"id":"v-live","surah":2,"ayah":51,"startToken":11,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q06-R01"]}],"rulings":[],"rules":[]}"#

    override func setUpWithError() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        directory = root.appendingPathComponent("snapshot")
        overlay = root.appendingPathComponent("live")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        try FileManager.default.copyItem(at: bundled.appendingPathComponent("catalog.json"), to: directory.appendingPathComponent("catalog.json"))
        try Data(emptyPage.utf8).write(to: directory.appendingPathComponent("page-008.json"))
        store = try QiraatStore(directory: directory, overlayDirectory: overlay)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory.deletingLastPathComponent())
        super.tearDown()
    }

    func testTheLiveURLIsTheWebAppsQiraatEndpointForThatPage() {
        XCTAssertEqual(QiraatLiveSync.liveURL(page: 8, route: .publicAPI).absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/public/v1/qiraat?page=8")
        XCTAssertEqual(AppEndpoints.publicQiraatVersions.absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/public/v1/qiraat/versions")
        XCTAssertEqual(AppEndpoints.publicMutoon(since: 41).absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/public/v1/mutoon?since=41")
    }

    func testLiveSyncSessionCannotStoreOrAcceptCookies() {
        let configuration = PublicLiveSyncSession.configuration()
        XCTAssertNil(configuration.httpCookieStorage)
        XCTAssertFalse(configuration.httpShouldSetCookies)
        XCTAssertEqual(configuration.httpCookieAcceptPolicy, .never)
        XCTAssertEqual(configuration.identifier, nil, "an ephemeral configuration is not a persistent background session")
    }

    func testVersionsDecoderAcceptsObjectAndArrayShapes() throws {
        XCTAssertEqual(try QiraatLiveSync.decodeVersions(Data(#"{"1":"etag-a","2":22}"#.utf8)),
                       [1: "etag-a", 2: "22"])
        XCTAssertEqual(try QiraatLiveSync.decodeVersions(Data(#"[{"page":1,"version":"etag-a"},{"page":2,"version":22}]"#.utf8)),
                       [1: "etag-a", 2: "22"])
    }

    /// The shape the deployed `/api/public/v1/qiraat/versions` returns: the array wrapped in `pages`.
    func testVersionsDecoderAcceptsTheServersPagesWrapper() throws {
        XCTAssertEqual(try QiraatLiveSync.decodeVersions(Data(#"{"pages":[{"page":1,"version":"f766"},{"page":2,"version":"99f9"}]}"#.utf8)),
                       [1: "f766", 2: "99f9"])
    }

    func testAChangedLivePageIsInstalledAndAnnouncedOnce() async {
        let sync = QiraatLiveSync(fetch: { _ in .init(data: Data(self.pageWithVariant.utf8)) }, minInterval: 0)
        let announcements = AnnouncementLog()
        let token = NotificationCenter.default.addObserver(forName: .qiraatPageDidChange, object: nil, queue: nil) { note in
            announcements.append(note.userInfo?["page"] as? Int ?? -1)
        }
        defer { NotificationCenter.default.removeObserver(token) }

        let first = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(first, .updated)
        XCTAssertEqual(store.page(8)?.variants.map(\.id), ["v-live"])
        let second = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(second, .unchanged)
        XCTAssertEqual(announcements.pages, [8], "only a real change redraws the page")
    }

    private func pageEight(variants count: Int) -> String {
        let records = (0..<count).map {
            #"{"id":"v-\#($0)","surah":2,"ayah":51,"startToken":\#($0 + 1),"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q06-R01"]}"#
        }
        return #"{"pageNumber":8,"variants":[\#(records.joined(separator: ","))],"rulings":[],"rules":[]}"#
    }

    /// The web review page is the source of truth and is still being edited: variants are modified, added and deleted
    /// there. A page that comes back with fewer records is a deletion the reviewer made, and it must reach the app, not be
    /// refused as a "suspicious shrink" (which left the deleted variants on the phone for good).
    func testADeletionMadeInTheWebReviewPageReachesTheApp() async {
        let big = pageEight(variants: 12)
        _ = try? store.applyLivePage(Data(big.utf8), number: 8)
        XCTAssertEqual(store.page(8)?.variants.count, 12)

        let sync = QiraatLiveSync(fetch: { _ in .init(data: Data(self.pageEight(variants: 2).utf8)) }, minInterval: 0)
        let outcome = await sync.refresh(page: 8, store: store)

        XCTAssertEqual(outcome, .updated)
        XCTAssertEqual(store.page(8)?.variants.count, 2)
    }

    /// The store build reads the cached public API, where a much smaller page is as likely a stale or truncated answer
    /// as a deletion: the store's shrink guard stays on there, and the page on the phone is kept.
    func testThePublicRouteRefusesASuddenlyMuchSmallerPage() async {
        let big = pageEight(variants: 12)
        _ = try? store.applyLivePage(Data(big.utf8), number: 8)

        let sync = QiraatLiveSync(fetch: { _ in .init(data: Data(self.pageEight(variants: 2).utf8)) },
                                  minInterval: 0, route: .publicAPI)
        let outcome = await sync.refresh(page: 8, store: store)

        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(store.page(8)?.variants.count, 12)
    }

    func testAFailedFetchKeepsWhatIsShown() async {
        struct Offline: Error {}
        let sync = QiraatLiveSync(fetch: { _ in throw Offline() }, minInterval: 0)
        let outcome = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(store.page(8)?.variants.count, 0)
    }

    func testAnotherPagesResponseIsRejected() async {
        let sync = QiraatLiveSync(fetch: { _ in
            .init(data: Data(self.pageWithVariant.replacingOccurrences(of: "\"pageNumber\":8", with: "\"pageNumber\":9").utf8))
        }, minInterval: 0)
        let outcome = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(store.page(8)?.variants.count, 0)
    }

    func testAPageJustCheckedIsNotFetchedAgainUnlessForced() async {
        var calls = 0
        let sync = QiraatLiveSync(fetch: { _ in calls += 1; return .init(data: Data(self.emptyPage.utf8)) }, minInterval: 60)
        _ = await sync.refresh(page: 8, store: store)
        let again = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(again, .skipped)
        _ = await sync.refresh(page: 8, store: store, force: true)
        XCTAssertEqual(calls, 2)
    }

    func testA304IsUnchangedAndSendsTheStoredETag() async {
        var seenETag: String?
        let sync = QiraatLiveSync(fetch: { request in
            seenETag = request.value(forHTTPHeaderField: "If-None-Match")
            return .init(data: Data(), statusCode: 304, etag: #""v8""#)
        }, minInterval: 0)

        let result = await sync.refreshPage(page: 8, store: store, force: true, ifNoneMatch: #""old-v8""#)

        XCTAssertEqual(result, .init(outcome: .unchanged, etag: #""v8""#))
        XCTAssertEqual(seenETag, #""old-v8""#)
        XCTAssertEqual(store.page(8)?.variants.count, 0)
    }

    func testInjectedFetchesUseOnlyPublicQiraatURLs() async throws {
        var paths: [String] = []
        let sync = QiraatLiveSync(fetch: { request in
            paths.append(request.url!.path)
            if request.url?.path.hasSuffix("/versions") == true {
                return .init(data: Data(#"{"1":"v1"}"#.utf8))
            }
            return .init(data: Data(#"{"pageNumber":1,"variants":[],"rulings":[],"rules":[]}"#.utf8))
        }, minInterval: 0, route: .publicAPI)

        _ = try await sync.fetchVersions(total: 1)
        _ = await sync.refresh(page: 1, store: store, force: true)

        XCTAssertEqual(paths, ["/api/public/v1/qiraat/versions", "/api/public/v1/qiraat"])
        XCTAssertTrue(paths.allSatisfy { $0.hasPrefix("/api/public/v1/") })
    }

    /// Owner decision 2026-11-03: until the Qiraat review is finished, development builds (`make device`) read the
    /// review routes, which the CDN never caches, so an edit in the web review tab reaches the iPhone at once.
    /// The App Store build reads the public API. Flip `LiveSyncRoute.current` as the last step before publishing.
    func testDevelopmentBuildsReadTheUncachedReviewRoutesUntilPublishing() {
        XCTAssertEqual(LiveSyncRoute.current, .reviewRoutes)
        XCTAssertEqual(QiraatLiveSync.liveURL(page: 8).absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/mushaf-1441/qiraat?page=8")
        XCTAssertEqual(AppEndpoints.liveMutoon(since: 41, route: .current).absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/mushaf-1441/mutoon?since=41")
        XCTAssertEqual(AppEndpoints.liveMutoon(route: .publicAPI).absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/public/v1/mutoon")
    }

    func testDevelopmentBuildsCheckTheOpenPageEveryFewSeconds() {
        XCTAssertLessThanOrEqual(QiraatLiveSync.firstPollInterval, 5)
        XCTAssertLessThanOrEqual(QiraatLiveSync.maxPollInterval, 15)
    }

    func testAQuietPageIsCheckedLessOftenUntilSomethingChanges() {
        let first = QiraatLiveSync.firstPollInterval
        let second = QiraatLiveSync.nextPollInterval(after: .unchanged, current: first)
        XCTAssertEqual(second, first * 2)
        var interval = first
        for _ in 0..<20 { interval = QiraatLiveSync.nextPollInterval(after: .unchanged, current: interval) }
        XCTAssertEqual(interval, QiraatLiveSync.maxPollInterval)
        XCTAssertEqual(QiraatLiveSync.nextPollInterval(after: .updated, current: interval), first)
        XCTAssertEqual(QiraatLiveSync.nextPollInterval(after: .failed, current: first), first * 2)
    }
}
