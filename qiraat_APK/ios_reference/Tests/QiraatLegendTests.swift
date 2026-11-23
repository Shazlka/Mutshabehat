import Foundation
import MushafCore
@testable import MushafCore
@testable import Mutshabehat
import XCTest

/// Tests of the colour key. The catalog is the bundled snapshot the app ships with. The page below is a
/// TEST FIXTURE: its token positions and readings are invented to exercise every mark; it is not Quran data.
final class QiraatLegendTests: XCTestCase {
    private let testPageJSON = """
    {"pageNumber":2,
     "variants":[
      {"id":"fixture-single","surah":2,"ayah":1,"startToken":1,"endToken":1,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q01-R01","Q01-R02"]},
      {"id":"fixture-narrator","surah":2,"ayah":1,"startToken":2,"endToken":2,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q02-R01"]},
      {"id":"fixture-multi","surah":2,"ayah":1,"startToken":3,"endToken":3,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":["Q01-R01","Q02-R01"]},
      {"id":"fixture-performance","surah":2,"ayah":1,"startToken":4,"endToken":4,"hafsText":"a","variantText":"a","performanceNote":"fixture","verificationStatus":"REVIEWED","readingIds":["Q03-R01"]},
      {"id":"fixture-unresolved","surah":2,"ayah":1,"startToken":5,"endToken":5,"hafsText":"a","variantText":"b","verificationStatus":"REVIEWED","readingIds":[]}
     ],
     "rulings":[
      {"id":"fixture-imalah-alternate","category":"IMALAH_TAQLIL","categoryAr":"الممال والمقلل","color":"#C026D3","wordAnchored":true,"surah":2,"ayah":1,"startToken":1,"endToken":1,"baseText":"a","verificationStatus":"REVIEWED","hasAlternate":true,
       "attribution":[{"authorityId":"Q01-R01","action":"إمالة"},{"authorityId":"Q01-R02","action":"تقليل"}],
       "readings":[{"readingId":"Q01-R01","action":"إمالة","isDefault":true},{"readingId":"Q01-R02","action":"تقليل","isDefault":false}]},
      {"id":"fixture-tarqiq","category":"TARQIQ_RA","categoryAr":"ترقيق الراء","color":"#B45309","wordAnchored":true,"surah":2,"ayah":1,"startToken":1,"endToken":1,"baseText":"a","verificationStatus":"REVIEWED","hasAlternate":false,
       "attribution":[{"authorityId":"Q05-R02","action":"ترقيق"}],
       "readings":[{"readingId":"Q05-R02","action":"ترقيق","isDefault":true}]},
      {"id":"fixture-taqlil-only","category":"IMALAH_TAQLIL","categoryAr":"الممال والمقلل","color":"#C026D3","wordAnchored":true,"surah":2,"ayah":1,"startToken":6,"endToken":6,"baseText":"a","verificationStatus":"REVIEWED","hasAlternate":false,
       "attribution":[{"authorityId":"Q01-R02","action":"تقليل"}],
       "readings":[{"readingId":"Q01-R02","action":"تقليل","isDefault":true}]},
      {"id":"fixture-ruling-only","category":"TARQIQ_RA","categoryAr":"ترقيق الراء","color":"#B45309","wordAnchored":true,"surah":2,"ayah":1,"startToken":7,"endToken":7,"baseText":"a","verificationStatus":"REVIEWED","hasAlternate":false,
       "attribution":[{"authorityId":"Q05-R02","action":"ترقيق"}],
       "readings":[{"readingId":"Q05-R02","action":"ترقيق","isDefault":true}]},
      {"id":"fixture-page-level","category":"ADD_COUNT","categoryAr":"عد الآي","color":"#0F766E","wordAnchored":false,"surah":2,"ayah":1,"startToken":8,"endToken":8,"baseText":"a","verificationStatus":"REVIEWED","hasAlternate":false,
       "attribution":[{"authorityId":"Q05-R02","action":"عد"}],
       "readings":[{"readingId":"Q05-R02","action":"عد","isDefault":true}]}
     ],
     "rules":[]}
    """

    private func bundledCatalog() throws -> QiraatCatalog {
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        return try JSONDecoder().decode(QiraatCatalog.self,
                                        from: Data(contentsOf: bundled.appendingPathComponent("catalog.json")))
    }

    private func testPage() throws -> QiraatPageData {
        try JSONDecoder().decode(QiraatPageData.self, from: Data(testPageJSON.utf8))
    }

    private func word(_ token: Int) -> MushafWord {
        MushafWord(id: "w\(token)", page: 2, line: 1, indexInLine: token, ayahKey: AyahKey(surah: 2, ayah: 1),
                   indexInAyah: token, charType: .word, glyph: "x", textUthmani: "x")
    }

    /// Every case of `VariantMarker.Style`. The switch fails to compile when MushafCore adds a case,
    /// so this list cannot fall behind the marker type.
    private func allVariantStyles() -> [VariantMarker.Style] {
        let styles: [VariantMarker.Style] = [.unresolved, .performance, .single(color: "#000000"), .multiReader(colors: [])]
        for style in styles {
            switch style {
            case .unresolved, .performance, .single, .multiReader: break
            }
        }
        return styles
    }

    /// Every case of `WordMarks.Underline`, checked the same way.
    private func allUnderlines() -> [WordMarks.Underline] {
        let underlines: [WordMarks.Underline] = [.solid("#000000"), .segments([])]
        for underline in underlines {
            switch underline {
            case .solid, .segments: break
            }
        }
        return underlines
    }

    func testEveryVariantStyleIsExplainedByALegendRow() throws {
        let catalog = try bundledCatalog()
        let marks = Set(QiraatLegend.entries(catalog: catalog).map(\.mark))
        for style in allVariantStyles() {
            XCTAssertTrue(marks.contains(QiraatLegendMark.of(style)), "no legend row for \(style)")
        }
    }

    func testEveryDrawnMarkOfARealWordIsExplainedAndEveryMarkIsDrawnByTheFixture() throws {
        let catalog = try bundledCatalog()
        let page = try testPage()
        let marks = QiraatMarks(catalog: catalog, page: page)
        var drawn: Set<QiraatLegendMark> = []
        for token in 1...7 {
            let wordMarks = try XCTUnwrap(marks.wordMarks(for: word(token), filter: .all), "token \(token) has no marks")
            drawn.formUnion(QiraatLegendMark.drawn(by: wordMarks, catalog: catalog))
        }
        XCTAssertEqual(drawn, Set(QiraatLegendMark.allCases), "the fixture must draw every mark style")

        let rows = Set(QiraatLegend.entries(catalog: catalog, usulCategories: QiraatLegend.usulCategories(in: [page])).map(\.mark))
        XCTAssertTrue(drawn.isSubset(of: rows), "drawn without a legend row: \(drawn.subtracting(rows))")
    }

    func testEveryUnderlineCaseIsExplained() throws {
        let catalog = try bundledCatalog()
        let rows = Set(QiraatLegend.entries(catalog: catalog).map(\.mark))
        for underline in allUnderlines() {
            let mark: QiraatLegendMark
            switch underline {
            case .solid(let hex):
                mark = hex == catalog.performanceColor ? .performanceLine : hex == catalog.unresolvedColor ? .unresolvedLine : .solidLine
            case .segments:
                mark = .segmentedLine
            }
            XCTAssertTrue(rows.contains(mark), "no legend row for underline \(underline)")
        }
    }

    func testEveryLegendMarkHasARow() throws {
        let catalog = try bundledCatalog()
        let categories = [QiraatLegendCategory(code: "IMALAH_TAQLIL", nameAr: "الممال والمقلل", color: "#C026D3")]
        let rows = Set(QiraatLegend.entries(catalog: catalog, usulCategories: categories).map(\.mark))
        XCTAssertEqual(rows, Set(QiraatLegendMark.allCases))
    }

    func testMarkRowsHaveCatalogColoursBeforeCategoriesLoad() throws {
        let catalog = try bundledCatalog()
        let rows = QiraatLegend.entries(catalog: catalog).filter { $0.group == .marks }
        let categoryMarks: Set<QiraatLegendMark> = [
            .dottedLine, .familyDot, .imalahFilled, .imalahRing, .rulingWord
        ]
        for row in rows where categoryMarks.contains(row.mark) {
            XCTAssertEqual(row.colors, [catalog.multiReaderColor], row.id)
        }
        let rulingWord = try XCTUnwrap(rows.first { $0.mark == .rulingWord })
        XCTAssertEqual(rulingWord.textColor, catalog.multiReaderColor)
        XCTAssertEqual(rulingWord.id, "mark-ruling-word")
    }

    func testReadersAndNarratorsGetOneColouredRowEach() throws {
        let catalog = try bundledCatalog()
        let rows = QiraatLegend.entries(catalog: catalog).filter { $0.group == .readers }
        XCTAssertEqual(rows.count, catalog.readers.count + catalog.narrators.count)
        for reader in catalog.readers {
            let row = try XCTUnwrap(rows.first { $0.id == "reader-\(reader.id)" })
            XCTAssertEqual(row.colors, [reader.color])
            XCTAssertEqual(row.textColor, reader.color)
            XCTAssertTrue(row.title.contains(reader.nameArShort))
        }
        for narrator in catalog.narrators {
            let row = try XCTUnwrap(rows.first { $0.id == "narrator-\(narrator.id)" })
            XCTAssertEqual(row.colors, [narrator.color])
            XCTAssertTrue(row.isNarrator)
            XCTAssertTrue(row.title.contains(narrator.nameAr))
        }
    }

    func testUsulCategoriesComeFromWordAnchoredRulingsOnceEach() throws {
        let categories = QiraatLegend.usulCategories(in: [try testPage()])
        XCTAssertEqual(categories.map(\.code), ["IMALAH_TAQLIL", "TARQIQ_RA"], "first-seen order, one row per name and colour")
        XCTAssertFalse(categories.contains { $0.code == "ADD_COUNT" }, "a page-level rule never colours a word")
    }

    func testUsulCategoriesReadFromTheBundledPages() throws {
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        let store = try QiraatStore(directory: bundled)
        let categories = QiraatLegend.usulCategories(store: store)
        XCTAssertFalse(categories.isEmpty)
        for category in categories {
            XCTAssertTrue(category.color.hasPrefix("#"), "\(category.code) has colour \(category.color)")
            XCTAssertFalse(category.nameAr.isEmpty)
        }
        XCTAssertEqual(Set(categories.map(\.id)).count, categories.count)
    }

    func testEveryRowReadsAsShapeNameAndMeaningForVoiceOver() throws {
        let catalog = try bundledCatalog()
        let categories = [QiraatLegendCategory(code: "IMALAH_TAQLIL", nameAr: "الممال والمقلل", color: "#C026D3")]
        for row in QiraatLegend.entries(catalog: catalog, usulCategories: categories) {
            XCTAssertTrue(row.accessibilityLabel.hasPrefix(row.mark.shapeWords), row.id)
            XCTAssertTrue(row.accessibilityLabel.contains(row.title), row.id)
            XCTAssertTrue(row.accessibilityLabel.hasSuffix(row.explanation), row.id)
        }
    }

    func testPerformanceAndUnresolvedRowsUseTheCataloguesColours() throws {
        let catalog = try bundledCatalog()
        let rows = QiraatLegend.entries(catalog: catalog)
        XCTAssertEqual(rows.first { $0.mark == .performanceLine }?.colors, [catalog.performanceColor])
        XCTAssertEqual(rows.first { $0.mark == .unresolvedLine }?.colors, [catalog.unresolvedColor])
        XCTAssertEqual(rows.first { $0.mark == .segmentedLine }?.textColor, catalog.multiReaderColor)
    }
}
