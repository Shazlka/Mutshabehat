import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

@MainActor
final class QiraatLiveSyncTests: XCTestCase {
    private var directory: URL!
    private var overlay: URL!
    private var store: QiraatStore!

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
        var announced: [Int] = []
        let token = NotificationCenter.default.addObserver(forName: .qiraatPageDidChange, object: nil, queue: nil) { note in
            announced.append(note.userInfo?["page"] as? Int ?? -1)
        }
        defer { NotificationCenter.default.removeObserver(token) }

        let first = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(first, .updated)
        XCTAssertEqual(store.page(8)?.variants.map(\.id), ["v-live"])
        let second = await sync.refresh(page: 8, store: store)
        XCTAssertEqual(second, .unchanged)
        XCTAssertEqual(announced, [8], "only a real change redraws the page")
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
