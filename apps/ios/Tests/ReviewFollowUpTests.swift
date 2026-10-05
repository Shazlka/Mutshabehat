#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat

/// Fixes from the final review: wasl/waqf of suggestions, a dirty draft across pages, and two-word faces.
@MainActor
final class ReviewFollowUpTests: XCTestCase {
    private let waqfOnlySuggestion = #"[{"key":"exact-9","tier":"exact","support":2,"sourceEntryId":"source","sources":["2:25:28"],"config":{"kind":"usul","categoryCode":"USUL_NAQL","narrators":[{"id":"Q01-R02","nameAr":"ورش عن نافع","wajhOrder":1}],"appliesWasl":false,"appliesWaqf":true}}]"#

    func testSuggestionKeepsNonDefaultWaslThroughAFollowUpUpdate() async throws {
        let (store, _, server) = try ReviewTestServer.makeStore([])
        server.bulkResponses = ["suggest": waqfOnlySuggestion]
        await store.load(page: 8)
        store.select(key: "002:049:001")
        await store.suggestionsTask?.value
        store.addSuggestion(try XCTUnwrap(store.suggestions.first))
        await store.waitUntilIdle()
        XCTAssertEqual(server.created.count, 1)
        XCTAssertTrue(server.actions.contains("update"), "wasl/waqf are stored by an update after the create")
        XCTAssertFalse(server.actions.contains("status"))
    }

    func testLoadingAnotherPageDropsADirtyDraftAndPendingMoves() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([.init(id: "r-1", start: 1, end: 1)])
        await store.load(page: 8)
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        store.updateDraft { $0.rulingText = "تعديل" }
        store.requestPage(9)                                   // waits for a confirmation
        XCTAssertTrue(store.hasPendingConfirmation)
        await store.load(page: 9)                              // e.g. opened from the home screen instead
        XCTAssertNil(store.session)
        XCTAssertFalse(store.hasUnsavedEdits)
        XCTAssertFalse(store.hasPendingConfirmation)
        store.requestSelect(key: nil)                          // nothing is frozen any more
        XCTAssertNil(store.selectedKey)
    }

    func testLinkingTheNextWordMakesATwoWordNewFace() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([])
        await store.load(page: 8)
        store.tapWord("002:049:001")
        store.linkingNext = true
        store.tapWord("002:049:002")
        XCTAssertEqual(store.selectedKey, "002:049:001")
        XCTAssertEqual(store.spanEndKey, "002:049:002")
        XCTAssertFalse(store.linkingNext)                       // a one-shot, like the web's Ctrl-click
        store.startNewDraft()
        let entry = try XCTUnwrap(store.session?.newEntry)
        XCTAssertEqual(entry.startWord, 1)
        XCTAssertEqual(entry.endWord, 2)
        store.tapWord("002:049:003")                            // an ordinary tap ends the span
        XCTAssertNil(store.spanEndKey)
        XCTAssertEqual(store.selectedKey, "002:049:003")
    }

    func testLinkingAfterOpeningACleanNewDraftUpdatesItsSpan() async throws {
        let (store, _, _) = try ReviewTestServer.makeStore([])
        await store.load(page: 8)
        store.tapWord("002:049:001")
        store.startNewDraft()
        XCTAssertEqual(store.session?.newEntry?.endWord, 1)
        store.linkingNext = true
        store.tapWord("002:049:002")
        XCTAssertEqual(store.session?.newEntry?.endWord, 2)
        XCTAssertEqual(store.session?.newEntry?.startWord, 1)
    }
}
#endif
