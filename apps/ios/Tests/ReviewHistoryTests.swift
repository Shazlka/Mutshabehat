#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat

@MainActor
final class ReviewHistoryTests: XCTestCase {
    private func transactions() throws -> [HistoryTransaction] {
        try JSONDecoder().decode([HistoryTransaction].self, from: Data(#"[{"txid":81,"at":"2026-10-05T10:00:00Z","undone":false,"changes":[{"table":"qiraat_entries","op":"INSERT"}]}]"#.utf8))
    }

    func testUndoCallsApiThenReloadsPage() async throws {
        var refreshed: [Int] = []
        let (store, transport, server) = try ReviewTestServer.makeStore([], refresh: { refreshed.append($0) })
        server.historyTransactions = try transactions()
        await store.load(page: 8)
        await store.loadHistory()
        let tx = try XCTUnwrap(store.history.first)
        let start = transport.requests.count
        await store.undo(tx)
        let requests = Array(transport.requests.dropFirst(start))
        XCTAssertEqual(requests.count, 3)
        XCTAssertEqual(requests.first?.httpMethod, "POST")
        XCTAssertEqual(transport.body(start)?["action"] as? String, "undo")
        XCTAssertEqual(transport.body(start)?["txid"] as? Int, 81)
        XCTAssertTrue(requests.dropFirst().first?.url?.query?.contains("page=8") == true)
        XCTAssertFalse(requests.dropFirst().first?.url?.query?.contains("history=1") == true)
        XCTAssertTrue(requests.last?.url?.query?.contains("history=1") == true)
        XCTAssertEqual(store.history.first?.undone, true)
        XCTAssertEqual(refreshed, [8])
    }

    func testUndoConflictShowsMessageAndKeepsList() async throws {
        try await refusedUndo(code: .undoConflict)
    }

    func testUndoRefusedShowsMessageAndKeepsList() async throws {
        try await refusedUndo(code: .undoRefused)
    }

    private func refusedUndo(code: ReviewErrorCode) async throws {
        var refreshed: [Int] = []
        let (store, transport, server) = try ReviewTestServer.makeStore([], refresh: { refreshed.append($0) })
        server.historyTransactions = try transactions()
        server.undoError = code
        await store.loadHistory()
        let before = store.history
        let start = transport.requests.count
        await store.undo(try XCTUnwrap(before.first))
        XCTAssertEqual(store.history, before)
        XCTAssertEqual(store.notice, code.defaultMessageAr)
        XCTAssertEqual(transport.requests.count, start + 1)
        XCTAssertTrue(refreshed.isEmpty)
    }

    func testHistoryLoadFailureIsReported() async throws {
        let (store, _, server) = try ReviewTestServer.makeStore([])
        server.historyTransactions = try transactions()
        await store.loadHistory()
        let before = store.history
        server.historyStatus = 500
        await store.loadHistory()
        XCTAssertEqual(store.historyState, .failed(ReviewErrorCode.unavailable.defaultMessageAr))
        XCTAssertEqual(store.history, before)
    }

    func testAlreadyUndoneDoesNotCallApi() async throws {
        let (store, transport, server) = try ReviewTestServer.makeStore([])
        server.historyTransactions = try transactions()
        await store.loadHistory()
        await store.undo(try XCTUnwrap(store.history.first))
        let count = transport.requests.count
        await store.undo(try XCTUnwrap(store.history.first))
        XCTAssertEqual(transport.requests.count, count)
    }
}
#endif
