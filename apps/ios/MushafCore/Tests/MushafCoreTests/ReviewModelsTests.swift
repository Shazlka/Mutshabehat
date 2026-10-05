#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct ReviewModelsTests {
    private let decoder = JSONDecoder()
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    private func rowJSON(extra: String = "", startWord: Int = 1, endAyah: Int = 49, endWord: Int = 1,
                         hamzah: String = "null") -> Data {
        Data("""
        {"entryId":"r-1","locationId":"l-2-49-1","version":"2026-10-05T04:35:27.964789+00:00",
         "kind":"usul","categoryCode":null,"categoryNameAr":null,"surah":2,"ayah":49,"startWord":\(startWord),
         "endAyah":\(endAyah),"endWord":\(endWord),"startKey":"002:049:001","endKey":"002:049:001","page":8,
         "hafsText":"وَإِذْ","readingText":null,"uthmaniText":null,"description":null,"performanceNote":null,
         "variantType":null,"rulingText":null,"options":null,"notes":null,"reviewStatus":"reviewed",
         "locationReviewStatus":"reviewed","verificationStatus":"VERIFIED","legacyRef":null,"entryOrder":1,
         "deleted":false,"appliesWasl":true,"appliesWaqf":true,"hamzahDetail":\(hamzah),
         "narrators":[{"id":"Q06-R01","code":"HAM-KHL","action":"x","nameAr":"خلف","wajhNote":null,"wajhOrder":1}],
         "flags":[]\(extra)}
        """.utf8)
    }

    @Test func decodesWebRowWithOptionalNulls() throws {
        let row = try decoder.decode(ReviewRow.self, from: rowJSON(
            hamzah: #"{"mode":"kalima","first":"تحقيق","second":"تسهيل","idkhalAlif":true}"#))
        #expect(row.entryId == "r-1")
        #expect(row.id == "r-1")
        #expect(row.kind == .usul)
        #expect(row.categoryCode == nil)
        #expect(row.reviewStatus == .reviewed)
        #expect(row.narrators.first?.id == "Q06-R01")
        #expect(row.narrators.first?.wajhOrder == 1)
        #expect(row.hamzahDetail == .kalima(first: .tahqiq, second: .tasheel, idkhalAlif: true))
    }

    @Test func hamzahDetailRoundTripsAllThreeModes() throws {
        let values: [HamzahDetail] = [
            .single(treatment: .ibdal),
            .kalima(first: .tahqiq, second: .hadhf, idkhalAlif: nil),
            .kalimatayn(harakahRelation: .mukhtalifatan, firstTreatment: .tasheel, secondTreatment: .ibdal,
                        isqatFirst: true, isqatSecond: nil, ibdalMadd: false,
                        wordKeys: HamzahDetail.WordKeys(first: "002:001:001", second: "002:001:002")),
        ]
        for value in values {
            let data = try encoder.encode(value)
            #expect(try decoder.decode(HamzahDetail.self, from: data) == value)
        }
        let json = try #require(String(data: try encoder.encode(values[0]), encoding: .utf8))
        #expect(json.contains(#""mode":"single""#))
        #expect(json.contains(#""treatment":"إبدال""#))
    }

    @Test func entryFieldsEncodesOnlySetKeys() throws {
        #expect(String(data: try encoder.encode(EntryFields()), encoding: .utf8) == "{}")
        var fields = EntryFields()
        fields.hamzahDetail = .set(nil)
        fields.notes = .set("ملاحظة")
        let json = try #require(String(data: try encoder.encode(fields), encoding: .utf8))
        #expect(json == #"{"hamzahDetail":null,"notes":"ملاحظة"}"#)
    }

    @Test func createEntryInputEncodesWebKeys() throws {
        let entry = CreateEntryInput(
            surah: 2, ayah: 49, startWord: 1, kind: .farsh, readingText: "وَإِذْ",
            variantType: "vowel",
            narrators: [NarratorInput(id: "Q06-R01", action: "قرأ", wajhOrder: 2, wajhNote: "ن")])
        let object = try #require(JSONSerialization.jsonObject(with: try encoder.encode(entry)) as? [String: Any])
        #expect(object["surah"] as? Int == 2)
        #expect(object["startWord"] as? Int == 1)
        #expect(object["kind"] as? String == "farsh")
        #expect(object["endAyah"] == nil)
        let narrator = try #require((object["narrators"] as? [[String: Any]])?.first)
        #expect(narrator["id"] as? String == "Q06-R01")
        #expect(narrator["wajhOrder"] as? Int == 2)
        #expect(narrator["wajhNote"] as? String == "ن")
    }

    @Test func rowSpansTwoWordFaceAndCrossAyahFace() throws {
        let two = try decoder.decode(ReviewRow.self, from: rowJSON(startWord: 3, endAyah: 49, endWord: 4))
        #expect(two.spansWord(surah: 2, ayah: 49, word: 3))
        #expect(two.spansWord(surah: 2, ayah: 49, word: 4))
        #expect(!two.spansWord(surah: 2, ayah: 49, word: 5))
        #expect(!two.spansWord(surah: 2, ayah: 49, word: 2))
        #expect(!two.spansWord(surah: 3, ayah: 49, word: 3))

        // Cross-ayah: starts at 2:49 word 9, ends at 2:50 word 2.
        let cross = try decoder.decode(ReviewRow.self, from: rowJSON(startWord: 9, endAyah: 50, endWord: 2))
        #expect(cross.spansWord(surah: 2, ayah: 49, word: 9))
        #expect(cross.spansWord(surah: 2, ayah: 49, word: 12))   // later words of the first ayah
        #expect(cross.spansWord(surah: 2, ayah: 50, word: 1))
        #expect(cross.spansWord(surah: 2, ayah: 50, word: 2))
        #expect(!cross.spansWord(surah: 2, ayah: 50, word: 3))
        #expect(!cross.spansWord(surah: 2, ayah: 49, word: 8))
    }

    @Test func deletedRowIsNotActive() throws {
        let data = String(data: rowJSON(), encoding: .utf8)!.replacingOccurrences(of: #""deleted":false"#, with: #""deleted":true"#)
        let row = try decoder.decode(ReviewRow.self, from: Data(data.utf8))
        #expect(!row.isActive)
    }

    @Test func decodesPageOverviewAndHistory() throws {
        let page = try decoder.decode(ReviewPage.self, from: Data("""
        {"page":8,"words":[{"key":"002:049:001","surah":2,"ayah":49,"word":1,"line":1,"text":"وَإِذْ"}],
         "rows":[],"stats":{"total":64,"deleted":0,"flagged":0,"reviewed":64,"unreviewed":0},
         "narrators":[{"id":"Q01","code":"NAF","type":"reader","color":"#2563EB","nameAr":"نافع المدني","parentId":null}],
         "categories":[{"code":"USUL_TAHQIQ","nameAr":"تحقيق"}],"variantTypes":["addition","vowel"]}
        """.utf8))
        #expect(page.words.first?.key == "002:049:001")
        #expect(page.stats.reviewed == 64)
        #expect(page.narrators.first?.type == .reader)
        #expect(page.categories.first?.code == "USUL_TAHQIQ")

        let overview = try decoder.decode(ReviewOverview.self, from: Data(
            #"{"isEditor":true,"pages":[{"page":1,"total":10,"flagged":0,"reviewed":8,"unreviewed":2}]}"#.utf8))
        #expect(overview.pages.first?.unreviewed == 2)

        let history = try decoder.decode([HistoryTransaction].self, from: Data("""
        [{"txid":5,"at":"2026-10-05T04:35:27+00:00","deviceId":null,"undone":false,"entryId":"r-1",
          "changes":[{"table":"qiraat_entries","rowId":"r-1","op":"UPDATE","field":"review_status","old":"unreviewed","new":"reviewed"}]}]
        """.utf8))
        #expect(history.first?.changes.first?.new == .string("reviewed"))
        #expect(history.first?.deviceId == nil)
    }

    @Test func decodesSuggestionAndBulkResult() throws {
        let suggestion = try decoder.decode(ReviewSuggestion.self, from: Data("""
        {"key":"k","tier":"exact","support":3,"shapeTotal":null,"shape":null,"sourceEntryId":"r-9",
         "sources":["2:25:28"],"config":{"kind":"usul","categoryCode":"USUL_NAQL","categoryNameAr":"النقل",
         "narrators":[{"id":"Q01-R02","nameAr":"ورش","action":"نقل"}]}}
        """.utf8))
        #expect(suggestion.tier == .exact)
        #expect(suggestion.config.narrators.first?.id == "Q01-R02")

        let result = try decoder.decode(BulkApplyResult.self, from: Data("""
        {"sourceEntryId":"r-1","added":[{"entryId":"r-2","surah":2,"ayah":3,"word":4}],
         "skipped":[],"errors":[{"surah":2,"ayah":5,"word":1,"message":"x"}]}
        """.utf8))
        #expect(result.added.count == 1)
        #expect(result.errors.first?.message == "x")
    }
}
#endif
