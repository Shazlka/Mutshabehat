import Foundation
import XCTest
@testable import Mutshabehat

@MainActor
final class QiraatHideUsulTests: XCTestCase {
    private func freshDefaults() -> UserDefaults {
        let suite = "QiraatHideUsulTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        addTeardownBlock { defaults.removePersistentDomain(forName: suite) }
        return defaults
    }

    func testUsulIsShownUntilTheReaderHidesIt() {
        let prefs = QiraatPreferences(defaults: freshDefaults())
        XCTAssertFalse(prefs.hidesUsul)
        XCTAssertFalse(prefs.display.hidesUsul)

        prefs.hidesUsul = true
        XCTAssertTrue(prefs.display.hidesUsul, "the page views redraw because the display value changes")
    }

    func testTheChoiceIsKeptOnTheDevice() {
        let defaults = freshDefaults()
        QiraatPreferences(defaults: defaults).hidesUsul = true
        XCTAssertTrue(QiraatPreferences(defaults: defaults).hidesUsul)

        QiraatPreferences(defaults: defaults).hidesUsul = false
        XCTAssertFalse(QiraatPreferences(defaults: defaults).hidesUsul)
    }

    func testEveryCategoryIsShownUntilTheReaderSwitchesItOff() {
        let prefs = QiraatPreferences(defaults: freshDefaults())
        XCTAssertTrue(prefs.hiddenUsulCategories.isEmpty)

        prefs.setUsul("USUL_SAKT", shown: false)
        XCTAssertEqual(prefs.display.hiddenUsulCategories, ["USUL_SAKT"], "the page views redraw because the display value changes")

        prefs.setUsul("USUL_SAKT", shown: true)
        XCTAssertTrue(prefs.display.hiddenUsulCategories.isEmpty)
    }

    func testTheCategoryChoicesAreKeptOnTheDevice() {
        let defaults = freshDefaults()
        let prefs = QiraatPreferences(defaults: defaults)
        prefs.setUsul("USUL_HA_SAKT", shown: false)
        prefs.setUsul("IMALAH_TAQLIL", shown: false)
        XCTAssertEqual(QiraatPreferences(defaults: defaults).hiddenUsulCategories, ["USUL_HA_SAKT", "IMALAH_TAQLIL"])
    }
}
