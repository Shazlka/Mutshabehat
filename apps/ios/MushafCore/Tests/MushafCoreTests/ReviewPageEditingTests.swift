#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct ReviewPageEditingTests {
    private func basePage() throws -> ReviewPage {
        try JSONDecoder().decode(ReviewPage.self, from: Data("""
        {"page":8,"words":[
          {"key":"002:049:001","surah":2,"ayah":49,"word":1,"line":1,"text":"وَإِذْ"},
          {"key":"002:049:002","surah":2,"ayah":49,"word":2,"line":1,"text":"نَجَّيْنَـٰكُم"},
          {"key":"002:049:003","surah":2,"ayah":49,"word":3,"line":2,"text":"مِّنْ"}],
         "rows":[
          {"entryId":"r-1","locationId":"l-1","version":"v1","kind":"usul","categoryCode":"USUL_TAHQIQ","categoryNameAr":"تحقيق",
           "surah":2,"ayah":49,"startWord":1,"endAyah":49,"endWord":1,"startKey":"002:049:001","endKey":"002:049:001",
           "reviewStatus":"unreviewed","narrators":[{"id":"Q06-R01","nameAr":"خلف","wajhOrder":1}],"flags":[]},
          {"entryId":"r-2","locationId":"l-2","version":"v1","kind":"farsh","surah":2,"ayah":49,"startWord":2,"endAyah":49,"endWord":2,
           "startKey":"002:049:002","endKey":"002:049:002","reviewStatus":"reviewed","narrators":[],"flags":[]}],
         "stats":{"total":2,"unreviewed":1,"reviewed":1,"flagged":0,"deleted":0},
         "narrators":[{"id":"Q01-R02","code":"NAF-WRS","nameAr":"ورش","parentId":"Q01","type":"narrator","color":null}],
         "categories":[{"code":"USUL_NAQL","nameAr":"النقل"},{"code":"USUL_TAHQIQ","nameAr":"تحقيق"}],"variantTypes":["vowel"]}
        """.utf8))
    }

    @Test func statsAreRecomputedFromLiveRowsAndCountDeletedSeparately() throws {
        var page = try basePage()
        page.rows[0].reviewStatus = .flagged
        page.rows[1].deleted = true
        let stats = ReviewPageEditing.stats(for: page.rows)
        #expect(stats == PageStats(total: 1, unreviewed: 0, reviewed: 0, flagged: 1, deleted: 1))
    }

    @Test func upsertReplacesAnExistingRowByIdAndRecomputesStats() throws {
        var page = try basePage()
        var updated = page.rows[0]
        updated.reviewStatus = .reviewed
        updated.version = "v2"
        ReviewPageEditing.upsert(updated, into: &page)
        #expect(page.rows.count == 2)
        #expect(page.rows[0].version == "v2")
        #expect(page.stats.reviewed == 2 && page.stats.unreviewed == 0)
    }

    @Test func upsertSwapsAPlaceholderForTheServerRow() throws {
        var page = try basePage()
        let entry = CreateEntryInput(surah: 2, ayah: 49, startWord: 3, kind: .usul, categoryCode: "USUL_NAQL",
                                     narrators: [NarratorInput(id: "Q01-R02", action: "نقل", wajhOrder: 1)])
        let temp = ReviewPageEditing.placeholderRow(id: "tmp-1", for: entry, in: page)
        ReviewPageEditing.upsert(temp, into: &page)
        #expect(page.rows.contains { $0.entryId == "tmp-1" })
        var server = temp
        server.entryId = "r-new"
        server.version = "v1"
        ReviewPageEditing.upsert(server, replacing: "tmp-1", into: &page)
        #expect(!page.rows.contains { $0.entryId == "tmp-1" })
        #expect(page.rows.contains { $0.entryId == "r-new" })
        #expect(page.rows.count == 3)
    }

    @Test func placeholderRowCarriesTheWordsPositionTextCategoryAndNarrators() throws {
        let page = try basePage()
        let entry = CreateEntryInput(surah: 2, ayah: 49, startWord: 2, endAyah: 49, endWord: 3, kind: .usul,
                                     categoryCode: "USUL_NAQL", narrators: [NarratorInput(id: "Q01-R02", action: "نقل")],
                                     appliesWasl: false)
        let temp = ReviewPageEditing.placeholderRow(id: "tmp-9", for: entry, in: page)
        #expect(temp.entryId == "tmp-9" && ReviewPageEditing.isPlaceholder(temp))
        #expect(temp.startKey == "002:049:002" && temp.endKey == "002:049:003")
        #expect(temp.hafsText == "نَجَّيْنَـٰكُم مِّنْ")
        #expect(temp.categoryNameAr == "النقل")
        #expect(temp.reviewStatus == .unreviewed && temp.appliesWasl == false && temp.appliesWaqf)
        #expect(temp.narrators.first?.nameAr == "ورش" && temp.narrators.first?.wajhOrder == 1)
        #expect(temp.page == 8)
    }

    @Test func applyingFieldsKeepsUntouchedValuesAndNamesTheNewCategory() throws {
        let page = try basePage()
        var fields = EntryFields()
        fields.categoryCode = .set("USUL_NAQL")
        fields.rulingText = .set("حكم")
        fields.hamzahDetail = .set(.single(treatment: .naql))
        let row = ReviewPageEditing.applying(fields, narrators: [NarratorInput(id: "Q01-R02", action: "نقل", wajhOrder: 2)],
                                             to: page.rows[0], in: page)
        #expect(row.categoryCode == "USUL_NAQL" && row.categoryNameAr == "النقل")
        #expect(row.rulingText == "حكم" && row.hamzahDetail == .single(treatment: .naql))
        #expect(row.version == "v1")                                  // the server assigns the next version
        #expect(row.narrators.map(\.id) == ["Q01-R02"] && row.narrators[0].wajhOrder == 2)
        #expect(row.readingText == page.rows[0].readingText)         // not in the patch: unchanged
        var clear = EntryFields()
        clear.hamzahDetail = .set(nil)
        #expect(ReviewPageEditing.applying(clear, narrators: row.narrators.map { NarratorInput(id: $0.id) }, to: row, in: page).hamzahDetail == nil)
    }
}
#endif
