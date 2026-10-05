#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat

@MainActor
final class ReviewStoreTests: XCTestCase {
    struct Spec: Sendable { var id: String; var start: Int; var end: Int; var status: String = "unreviewed"; var version = "v1" }

    /// A stateful fake of the review server: PATCH status changes the row and bumps its version.
    final class Server: @unchecked Sendable {
        private let lock = NSLock()
        private var specs: [Spec]
        var patchStatus = 200
        init(_ specs: [Spec]) { self.specs = specs }

        private func rowJSON(_ r: Spec) -> String {
            """
            {"entryId":"\(r.id)","locationId":"l-\(r.id)","version":"\(r.version)","kind":"usul","categoryCode":"USUL_TAHQIQ","categoryNameAr":"تحقيق",
             "surah":2,"ayah":49,"startWord":\(r.start),"endAyah":49,"endWord":\(r.end),"startKey":"002:049:00\(r.start)","endKey":"002:049:00\(r.end)",
             "page":8,"reviewStatus":"\(r.status)","narrators":[{"id":"Q06-R01","nameAr":"خلف","wajhOrder":1}],"flags":[]}
            """
        }

        func page() -> String {
            let words = (1...4).map {
                #"{"key":"002:049:00\#($0)","surah":2,"ayah":49,"word":\#($0),"line":1,"text":"w\#($0)"}"#
            }.joined(separator: ",")
            let rows = lock.withLock { specs.map(rowJSON).joined(separator: ",") }
            return """
            {"page":8,"words":[\(words)],"rows":[\(rows)],
             "stats":{"total":0,"unreviewed":0,"reviewed":0,"flagged":0,"deleted":0},
             "narrators":[{"id":"Q06-R01","code":"HAM-KHL","nameAr":"خلف","parentId":"Q06","type":"narrator","color":null}],
             "categories":[{"code":"USUL_TAHQIQ","nameAr":"تحقيق"}],"variantTypes":["vowel"]}
            """
        }

        func handle(_ request: URLRequest) -> (status: Int, body: String) {
            if request.httpMethod == "PATCH" {
                if patchStatus != 200 { return (patchStatus, #"{"error":"unavailable"}"#) }
                let body = (try? JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any]) ?? [:]
                return lock.withLock {
                    guard let index = specs.firstIndex(where: { $0.id == body["entryId"] as? String }) else { return (404, #"{"error":"not_found"}"#) }
                    if let status = body["status"] as? String { specs[index].status = status }
                    specs[index].version = "v2"
                    return (200, rowJSON(specs[index]))
                }
            }
            if request.url?.query?.contains("overview") == true {
                return (200, #"{"isEditor":true,"pages":[{"page":8,"total":3,"flagged":0,"reviewed":1,"unreviewed":2},{"page":9,"total":3,"flagged":1,"reviewed":1,"unreviewed":1}]}"#)
            }
            return (200, page())
        }
    }

    private func makeStore(_ specs: [Spec], patchStatus: Int = 200,
                           refresh: @escaping (Int) -> Void = { _ in }) throws -> (ReviewStore, StubReviewTransport) {
        let server = Server(specs)
        server.patchStatus = patchStatus
        let transport = StubReviewTransport { server.handle($0) }
        let library = try MushafLibrary()
        let api = ReviewAPI(baseURL: URL(string: "https://example.test")!, transport: transport, deviceId: "dev")
        let store = ReviewStore(api: api, mushafPage: { library.page($0) }, liveRefresh: refresh)
        return (store, transport)
    }

    func testTwoWordFaceShowsOnBothWords() async throws {
        let (store, _) = try makeStore([Spec(id: "r-1", start: 2, end: 3)])
        await store.load(page: 8)
        XCTAssertEqual(store.rows(forKey: "002:049:002").map(\.entryId), ["r-1"])
        XCTAssertEqual(store.rows(forKey: "002:049:003").map(\.entryId), ["r-1"])
        XCTAssertTrue(store.rows(forKey: "002:049:001").isEmpty)
        XCTAssertTrue(store.rows(forKey: "002:049:004").isEmpty)
    }

    func testStatusPriorityFlaggedWins() async throws {
        let (store, _) = try makeStore([
            Spec(id: "r-1", start: 1, end: 3, status: "reviewed"),
            Spec(id: "r-2", start: 2, end: 2),
            Spec(id: "r-3", start: 3, end: 3, status: "flagged"),
        ])
        await store.load(page: 8)
        XCTAssertEqual(store.status(forKey: "002:049:001"), .reviewed)
        XCTAssertEqual(store.status(forKey: "002:049:002"), .unreviewed)
        XCTAssertEqual(store.status(forKey: "002:049:003"), .flagged)
        XCTAssertNil(store.status(forKey: "002:049:004"))
    }

    func testApproveSendsStatusAndReplacesRowWithServerVersion() async throws {
        let (store, transport) = try makeStore([Spec(id: "r-1", start: 1, end: 1)])
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
        let (store, _) = try makeStore([Spec(id: "r-1", start: 1, end: 1)], patchStatus: 500)
        await store.load(page: 8)
        store.approve(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        await store.waitUntilIdle()
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .unreviewed)   // server truth restored
        if case .failed = store.saveStatus {} else { XCTFail("expected failed, got \(store.saveStatus)") }
        XCTAssertEqual(store.failures.count, 1)
    }

    func testNextUnreviewedSkipsReviewedAndWrapsToNextPage() async throws {
        let (store, _) = try makeStore([
            Spec(id: "r-1", start: 1, end: 1, status: "reviewed"),
            Spec(id: "r-2", start: 3, end: 3),
        ])
        await store.load(page: 8)
        XCTAssertEqual(store.nextReviewKey(after: nil), "002:049:003")
        XCTAssertNil(store.nextReviewKey(after: "002:049:003"))
        XCTAssertEqual(store.nextPageNeedingReview(), 9)      // page 8 itself is checked after the end, page 9 has unreviewed
    }

    func testSuccessfulSaveRefreshesTheLiveOverlayOnce() async throws {
        var refreshed: [Int] = []
        let (store, _) = try makeStore([Spec(id: "r-1", start: 1, end: 1)], refresh: { refreshed.append($0) })
        await store.load(page: 8)
        store.approve(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        await store.waitUntilIdle()
        XCTAssertEqual(refreshed, [8])
    }

    func testAPlaceholderRowCannotBeApprovedYet() async throws {
        let (store, transport) = try makeStore([])
        await store.load(page: 8)
        let temp = ReviewRow(entryId: "tmp-1", kind: .usul, surah: 2, ayah: 49, startWord: 1)
        store.approve(temp)
        await store.waitUntilIdle()
        XCTAssertNotNil(store.notice)
        XCTAssertFalse(transport.requests.contains { $0.httpMethod == "PATCH" })
    }
}
#endif
