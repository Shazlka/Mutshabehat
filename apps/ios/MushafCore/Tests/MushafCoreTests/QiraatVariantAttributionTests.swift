import Foundation
import Testing
@testable import MushafCore

/// ابن عامر at 2:124 (page 19): هشام reads «إبراهام» with the alif; ابن ذكوان has two faces, the second with
/// the yā' and «بخلف عنه». The card must keep each reader's own row instead of one flat list of pills.
private let ibrahim = QiraatVariant(
    id: "v-ibrahim", surah: 2, ayah: 124, startToken: 3, endToken: 3, hafsText: "إِبْرَٰهِـۧمَ",
    variantText: "إِبْرَاهَامَ", verificationStatus: "REVIEWED", readingIds: ["Q04-R01", "Q04-R02"],
    attribution: [
        QiraatRulingAttribution(authorityId: "Q04-R01", action: "بالألف", wajhOrder: 1),
        QiraatRulingAttribution(authorityId: "Q04-R02", action: "بالألف", wajhOrder: 1),
        QiraatRulingAttribution(authorityId: "Q04-R02", action: "بالياء", wajhOrder: 2, wajhNote: "بخلف عنه"),
    ])

@Suite struct QiraatVariantAttributionTests {
    @Test func decodesPerReaderRowsAndDefaultsToNoneWhenTheWebSentNone() throws {
        let with = Data("""
        {"id":"v","surah":2,"ayah":124,"startToken":3,"readingIds":["Q04-R02"],
         "attribution":[{"authorityId":"Q04-R02","action":"بالياء","wajhOrder":2,"wajhNote":"بخلف عنه"}]}
        """.utf8)
        let decoded = try JSONDecoder().decode(QiraatVariant.self, from: with)
        #expect(decoded.attribution.count == 1)
        #expect(decoded.attribution[0].wajhOrder == 2)
        #expect(decoded.attribution[0].wajhNote == "بخلف عنه")

        let without = Data(#"{"id":"v","surah":2,"ayah":124,"startToken":3,"readingIds":["Q04-R02"]}"#.utf8)
        #expect(try JSONDecoder().decode(QiraatVariant.self, from: without).attribution.isEmpty)
    }

    @Test func keepsEachReadersOwnRowForTheReadingsShown() {
        let both = ibrahim.attribution(scopedTo: ["Q04-R01", "Q04-R02"], catalog: testCatalog)
        #expect(both.count == 3)

        let ibnDhakwan = ibrahim.attribution(scopedTo: ["Q04-R02"], catalog: testCatalog)
        #expect(ibnDhakwan.map(\.action) == ["بالألف", "بالياء"])
        #expect(ibnDhakwan.allSatisfy { $0.authorityId == "Q04-R02" })

        #expect(ibrahim.attribution(scopedTo: ["Q06-R01"], catalog: testCatalog).isEmpty)
    }

    @Test func aReaderLevelRowAppliesWhenAnyOfThatReadersNarratorsIsShown() {
        let variant = QiraatVariant(
            id: "v", surah: 2, ayah: 1, startToken: 1, endToken: 1, hafsText: "أ", variantText: "ب",
            verificationStatus: "REVIEWED", readingIds: ["Q07-R01", "Q07-R02"],
            attribution: [QiraatRulingAttribution(authorityId: "Q07", action: "بالياء")])
        #expect(variant.attribution(scopedTo: ["Q07-R01"], catalog: testCatalog).count == 1)
        #expect(variant.attribution(scopedTo: ["Q04-R01"], catalog: testCatalog).isEmpty)
    }

    @Test func groupsByActionInFirstAppearanceOrderWithTheWajhKept() {
        let groups = ibrahim.attributionByAction(scopedTo: ["Q04-R01", "Q04-R02"], catalog: testCatalog)
        #expect(groups.map(\.action) == ["بالألف", "بالياء"])
        #expect(groups[0].entries.map(\.authorityId) == ["Q04-R01", "Q04-R02"])
        #expect(groups[1].entries.map(\.authorityId) == ["Q04-R02"])
        #expect(groups[1].entries[0].wajhOrder == 2)
        #expect(groups[1].entries[0].wajhNote == "بخلف عنه")
    }

    @Test func aRowWithNoActionGroupsUnderTheEmptyAction() {
        let variant = QiraatVariant(
            id: "v", surah: 2, ayah: 1, startToken: 1, endToken: 1, hafsText: "أ", variantText: "ب",
            verificationStatus: "REVIEWED", readingIds: ["Q01-R02"],
            attribution: [QiraatRulingAttribution(authorityId: "Q01-R02", action: nil)])
        #expect(variant.attributionByAction(scopedTo: ["Q01-R02"], catalog: testCatalog).map(\.action) == [""])
    }
}
