import XCTest

/// A tap in the left margin shows or hides the controls: with the Qiraat layer on, the page centre is a marked word.
/// The Qiraat entry in the reader's top bar: the icon and its menu, the filter chip in the reading
/// header, and the «المزيد» menu that now holds المتشابهات and الحفظ.
@MainActor
final class QiraatTopBarUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(page: Int = 1, filter: String = "all", layer: String = "qiraat") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-mushaf1441:last-page:v1", "\(page)", "-mushaf1441:qiraat-filter:v1", filter,
                               "-mushaf1441:reader-layer:v1", layer, "-app:language:v1", "ar",
                               "-reading-fresh", "-memorization-seed", "empty", "-backup-folder", "none"]
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    /// A menu entry of any kind (button or submenu) whose label contains every given word. Interpolated names
    /// carry invisible direction marks, so «الإمام نافع» is matched as two words.
    private func byLabel(_ words: String..., in app: XCUIApplication) -> XCUIElement {
        let predicates = words.map { NSPredicate(format: "label CONTAINS %@", $0) }
        return app.descendants(matching: .any).matching(NSCompoundPredicate(andPredicateWithSubpredicates: predicates)).firstMatch
    }

    /// The reader / narrator filter is a submenu of the Qiraat menu.
    private func openFilterSubmenu(_ app: XCUIApplication) {
        let submenu = element("qiraat-filter", in: app)
        XCTAssertTrue(submenu.waitForExistence(timeout: 3), "the filter submenu is in the Qiraat menu")
        submenu.tap()
    }

    private func showChrome(_ app: XCUIApplication) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["open-index"].waitForExistence(timeout: 5))
    }

    func testTheBarHasExactlyFiveIconsOfAtLeast44Points() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        let ids = ["search-button", "bookmarks-button", "qiraat-button", "more-button", "settings-button"]
        var frames: [CGRect] = []
        for id in ids {
            let icon = app.buttons[id]
            XCTAssertTrue(icon.waitForExistence(timeout: 5), id)
            XCTAssertGreaterThanOrEqual(icon.frame.width, 43.5, id)
            XCTAssertGreaterThanOrEqual(icon.frame.height, 43.5, id)
            frames.append(icon.frame)
        }
        for (i, a) in frames.enumerated() {
            for b in frames[(i + 1)...] { XCTAssertFalse(a.insetBy(dx: 1, dy: 1).intersects(b), "\(a) overlaps \(b)") }
        }
        // The two moved buttons are inside the menu, not in the bar.
        XCTAssertFalse(app.buttons["mutshabehat-button"].exists)
        XCTAssertFalse(app.buttons["memorization-button"].exists)
    }

    func testMoreMenuHoldsMutshabehatAndMemorization() {
        let app = launch()
        showChrome(app)
        app.buttons["more-button"].tap()
        XCTAssertTrue(app.buttons["mutshabehat-button"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["memorization-button"].exists)
    }

    func testTheQiraatMenuSwitchesTheLayerOffAndOn() {
        let app = launch()
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        app.buttons["qiraat-button"].tap()
        let toggle = element("qiraat-hub-toggle", in: app)
        XCTAssertTrue(toggle.waitForExistence(timeout: 3))
        toggle.tap()
        XCTAssertFalse(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 2))
        app.buttons["qiraat-button"].tap()
        XCTAssertTrue(element("qiraat-hub-toggle", in: app).waitForExistence(timeout: 3))
        element("qiraat-hub-toggle", in: app).tap()
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 5))
    }

    func testNoChipWhileTheFilterIsAll() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        XCTAssertFalse(element("qiraat-filter-chip", in: app).exists)
    }

    func testNoChipWhileTheLayerIsOff() {
        let app = launch(filter: "reading:Q01-R02", layer: "none")
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        XCTAssertFalse(element("qiraat-filter-chip", in: app).exists)
    }

    /// The chip names the narrator without the repeated «الراوي», and sits clear of the banner text.
    func testTheChipShowsTheShortNameAndStaysClearOfTheBanner() {
        let app = launch(page: 4, filter: "reading:Q01-R02")
        let chip = element("qiraat-filter-chip", in: app)
        XCTAssertTrue(chip.waitForExistence(timeout: 15))
        XCTAssertTrue(chip.label.contains("ورش"), chip.label)
        XCTAssertFalse(app.staticTexts["الراوي ورش"].exists)
        for id in ["reading-surah-title", "reading-section-text"] {
            let text = app.staticTexts[id]
            XCTAssertTrue(text.waitForExistence(timeout: 5), id)
            XCTAssertFalse(chip.frame.intersects(text.frame), "\(id) is covered by the chip: \(chip.frame) vs \(text.frame)")
        }
        XCTAssertLessThanOrEqual(chip.frame.height, 52)
    }

    /// One tap on the chip opens the filter; changing it moves nothing: the page frame is identical
    /// with the header, after the change, and with the controls showing.
    func testChangingTheFilterFromTheChipNeverMovesThePage() {
        let app = launch(filter: "reading:Q01-R02")
        let mushafPage = element("mushaf-page-1", in: app)
        XCTAssertTrue(mushafPage.waitForExistence(timeout: 15))
        let before = mushafPage.frame
        let chip = element("qiraat-filter-chip", in: app)
        XCTAssertTrue(chip.waitForExistence(timeout: 5))
        chip.tap()
        let nafi = app.buttons["qiraat-reader-Q01"]
        XCTAssertTrue(nafi.waitForExistence(timeout: 5))
        nafi.tap()
        XCTAssertTrue(chip.waitForExistence(timeout: 5))
        XCTAssertTrue(chip.label.contains("نافع"), chip.label)
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the filter changed")

        showChrome(app)
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the controls showed")
        app.buttons["qiraat-button"].tap()
        openFilterSubmenu(app)
        // Items inside a menu are exposed by label.
        let all = app.buttons["الكل"]
        XCTAssertTrue(all.waitForExistence(timeout: 3))
        all.tap()
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the filter changed from the menu")

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()   // back to the reading header
        XCTAssertFalse(element("qiraat-filter-chip", in: app).waitForExistence(timeout: 2), "the filter is all again")
        XCTAssertEqual(mushafPage.frame, before)
    }

    func testTheMenuFilterCanPickANarrator() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        app.buttons["qiraat-button"].tap()
        openFilterSubmenu(app)
        let nafi = byLabel("الإمام", "نافع", in: app)
        XCTAssertTrue(nafi.waitForExistence(timeout: 3))
        nafi.tap()
        let warsh = byLabel("الراوي", "ورش", in: app)
        XCTAssertTrue(warsh.waitForExistence(timeout: 3))
        warsh.tap()
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        XCTAssertTrue(element("qiraat-filter-chip", in: app).waitForExistence(timeout: 5))
    }
}
