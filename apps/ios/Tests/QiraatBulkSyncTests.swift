import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

/// Pages requested by the background pass, safe to append from whichever task fetches.
private final class RequestLog: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [Int] = []
    func append(_ page: Int) { lock.withLock { values.append(page) } }
    var pages: [Int] { lock.withLock { values } }
}

@MainActor
final class QiraatBulkSyncTests: XCTestCase {
    nonisolated(unsafe) private var root: URL!
    nonisolated(unsafe) private var store: QiraatStore!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let snapshot = root.appendingPathComponent("snapshot")
        try FileManager.default.createDirectory(at: snapshot, withIntermediateDirectories: true)
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        try FileManager.default.copyItem(at: bundled.appendingPathComponent("catalog.json"), to: snapshot.appendingPathComponent("catalog.json"))
        store = try QiraatStore(directory: snapshot, overlayDirectory: root.appendingPathComponent("live"))
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: root)
        super.tearDown()
    }

    private static func pageNumber(in url: URL) -> Int {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "page" }?.value.flatMap(Int.init) ?? -1
    }

    private static func body(for page: Int) -> Data {
        Data(#"{"pageNumber":\#(page),"variants":[],"rulings":[],"rules":[]}"#.utf8)
    }

    private static func versions(total: Int = mushafPageCount, changedPage: Int? = nil) -> Data {
        let pairs = (1...total).map { page in
            #""\#(page)":"\#(page == changedPage ? "v2" : "v1")""#
        }
        return Data("{\(pairs.joined(separator: ","))}".utf8)
    }

    private func bulk(defaults: UserDefaults? = nil) -> QiraatBulkSync {
        QiraatBulkSync(defaults: defaults ?? freshDefaults(),
                       versionsURL: root.appendingPathComponent("live/qiraat-versions.json"))
    }

    private func freshDefaults() -> UserDefaults {
        let suite = "QiraatBulkSyncTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    func testPagesAreFetchedNearestFirstAndEveryPageOnce() {
        XCTAssertEqual(QiraatBulkSync.order(around: 5, total: 9), [5, 6, 4, 7, 3, 8, 2, 9, 1])
        XCTAssertEqual(QiraatBulkSync.order(around: 1, total: 4), [1, 2, 3, 4])
        XCTAssertEqual(QiraatBulkSync.order(around: 99, total: 4), [4, 3, 2, 1], "an out-of-range page is clamped")
        let all = QiraatBulkSync.order(around: 300)
        XCTAssertEqual(all.first, 300)
        XCTAssertEqual(Set(all), Set(1...mushafPageCount))
        XCTAssertEqual(all.count, mushafPageCount)
    }

    func testAFullPassInstallsEveryPageStartingWithTheOneBeingRead() async {
        let log = RequestLog()
        let sync = QiraatLiveSync(fetch: { request in
            if request.url?.path.hasSuffix("/versions") == true {
                return .init(data: Self.versions())
            }
            let page = Self.pageNumber(in: request.url!)
            log.append(page)
            return .init(data: Self.body(for: page), etag: #""page-etag""#)
        }, minInterval: 0)
        let summary = await bulk().run(around: 300, store: store, sync: sync, concurrency: 1)

        XCTAssertEqual(summary, QiraatBulkSync.Summary(updated: mushafPageCount, unchanged: 0, failed: 0, gaveUp: false))
        XCTAssertEqual(Array(log.pages.prefix(5)), [300, 301, 299, 302, 298])
        XCTAssertEqual(log.pages.count, mushafPageCount)
        XCTAssertNotNil(store.page(1))
        XCTAssertNotNil(store.page(mushafPageCount))
    }

    func testTheBackgroundPassLeavesTheWordCardsSyncStatusAlone() async {
        let sync = QiraatLiveSync(fetch: { request in
            .init(data: Self.body(for: Self.pageNumber(in: request.url!)))
        }, minInterval: 0)
        _ = await sync.refresh(page: 12, store: store, force: true, announceProgress: false)
        XCTAssertNil(sync.pageState(for: 12).latestOutcome, "an unrelated page must not re-render the open card")
        XCTAssertNotNil(store.page(12), "but the data is installed")
    }

    func testAnOfflinePassGivesUpInsteadOfWaitingOutEveryPage() async {
        struct Offline: Error {}
        let log = RequestLog()
        let sync = QiraatLiveSync(fetch: { request in log.append(Self.pageNumber(in: request.url!)); throw Offline() }, minInterval: 0)
        let summary = await bulk().run(around: 1, store: store, sync: sync, concurrency: 2)
        XCTAssertTrue(summary.gaveUp)
        XCTAssertTrue(summary.usedFallback)
        XCTAssertLessThan(log.pages.count, 20)
        XCTAssertGreaterThan(summary.failed, 0)
    }

    func testAPageThatFailedOnceIsRetriedAtTheEnd() async {
        final class Flaky: @unchecked Sendable { var failedOnce = false }
        let flaky = Flaky()
        let sync = QiraatLiveSync(fetch: { request in
            if request.url?.path.hasSuffix("/versions") == true { return .init(data: Self.versions()) }
            let page = Self.pageNumber(in: request.url!)
            if page == 10, !flaky.failedOnce { flaky.failedOnce = true; throw URLError(.timedOut) }
            return .init(data: Self.body(for: page))
        }, minInterval: 0)
        let summary = await bulk().run(around: 1, store: store, sync: sync, concurrency: 1)
        XCTAssertEqual(summary.failed, 0)
        XCTAssertEqual(summary.updated, mushafPageCount)
        XCTAssertNotNil(store.page(10))
    }

    /// One page the server keeps refusing (a shrink the guard rejects, say) is not a network outage: the pass reached every
    /// other page. It used to leave the «completed» stamp unset, so every launch and every return to the foreground
    /// started another ~600-request pass.
    func testAPassWithOneStubbornlyFailingPageIsNotRepeatedOnTheNextOpen() async {
        let defaults = freshDefaults()
        let bulk = bulk(defaults: defaults)
        let sync = QiraatLiveSync(fetch: { request in
            if request.url?.path.hasSuffix("/versions") == true { return .init(data: Self.versions()) }
            let page = Self.pageNumber(in: request.url!)
            if page == 7 { throw URLError(.cannotConnectToHost) }
            return .init(data: Self.body(for: page))
        }, minInterval: 0)

        bulk.start(around: 1, store: store, sync: sync)
        while bulk.isRunning { try? await Task.sleep(for: .milliseconds(20)) }

        XCTAssertNotNil(defaults.object(forKey: QiraatBulkSync.lastCompletedKey))
        bulk.start(around: 1, store: store, sync: sync)
        XCTAssertFalse(bulk.isRunning, "a pass that reached every other page is not repeated at once")
    }

    func testARecentFullPassIsNotRepeatedOnTheNextOpen() {
        let defaults = freshDefaults()
        defaults.set(Date(), forKey: QiraatBulkSync.lastCompletedKey)
        let bulk = bulk(defaults: defaults)
        bulk.start(around: 1, store: store)
        XCTAssertFalse(bulk.isRunning)
    }

    func testOnlyPagesWhoseVersionChangedAreFetchedWithTheirPreviousETag() async {
        final class State: @unchecked Sendable {
            var changedPage: Int?
            var requestedPages: [Int] = []
            var etags: [Int: String?] = [:]
        }
        let state = State()
        let sync = QiraatLiveSync(fetch: { request in
            if request.url?.path.hasSuffix("/versions") == true {
                return .init(data: Self.versions(total: 3, changedPage: state.changedPage))
            }
            let page = Self.pageNumber(in: request.url!)
            state.requestedPages.append(page)
            state.etags[page] = request.value(forHTTPHeaderField: "If-None-Match")
            return .init(data: Self.body(for: page), etag: #""etag-\#(page)""#)
        }, minInterval: 0)
        let bulk = bulk()

        _ = await bulk.run(around: 1, store: store, sync: sync, concurrency: 1, total: 3)
        state.requestedPages.removeAll()
        state.etags.removeAll()
        state.changedPage = 2
        let summary = await bulk.run(around: 1, store: store, sync: sync, concurrency: 1, total: 3)

        XCTAssertEqual(state.requestedPages, [2])
        XCTAssertEqual(state.etags[2]!, #""etag-2""#)
        XCTAssertEqual(summary.updated + summary.unchanged, 1)
        XCTAssertFalse(summary.usedFallback)
    }

    func testVersionsFailureFallsBackToEveryPage() async {
        let log = RequestLog()
        let sync = QiraatLiveSync(fetch: { request in
            if request.url?.path.hasSuffix("/versions") == true {
                return .init(data: Data(), statusCode: 404)
            }
            let page = Self.pageNumber(in: request.url!)
            log.append(page)
            return .init(data: Self.body(for: page))
        }, minInterval: 0)

        let summary = await bulk().run(around: 2, store: store, sync: sync, concurrency: 1, total: 3)

        XCTAssertTrue(summary.usedFallback)
        XCTAssertEqual(log.pages, [2, 3, 1])
        XCTAssertFalse(summary.gaveUp)
    }

    func testFallbackPassUsesTheLongerRepeatInterval() {
        let defaults = freshDefaults()
        defaults.set(Date(timeIntervalSinceNow: -(QiraatBulkSync.repeatAfter + 1)),
                     forKey: QiraatBulkSync.lastCompletedKey)
        defaults.set(true, forKey: QiraatBulkSync.lastUsedFallbackKey)
        let bulk = bulk(defaults: defaults)

        bulk.start(around: 1, store: store)

        XCTAssertFalse(bulk.isRunning)
    }

    func testOfflineFallbackAttemptIsAlsoThrottled() async {
        let defaults = freshDefaults()
        let bulk = bulk(defaults: defaults)
        let sync = QiraatLiveSync(fetch: { _ in throw URLError(.notConnectedToInternet) }, minInterval: 0)

        bulk.start(around: 1, store: store, sync: sync)
        while bulk.isRunning { try? await Task.sleep(for: .milliseconds(20)) }

        XCTAssertNotNil(defaults.object(forKey: QiraatBulkSync.lastCompletedKey))
        XCTAssertTrue(defaults.bool(forKey: QiraatBulkSync.lastUsedFallbackKey))
        bulk.start(around: 1, store: store, sync: sync)
        XCTAssertFalse(bulk.isRunning)
    }
}
