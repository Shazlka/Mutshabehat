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
        let sync = QiraatLiveSync(fetch: { url in
            let page = Self.pageNumber(in: url)
            log.append(page)
            return Self.body(for: page)
        }, minInterval: 0)
        let summary = await QiraatBulkSync(defaults: freshDefaults()).run(around: 300, store: store, sync: sync, concurrency: 1)

        XCTAssertEqual(summary, QiraatBulkSync.Summary(updated: mushafPageCount, unchanged: 0, failed: 0, gaveUp: false))
        XCTAssertEqual(Array(log.pages.prefix(5)), [300, 301, 299, 302, 298])
        XCTAssertEqual(log.pages.count, mushafPageCount)
        XCTAssertNotNil(store.page(1))
        XCTAssertNotNil(store.page(mushafPageCount))
    }

    func testTheBackgroundPassLeavesTheWordCardsSyncStatusAlone() async {
        let sync = QiraatLiveSync(fetch: { url in Self.body(for: Self.pageNumber(in: url)) }, minInterval: 0)
        _ = await sync.refresh(page: 12, store: store, force: true, announceProgress: false)
        XCTAssertNil(sync.pageState(for: 12).latestOutcome, "an unrelated page must not re-render the open card")
        XCTAssertNotNil(store.page(12), "but the data is installed")
    }

    func testAnOfflinePassGivesUpInsteadOfWaitingOutEveryPage() async {
        struct Offline: Error {}
        let log = RequestLog()
        let sync = QiraatLiveSync(fetch: { url in log.append(Self.pageNumber(in: url)); throw Offline() }, minInterval: 0)
        let summary = await QiraatBulkSync(defaults: freshDefaults()).run(around: 1, store: store, sync: sync, concurrency: 2)
        XCTAssertTrue(summary.gaveUp)
        XCTAssertLessThan(log.pages.count, 20)
        XCTAssertGreaterThan(summary.failed, 0)
    }

    func testAPageThatFailedOnceIsRetriedAtTheEnd() async {
        final class Flaky: @unchecked Sendable { var failedOnce = false }
        let flaky = Flaky()
        let sync = QiraatLiveSync(fetch: { url in
            let page = Self.pageNumber(in: url)
            if page == 10, !flaky.failedOnce { flaky.failedOnce = true; throw URLError(.timedOut) }
            return Self.body(for: page)
        }, minInterval: 0)
        let summary = await QiraatBulkSync(defaults: freshDefaults()).run(around: 1, store: store, sync: sync, concurrency: 1)
        XCTAssertEqual(summary.failed, 0)
        XCTAssertEqual(summary.updated, mushafPageCount)
        XCTAssertNotNil(store.page(10))
    }

    func testARecentFullPassIsNotRepeatedOnTheNextOpen() {
        let defaults = freshDefaults()
        defaults.set(Date(), forKey: QiraatBulkSync.lastCompletedKey)
        let bulk = QiraatBulkSync(defaults: defaults)
        bulk.start(around: 1, store: store)
        XCTAssertFalse(bulk.isRunning)
    }
}
