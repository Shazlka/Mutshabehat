import Foundation
import Testing
@testable import MushafCore

@Suite struct ReviewDraftTests {
    // MARK: Helpers

    private func row(kind: String = "usul", category: String? = "USUL_NAQL", status: String = "unreviewed",
                     narrators: [(String, Int, String?)] = [("Q01-R02", 1, nil)], reading: String? = nil,
                     ruling: String? = nil, hamzah: String = "null", wasl: Bool = true, waqf: Bool = true) throws -> ReviewRow {
        let list = narrators.map { id, order, note in
            #"{"id":"\#(id)","nameAr":"x","wajhOrder":\#(order),"wajhNote":\#(note.map { "\"\($0)\"" } ?? "null"),"action":"أداء"}"#
        }.joined(separator: ",")
        return try JSONDecoder().decode(ReviewRow.self, from: Data("""
        {"entryId":"r-1","locationId":"l-1","version":"v1","kind":"\(kind)",
         "categoryCode":\(category.map { "\"\($0)\"" } ?? "null"),"surah":2,"ayah":49,"startWord":3,"endAyah":49,"endWord":3,
         "hafsText":"كلمة","readingText":\(reading.map { "\"\($0)\"" } ?? "null"),
         "rulingText":\(ruling.map { "\"\($0)\"" } ?? "null"),"variantType":null,"reviewStatus":"\(status)",
         "appliesWasl":\(wasl),"appliesWaqf":\(waqf),"hamzahDetail":\(hamzah),"narrators":[\(list)],"flags":[]}
        """.utf8))
    }

    private func newEntry() -> CreateEntryInput {
        CreateEntryInput(surah: 2, ayah: 49, startWord: 3, endAyah: 49, endWord: 3, kind: .farsh,
                         readingText: "كلمة", uthmaniText: "كلمة", narrators: [])
    }

    // MARK: Validation

    @Test func validateRejectsFarshWithoutReadingText() {
        var f = ReviewDraft.fields(from: newEntry())
        f.narrators = [NarratorInput(id: "Q01-R01")]
        f.readingText = "  "
        #expect(ReviewDraft.validate(f)?.messageAr == "نص القراءة مطلوب لفرش الحروف")
    }

    @Test func validateRequiresCategoryForUsulAndANarrator() {
        var f = ReviewDraft.fields(from: newEntry())
        f.kind = .usul
        f.narrators = [NarratorInput(id: "Q01-R01")]
        #expect(ReviewDraft.validate(f)?.messageAr == "الباب / القاعدة مطلوبة لأصول القراءات")
        f.categoryCode = "USUL_NAQL"
        #expect(ReviewDraft.validate(f) == nil)
        f.narrators = []
        #expect(ReviewDraft.validate(f)?.messageAr == "يجب اختيار راوٍ واحد على الأقل")
    }

    @Test func validateRequiresHafsAsSecondWajhWithNote() {
        var f = ReviewDraft.fields(from: newEntry())
        f.kind = .usul
        f.categoryCode = "USUL_NAQL"
        f.narrators = [NarratorInput(id: CanonicalReaders.hafsId, wajhOrder: 1, wajhNote: "ن")]
        #expect(ReviewDraft.validate(f)?.messageAr == ReviewErrorCode.ruleD8.defaultMessageAr)
        f.narrators = [NarratorInput(id: CanonicalReaders.hafsId, wajhOrder: 2, wajhNote: " ")]
        #expect(ReviewDraft.validate(f)?.messageAr == ReviewErrorCode.ruleD8.defaultMessageAr)
        f.narrators = [NarratorInput(id: CanonicalReaders.hafsId, wajhOrder: 2, wajhNote: "وجه ثانٍ")]
        #expect(ReviewDraft.validate(f) == nil)
    }

    @Test func waslAndWaqfCannotBothBeOff() {
        var f = ReviewDraft.fields(from: newEntry())
        f.narrators = [NarratorInput(id: "Q01-R01")]
        f.appliesWasl = false
        f.appliesWaqf = false
        #expect(ReviewDraft.validate(f)?.messageAr == ReviewErrorCode.ruleWaslWaqf.defaultMessageAr)
    }

    // MARK: Categories and dirty state

    @Test func hamzahCategoryReplacesSelectionAndOthersStack() {
        var f = ReviewDraft.fields(from: newEntry())
        ReviewDraft.toggleCategory("USUL_NAQL", in: &f)
        ReviewDraft.toggleCategory("USUL_SAKT", in: &f)
        #expect(f.categoryCode == "USUL_NAQL")
        #expect(f.extraCategoryCodes == ["USUL_SAKT"])
        #expect(ReviewDraft.selectedCategoryCodes(f) == ["USUL_NAQL", "USUL_SAKT"])
        ReviewDraft.toggleCategory("TAGHYIR_HAMZ", in: &f)
        #expect(f.categoryCode == "TAGHYIR_HAMZ")
        #expect(f.extraCategoryCodes.isEmpty)
        ReviewDraft.toggleCategory("IMALAH_TAQLIL", in: &f)
        #expect(f.categoryCode == "IMALAH_TAQLIL")
    }

    @Test func untickingThePrimaryPromotesTheNextOne() {
        var f = ReviewDraft.fields(from: newEntry())
        for code in ["USUL_NAQL", "USUL_SAKT", "USUL_MADD"] { ReviewDraft.toggleCategory(code, in: &f) }
        ReviewDraft.toggleCategory("USUL_NAQL", in: &f)
        #expect(f.categoryCode == "USUL_SAKT")
        #expect(f.extraCategoryCodes == ["USUL_MADD"])
        ReviewDraft.toggleCategory("USUL_MADD", in: &f)
        #expect(f.extraCategoryCodes.isEmpty)
    }

    @Test func unchangedDraftIsNotDirty() throws {
        let original = ReviewDraft.fields(from: try row())
        #expect(!ReviewDraft.isDirty(original: original, current: original))
        var changed = original
        changed.readingText = "x"
        #expect(ReviewDraft.isDirty(original: original, current: changed))
        var withExtra = original
        withExtra.extraCategoryCodes = ["USUL_SAKT"]
        #expect(ReviewDraft.isDirty(original: original, current: withExtra))
    }

    @Test func fieldsFromRowFallBackToHafsTextAndNormalizeVariantType() throws {
        let f = ReviewDraft.fields(from: try row(kind: "farsh", category: nil))
        #expect(f.readingText == "كلمة")
        #expect(f.variantType == nil)
        #expect(ReviewDraft.fields(from: newEntry()).variantType == "vowel")
    }

    // MARK: Save plans

    @Test func existingRowPlanUpdatesThenNarratorsThenApproves() throws {
        let r = try row(reading: "نقل", ruling: "حكم")
        let original = ReviewDraft.fields(from: r)
        var draft = original
        draft.rulingText = "  حكم جديد "
        let plans = ReviewDraft.savePlan(draft: draft, original: original, row: r, newEntry: nil, approve: true)
        #expect(plans.count == 1)
        #expect(plans[0].chainKey == "entry:r-1")
        guard case .update(let fields) = plans[0].steps[0] else { Issue.record("expected update first"); return }
        #expect(fields.kind == .set(.usul))
        #expect(fields.categoryCode == .set("USUL_NAQL"))
        #expect(fields.rulingText == .set("حكم جديد"))
        #expect(fields.readingText == .set("نقل"))
        #expect(fields.appliesWasl == .set(true))
        #expect(fields.hamzahDetail == .set(nil))
        #expect(plans[0].steps[1] == .setNarrators(draft.narrators))
        #expect(plans[0].steps[2] == .approve)
    }

    @Test func cleanRowPlanIsApproveOnlyOrNothing() throws {
        let r = try row()
        let f = ReviewDraft.fields(from: r)
        #expect(ReviewDraft.savePlan(draft: f, original: f, row: r, newEntry: nil, approve: true).first?.steps == [.approve])
        #expect(ReviewDraft.savePlan(draft: f, original: f, row: r, newEntry: nil, approve: false).isEmpty)
    }

    @Test func farshFieldsCarryVariantTypeDescriptionAndPerformanceNote() throws {
        let r = try row(kind: "farsh", category: nil, reading: "قراءة")
        let original = ReviewDraft.fields(from: r)
        var draft = original
        draft.variantType = "تشكيل"
        draft.description = " وصف "
        draft.performanceNote = ""
        let plan = ReviewDraft.savePlan(draft: draft, original: original, row: r, newEntry: nil, approve: false)
        guard case .update(let fields) = plan[0].steps[0] else { Issue.record("expected update"); return }
        #expect(fields.variantType == .set("vowel"))
        #expect(fields.description == .set("وصف"))
        #expect(fields.performanceNote == .set(nil))
        #expect(fields.categoryCode == .unset)
        #expect(!plan[0].steps.contains(.approve))
    }

    @Test func savePlanCreatesSiblingPerExtraCategory() throws {
        let r = try row(reading: "نقل")
        let original = ReviewDraft.fields(from: r)
        var draft = original
        draft.extraCategoryCodes = ["USUL_SAKT", "USUL_MADD"]
        let plans = ReviewDraft.savePlan(draft: draft, original: original, row: r, newEntry: nil, approve: false)
        #expect(plans.count == 3)
        let siblings = plans.dropFirst().compactMap { plan -> CreateEntryInput? in
            if case .create(let entry) = plan.steps[0] { entry } else { nil }
        }
        #expect(siblings.map(\.categoryCode) == ["USUL_SAKT", "USUL_MADD"])
        #expect(siblings.allSatisfy { $0.kind == .usul && $0.hamzahDetail == nil && $0.startWord == 3 && $0.ayah == 49 })
        #expect(siblings.allSatisfy { $0.narrators == draft.narrators })
    }

    @Test func newEntryPlanCreatesThenUpdatesNonDefaultsThenApproves() {
        var draft = ReviewDraft.fields(from: newEntry())
        draft.narrators = [NarratorInput(id: "Q01-R01", wajhOrder: 1)]
        draft.appliesWaqf = false
        let plans = ReviewDraft.savePlan(draft: draft, original: ReviewDraft.fields(from: newEntry()),
                                         row: nil, newEntry: newEntry(), approve: true)
        #expect(plans.count == 1)
        #expect(plans[0].chainKey == "loc:2:49:3")
        guard case .create(let entry) = plans[0].steps[0] else { Issue.record("expected create"); return }
        #expect(entry.kind == .farsh && entry.variantType == "vowel" && entry.readingText == "كلمة")
        #expect(entry.narrators == draft.narrators)
        guard case .update(let fields) = plans[0].steps[1] else { Issue.record("expected update"); return }
        #expect(fields.appliesWasl == .set(true) && fields.appliesWaqf == .set(false))
        #expect(plans[0].steps[2] == .approve)
    }

    @Test func newEntryWithDefaultsNeedsNoFollowUpUpdate() {
        var draft = ReviewDraft.fields(from: newEntry())
        draft.narrators = [NarratorInput(id: "Q01-R01")]
        let plans = ReviewDraft.savePlan(draft: draft, original: ReviewDraft.fields(from: newEntry()),
                                         row: nil, newEntry: newEntry(), approve: false)
        #expect(plans[0].steps.count == 1)
    }

    @Test func newUsulEntryWithHamzahKeepsDetailAndSiblingsDropIt() {
        var draft = ReviewDraft.fields(from: newEntry())
        draft.kind = .usul
        draft.categoryCode = "TAGHYIR_HAMZ"
        draft.narrators = [NarratorInput(id: "Q01-R01")]
        draft.hamzahDetail = .single(treatment: .tasheel)
        let plans = ReviewDraft.savePlan(draft: draft, original: ReviewDraft.fields(from: newEntry()),
                                         row: nil, newEntry: newEntry(), approve: false)
        guard case .create(let entry) = plans[0].steps[0] else { Issue.record("expected create"); return }
        #expect(entry.hamzahDetail == .single(treatment: .tasheel))
        #expect(entry.categoryCode == "TAGHYIR_HAMZ" && entry.variantType == nil)
        #expect(plans[0].steps.count == 2)   // the follow-up update carries the hamzah detail
    }

    // MARK: Narrator selection

    @Test func togglingHafsAddsItAsSecondWajhWithNote() {
        let list = NarratorSelection.toggleNarrator([], id: CanonicalReaders.hafsId)
        #expect(list == [NarratorInput(id: CanonicalReaders.hafsId, action: nil, wajhOrder: 2, wajhNote: "وجه ثانٍ لحفص")])
        #expect(NarratorSelection.toggleNarrator(list, id: CanonicalReaders.hafsId).isEmpty)
    }

    @Test func togglingAReaderAddsOrRemovesBothNarrators() {
        let both = NarratorSelection.toggleReader([], readerId: "Q01")
        #expect(both.map(\.id) == ["Q01-R01", "Q01-R02"])
        #expect(NarratorSelection.toggleReader(both, readerId: "Q01").isEmpty)
        let one = NarratorSelection.toggleReader([NarratorInput(id: "Q05-R01", wajhOrder: 1)], readerId: "Q05")
        #expect(one.map(\.id) == ["Q05-R01", "Q05-R02"])
        #expect(one[1].wajhOrder == 2 && one[1].wajhNote == "وجه ثانٍ لحفص")
    }

    @Test func presetsSelectTheExpectedNarrators() {
        #expect(NarratorSelection.select([], preset: .all).count == 20)
        #expect(NarratorSelection.select([], preset: .sabah).count == 14)
        #expect(NarratorSelection.select([], preset: .thalatha).count == 6)
        #expect(NarratorSelection.select([], preset: .kufis).count == 8)
        #expect(NarratorSelection.select([], preset: .madaniyan).map(\.id) == ["Q01-R01", "Q01-R02", "Q08-R01", "Q08-R02"])
        // A preset keeps the faces of narrators it contains and drops the rest.
        let kept = NarratorSelection.select([NarratorInput(id: "Q01-R01", action: "x", wajhOrder: 3), NarratorInput(id: "Q09-R01")],
                                            preset: .madaniyan)
        #expect(kept.first == NarratorInput(id: "Q01-R01", action: "x", wajhOrder: 3))
        #expect(!kept.contains { $0.id == "Q09-R01" })
    }

    @Test func addingAnotherFaceNumbersItAfterTheHighestAndFlagsKhulf() {
        let start = [NarratorInput(id: "Q01-R02", wajhOrder: 1)]
        let more = NarratorSelection.addFace(start, narratorId: "Q01-R02")
        #expect(more.last == NarratorInput(id: "Q01-R02", action: nil, wajhOrder: 2, wajhNote: "بخلف عنه"))
        let reader = NarratorSelection.addFaceForReader([], readerId: "Q05")
        #expect(reader.map(\.wajhOrder) == [1, 2])
        #expect(NarratorSelection.removeFace(more, at: 0) == [more[1]])
    }

    // MARK: Golden parity

    private struct DraftGolden: Decodable {
        struct Row: Decodable {
            struct N: Decodable { let id: String; let nameAr: String }
            let entryId: String; let kind: String; let deleted: Bool
            let categoryNameAr: String?; let readingText: String?; let hafsText: String?
            let startKey: String; let endKey: String; let narrators: [N]
        }
        struct Case: Decodable { let rows: [Row]; let summary: String }
        let variantTypes: [[JSONValue]]
        let rowCases: [Case]
    }

    @Test func variantTypeNormalizationMatchesWeb() throws {
        let golden: DraftGolden = try ReviewGolden.load("draft")
        for pair in golden.variantTypes {
            let raw: String? = { if case .string(let s) = pair[0] { s } else { nil } }()
            guard case .string(let expected) = pair[1] else { Issue.record("bad golden"); return }
            #expect(VariantType.normalize(raw) == expected, "raw: \(raw ?? "nil")")
        }
    }

    @Test func facesSummaryMatchesWeb() throws {
        let golden: DraftGolden = try ReviewGolden.load("draft")
        func quoted(_ s: String?) -> String { s.map { "\"" + $0.replacingOccurrences(of: "\"", with: "\\\"") + "\"" } ?? "null" }
        var bad = 0
        for c in golden.rowCases {
            let rows = try c.rows.map { r -> ReviewRow in
                let narrators = r.narrators.map { #"{"id":"\#($0.id)","nameAr":"\#($0.nameAr)","wajhOrder":1}"# }.joined(separator: ",")
                return try JSONDecoder().decode(ReviewRow.self, from: Data("""
                {"entryId":"\(r.entryId)","locationId":"l","version":"v","kind":"\(r.kind)","categoryNameAr":\(quoted(r.categoryNameAr)),
                 "surah":2,"ayah":1,"startWord":1,"startKey":"\(r.startKey)","endKey":"\(r.endKey)","hafsText":\(quoted(r.hafsText)),
                 "readingText":\(quoted(r.readingText)),"deleted":\(r.deleted),"narrators":[\(narrators)],"flags":[]}
                """.utf8))
            }
            if FacesSummary.summarize(rows) != c.summary { bad += 1 }
        }
        #expect(bad == 0)
        #expect(golden.rowCases.count == 600)
    }
}
