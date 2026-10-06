import MushafCore
import XCTest
@testable import Mutshabehat

final class MemorizationThemeTests: XCTestCase {
    func testEveryStatusHasADistinctShapeAndLabel() {
        let shapes = MemorizationStatus.allCases.map(MemorizationTheme.shape)
        XCTAssertEqual(Set(shapes).count, 4)
        XCTAssertEqual(shapes, ["✓✓", "!", "◐", "○"])
        for language in AppLanguage.allCases {
            let labels = MemorizationStatus.allCases.map { MemorizationTheme.label($0, language: language) }
            XCTAssertEqual(Set(labels).count, 4)
            XCTAssertTrue(labels.allSatisfy { !$0.isEmpty })
        }
        XCTAssertEqual(MemorizationTheme.label(.mastered, language: .arabic), "متقن")
        XCTAssertEqual(MemorizationTheme.label(.memorizedWithErrors, language: .arabic), "محفوظ مع أخطاء")
        XCTAssertEqual(MemorizationTheme.label(.needsMushaf, language: .arabic), "يحتاج المصحف")
        XCTAssertEqual(MemorizationTheme.label(.notMemorized, language: .arabic), "غير محفوظ")
    }

    func testShortLabelOnlyShortensTheErrorsState() {
        XCTAssertEqual(MemorizationTheme.shortLabel(.memorizedWithErrors, language: .arabic), "مع أخطاء")
        XCTAssertEqual(MemorizationTheme.shortLabel(.mastered, language: .arabic), "متقن")
    }

    func testColorsDifferPerStatusInBothInterfaceStyles() {
        for style in [UIUserInterfaceStyle.light, .dark] {
            let traits = UITraitCollection(userInterfaceStyle: style)
            let colors = MemorizationStatus.allCases.map { MemorizationTheme.uiColor($0).resolvedColor(with: traits) }
            for i in colors.indices { for j in colors.indices where i < j { XCTAssertNotEqual(colors[i], colors[j]) } }
        }
    }

    func testPageSummarySpeaksStateAndMix() {
        var counts: [MemorizationStatus: Int] = [:]
        for status in MemorizationStatus.allCases { counts[status] = 0 }
        counts[.mastered] = 7
        counts[.notMemorized] = 3
        let mix = PageMix(counts: counts, fractions: [.mastered: 0.7, .notMemorized: 0.3], ayahCount: 10, masteredAyahs: 7)
        let progress = MemorizationPageProgress(page: 42, state: .notMemorized, mix: mix)
        let text = MemorizationTheme.pageSummary(page: 42, progress: progress, language: .english)
        XCTAssertEqual(text, "Page 42: Not memorized, 7 of 10 ayat mastered")
        XCTAssertTrue(MemorizationTheme.pageSummary(page: 42, progress: progress, language: .arabic).contains("غير محفوظ"))
    }

    func testNumbersFollowTheLanguage() {
        XCTAssertEqual(MemorizationTheme.number(42, language: .english), "42")
        XCTAssertEqual(MemorizationTheme.number(42, language: .arabic), "٤٢")
    }
}
