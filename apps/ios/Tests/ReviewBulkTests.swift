#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat
#if DEBUG
@testable import ReviewEditor
#endif

@MainActor
final class ReviewBulkTests: XCTestCase {
    private let suggestionJSON = #"[{"key":"exact-1","tier":"exact","support":2,"sourceEntryId":"source","sources":["2:25:28"],"config":{"kind":"farsh","readingText":"قراءة","narrators":[{"id":"Q01-R02","nameAr":"ورش عن نافع","action":"أداء","wajhOrder":2,"wajhNote":"الخلاف"}]}}]"#
    private let matchesJSON = #"[{"entryId":"a","version":"v1","surah":2,"ayah":25,"startWord":28,"locationId":"la","kind":"usul","categoryCode":"USUL_TAHQIQ","reviewStatus":"reviewed","narrators":[]},{"entryId":"b","version":"v1","surah":2,"ayah":25,"startWord":28,"kind":"usul","categoryCode":"USUL_NAQL","reviewStatus":"reviewed","narrators":[]},{"entryId":"c","version":"v1","surah":2,"ayah":25,"startWord":28,"kind":"farsh","reviewStatus":"reviewed","narrators":[]}]"#
    private let occurrencesJSON = #"[{"surah":2,"ayah":49,"word":1,"page":8,"canonicalKey":"002:049:001","text":"w1","status":"exists","existingEntryId":"r"},{"surah":2,"ayah":49,"word":2,"page":8,"canonicalKey":"002:049:002","text":"w2","status":"add"},{"surah":2,"ayah":49,"word":3,"page":8,"canonicalKey":"002:049:003","text":"w3","status":"add"}]"#
    private let resultJSON = #"{"sourceEntryId":"r","added":[{"entryId":"new","surah":2,"ayah":49,"word":2}],"skipped":[{"surah":2,"ayah":49,"word":3,"existingEntryId":"other"}],"errors":[{"surah":2,"ayah":49,"word":4,"message":"تعذر الحفظ"}]}"#

    private func setup(_ specs: [ReviewTestServer.Spec] = []) async throws -> (ReviewStore, StubReviewTransport, ReviewTestServer) {
        let (store, transport, server) = try ReviewTestServer.makeStore(specs)
        server.bulkResponses = ["suggest": suggestionJSON, "findSameWord": matchesJSON,
                                "findOccurrences": occurrencesJSON, "bulkApply": resultJSON,
                                "copyEntry": #"{"entryId":"copy","version":"v1","kind":"usul","surah":2,"ayah":49,"startWord":1,"endAyah":49,"endWord":1,"startKey":"002:049:001","endKey":"002:049:001","page":8,"reviewStatus":"unreviewed","narrators":[]}"#]
        await store.load(page: 8)
        store.select(key: "002:049:001")
        return (store, transport, server)
    }

    func testSuggestionAddCreatesAnUnreviewedEntry() async throws {
        let (store, _, server) = try await setup()
        await store.suggestionsTask?.value
        let suggestion = try XCTUnwrap(store.suggestions.first)
        store.addSuggestion(suggestion)
        XCTAssertTrue(store.suggestions.isEmpty)
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .unreviewed)
        await store.waitUntilIdle()
        XCTAssertEqual(server.created.count, 1)
        XCTAssertEqual(server.created.first?["kind"] as? String, "farsh")
        XCTAssertFalse(server.actions.contains("status"))
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .unreviewed)
        store.addSuggestion(suggestion)
        await store.waitUntilIdle()
        XCTAssertEqual(server.created.count, 1)
    }

    func testSuggestionIsDisabledWhenANarratorAlreadyHasAFarshWajh() async throws {
        let (store, _, server) = try await setup([.init(id: "r", start: 1, end: 1, kind: "farsh", narrators: ["Q01-R02"])])
        await store.suggestionsTask?.value
        let suggestion = try XCTUnwrap(store.suggestions.first)
        XCTAssertTrue(SuggestionLogic.isBlocked(suggestion, wordRows: store.rows(forKey: "002:049:001")))
        store.addSuggestion(suggestion)
        await store.waitUntilIdle()
        XCTAssertTrue(server.created.isEmpty)
    }

    func testSuggestionsAreClearedWhileASpanIsSelected() async throws {
        let (store, transport, _) = try await setup()
        await store.suggestionsTask?.value
        XCTAssertEqual(store.suggestions.count, 1)
        let count = transport.requests.count
        store.spanEndKey = "002:049:002"
        XCTAssertTrue(store.suggestions.isEmpty)
        store.loadSuggestions()
        await store.suggestionsTask?.value
        XCTAssertEqual(transport.requests.count, count)
    }

    func testSuggestionSelectionDebouncesAndCancelsPreviousWord() async throws {
        let (store, transport, _) = try await setup()
        store.select(key: "002:049:002")
        store.select(key: "002:049:003")
        await store.suggestionsTask?.value
        let bodies = transport.requests.indices.compactMap { transport.body($0) }.filter { $0["action"] as? String == "suggest" }
        XCTAssertEqual(bodies.count, 1)
        XCTAssertEqual(bodies.first?["word"] as? Int, 3)
    }

    func testCopyRequiresPreviewConfirmation() async throws {
        let (store, _, server) = try await setup()
        await store.loadSameWord(verifiedOnly: false)
        await store.confirmCopy()
        XCTAssertFalse(server.actions.contains("copyEntry"))
        store.previewMatch = try XCTUnwrap(store.sameWordMatches.first)
        XCTAssertFalse(server.actions.contains("copyEntry"))
        await store.confirmCopy()
        XCTAssertEqual(server.actions.filter { $0 == "copyEntry" }.count, 1)
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.entryId, "copy")
        XCTAssertNil(store.previewMatch)
        await store.confirmCopy()
        XCTAssertEqual(server.actions.filter { $0 == "copyEntry" }.count, 1)
    }

    func testCopyPreviewIsInvalidatedBySelectionChange() async throws {
        let (store, _, server) = try await setup()
        await store.loadSameWord(verifiedOnly: false)
        store.previewMatch = store.sameWordMatches.first
        store.select(key: "002:049:002")
        await store.confirmCopy()
        XCTAssertFalse(server.actions.contains("copyEntry"))
    }

    func testVerifiedSameCategoryFilter() async throws {
        let (store, _, _) = try await setup([.init(id: "r", start: 1, end: 1)])
        await store.loadSameWord(verifiedOnly: true)
        XCTAssertEqual(store.visibleSameWordMatches.map(\.entryId), ["a"])
        store.sameWordVerifiedOnly = false
        XCTAssertEqual(store.visibleSameWordMatches.count, 3)
        store.startNewDraft()
        store.updateDraft { $0.kind = .usul; $0.categoryCode = nil }
        await store.loadSameWord(verifiedOnly: true)
        XCTAssertEqual(store.visibleSameWordMatches.map(\.entryId), ["a", "b"])
    }

    func testApplyAllSendsOnlySelectedAddTargets() async throws {
        let (store, transport, _) = try await setup([.init(id: "r", start: 1, end: 1)])
        await store.loadOccurrences(for: try XCTUnwrap(store.page?.rows.first))
        XCTAssertEqual(store.selectedOccurrences, ["002:049:002", "002:049:003"])
        store.selectedOccurrences = ["002:049:001", "002:049:002", "unknown"]
        await store.applyToSelected(sourceEntryId: "r")
        let bodies = transport.requests.indices.compactMap { transport.body($0) }
        let body = try XCTUnwrap(bodies.first { $0["action"] as? String == "bulkApply" })
        let targets = try XCTUnwrap(body["targets"] as? [[String: Int]])
        XCTAssertEqual(targets, [["surah": 2, "ayah": 49, "word": 2]])
        XCTAssertTrue(transport.requests.last?.url?.query?.contains("page=8") == true)
    }

    func testApplyAllReportsSkippedAndErrors() async throws {
        let (store, _, _) = try await setup([.init(id: "r", start: 1, end: 1)])
        await store.loadOccurrences(for: try XCTUnwrap(store.page?.rows.first))
        await store.applyToSelected(sourceEntryId: "r")
        XCTAssertEqual(store.lastBulkResult?.added.count, 1)
        XCTAssertEqual(store.lastBulkResult?.skipped.count, 1)
        XCTAssertEqual(store.lastBulkResult?.errors.first?.message, "تعذر الحفظ")
    }

    func testCopyAndBulkFailuresPreservePreviewAndReportNotice() async throws {
        let (store, _, server) = try await setup([.init(id: "r", start: 1, end: 1)])
        await store.loadSameWord(verifiedOnly: false)
        store.previewMatch = store.sameWordMatches.first
        await store.loadOccurrences(for: try XCTUnwrap(store.page?.rows.first))
        server.bulkStatus = 500
        await store.confirmCopy()
        XCTAssertNotNil(store.previewMatch)
        XCTAssertNotNil(store.notice)
        await store.applyToSelected(sourceEntryId: "r")
        XCTAssertNil(store.lastBulkResult)
        XCTAssertNotNil(store.notice)
    }
}
#endif
