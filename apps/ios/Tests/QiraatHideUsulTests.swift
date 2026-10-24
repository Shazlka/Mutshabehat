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
}
