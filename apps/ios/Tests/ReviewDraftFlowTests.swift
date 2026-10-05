#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat

@MainActor
final class ReviewDraftFlowTests: XCTestCase {
    typealias Spec = ReviewTestServer.Spec

    private func loaded(_ specs: [Spec], postStatus: Int = 200) async throws -> (ReviewStore, StubReviewTransport, ReviewTestServer) {
        let made = try ReviewTestServer.makeStore(specs, postStatus: postStatus)
        await made.0.load(page: 8)
        return made
    }

    private func writes(_ transport: StubReviewTransport) -> [String] {
        transport.requests.indices.compactMap { index in
            transport.requests[index].httpMethod == "GET" ? nil : transport.body(index)?["action"] as? String
        }
    }

    func testANewFarshDraftCreatesAnEntryWithItsNarrators() async throws {
        let (store, _, server) = try await loaded([])
        store.select(key: "002:049:002")
        store.startNewDraft()
        store.updateDraft { $0.narrators = [NarratorInput(id: "Q01-R02", action: "نقل", wajhOrder: 1)]; $0.readingText = " قراءة " }
        XCTAssertTrue(store.saveDraft(approve: false))
        // Optimistic: a placeholder row appears at once.
        XCTAssertEqual(store.rows(forKey: "002:049:002").count, 1)
        XCTAssertTrue(ReviewPageEditing.isPlaceholder(try XCTUnwrap(store.rows(forKey: "002:049:002").first)))
        await store.waitUntilIdle()
        let entry = try XCTUnwrap(server.created.first)
        XCTAssertEqual(entry["kind"] as? String, "farsh")
        XCTAssertEqual(entry["readingText"] as? String, "قراءة")
        XCTAssertEqual(entry["startWord"] as? Int, 2)
        XCTAssertEqual((entry["narrators"] as? [[String: Any]])?.first?["id"] as? String, "Q01-R02")
        XCTAssertFalse(store.rows(forKey: "002:049:002").contains { ReviewPageEditing.isPlaceholder($0) })
    }

    func testMultiCategorySaveCreatesASiblingForEachExtraBab() async throws {
        let (store, transport, server) = try await loaded([Spec(id: "r-1", start: 1, end: 1)])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        store.updateDraft { draft in
            ReviewDraft.toggleCategory("USUL_NAQL", in: &draft)   // becomes an extra next to USUL_TAHQIQ
        }
        XCTAssertEqual(store.session?.draft.extraCategoryCodes, ["USUL_NAQL"])
        XCTAssertTrue(store.saveDraft(approve: false))
        await store.waitUntilIdle()
        // The primary save and the sibling create are different chains, so they may interleave.
        XCTAssertEqual(writes(transport).sorted(), ["create", "narrators", "update"])
        XCTAssertEqual(server.created.first?["categoryCode"] as? String, "USUL_NAQL")
        XCTAssertEqual(server.created.first?["kind"] as? String, "usul")
    }

    func testHafsAsAFirstWajhIsRefusedBeforeAnyRequest() async throws {
        let (store, transport, _) = try await loaded([])
        store.select(key: "002:049:002")
        store.startNewDraft()
        store.updateDraft { $0.narrators = [NarratorInput(id: CanonicalReaders.hafsId, wajhOrder: 1)] }
        XCTAssertFalse(store.saveDraft(approve: false))
        XCTAssertEqual(store.notice, ReviewErrorCode.ruleD8.defaultMessageAr)
        XCTAssertTrue(writes(transport).isEmpty)
    }

    func testAFailedCreateGivesTheDraftBack() async throws {
        let (store, _, _) = try await loaded([], postStatus: 500)
        store.select(key: "002:049:002")
        store.startNewDraft()
        store.updateDraft { $0.narrators = [NarratorInput(id: "Q01-R02", wajhOrder: 1)] }
        XCTAssertTrue(store.saveDraft(approve: false))
        XCTAssertNil(store.session)                                   // closed optimistically
        await store.waitUntilIdle()
        XCTAssertTrue(store.rows(forKey: "002:049:002").isEmpty)      // the placeholder is gone
        let draft = try XCTUnwrap(store.session?.draft)               // inputs are back
        XCTAssertEqual(draft.narrators.map(\.id), ["Q01-R02"])
        XCTAssertEqual(store.failures.count, 1)
    }

    func testTheDraftIsNotGivenBackWhenTheReviewerMovedOn() async throws {
        let (store, _, _) = try await loaded([], postStatus: 500)
        store.select(key: "002:049:002")
        store.startNewDraft()
        store.updateDraft { $0.narrators = [NarratorInput(id: "Q01-R02", wajhOrder: 1)] }
        XCTAssertTrue(store.saveDraft(approve: false))
        store.select(key: "002:049:004")
        await store.waitUntilIdle()
        XCTAssertNil(store.session)
    }

    func testBindingsReadAndWriteTheDraft() async throws {
        let (store, _, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1)])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        let reading = store.draftBinding(\.readingText, default: "")
        reading.wrappedValue = "جديد"
        XCTAssertEqual(store.session?.draft.readingText, "جديد")
        XCTAssertTrue(store.hasUnsavedEdits)
    }
}
#endif
