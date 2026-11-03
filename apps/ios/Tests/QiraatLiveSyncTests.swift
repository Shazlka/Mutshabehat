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
        XCTAssertEqual(QiraatLiveSync.liveURL(page: 8).absoluteString,
                       "https://mutshabehat-v2.vercel.app/api/mushaf-1441/qiraat?page=8")
    }

    func testAChangedLivePageIsInstalledAndAnnouncedOnce() async {
        let sync = QiraatLiveSync(fetch: { _ in Data(self.pageWithVariant.utf8) }, minInterval: 0)
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

        let sync = QiraatLiveSync(fetch: { _ in Data(self.pageEight(variants: 2).utf8) }, minInterval: 0)
        let outcome = await sync.refresh(page: 8, store: store)

        XCTAssertEqual(outcome, .updated)
        XCTAssertEqual(store.page(8)?.variants.count, 2)
    }

    func testAFailedFetchKeepsWhatIsShown() async {
        struct Offline: Error {}
        let sync = QiraatLiveSync(fetch: { _ in throw Offline() }, minInterval: 0)
        let outcome = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(store.page(8)?.variants.count, 0)
    }

    func testAnotherPagesResponseIsRejected() async {
        let sync = QiraatLiveSync(fetch: { _ in Data(self.pageWithVariant.replacingOccurrences(of: "\"pageNumber\":8", with: "\"pageNumber\":9").utf8) }, minInterval: 0)
        let outcome = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(store.page(8)?.variants.count, 0)
    }

    func testAPageJustCheckedIsNotFetchedAgainUnlessForced() async {
        var calls = 0
        let sync = QiraatLiveSync(fetch: { _ in calls += 1; return Data(self.emptyPage.utf8) }, minInterval: 60)
        _ = await sync.refresh(page: 8, store: store)
        let again = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(again, .skipped)
        _ = await sync.refresh(page: 8, store: store, force: true)
        XCTAssertEqual(calls, 2)
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
