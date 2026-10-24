import Foundation
import MushafCore
@testable import Mutshabehat
import XCTest

/// The colour key shows, for each reader and narrator, a word of the Mushaf that only they read in that way.
/// The pages below are TEST FIXTURES (invented words and positions), not Quran data.
final class QiraatLegendSampleWordTests: XCTestCase {
    private func catalog() throws -> QiraatCatalog {
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        return try JSONDecoder().decode(QiraatCatalog.self,
                                        from: Data(contentsOf: bundled.appendingPathComponent("catalog.json")))
    }

    private func variant(_ id: String, ayah: Int, token: Int = 1, end: Int? = nil, hafs: String, variant: String = "x",
                         readings: [String], status: String = "REVIEWED") -> String {
        """
        {"id":"\(id)","surah":2,"ayah":\(ayah),"startToken":\(token),"endToken":\(end ?? token),"hafsText":"\(hafs)","variantText":"\(variant)",\
        "verificationStatus":"\(status)","readingIds":[\(readings.map { "\"\($0)\"" }.joined(separator: ","))]}
        """
    }

    private func page(_ variants: [String]) throws -> QiraatPageData {
        let json = #"{"pageNumber":2,"variants":[\#(variants.joined(separator: ","))],"rulings":[],"rules":[]}"#
        return try JSONDecoder().decode(QiraatPageData.self, from: Data(json.utf8))
    }

    func testANarratorGetsAWordOnlyHeReads() throws {
        let words = QiraatLegend.sampleWords(in: [try page([
            variant("a", ayah: 1, hafs: "كَلِمَةٌ", readings: ["Q01-R02", "Q02-R01"]),
            variant("b", ayah: 2, hafs: "قَوْلٌ", readings: ["Q01-R02"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["Q01-R02"]?.text, "قَوْلٌ", "the word shared with another reader is not his alone")
        XCTAssertEqual(words["Q01-R02"]?.ayah, 2)
        XCTAssertNil(words["Q02-R01"], "he only ever appears together with someone else")
    }

    func testAReaderNeedsBothOfHisNarratorsAndNobodyElse() throws {
        let words = QiraatLegend.sampleWords(in: [try page([
            variant("one", ayah: 1, hafs: "نَارٌ", readings: ["Q01-R01"]),
            variant("both-plus", ayah: 2, hafs: "نُورٌ", readings: ["Q01-R01", "Q01-R02", "Q03-R01"]),
            variant("both", ayah: 3, hafs: "بَحْرٌ", readings: ["Q01-R02", "Q01-R01"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["Q01"]?.text, "بَحْرٌ")
        XCTAssertEqual(words["Q01-R01"]?.text, "نَارٌ")
        XCTAssertNil(words["Q01-R02"])
    }

    func testOnlyAChangeOfTheWrittenWordCounts() throws {
        let words = QiraatLegend.sampleWords(in: [try page([
            variant("performance", ayah: 1, hafs: "رَبٌّ", variant: "رَبٌّ", readings: ["Q02-R02"]),
            variant("two-words", ayah: 2, token: 3, end: 4, hafs: "مِنْ بَعْدِ", readings: ["Q02-R02"]),
            variant("none", ayah: 3, hafs: "حَقٌّ", readings: []),
            variant("good", ayah: 4, hafs: "عَدْلٌ", readings: ["Q02-R02"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["Q02-R02"]?.text, "عَدْلٌ")
    }

    func testAStopSignIsDroppedAndTwoRowsNeverShareAWord() throws {
        let words = QiraatLegend.sampleWords(in: [try page([
            variant("a", ayah: 1, hafs: "وَلِيَتَمَتَّعُوا۟ ۖ", readings: ["Q01-R01"]),
            variant("b", ayah: 2, hafs: "وَلِيَتَمَتَّعُوا۟", readings: ["Q02-R01"]),
            variant("c", ayah: 3, hafs: "شَجَرَةٌ", readings: ["Q02-R01"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["Q01-R01"]?.text, "وَلِيَتَمَتَّعُوا۟")
        XCTAssertEqual(words["Q02-R01"]?.text, "شَجَرَةٌ", "the first row already took the other word, whatever its marks")
    }

    func testASignBelongingToTheNextWordIsNotLeftDanglingAfterTheWord() throws {
        let words = QiraatLegend.sampleWords(in: [try page([
            variant("a", ayah: 1, hafs: "وَضِيَآءً\u{06ED}", readings: ["Q02-R02"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["Q02-R02"]?.text, "وَضِيَآءً")
    }

    func testAVerifiedWordIsPreferredAndTheKeyShowsTheWordAndItsPlace() throws {
        let cat = try catalog()
        let words = QiraatLegend.sampleWords(in: [try page([
            variant("reviewed", ayah: 1, hafs: "جَنَّةٌ", readings: ["Q03-R01"]),
            variant("verified", ayah: 9, hafs: "سَمَاءٌ", readings: ["Q03-R01"], status: "VERIFIED"),
        ])], catalog: cat)
        XCTAssertEqual(words["Q03-R01"]?.text, "سَمَاءٌ")

        let rows = QiraatLegend.entries(catalog: cat, sampleWords: words)
        let row = try XCTUnwrap(rows.first { $0.id == "narrator-Q03-R01" })
        XCTAssertEqual(row.sampleWord, "سَمَاءٌ")
        XCTAssertTrue(row.explanation.contains("٢:٩"), row.explanation)
        XCTAssertNil(try XCTUnwrap(rows.first { $0.id == "narrator-Q03-R02" }).sampleWord, "no word found: the plain sample stays")
        XCTAssertNil(try XCTUnwrap(rows.first { $0.id == "mark-solid" }).sampleWord, "the shapes keep a plain sample word")
    }

    /// With «فرش فقط» on, the key has no أصول mark and no باب; the reader and narrator rows stay.
    func testTheKeyListsNoUsulWhileUsulIsHidden() throws {
        let cat = try catalog()
        let usul = [QiraatLegendCategory(code: "TARQIQ_RA", nameAr: "ترقيق الراء", color: "#B45309")]
        let all = QiraatLegend.entries(catalog: cat, usulCategories: usul)
        let farshOnly = QiraatLegend.entries(catalog: cat, usulCategories: usul, hidesUsul: true)
        XCTAssertTrue(all.contains { $0.group == .usul })
        XCTAssertFalse(farshOnly.contains { $0.group == .usul })
        XCTAssertEqual(farshOnly.filter { $0.group == .marks }.map(\.mark),
                       [.solidLine, .segmentedLine, .performanceLine, .unresolvedLine])
        XCTAssertEqual(farshOnly.filter { $0.group == .readers }.count, all.filter { $0.group == .readers }.count)
    }
}
