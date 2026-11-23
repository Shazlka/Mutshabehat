#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct SuggestionLogicTests {
    private func suggestion(kind: String = "farsh", full: Bool = false) throws -> ReviewSuggestion {
        let fields = full ? #", "categoryCode":"HAMZATAN_KALIMA","variantType":"vowel","readingText":"قراءة","uthmaniText":"رسم","description":"بيان","performanceNote":"أداء","rulingText":"حكم","appliesWasl":false,"appliesWaqf":true,"hamzahDetail":{"mode":"single","treatment":"إبدال"}"# : ""
        return try JSONDecoder().decode(ReviewSuggestion.self, from: Data("""
        {"key":"s","tier":"exact","support":2,"sourceEntryId":"source","sources":["2:25:28"],
         "config":{"kind":"\(kind)","narrators":[{"id":"Q01-R02","nameAr":"ورش عن نافع","action":"تقليل","wajhOrder":2,"wajhNote":"الخلاف"}]\(fields)}}
        """.utf8))
    }

    private func row(kind: String = "farsh", category: String = "null", deleted: Bool = false,
                     narrator: String = "Q01-R02", status: String = "unreviewed", id: String = "r") throws -> ReviewRow {
        try JSONDecoder().decode(ReviewRow.self, from: Data("""
        {"entryId":"\(id)","version":"v1","surah":2,"ayah":49,"startWord":1,"kind":"\(kind)","categoryCode":\(category),"deleted":\(deleted),"reviewStatus":"\(status)",
         "narrators":[{"id":"\(narrator)","nameAr":"راوٍ","wajhOrder":3}]}
        """.utf8))
    }

    @Test func farshClashIncludesEveryActiveStatusAndWajh() throws {
        let s = try suggestion()
        for status in ["unreviewed", "reviewed", "flagged"] {
            #expect(SuggestionLogic.isBlocked(s, wordRows: [try row(status: status)]))
        }
        #expect(!SuggestionLogic.isBlocked(s, wordRows: [try row(deleted: true)]))
        #expect(!SuggestionLogic.isBlocked(s, wordRows: [try row(narrator: "Q02-R01")]))
        #expect(!SuggestionLogic.isBlocked(s, wordRows: [try row(kind: "usul")]))
        #expect(SuggestionLogic.isBlocked(s, wordRows: [try row(id: "tmp-1")]))
        #expect(!SuggestionLogic.isBlocked(s, wordRows: []))
    }

    @Test func usulSuggestionsAreNeverBlocked() throws {
        #expect(!SuggestionLogic.isBlocked(try suggestion(kind: "usul"), wordRows: [try row()]))
    }

    @Test func suggestionStepsStoreNonDefaultWaslWaqfAndHamzahDetailAfterTheCreate() throws {
        let s = try suggestion(kind: "usul", full: true)     // wasl off, hamzah detail set
        let input = SuggestionLogic.createInput(for: s, surah: 2, ayah: 49, startWord: 1)
        let steps = ReviewDraft.createSteps(for: input)
        var follow = EntryFields()
        follow.appliesWasl = .set(false)
        follow.appliesWaqf = .set(true)
        follow.hamzahDetail = .set(.single(treatment: .ibdal))
        #expect(steps == [.create(input), .update(follow)])
        #expect(!steps.contains(.approve))
    }

    @Test func createInputPreservesEveryWebFieldWithoutApproving() throws {
        let s = try suggestion(kind: "usul", full: true)
        let input = SuggestionLogic.createInput(for: s, surah: 2, ayah: 49, startWord: 1)
        #expect(input == CreateEntryInput(surah: 2, ayah: 49, startWord: 1, kind: .usul,
            readingText: "قراءة", uthmaniText: "رسم", description: "بيان", performanceNote: "أداء",
            variantType: "vowel", categoryCode: "HAMZATAN_KALIMA", rulingText: "حكم",
            narrators: [NarratorInput(id: "Q01-R02", action: "تقليل", wajhOrder: 2, wajhNote: "الخلاف")],
            appliesWasl: false, appliesWaqf: true, hamzahDetail: .single(treatment: .ibdal)))
        let sparse = SuggestionLogic.createInput(for: try suggestion(), surah: 3, ayah: 4, startWord: 5)
        #expect(sparse.kind == .farsh && sparse.readingText == nil && sparse.appliesWasl == nil)
        #expect(sparse.endAyah == nil && sparse.endWord == nil && sparse.notes == nil)
    }

    @Test func sameCategoryMatchesWebIncludingUnclassifiedAndAbsentRow() throws {
        let farsh = try row(id: "farsh")
        let a = try row(kind: "usul", category: #""A""#, id: "a")
        let b = try row(kind: "usul", category: #""B""#, id: "b")
        let all = [farsh, a, b]
        #expect(SameWordLogic.verifiedSameCategory(matches: all, for: farsh) == [farsh])
        #expect(SameWordLogic.verifiedSameCategory(matches: all, for: a) == [a])
        #expect(SameWordLogic.verifiedSameCategory(matches: all, for: try row(kind: "usul")) == [a, b])
        #expect(SameWordLogic.verifiedSameCategory(matches: all, for: try row(kind: "usul", category: #""""#)) == [a, b])
        #expect(SameWordLogic.verifiedSameCategory(matches: all, for: nil) == all)
    }
}
#endif
