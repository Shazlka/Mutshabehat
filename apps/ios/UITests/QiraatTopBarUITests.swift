import XCTest

/// A tap on the reading header shows or hides the controls: with the Qiraat layer on, the page centre is a marked word.
/// The Qiraat entry in the reader's top bar: the icon and its menu, the filter chip in the reading
/// header, and the «المزيد» menu that now holds المتشابهات and الحفظ.
@MainActor
final class QiraatTopBarUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(page: Int = 1, filter: String = "all", layer: String = "qiraat") -> XCUIApplication {
        let app = XCUIApplication.isolated()
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

    /// The reader / narrator filter is an entry of the Qiraat menu that opens the full-screen picker.
    private func openFilterPicker(_ app: XCUIApplication) {
        let entry = element("qiraat-filter", in: app)
        XCTAssertTrue(entry.waitForExistence(timeout: 20), "the filter entry is in the Qiraat menu")
        entry.tap()
        XCTAssertTrue(app.buttons["qiraat-reader-all"].waitForExistence(timeout: 20), "the picker opened")
    }

    private func showChrome(_ app: XCUIApplication) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()
        XCTAssertTrue(app.buttons["open-index"].waitForExistence(timeout: 20))
    }

    /// Every menu is in the footer bar: six icons of at least 44 points, wholly below the page, none on another.
    func testTheFooterBarHasExactlySixIconsOfAtLeast44PointsBelowThePage() {
        let app = launch()
        let mushafPage = element("mushaf-page-1", in: app)
        XCTAssertTrue(mushafPage.waitForExistence(timeout: 15))
        showChrome(app)
        let ids = ["open-index", "search-button", "bookmarks-button", "qiraat-button", "more-button", "settings-button"]
        var frames: [CGRect] = []
        for id in ids {
            let icon = app.buttons[id]
            XCTAssertTrue(icon.waitForExistence(timeout: 20), id)
            XCTAssertGreaterThanOrEqual(icon.frame.width, 43.5, id)
            XCTAssertGreaterThanOrEqual(icon.frame.height, 43.5, id)
            // The bar sits wholly below the paper: it never covers the page.
            XCTAssertGreaterThanOrEqual(icon.frame.minY, mushafPage.frame.maxY, "\(id) overlaps the page")
            // Above the screen's bottom edge and its rounded corners, never cut by them.
            XCTAssertLessThanOrEqual(icon.frame.maxY, app.windows.firstMatch.frame.maxY - 20, "\(id) is too low")
            frames.append(icon.frame)
        }
        for (i, a) in frames.enumerated() {
            for b in frames[(i + 1)...] { XCTAssertFalse(a.insetBy(dx: 1, dy: 1).intersects(b), "\(a) overlaps \(b)") }
        }
        // The two moved buttons are inside the menu, not in the bar.
        XCTAssertFalse(app.buttons["mutshabehat-button"].exists)
        XCTAssertFalse(app.buttons["memorization-button"].exists)
    }

    /// All the information stays at the top, with the bar hidden and showing: the surah, the juz and hizb and the
    /// khatma progress are on screen above the page in both states, and the page does not move.
    func testTheInformationStaysOnTopWhileTheFooterBarShowsAndHides() {
        let app = launch()
        let mushafPage = element("mushaf-page-1", in: app)
        XCTAssertTrue(mushafPage.waitForExistence(timeout: 15))
        let before = mushafPage.frame
        let ids = ["reading-surah-title", "reading-section-text", "khatma-progress", "reading-page-number"]
        func assertOnTop() {
            for id in ids {
                let item = element(id, in: app)
                XCTAssertTrue(item.waitForExistence(timeout: 20), id)
                XCTAssertLessThan(item.frame.maxY, mushafPage.frame.minY + 4, "\(id) is not above the page")
            }
        }
        assertOnTop()
        showChrome(app)
        assertOnTop()
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the footer bar showed")
    }

    /// Page number and surah at the right, the khatma progress in the middle, the juz and hizb at the left.
    func testTheHeaderPutsTheJuzOnTheLeftAndTheProgressInTheMiddle() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        let surah = element("reading-surah-title", in: app)
        let khatma = element("khatma-progress", in: app)
        let section = element("reading-section-text", in: app)
        for item in [surah, khatma, section] { XCTAssertTrue(item.waitForExistence(timeout: 20)) }
        XCTAssertGreaterThan(surah.frame.midX, khatma.frame.midX, "the surah is right of the progress")
        XCTAssertGreaterThan(khatma.frame.midX, section.frame.midX, "the progress is right of the juz and hizb")
        XCTAssertLessThan(section.frame.midX, app.frame.midX, "the juz and hizb are on the left half")
        XCTAssertEqual(khatma.frame.midX, app.frame.midX, accuracy: app.frame.width * 0.2, "the progress is in the middle")
        XCTAssertFalse(khatma.frame.intersects(section.frame))
        XCTAssertFalse(khatma.frame.intersects(surah.frame))
    }

    func testMoreMenuHoldsMutshabehatAndMemorization() {
        let app = launch()
        showChrome(app)
        app.buttons["more-button"].tap()
        XCTAssertTrue(app.buttons["mutshabehat-button"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["memorization-button"].exists)
    }

    func testTheQiraatMenuSwitchesTheLayerOffAndOn() {
        let app = launch()
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        app.buttons["qiraat-button"].tap()
        let toggle = element("qiraat-hub-toggle", in: app)
        XCTAssertTrue(toggle.waitForExistence(timeout: 20))
        toggle.tap()
        XCTAssertFalse(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 2))
        app.buttons["qiraat-button"].tap()
        XCTAssertTrue(element("qiraat-hub-toggle", in: app).waitForExistence(timeout: 20))
        element("qiraat-hub-toggle", in: app).tap()
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 20))
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
            XCTAssertTrue(text.waitForExistence(timeout: 20), id)
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
        XCTAssertTrue(chip.waitForExistence(timeout: 20))
        chip.tap()
        let nafi = app.buttons["qiraat-reader-Q01"]
        XCTAssertTrue(nafi.waitForExistence(timeout: 20))
        nafi.tap()
        XCTAssertTrue(chip.waitForExistence(timeout: 20))
        XCTAssertTrue(chip.label.contains("نافع"), chip.label)
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the filter changed")

        showChrome(app)
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the controls showed")
        app.buttons["qiraat-button"].tap()
        openFilterPicker(app)
        app.buttons["qiraat-reader-all"].tap()
        XCTAssertEqual(mushafPage.frame, before, "the page moved when the filter changed from the menu")

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()   // back to the reading header
        XCTAssertFalse(element("qiraat-filter-chip", in: app).waitForExistence(timeout: 2), "the filter is all again")
        XCTAssertEqual(mushafPage.frame, before)
    }

    func testTheMenuFilterCanPickANarrator() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        app.buttons["qiraat-button"].tap()
        openFilterPicker(app)
        let warsh = app.buttons["qiraat-narrator-Q01-R02"]
        XCTAssertTrue(warsh.waitForExistence(timeout: 20))
        warsh.tap()
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()
        XCTAssertTrue(element("qiraat-filter-chip", in: app).waitForExistence(timeout: 20))
    }

    /// The picker is full screen with every reader and narrator in three columns, none behind a scroll.
    func testThePickerShowsEveryReaderAndNarratorInThreeColumnsOnOneScreen() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        app.buttons["qiraat-button"].tap()
        openFilterPicker(app)
        let screen = app.windows.firstMatch.frame
        var columns = Set<Int>()
        for n in 1...10 {
            let id = String(format: "Q%02d", n)
            let reader = app.buttons["qiraat-reader-\(id)"]
            XCTAssertTrue(reader.exists, id)
            XCTAssertTrue(screen.contains(reader.frame), "\(id) is not on the screen: \(reader.frame)")
            columns.insert(Int((reader.frame.midX / 10).rounded()))
            for r in 1...2 {
                let narrator = app.buttons["qiraat-narrator-\(id)-R0\(r)"]
                XCTAssertTrue(narrator.exists && screen.contains(narrator.frame), "\(id)-R0\(r) is not on the screen")
            }
        }
        XCTAssertEqual(columns.count, 3, "the readers are in three columns: \(columns)")
        app.buttons["qiraat-narrator-Q05-R01"].tap()
        XCTAssertFalse(app.buttons["qiraat-reader-all"].waitForExistence(timeout: 3), "choosing closes the picker")
        XCTAssertTrue(element("qiraat-filter-chip", in: app).waitForExistence(timeout: 20))
    }

    /// A finger on the bar raises the glass lens under the touched item and moves it as the finger slides.
    func testTheGlassLensFollowsAFingerSlidingAlongTheBar() {
        let app = launch()
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 15))
        showChrome(app)
        let bar = element("footer-bar", in: app)
        XCTAssertTrue(bar.waitForExistence(timeout: 20))
        XCTAssertEqual(bar.value as? String, "slot:none last:none")
        let left = app.buttons["settings-button"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let right = app.buttons["open-index"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        // Touch the left slot and slide to the right one: the lens was under the last slot, and left with the finger.
        left.press(forDuration: 0.2, thenDragTo: right, withVelocity: .slow, thenHoldForDuration: 0.3)
        XCTAssertEqual(bar.value as? String, "slot:none last:5", "the lens followed the finger to the right end")
    }
}
