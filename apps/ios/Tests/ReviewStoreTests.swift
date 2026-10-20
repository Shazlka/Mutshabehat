#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat
#if DEBUG
@testable import ReviewEditor
#endif

@MainActor
final class ReviewStoreTests: XCTestCase {
    func testTwoWordFaceShowsOnBothWords() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([ReviewTestServer.Spec(id: "r-1", start: 2, end: 3)])
        await store.load(page: 8)
        XCTAssertEqual(store.rows(forKey: "002:049:002").map(\.entryId), ["r-1"])
        XCTAssertEqual(store.rows(forKey: "002:049:003").map(\.entryId), ["r-1"])
        XCTAssertTrue(store.rows(forKey: "002:049:001").isEmpty)
        XCTAssertTrue(store.rows(forKey: "002:049:004").isEmpty)
    }

    func testStatusPriorityFlaggedWins() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([
            ReviewTestServer.Spec(id: "r-1", start: 1, end: 3, status: "reviewed"),
            ReviewTestServer.Spec(id: "r-2", start: 2, end: 2),
            ReviewTestServer.Spec(id: "r-3", start: 3, end: 3, status: "flagged"),
        ])
        await store.load(page: 8)
        XCTAssertEqual(store.status(forKey: "002:049:001"), .reviewed)
        XCTAssertEqual(store.status(forKey: "002:049:002"), .unreviewed)
        XCTAssertEqual(store.status(forKey: "002:049:003"), .flagged)
        XCTAssertNil(store.status(forKey: "002:049:004"))
    }

    func testApproveSendsStatusAndReplacesRowWithServerVersion() async throws {
        let (store, transport, _) = try ReviewTestServer.makeStore([ReviewTestServer.Spec(id: "r-1", start: 1, end: 1)])
        await store.load(page: 8)
        let before = try XCTUnwrap(store.rows(forKey: "002:049:001").first)
        store.approve(before)
        // Optimistic: the reviewer sees "reviewed" at once, before any server answer.
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .reviewed)
        await store.waitUntilIdle()
        let patch = try XCTUnwrap(transport.requests.firstIndex { $0.httpMethod == "PATCH" })
        let body = try XCTUnwrap(transport.body(patch))
        XCTAssertEqual(body["action"] as? String, "status")
        XCTAssertEqual(body["status"] as? String, "reviewed")
        XCTAssertEqual(body["version"] as? String, "v1")
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.version, "v2")
        if case .saved = store.saveStatus {} else { XCTFail("expected saved, got \(store.saveStatus)") }
    }

    func testFailedApproveRestoresRowAndSetsFailedStatus() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([ReviewTestServer.Spec(id: "r-1", start: 1, end: 1)], patchStatus: 500)
        await store.load(page: 8)
        store.approve(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        await store.waitUntilIdle()
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .unreviewed)   // server truth restored
        if case .failed = store.saveStatus {} else { XCTFail("expected failed, got \(store.saveStatus)") }
        XCTAssertEqual(store.failures.count, 1)
    }

    func testNextUnreviewedSkipsReviewedAndWrapsToNextPage() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([
            ReviewTestServer.Spec(id: "r-1", start: 1, end: 1, status: "reviewed"),
            ReviewTestServer.Spec(id: "r-2", start: 3, end: 3),
        ])
        await store.load(page: 8)
        XCTAssertEqual(store.nextReviewKey(after: nil), "002:049:003")
        XCTAssertNil(store.nextReviewKey(after: "002:049:003"))
        XCTAssertEqual(store.nextPageNeedingReview(), 9)      // page 8 itself is checked after the end, page 9 has unreviewed
    }

    func testSuccessfulSaveRefreshesTheLiveOverlayOnce() async throws {
        var refreshed: [Int] = []
        let (store, _, _) = try ReviewTestServer.makeStore([ReviewTestServer.Spec(id: "r-1", start: 1, end: 1)], refresh: { refreshed.append($0) })
        await store.load(page: 8)
        store.approve(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        await store.waitUntilIdle()
        XCTAssertEqual(refreshed, [8])
    }

    func testAPlaceholderRowCannotBeApprovedYet() async throws {
        let (store, transport, _) = try ReviewTestServer.makeStore([])
        await store.load(page: 8)
        let temp = ReviewRow(entryId: "tmp-1", kind: .usul, surah: 2, ayah: 49, startWord: 1)
        store.approve(temp)
        await store.waitUntilIdle()
        XCTAssertNotNil(store.notice)
        XCTAssertFalse(transport.requests.contains { $0.httpMethod == "PATCH" })
    }
}
#endif
