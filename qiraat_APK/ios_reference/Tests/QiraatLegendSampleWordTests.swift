import Foundation
import MushafCore
@testable import Mutshabehat
import XCTest

/// The colour key shows a word of the Mushaf in every sample: for each reader and narrator a word only they read,
/// else any word they read; for each باب a word it rules; for each mark a word that really carries it.
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

    private func ruling(_ id: String, category: String = "TARQIQ_RA", color: String = "#B45309", ayah: Int, token: Int = 1,
                        base: String, readings: [(String, String, Bool)] = [("Q05-R02", "ترقيق", true)]) -> String {
        let list = readings.map { #"{"readingId":"\#($0.0)","action":"\#($0.1)","isDefault":\#($0.2)}"# }.joined(separator: ",")
        let alternate = readings.contains { !$0.2 }
        return """
        {"id":"\(id)","category":"\(category)","categoryAr":"\(category)","color":"\(color)","wordAnchored":true,"surah":2,"ayah":\(ayah),\
        "startToken":\(token),"endToken":\(token),"endAyah":\(ayah),"baseText":"\(base)","verificationStatus":"REVIEWED","hasAlternate":\(alternate),\
        "attribution":[],"readings":[\(list)]}
        """
    }

    private func page(variants: [String] = [], rulings: [String] = []) throws -> QiraatPageData {
        let json = #"{"pageNumber":2,"variants":[\#(variants.joined(separator: ","))],"rulings":[\#(rulings.joined(separator: ","))],"rules":[]}"#
        return try JSONDecoder().decode(QiraatPageData.self, from: Data(json.utf8))
    }

    // MARK: Readers and narrators

    func testANarratorGetsAWordOnlyHeReads() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("a", ayah: 1, hafs: "كَلِمَةٌ", readings: ["Q01-R02", "Q02-R01"]),
            variant("b", ayah: 2, hafs: "قَوْلٌ", readings: ["Q01-R02"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["narrator-Q01-R02"]?.text, "قَوْلٌ", "the word shared with another reader is not his alone")
        XCTAssertEqual(words["narrator-Q01-R02"]?.ayah, 2)
    }

    func testAReaderNeedsBothOfHisNarratorsAndNobodyElse() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("one", ayah: 1, hafs: "نَارٌ", readings: ["Q01-R01"]),
            variant("both-plus", ayah: 2, hafs: "نُورٌ", readings: ["Q01-R01", "Q01-R02", "Q03-R01"]),
            variant("both", ayah: 3, hafs: "بَحْرٌ", readings: ["Q01-R02", "Q01-R01"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["reader-Q01"]?.text, "بَحْرٌ")
        XCTAssertEqual(words["narrator-Q01-R01"]?.text, "نَارٌ")
    }

    /// Nobody reads a word alone: they still get a word they read, the one shared with the fewest others first,
    /// and the rows after the first take what is left (no two rows share a word).
    func testWithoutAWordOfTheirOwnAnAuthorityGetsAWordTheyReadWithTheFewestOthers() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("crowd", ayah: 1, hafs: "كَثِيرٌ", readings: ["Q02-R01", "Q03-R01", "Q04-R01", "Q09-R01"]),
            variant("pair", ayah: 2, hafs: "زَوْجٌ", readings: ["Q02-R01", "Q03-R01"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["reader-Q02"]?.text, "زَوْجٌ", "the reader's row comes first in the key")
        XCTAssertEqual(words["narrator-Q02-R01"]?.text, "كَثِيرٌ")
        XCTAssertNil(words["narrator-Q03-R01"], "both words are taken: the plain sample stays rather than repeat one")
    }

    /// حفص reads the Mushaf's own text, so a word that others read differently is his, after the rows before him.
    func testHafsGetsAWordOthersReadDifferently() throws {
        let shared = (1...8).map { "word\($0)" }
        let words = QiraatLegend.sampleWords(in: [try page(variants: shared.enumerated().map {
            variant("v\($0.offset)", ayah: 1 + $0.offset, hafs: $0.element, readings: ["Q02-R01", "Q03-R01", "Q04-R01"])
        })], catalog: try catalog())
        let hafs = try XCTUnwrap(words["narrator-\(QiraatCompare.hafsReadingId)"])
        XCTAssertTrue(shared.contains(hafs.text), hafs.text)
    }

    func testOnlyAChangeOfTheWrittenWordCounts() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("performance", ayah: 1, hafs: "رَبٌّ", variant: "رَبٌّ", readings: ["Q02-R02"]),
            variant("two-words", ayah: 2, token: 3, end: 4, hafs: "مِنْ بَعْدِ", readings: ["Q02-R02"]),
            variant("none", ayah: 3, hafs: "حَقٌّ", readings: []),
            variant("good", ayah: 4, hafs: "عَدْلٌ", readings: ["Q02-R02"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["narrator-Q02-R02"]?.text, "عَدْلٌ")
    }

    func testAStopSignIsDroppedAndTwoRowsNeverShareAWord() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("a", ayah: 1, hafs: "وَلِيَتَمَتَّعُوا۟ ۖ", readings: ["Q01-R01"]),
            variant("b", ayah: 2, hafs: "وَلِيَتَمَتَّعُوا۟", readings: ["Q02-R01"]),
            variant("c", ayah: 3, hafs: "شَجَرَةٌ", readings: ["Q02-R01"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["narrator-Q01-R01"]?.text, "وَلِيَتَمَتَّعُوا۟")
        XCTAssertEqual(words["narrator-Q02-R01"]?.text, "شَجَرَةٌ", "the first row already took the other word, whatever its marks")
    }

    func testASignBelongingToTheNextWordIsNotLeftDanglingAfterTheWord() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("a", ayah: 1, hafs: "وَضِيَآءً\u{06ED}", readings: ["Q02-R02"]),
        ])], catalog: try catalog())
        XCTAssertEqual(words["narrator-Q02-R02"]?.text, "وَضِيَآءً")
    }

    func testAVerifiedWordIsPreferred() throws {
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("reviewed", ayah: 1, hafs: "جَنَّةٌ", readings: ["Q03-R01"]),
            variant("verified", ayah: 9, hafs: "سَمَاءٌ", readings: ["Q03-R01"], status: "VERIFIED"),
        ])], catalog: try catalog())
        XCTAssertEqual(words["narrator-Q03-R01"]?.text, "سَمَاءٌ")
    }

    // MARK: Marks

    /// `count` distinct invented words, `prefix1`, `prefix2` …
    private func pool(_ prefix: String, _ count: Int) -> [String] { (1...count).map { "\(prefix)\($0)" } }

    /// One real word for each shape, chosen where that shape is the only one the word carries. The readers and the
    /// أبواب are served first and take their own words, so the page has spare ones for the marks.
    func testEveryMarkGetsAWordThatReallyCarriesIt() throws {
        let cat = try catalog()
        let imalah = "IMALAH_TAQLIL"
        let solid = pool("solid", 6), segmented = pool("seg", 8)
        var ayah = 0
        func next() -> Int { ayah += 1; return ayah }
        let variants = solid.map { variant("s\($0)", ayah: next(), hafs: $0, readings: ["Q05-R01"]) }
            + segmented.map { variant("g\($0)", ayah: next(), hafs: $0, readings: ["Q01-R01", "Q02-R01"]) }
            + [variant("performance", ayah: next(), hafs: "perf", variant: "perf", readings: ["Q03-R01"]),
               variant("unresolved", ayah: next(), hafs: "unres", readings: [])]
        let plain = pool("plain", 4), alternate = pool("alt", 4), imalahWords = pool("imalah", 4)
        let taqlilWords = pool("taqlil", 4), family = pool("fam", 4)
        var rulings = plain.map { ruling("p\($0)", ayah: next(), base: $0) }
        rulings += alternate.map {
            ruling("a\($0)", ayah: next(), base: $0, readings: [("Q05-R02", "ترقيق", true), ("Q01-R02", "ترقيق", false)])
        }
        rulings += imalahWords.map {
            ruling("i\($0)", category: imalah, color: "#C026D3", ayah: next(), base: $0, readings: [("Q06-R01", "إمالة", true)])
        }
        rulings += taqlilWords.map {
            ruling("t\($0)", category: imalah, color: "#C026D3", ayah: next(), base: $0, readings: [("Q01-R02", "تقليل", true)])
        }
        for word in family {
            let a = next()
            rulings.append(ruling("fa\(word)", ayah: a, base: word))
            rulings.append(ruling("fb\(word)", category: "MADD", color: "#2563EB", ayah: a, base: word))
        }
        let words = QiraatLegend.sampleWords(in: [try page(variants: variants, rulings: rulings)], catalog: cat)
        let used = Set(words.filter { !$0.key.hasPrefix("mark-") }.map(\.value.text))

        func word(_ id: String, in candidates: [String], colours: Int? = nil, line: UInt = #line) throws -> QiraatLegendSampleWord {
            let sample = try XCTUnwrap(words[id], id, line: line)
            XCTAssertTrue(candidates.contains(sample.text), "\(id): \(sample.text)", line: line)
            XCTAssertFalse(used.contains(sample.text), "\(id) repeats a word another row shows: \(sample.text)", line: line)
            if let colours { XCTAssertEqual(sample.colors.count, colours, id, line: line) }
            return sample
        }
        _ = try word("mark-solid", in: solid, colours: 1)
        _ = try word("mark-segmented", in: segmented, colours: 2)
        XCTAssertEqual(words["mark-performance"]?.text, "perf")
        XCTAssertEqual(words["mark-performance"]?.colors, [cat.performanceColor])
        XCTAssertEqual(words["mark-unresolved"]?.text, "unres")
        XCTAssertEqual(words["mark-unresolved"]?.colors, [cat.unresolvedColor])
        let dotted = try word("mark-dotted", in: alternate)
        XCTAssertEqual(dotted.colors, ["#B45309"])
        XCTAssertNil(dotted.textColor, "a dotted line keeps the plain ink for its word")
        _ = try word("mark-family", in: family)
        XCTAssertEqual(try word("mark-imalah", in: imalahWords).colors, ["#C026D3"])
        XCTAssertEqual(try word("mark-taqlil", in: taqlilWords).colors, ["#C026D3"])
        let ruled = try word("mark-ruling-word", in: plain)
        XCTAssertEqual(ruled.textColor, "#B45309", "the word's own text takes the ruling colour")
    }

    // MARK: Usul categories

    func testEachBabGetsAWordItRulesAndRowsShowIt() throws {
        let cat = try catalog()
        let pg = try page(rulings: [
            ruling("empty", ayah: 1, base: ""),
            ruling("tarqiq", ayah: 2, base: "رَبٌّ"),
            ruling("madd", category: "MADD", color: "#2563EB", ayah: 3, base: "جَاءَ"),
            ruling("madd-2", category: "MADD", color: "#2563EB", ayah: 4, base: "رَبٌّ"),
        ])
        let words = QiraatLegend.sampleWords(in: [pg], catalog: cat)
        let tarqiq = QiraatLegendCategory(code: "TARQIQ_RA", nameAr: "TARQIQ_RA", color: "#B45309")
        let madd = QiraatLegendCategory(code: "MADD", nameAr: "MADD", color: "#2563EB")
        XCTAssertEqual(words["usul-\(tarqiq.id)"]?.text, "رَبٌّ")
        XCTAssertEqual(words["usul-\(madd.id)"]?.text, "جَاءَ", "«رَبٌّ» is taken, the other word of the باب is used")

        let rows = QiraatLegend.entries(catalog: cat, usulCategories: [tarqiq, madd], sampleWords: words)
        let row = try XCTUnwrap(rows.first { $0.id == "usul-\(madd.id)" })
        XCTAssertEqual(row.sampleWord, "جَاءَ")
        XCTAssertTrue(row.explanation.contains("٢:٣"), row.explanation)
    }

    // MARK: Rows

    func testRowsTakeTheirWordAndColoursAndAShapeWithoutOneKeepsThePlainSample() throws {
        let cat = try catalog()
        let segmented = pool("seg", 8)
        let words = QiraatLegend.sampleWords(in: [try page(variants: [
            variant("v", ayah: 99, hafs: "سَمَاءٌ", readings: ["Q03-R01"], status: "VERIFIED"),
        ] + segmented.enumerated().map {
            variant("g\($0.offset)", ayah: 1 + $0.offset, hafs: $0.element, readings: ["Q01-R01", "Q02-R01"])
        })], catalog: cat)
        let rows = QiraatLegend.entries(catalog: cat, sampleWords: words)
        let narrator = try XCTUnwrap(rows.first { $0.id == "narrator-Q03-R01" })
        XCTAssertEqual(narrator.sampleWord, "سَمَاءٌ")
        XCTAssertTrue(narrator.explanation.contains("٢:٩٩"), narrator.explanation)

        let mark = try XCTUnwrap(rows.first { $0.id == "mark-segmented" })
        XCTAssertNotNil(mark.sampleWord)
        XCTAssertEqual(mark.colors.count, 2)
        XCTAssertNil(try XCTUnwrap(rows.first { $0.id == "mark-dotted" }).sampleWord, "no word carries it here: the plain sample stays")
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

    // MARK: The bundled snapshot

    /// On the data the app ships: every reader and narrator, every باب and nearly every shape has a word of the
    /// Mushaf, and no two rows share one. The names of the rows left plain are printed for the changelog.
    func testTheBundledSnapshotGivesEveryRowItsOwnWord() throws {
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        let store = try QiraatStore(directory: bundled)
        let scanned = QiraatLegend.scan(store: store)
        let rows = QiraatLegend.entries(catalog: store.catalog, usulCategories: scanned.categories,
                                        sampleWords: scanned.sampleWords)

        let plain = rows.filter { $0.sampleWord == nil }.map(\.id)
        print("Rows left with the plain sample: \(plain)")
        XCTAssertEqual(plain.filter { $0.hasPrefix("reader-") || $0.hasPrefix("narrator-") || $0.hasPrefix("usul-") }, [],
                       "every reader, narrator and باب has a word")
        XCTAssertLessThanOrEqual(plain.filter { $0.hasPrefix("mark-") }.count, 1, "at most the grey line has no real word")

        let letters = rows.compactMap(\.sampleWord).map { word in
            String(String.UnicodeScalarView(word.unicodeScalars.filter { $0.properties.generalCategory != .nonspacingMark }))
        }
        XCTAssertEqual(Set(letters).count, letters.count, "no two rows show the same word")
        for row in rows where row.group == .readers && row.sampleWord != nil {
            XCTAssertFalse(row.colors.isEmpty)
        }
    }
}
