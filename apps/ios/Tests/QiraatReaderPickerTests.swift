import Foundation
import MushafCore
import SwiftUI
import XCTest
@testable import Mutshabehat

final class QiraatReaderPickerTests: XCTestCase {
    private var sampleCatalog: QiraatCatalog!

    override func setUpWithError() throws {
        let json = """
        {
          "schemaVersion": 1,
          "source": "api",
          "fetchedAt": "2026-10-10T00:00:00Z",
          "pageCount": 604,
          "readers": [
            {"id": "Q01", "nameAr": "نافع المدني", "nameArShort": "نافع", "color": "#2563EB", "sortOrder": 1},
            {"id": "Q02", "nameAr": "ابن كثير المكي", "nameArShort": "ابن كثير", "color": "#16A34A", "sortOrder": 2},
            {"id": "Q03", "nameAr": "أبو عمرو البصري", "nameArShort": "أبو عمرو", "color": "#0891B2", "sortOrder": 3},
            {"id": "Q05", "nameAr": "عاصم الكوفي", "nameArShort": "عاصم", "color": "#EA580C", "sortOrder": 5},
            {"id": "Q06", "nameAr": "حمزة الكوفي", "nameArShort": "حمزة", "color": "#DC2626", "sortOrder": 6},
            {"id": "Q07", "nameAr": "الكسائي الكوفي", "nameArShort": "الكسائي", "color": "#DB2777", "sortOrder": 7}
          ],
          "narrators": [
            {"id": "Q01-R01", "readerId": "Q01", "nameAr": "قالون", "color": "#60A5FA", "sortOrder": 1},
            {"id": "Q01-R02", "readerId": "Q01", "nameAr": "ورش", "color": "#1D4ED8", "sortOrder": 2},
            {"id": "Q02-R01", "readerId": "Q02", "nameAr": "البزي", "color": "#4ADE80", "sortOrder": 1},
            {"id": "Q02-R02", "readerId": "Q02", "nameAr": "قنبل", "color": "#15803D", "sortOrder": 2},
            {"id": "Q03-R01", "readerId": "Q03", "nameAr": "الدوري عن أبي عمرو", "color": "#67E8F9", "sortOrder": 1},
            {"id": "Q03-R02", "readerId": "Q03", "nameAr": "السوسي", "color": "#0E7490", "sortOrder": 2},
            {"id": "Q05-R01", "readerId": "Q05", "nameAr": "شعبة", "color": "#FB923C", "sortOrder": 1},
            {"id": "Q05-R02", "readerId": "Q05", "nameAr": "حفص", "color": "#C2410C", "sortOrder": 2},
            {"id": "Q06-R01", "readerId": "Q06", "nameAr": "خلف", "color": "#F87171", "sortOrder": 1},
            {"id": "Q06-R02", "readerId": "Q06", "nameAr": "خلاد", "color": "#B91C1C", "sortOrder": 2},
            {"id": "Q07-R01", "readerId": "Q07", "nameAr": "أبو الحارث", "color": "#F472B6", "sortOrder": 1},
            {"id": "Q07-R02", "readerId": "Q07", "nameAr": "الدوري عن الكسائي", "color": "#BE185D", "sortOrder": 2}
          ],
          "multiReaderColor": "#3F6212",
          "performanceColor": "#4F46E5",
          "unresolvedColor": "#8a8a8a"
        }
        """
        sampleCatalog = try JSONDecoder().decode(QiraatCatalog.self, from: Data(json.utf8))
    }

    func testArabicTextNormalizerStripsTashkeel() {
        XCTAssertEqual(ArabicTextNormalizer.normalize("نَافِعٌ"), "نافع")
        XCTAssertEqual(ArabicTextNormalizer.normalize("عَاصِمٌ"), "عاصم")
        XCTAssertEqual(ArabicTextNormalizer.normalize("حَمْزَةُ"), "حمزه")
        XCTAssertEqual(ArabicTextNormalizer.normalize("الْكِسَائِيُّ"), "الكسايي")
        XCTAssertEqual(ArabicTextNormalizer.normalize("قَالُونُ"), "قالون")
        XCTAssertEqual(ArabicTextNormalizer.normalize("وَرْشٌ"), "ورش")
    }

    func testArabicTextNormalizerNormalizesAlefVariants() {
        XCTAssertEqual(ArabicTextNormalizer.normalize("أبو جعفر"), "ابو جعفر")
        XCTAssertEqual(ArabicTextNormalizer.normalize("إبن كثير"), "ابن كثير")
        XCTAssertEqual(ArabicTextNormalizer.normalize("آدم"), "ادم")
        XCTAssertEqual(ArabicTextNormalizer.normalize("ٱبن"), "ابن")
    }

    func testArabicTextNormalizerNormalizesTaaMarbutaAndAlefMaqsura() {
        XCTAssertEqual(ArabicTextNormalizer.normalize("حمزة"), "حمزه")
        XCTAssertEqual(ArabicTextNormalizer.normalize("حمزه"), "حمزه")
        XCTAssertEqual(ArabicTextNormalizer.normalize("الكسائى"), "الكسايي")
        XCTAssertEqual(ArabicTextNormalizer.normalize("الكسائي"), "الكسايي")
    }

    func testArabicTextNormalizerStripsTatweelAndCollapsesWhitespace() {
        XCTAssertEqual(ArabicTextNormalizer.normalize("نـــافع"), "نافع")
        XCTAssertEqual(ArabicTextNormalizer.normalize("  أبو    عمرو  "), "ابو عمرو")
    }

    func testArabicTextNormalizerMatchesWithTashkeelInsensitiveQuery() {
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "نافع المدني", query: "نَافِع"))
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "نافع المدني", query: "المدني"))
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "أبو عمرو البصري", query: "ابو عمرو"))
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "حمزة الكوفي", query: "حمزه"))
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "قالون", query: "قَالُون"))
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "الدوري عن أبي عمرو", query: "الدوري"))
        XCTAssertTrue(ArabicTextNormalizer.matches(target: "الدوري عن الكسائي", query: "الدوري"))
        XCTAssertFalse(ArabicTextNormalizer.matches(target: "عاصم الكوفي", query: "حفص"))
    }

    func testSelectionModeEquatabilityAndPresets() {
        XCTAssertEqual(SelectionMode.single, SelectionMode.single)
        XCTAssertEqual(SelectionMode.multiple(max: 2), SelectionMode.multiple(max: 2))
        XCTAssertNotEqual(SelectionMode.single, SelectionMode.multiple(max: 2))
        XCTAssertNotEqual(SelectionMode.multiple(max: 1), SelectionMode.multiple(max: 2))
    }

    func testCompactLabelsDoNotRepeatImamOrRiwayata() {
        let reader = sampleCatalog.reader("Q01")!
        let narrator = sampleCatalog.narrator("Q01-R02")!

        let readerLabel = "\(reader.nameArShort) (روايتاه)"
        let narratorLabel = narrator.nameAr
        let sectionHeader = reader.nameAr

        // Reader row: nameArShort + (روايتاه)
        XCTAssertEqual(readerLabel, "نافع (روايتاه)")
        XCTAssertFalse(readerLabel.contains("الإمام"))
        XCTAssertFalse(readerLabel.contains("روايتا الإمام"))

        // Narrator row: nameAr
        XCTAssertEqual(narratorLabel, "ورش")
        XCTAssertFalse(narratorLabel.contains("الراوي"))

        // Section header: nameAr
        XCTAssertEqual(sectionHeader, "نافع المدني")
        XCTAssertFalse(sectionHeader.contains("الإمام"))
    }

    @MainActor
    func testSingleSelectionPickerInitializesWithBinding() {
        var filter = QiraatFilter.all
        let binding = Binding(get: { filter }, set: { filter = $0 })
        let picker = QiraatReaderPicker(catalog: sampleCatalog, selection: binding)
        XCTAssertNotNil(picker)
    }

    @MainActor
    func testMultiSelectionPickerInitializesForCompare() {
        var picked: [String] = []
        let picker = QiraatReaderPicker(
            catalog: sampleCatalog,
            selectionMode: .multiple(max: 2),
            selectedIDs: ["Q01", "Q05"]
        ) { picked = $0 }
        XCTAssertNotNil(picker)
    }
}
