#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat
#if DEBUG
@testable import ReviewEditor
#endif

@MainActor
final class ReviewEditingTests: XCTestCase {
    typealias Spec = ReviewTestServer.Spec

    private func loaded(_ specs: [Spec]) async throws -> (ReviewStore, StubReviewTransport, ReviewTestServer) {
        let made = try ReviewTestServer.makeStore(specs)
        await made.0.load(page: 8)
        return made
    }

    private func patchActions(_ transport: StubReviewTransport) -> [String] {
        transport.requests.indices.compactMap { transport.requests[$0].httpMethod == "PATCH" ? transport.body($0)?["action"] as? String : nil }
    }

    func testDirtyDraftBlocksWordSwitchUntilConfirmed() async throws {
        let (store, _, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1), Spec(id: "r-2", start: 3, end: 3)])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        XCTAssertFalse(store.hasUnsavedEdits)
        store.requestSelect(key: "002:049:003")                    // clean draft: moves at once
        XCTAssertEqual(store.selectedKey, "002:049:003")

        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:003").first))
        store.updateDraft { $0.rulingText = "تعديل" }
        XCTAssertTrue(store.hasUnsavedEdits)
        store.requestSelect(key: "002:049:001")
        XCTAssertEqual(store.selectedKey, "002:049:003")           // blocked
        XCTAssertEqual(store.pendingSelection, "002:049:001")
        store.cancelPendingSelection()
        XCTAssertNil(store.pendingSelection)
        XCTAssertTrue(store.hasUnsavedEdits)

        store.requestSelect(key: "002:049:001")
        store.confirmPendingSelection()
        XCTAssertEqual(store.selectedKey, "002:049:001")
        XCTAssertNil(store.session)                                // the edits were dropped
    }

    func testApproveWithDirtyDraftQueuesSaveThenApprove() async throws {
        let (store, transport, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1, rulingText: "قديم")])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        store.updateDraft { $0.rulingText = "جديد" }
        XCTAssertTrue(store.saveDraft(approve: true))
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.rulingText, "جديد")      // optimistic
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .reviewed)
        await store.waitUntilIdle()
        XCTAssertEqual(patchActions(transport), ["update", "narrators", "status"])
        XCTAssertEqual(store.rows(forKey: "002:049:001").first?.reviewStatus, .reviewed)
        XCTAssertNil(store.session)
    }

    func testApproveWithACleanDraftSendsOnlyTheStatus() async throws {
        let (store, transport, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1)])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        XCTAssertTrue(store.saveDraft(approve: true))
        await store.waitUntilIdle()
        XCTAssertEqual(patchActions(transport), ["status"])
    }

    func testSavingAdvancesToTheNextUnreviewedWord() async throws {
        let (store, _, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1), Spec(id: "r-2", start: 4, end: 4)])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        XCTAssertTrue(store.saveDraft(approve: true))
        XCTAssertEqual(store.selectedKey, "002:049:004")
        await store.waitUntilIdle()
    }

    func testTheLastApprovalClosesTheSheetWithANotice() async throws {
        let (store, _, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1)])
        store.select(key: "002:049:001")
        store.approve(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        XCTAssertNil(store.nextReviewKey(after: "002:049:001"))
        await store.waitUntilIdle()
    }

    func testAnInvalidDraftIsRefusedWithAMessage() async throws {
        let (store, transport, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1)])
        store.select(key: "002:049:001")
        store.startEditing(try XCTUnwrap(store.rows(forKey: "002:049:001").first))
        store.updateDraft { $0.narrators = [] }
        XCTAssertFalse(store.saveDraft(approve: true))
        XCTAssertEqual(store.notice, "يجب اختيار راوٍ واحد على الأقل")
        XCTAssertFalse(transport.requests.contains { $0.httpMethod == "PATCH" })
        XCTAssertNotNil(store.session)                              // nothing is lost
    }

    func testANewDraftStartsFromTheWordWithNoNarrators() async throws {
        let (store, _, _) = try await loaded([])
        store.select(key: "002:049:002")
        store.startNewDraft()
        let session = try XCTUnwrap(store.session)
        XCTAssertNil(session.rowId)
        XCTAssertEqual(session.draft.readingText, "w2")
        XCTAssertEqual(session.draft.kind, .farsh)
        XCTAssertTrue(session.draft.narrators.isEmpty)
        XCTAssertFalse(store.hasUnsavedEdits)
    }

    func testReferenceAddFillsTheDraftAndMarksTheGroupAsInDraft() async throws {
        let (store, _, _) = try await loaded([])
        store.select(key: "002:049:002")
        store.startNewDraft()
        let group = ReferenceGroup(key: "g", readersLabel: "ورش", narratorIds: ["Q01-R02"], performanceText: "نقل",
                                   readingText: "نَقْل", condition: .waqf,
                                   suggestion: ReferenceSuggestion(kind: .usul, categoryCode: "USUL_NAQL"))
        XCTAssertFalse(store.isInDraft(group))
        store.applyReference(group, source: .shamil)
        let draft = try XCTUnwrap(store.session?.draft)
        XCTAssertEqual(draft.narrators.map(\.id), ["Q01-R02"])
        XCTAssertEqual(draft.narrators.first?.action, "نقل")
        XCTAssertEqual(draft.readingText, "نَقْل")                    // the pre-filled Hafs word is replaced on a fresh draft
        XCTAssertEqual(draft.kind, .usul)
        XCTAssertEqual(draft.categoryCode, "USUL_NAQL")
        XCTAssertTrue(draft.appliesWasl == false && draft.appliesWaqf)
        XCTAssertTrue(store.isInDraft(group))
        XCTAssertTrue(store.hasUnsavedEdits)
    }

    func testReferenceDecisionComparesWithTheWordsSavedFaces() async throws {
        let (store, _, _) = try await loaded([Spec(id: "r-1", start: 1, end: 1, status: "reviewed", narrators: ["Q06-R01"])])
        store.select(key: "002:049:001")
        let covered = ReferenceGroup(key: "a", readersLabel: "x", narratorIds: ["Q06-R01"], performanceText: "")
        let missing = ReferenceGroup(key: "b", readersLabel: "y", narratorIds: ["Q01-R02"], performanceText: "")
        XCTAssertEqual(store.decision(for: covered).status, .matched)
        XCTAssertEqual(store.decision(for: missing).status, .missing)
    }
}
#endif
