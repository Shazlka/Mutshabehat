import Foundation
import Testing
@testable import MushafCore

/// Fixtures/qiraat-page-001.json holds records copied from the live web API for page 1;
/// Fixtures/qiraat-catalog.json holds the readers and narrators of packages/qiraat-core.
private func fixture(_ name: String) throws -> Data {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
    return try Data(contentsOf: url)
}

let testCatalog: QiraatCatalog = try! JSONDecoder().decode(QiraatCatalog.self, from: fixture("qiraat-catalog"))
let pageOne: QiraatPageData = try! JSONDecoder().decode(QiraatPageData.self, from: fixture("qiraat-page-001"))

private func variant(_ id: String, _ surah: Int, _ ayah: Int, _ token: Int, hafs: String = "كلمة",
                     text: String = "كلمه", readings: [String]) -> QiraatVariant {
    QiraatVariant(id: id, surah: surah, ayah: ayah, startToken: token, endToken: token, hafsText: hafs,
                  variantText: text, verificationStatus: "REVIEWED", readingIds: readings)
}

private func ruling(_ id: String, category: String = "IMALAH_TAQLIL", color: String = "#C026D3",
                    _ surah: Int, _ ayah: Int, _ start: Int, endAyah: Int? = nil, _ end: Int,
                    anchored: Bool = true, alternate: Bool = false,
                    readings: [(String, String, Bool)]) -> QiraatRuling {
    QiraatRuling(id: id, category: category, categoryAr: "الممال والمقلل", color: color, wordAnchored: anchored,
                 surah: surah, ayah: ayah, startToken: start, endToken: end, endAyah: endAyah, baseText: "",
                 verificationStatus: "REVIEWED", hasAlternate: alternate,
                 attribution: readings.map { QiraatRulingAttribution(authorityId: $0.0, action: $0.1) },
                 readings: readings.map { QiraatRulingReading(readingId: $0.0, action: $0.1, isDefault: $0.2) })
}

private func marks(_ variants: [QiraatVariant] = [], _ rulings: [QiraatRuling] = []) -> QiraatMarks {
    QiraatMarks(catalog: testCatalog, page: QiraatPageData(pageNumber: 9, variants: variants, rulings: rulings, rules: []))
}

@Suite struct QiraatDecodingTests {
    @Test func decodesARealPageFromTheWebAPI() {
        #expect(pageOne.pageNumber == 1)
        #expect(pageOne.variants.count == 9)
        #expect(pageOne.variants[0].hafsText == "مَـٰلِكِ")
        #expect(pageOne.variants[0].readingIds.count == 12)
        #expect(pageOne.rulings.first?.category == "IDGHAM_KABIR")
        #expect(pageOne.rules.first?.attributionLabel == "المكي، الكوفي")
    }

    @Test func catalogHasTenReadersAndTwentyNarratorsWithDisambiguatedNames() {
        #expect(testCatalog.readers.count == 10)
        #expect(testCatalog.narrators.count == 20)
        #expect(testCatalog.reader("Q10")?.nameArShort == "خلف العاشر")
        #expect(testCatalog.narrator("Q03-R01")?.nameAr == "الدوري عن أبي عمرو")
        #expect(testCatalog.narrator("Q07-R02")?.nameAr == "الدوري عن الكسائي")
        #expect(testCatalog.readerId(ofReading: "Q06-R01") == "Q06")
        #expect(testCatalog.readerId(ofReading: "Q99-R01") == nil)
    }

    @Test func parsesHexColours() {
        #expect(QiraatColor(hex: "#2563EB") == QiraatColor(red: 0x25 / 255.0, green: 0x63 / 255.0, blue: 0xEB / 255.0))
        #expect(QiraatColor(hex: "8a8a8a") == QiraatColor(red: 0x8a / 255.0, green: 0x8a / 255.0, blue: 0x8a / 255.0))
        #expect(QiraatColor(hex: "#12") == nil)
    }
}

@Suite struct QiraatVariantMarkerTests {
    let page = QiraatMarks(catalog: testCatalog, page: pageOne)

    /// 1:4 مالك/ملك: six readers share one variant → one segmented marker, readers in canonical order.
    @Test func severalReadersGiveOneSegmentedMarkerInReaderOrder() throws {
        let marker = try #require(page.variantMarker(surah: 1, ayah: 4, token: 1, filter: .all))
        #expect(marker.style == .multiReader(colors: ["#2563EB", "#16A34A", "#0891B2", "#7C3AED", "#DC2626", "#CA8A04"]))
        #expect(page.textColor(of: marker) == "#3F6212")
    }

    @Test func aReaderFilterScopesTheColourToThatReader() throws {
        // 1:6 الصراط: Q02-R02 (قنبل) alone reads السراط → his narrator colour, not a gradient.
        let marker = try #require(page.variantMarker(surah: 1, ayah: 6, token: 2, filter: .reader("Q02")))
        #expect(marker.style == .single(color: "#15803D"))
        #expect(marker.variants.count == 1)
    }

    @Test func bothNarratorsOfOneReaderGiveTheReaderColour() throws {
        let marker = try #require(page.variantMarker(surah: 1, ayah: 7, token: 4, filter: .reader("Q03")))
        #expect(marker.style == .single(color: "#0891B2"))
    }

    @Test func aPerformanceOnlyVariantGetsThePerformanceColour() throws {
        // 1:6 الصراط for حمزة: إشمام, the text is unchanged.
        let marker = try #require(page.variantMarker(surah: 1, ayah: 6, token: 2, filter: .reader("Q06")))
        #expect(marker.style == .performance)
        #expect(page.textColor(of: marker) == "#4F46E5")
    }

    @Test func aNarratorFilterNeverShowsAnotherReadersColour() throws {
        let marker = try #require(page.variantMarker(surah: 1, ayah: 4, token: 1, filter: .reading("Q01-R02")))
        #expect(marker.style == .single(color: "#1D4ED8"))
        #expect(page.variantMarker(surah: 1, ayah: 4, token: 1, filter: .reading("Q05-R02")) == nil)
    }

    @Test func unknownOrMissingReadingIdsAreUnresolvedNotGuessed() throws {
        let m = marks([variant("a", 2, 3, 4, readings: []), variant("b", 2, 3, 5, readings: ["Q99-R07"])])
        #expect(try #require(m.variantMarker(surah: 2, ayah: 3, token: 4, filter: .all)).style == .unresolved)
        #expect(try #require(m.variantMarker(surah: 2, ayah: 3, token: 5, filter: .all)).style == .unresolved)
    }

    @Test func aTokenWithoutVariantsHasNoMarker() {
        #expect(page.variantMarker(surah: 1, ayah: 4, token: 2, filter: .all) == nil)
        #expect(page.variantMarker(surah: 1, ayah: 5, token: 1, filter: .all) == nil)
    }
}

@Suite struct QiraatRulingMarkerTests {
    /// Page 1's إدغام كبير ﴿ٱلرَّحِيمِ ۝ مَـٰلِكِ﴾ runs from 1:3 token 2 to 1:4 token 1.
    @Test func aRulingThatCrossesTheAyahEndMarksBothWords() throws {
        let page = QiraatMarks(catalog: testCatalog, page: pageOne)
        #expect(page.rulingMarker(surah: 1, ayah: 3, token: 2, filter: .all) != nil)
        #expect(page.rulingMarker(surah: 1, ayah: 4, token: 1, filter: .all) != nil)
        #expect(page.rulingMarker(surah: 1, ayah: 3, token: 1, filter: .all) == nil)
        #expect(page.rulingMarker(surah: 1, ayah: 4, token: 2, filter: .all) == nil)
    }

    @Test func spanRulesMatchTheWeb() {
        let span = ruling("s", 2, 5, 3, endAyah: 7, 2, readings: [])
        #expect(span.touches(surah: 2, ayah: 5, token: 3))
        #expect(!span.touches(surah: 2, ayah: 5, token: 2))
        #expect(span.touches(surah: 2, ayah: 6, token: 40))
        #expect(span.touches(surah: 2, ayah: 7, token: 2))
        #expect(!span.touches(surah: 2, ayah: 7, token: 3))
        #expect(!span.touches(surah: 3, ayah: 6, token: 1))
        let reversed = ruling("r", 2, 7, 1, endAyah: 5, 1, readings: [])
        #expect(!reversed.touches(surah: 2, ayah: 6, token: 1))
        #expect(!reversed.touches(surah: 2, ayah: 7, token: 1))
    }

    @Test func pageLevelRulingsDoNotColourWords() {
        let m = marks([], [ruling("p", 2, 3, 1, 1, anchored: false, readings: [("Q01-R01", "إمالة", true)])])
        #expect(m.rulingMarker(surah: 2, ayah: 3, token: 1, filter: .all) == nil)
    }

    @Test func severalFamiliesOnOneWordAreFlaggedAndTheFirstColourWins() throws {
        let m = marks([], [ruling("a", 2, 3, 1, 1, readings: [("Q01-R02", "تقليل", true)]),
                           ruling("b", category: "TARQIQ_RA", color: "#B45309", 2, 3, 1, 1, readings: [("Q01-R02", "ترقيق", true)])])
        let marker = try #require(m.rulingMarker(surah: 2, ayah: 3, token: 1, filter: .all))
        #expect(marker.color == "#C026D3")
        #expect(marker.multiple)
    }

    @Test func twoWajhsFollowTheFilter() throws {
        let m = marks([], [ruling("a", 2, 3, 1, 1, alternate: true,
                                  readings: [("Q01-R02", "تقليل", false), ("Q06-R01", "إمالة", true)])])
        #expect(try #require(m.rulingMarker(surah: 2, ayah: 3, token: 1, filter: .all)).hasAlternate)
        #expect(try #require(m.rulingMarker(surah: 2, ayah: 3, token: 1, filter: .reading("Q01-R02"))).hasAlternate)
        #expect(try #require(m.rulingMarker(surah: 2, ayah: 3, token: 1, filter: .reader("Q06"))).hasAlternate == false)
        #expect(m.rulingMarker(surah: 2, ayah: 3, token: 1, filter: .reader("Q05")) == nil)
    }

    @Test func imalahDotIsFilledWhenAnyReadingIsImalahAndARingForTaqlilOnly() throws {
        let both = marks([], [ruling("a", 2, 3, 1, 1, readings: [("Q01-R02", "تقليل", true), ("Q06-R01", "إمالة", true)])])
        #expect(try #require(both.imalahTaqlilMarker(surah: 2, ayah: 3, token: 1, filter: .all)).filled)
        // Same as the web: once a ruling matches the filter, all of its readings decide the dot, so
        // ورش alone still sees a filled dot here because حمزة's إمالة is on the same ruling.
        #expect(try #require(both.imalahTaqlilMarker(surah: 2, ayah: 3, token: 1, filter: .reading("Q01-R02"))).filled)
        let taqlilOnly = marks([], [ruling("c", 2, 3, 1, 1, readings: [("Q01-R02", "تقليل", true)])])
        #expect(try #require(taqlilOnly.imalahTaqlilMarker(surah: 2, ayah: 3, token: 1, filter: .all)).filled == false)
        let fath = marks([], [ruling("b", 2, 3, 1, 1, readings: [("Q05-R02", "فتح", true)])])
        #expect(fath.imalahTaqlilMarker(surah: 2, ayah: 3, token: 1, filter: .all) == nil)
    }
}

@Suite struct QiraatWordMarksTests {
    private func word(_ surah: Int, _ ayah: Int, _ token: Int, type: CharType = .word) -> MushafWord {
        MushafWord(id: "w", page: 9, line: 1, indexInLine: 1, ayahKey: AyahKey(surah: surah, ayah: ayah),
                   indexInAyah: token, charType: type, glyph: "x", textUthmani: "x")
    }

    @Test func theVariantColourWinsOverTheRulingColour() throws {
        let m = marks([variant("v", 2, 3, 1, readings: ["Q01-R02"])],
                      [ruling("r", 2, 3, 1, 1, alternate: true, readings: [("Q01-R02", "تقليل", false)])])
        let w = try #require(m.wordMarks(for: word(2, 3, 1), filter: .all))
        #expect(w.textColor == "#1D4ED8")
        #expect(w.underline == .solid("#1D4ED8"))
        #expect(w.dottedUnderlineColor == "#C026D3")
        #expect(w.imalahDot == ImalahTaqlilMarker(color: "#C026D3", filled: false))
    }

    @Test func aRulingOnlyWordTakesItsFamilyColourAndNoUnderline() throws {
        let m = marks([], [ruling("r", category: "TARQIQ_RA", color: "#B45309", 2, 3, 1, 1, readings: [("Q01-R02", "ترقيق", true)])])
        let w = try #require(m.wordMarks(for: word(2, 3, 1), filter: .all))
        #expect(w.textColor == "#B45309")
        #expect(w.underline == nil)
        #expect(w.dottedUnderlineColor == nil)
        #expect(w.familyDotColor == nil)
    }

    @Test func aMultiReaderVariantUnderlinesWithOneSegmentPerReader() throws {
        let m = marks([variant("v", 2, 3, 1, readings: ["Q01-R01", "Q01-R02", "Q06-R02"])])
        let w = try #require(m.wordMarks(for: word(2, 3, 1), filter: .all))
        #expect(w.underline == .segments(["#2563EB", "#DC2626"]))
        #expect(w.textColor == "#3F6212")
    }

    @Test func pageFurnitureIsNeverMarked() {
        let m = marks([variant("v", 2, 3, 1, readings: ["Q01-R01"])])
        #expect(m.wordMarks(for: word(2, 3, 1, type: .end), filter: .all) == nil)
        #expect(m.wordMarks(for: word(2, 3, 2), filter: .all) == nil)
    }

    @Test func selectionListsFilteredVariantsAndRulings() throws {
        let page = QiraatMarks(catalog: testCatalog, page: pageOne)
        let all = try #require(page.selection(surah: 1, ayah: 6, token: 2, filter: .all))
        #expect(all.variants.count == 2)
        let hamzah = try #require(page.selection(surah: 1, ayah: 6, token: 2, filter: .reader("Q06")))
        #expect(hamzah.variants.map(\.id) == [pageOne.variants[2].id])
        #expect(page.selection(surah: 1, ayah: 5, token: 1, filter: .all) == nil)
    }
}

@Suite struct QiraatPresentationTests {
    @Test func pillsRollUpAReaderWhoseNarratorsBothAppear() {
        let pills = rollupAuthorityPills(["Q06-R02", "Q01-R02", "Q06-R01", "Q10", "CS-KUFI"], catalog: testCatalog)
        #expect(pills.map(\.name) == ["الراوي ورش", "الإمام حمزة", "الإمام خلف العاشر", "CS-KUFI"])
        #expect(pills.map(\.color) == ["#1D4ED8", "#DC2626", "#475569", "#8a7c5c"])
    }

    @Test func rulingTextIsShownOnlyWhenItAddsSomething() {
        #expect(distinctRulingText("الممال والمقلل", categoryAr: "الممال والمقلل", actions: []) == nil)
        #expect(distinctRulingText("إمالة وقفًا", categoryAr: "الممال والمقلل", actions: ["إمالة وقفا"]) == nil)
        #expect(distinctRulingText("عدّها الكوفي", categoryAr: "عد الآي", actions: []) == "عدّها الكوفي")
    }

    @Test func anActionThatRepeatsTheCategoryIsRedundant() {
        #expect(isRedundantActionLabel("ترك الغنة", categoryAr: "ترك الغنة"))
        #expect(isRedundantActionLabel(nil, categoryAr: "ترك الغنة"))
        #expect(!isRedundantActionLabel("إمالة وقفًا", categoryAr: "الممال والمقلل"))
    }

    @Test func attributionGroupsKeepTheOrderTheyFirstAppearIn() {
        let r = ruling("r", 2, 3, 1, 1, readings: [("Q06-R01", "إمالة", true), ("Q01-R02", "تقليل", true), ("Q06-R02", "إمالة", true)])
        #expect(r.attributionByAction.map(\.action) == ["إمالة", "تقليل"])
        #expect(r.attributionByAction[0].entries.map(\.authorityId) == ["Q06-R01", "Q06-R02"])
    }
}

@Suite struct QiraatSettingsTests {
    @Test func filterRoundTripsThroughItsStoredValue() {
        for filter in [QiraatFilter.all, .reader("Q06"), .reading("Q03-R01")] {
            #expect(QiraatFilter(storageValue: filter.storageValue) == filter)
        }
        #expect(QiraatFilter.reading("Q03-R01").storageValue == "reading:Q03-R01")
        #expect(QiraatFilter(storageValue: "reader:") == nil)
        #expect(QiraatFilter(storageValue: "nonsense") == nil)
    }

    @Test func differenceTypesUseTheWebsArabicLabels() {
        #expect(differenceTypeLabelAr("HARAKAH") == "تشكيل")
        #expect(differenceTypeLabelAr("ORTHOGRAPHY") == "رسم")
        #expect(differenceTypeLabelAr(nil) == "أخرى")
        #expect(differenceTypeLabelAr("SOMETHING_NEW") == "أخرى")
    }
}
