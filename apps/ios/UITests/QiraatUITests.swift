import XCTest

/// The Qiraat layer end to end: marked words, the detail sheet, the filter, and the remembered toggle.
/// Marked words are exposed as accessibility elements "qiraat-word-<surah>:<ayah>:<token>".
@MainActor
final class QiraatUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(atPage page: Int, layer: String? = "qiraat", filter: String = "all") -> XCUIApplication {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-mushaf1441:last-page:v1", "\(page)", "-mushaf1441:qiraat-filter:v1", filter,
                               "-reading-fresh", "-app:language:v1", "ar"]
        if let layer { app.launchArguments += ["-mushaf1441:reader-layer:v1", layer] }
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    /// iPad landscape with «تعلّم»: one page, and the side bar at its right shows the page's differences, then the
    /// card of a tapped word in place of the sheet; closing the card brings the page's differences back.
    func testIPadLearningViewShowsOnePageAndTheTappedWordInTheSideBar() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad only") }
        XCUIDevice.shared.orientation = .landscapeLeft
        addTeardownBlock { XCUIDevice.shared.orientation = .portrait }
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-mushaf1441:last-page:v1", "1", "-mushaf1441:qiraat-filter:v1", "all",
                               "-mushaf1441:reader-layer:v1", "qiraat", "-reading-fresh", "-app:language:v1", "ar",
                               "-mushaf:landscapeView:v1", "learning"]
        app.launch()

        let mushafPage = element("mushaf-page-1", in: app)
        XCTAssertTrue(mushafPage.waitForExistence(timeout: 30))
        XCTAssertFalse(element("mushaf-page-2", in: app).exists, "one page, not a spread")
        let sideBar = element("qiraat-side-bar", in: app)
        XCTAssertTrue(sideBar.waitForExistence(timeout: 20))
        XCTAssertGreaterThanOrEqual(sideBar.frame.minX, mushafPage.frame.maxX - 1, "the side bar is right of the page")
        XCTAssertTrue(element("qiraat-page-summary", in: app).waitForExistence(timeout: 20), "the page's differences")

        let word = element("qiraat-word-1:4:1", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 30))
        word.tap()
        let close = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(sideBar.frame.contains(close.frame), "the card is in the side bar, not a sheet")
        XCTAssertTrue(app.staticTexts["الإمام نافع"].exists)
        XCTAssertTrue(mushafPage.isHittable, "the page stays usable beside the card")

        close.tap()
        XCTAssertTrue(element("qiraat-page-summary", in: app).waitForExistence(timeout: 10))
        XCTAssertFalse(close.exists)
    }

    /// iPad landscape: the header's information stands in a rail left of the spread, the footer's actions in a rail
    /// right of it, the pages take nearly the full height, and the rail's القراءات and المزيد menus open and work.
    func testIPadLandscapeRailsHoldTheHeaderAndTheFooter() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad only") }
        XCUIDevice.shared.orientation = .landscapeLeft
        addTeardownBlock { XCUIDevice.shared.orientation = .portrait }
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-mushaf1441:last-page:v1", "50", "-mushaf1441:qiraat-filter:v1", "all",
                               "-mushaf1441:reader-layer:v1", "qiraat", "-reading-fresh", "-app:language:v1", "ar",
                               "-show-chrome"]
        app.launch()

        let left = element("mushaf-page-50", in: app), right = element("mushaf-page-49", in: app)
        XCTAssertTrue(left.waitForExistence(timeout: 30))
        XCTAssertTrue(right.exists)
        // No header across the top and no footer bar: the spread starts near the top of the screen (on a 13-inch
        // iPad it is then as wide as the space between the rails allows).
        XCTAssertFalse(app.tabBars.firstMatch.exists, "no footer bar")
        XCTAssertLessThan(left.frame.minY, app.windows.firstMatch.frame.height * 0.1, "no header above the pages")
        for id in ["reading-page-number", "reading-surah-title", "khatma-progress"] {
            let item = element(id, in: app)
            XCTAssertTrue(item.waitForExistence(timeout: 10), id)
            XCTAssertLessThanOrEqual(item.frame.maxX, left.frame.minX + 1, "\(id) is in the left rail")
        }
        for id in ["open-index", "search-button", "bookmarks-button", "qiraat-button", "more-button", "settings-button"] {
            let button = app.buttons[id]
            XCTAssertTrue(button.waitForExistence(timeout: 10), id)
            XCTAssertGreaterThanOrEqual(button.frame.minX, right.frame.maxX - 1, "\(id) is in the right rail")
            XCTAssertGreaterThanOrEqual(button.frame.height, 44, id)
        }

        // A swipe that starts on the left rail turns the spread, as one from the page's edge does.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.8))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.8)))
        XCTAssertTrue(element("mushaf-page-51", in: app).waitForExistence(timeout: 20), "the next spread")

        app.buttons["more-button"].tap()
        XCTAssertTrue(element("mutshabehat-button", in: app).waitForExistence(timeout: 10), "the more menu opened")
        app.otherElements["PopoverDismissRegion"].firstMatch.tap()   // a tap outside the popover closes it
        XCTAssertTrue(element("mutshabehat-button", in: app).waitForNonExistence(timeout: 10))

        app.buttons["qiraat-button"].tap()
        let filterRow = element("qiraat-filter", in: app)
        XCTAssertTrue(filterRow.waitForExistence(timeout: 10), "the Qiraat menu opened")
        filterRow.tap()
        XCTAssertTrue(app.buttons["qiraat-reader-all"].waitForExistence(timeout: 20), "a row of the menu works")
    }

    /// Settings offers «العرض الأفقي» (قراءة / تعلّم) on an iPad only.
    func testSettingsOffersTheLandscapeViewOnIPad() {
        let app = launch(atPage: 1)
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 30))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()
        let settings = app.buttons["settings-button"]
        XCTAssertTrue(settings.waitForExistence(timeout: 20))
        settings.tap()
        XCTAssertTrue(app.buttons["تم"].waitForExistence(timeout: 20))
        let picker = element("landscape-view-picker", in: app)
        if UIDevice.current.userInterfaceIdiom == .pad {
            var swipes = 0
            while !picker.exists && swipes < 4 { app.swipeUp(); swipes += 1 }
            XCTAssertTrue(picker.exists)
        } else {
            XCTAssertFalse(picker.exists)
        }
    }

    func testColdLaunchWordTapsSurviveBackgroundAndSettingsWithoutAPageTurn() {
        let app = launch(atPage: 1)
        let wordID = "qiraat-word-1:4:1"
        let word = element(wordID, in: app)
        // A cold launch loads the page font and the Qiraat snapshot; on a busy machine that can pass 10 s.
        XCTAssertTrue(word.waitForExistence(timeout: 30))

        func openAndCloseWord() {
            let close = app.buttons["qiraat-sheet-close"]
            // The first touch in the instant after the app returns from the background can be dropped by the
            // system before it reaches the page (the app logs no tap at all), so a lost tap is repeated once.
            for attempt in 1...2 {
                element(wordID, in: app).tap()
                if close.waitForExistence(timeout: attempt == 1 ? 3 : 5) { break }
            }
            XCTAssertTrue(close.exists)
            XCTAssertTrue(app.staticTexts["الإمام نافع"].exists)
            close.tap()
            XCTAssertTrue(element("mushaf-page-1", in: app).exists)
        }

        openAndCloseWord()
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(element("mushaf-page-1", in: app).waitForExistence(timeout: 20))
        openAndCloseWord()

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()
        app.buttons["settings-button"].tap()
        let done = app.buttons["تم"]
        XCTAssertTrue(done.waitForExistence(timeout: 20))
        done.tap()
        openAndCloseWord()
    }

    /// 1:4 مَـٰلِكِ / مَلِكِ: six readers read ملك; عاصم reads it like Hafs, so he is not listed.
    func testTappingAMarkedWordShowsWhoReadsIt() {
        let app = launch(atPage: 1)
        let word = element("qiraat-word-1:4:1", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 20))
        word.tap()
        XCTAssertTrue(app.staticTexts["الإمام نافع"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["الإمام أبو جعفر"].exists)
        XCTAssertFalse(app.staticTexts["الإمام عاصم"].exists)
        saveScreenshot(named: "qiraat-sheet-1-4", app: app)
    }

    func testANarratorFilterNarrowsTheCardToThatNarrator() {
        let app = launch(atPage: 1, filter: "reading:Q01-R02")
        let word = element("qiraat-word-1:4:1", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 20))
        word.tap()
        XCTAssertTrue(app.staticTexts["الراوي ورش"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["الإمام ابن كثير"].exists)
    }

    func testANewInstallStartsWithTheQiraatLayerOn() {
        let app = launch(atPage: 1, layer: nil)
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 30))
    }

    func testTheLayerToggleTurnsMarksOffAndIsRemembered() {
        let app = launch(atPage: 1)
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 20))
        saveScreenshot(named: "qiraat-page-1", app: app)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()  // margin tap to toggle chrome safely
        let settingsButton = app.buttons["settings-button"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 20))
        settingsButton.tap()

        let toggle = app.switches["qiraat-toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 20))
        toggle.switches.firstMatch.tap()   // the row is one element; only the switch inside it reacts
        let done = app.buttons["تم"]
        XCTAssertTrue(done.waitForExistence(timeout: 20))
        done.tap()

        XCTAssertFalse(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 2))
        app.terminate()

        let relaunched = XCUIApplication.isolated()
        relaunched.launchArguments = ["-mushaf1441:last-page:v1", "1", "-mushaf1441:qiraat-filter:v1", "all", "-reading-fresh"]
        relaunched.launch()
        XCTAssertTrue(element("mushaf-page-1", in: relaunched).waitForExistence(timeout: 20))
        XCTAssertFalse(element("qiraat-word-1:4:1", in: relaunched).exists)

        // Leave the device as a new install would be, so the other tests start from the default.
        relaunched.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()
        XCTAssertTrue(relaunched.buttons["settings-button"].waitForExistence(timeout: 20))
        relaunched.buttons["settings-button"].tap()
        let relaunchedToggle = relaunched.switches["qiraat-toggle"]
        XCTAssertTrue(relaunchedToggle.waitForExistence(timeout: 20))
        XCTAssertTrue(relaunchedToggle.switches.firstMatch.waitForExistence(timeout: 20))
        relaunchedToggle.switches.firstMatch.tap()
        XCTAssertEqual(relaunchedToggle.switches.firstMatch.value as? String, "1", "the layer switch turned on")
        XCTAssertTrue(relaunched.buttons["تم"].waitForExistence(timeout: 20))
        relaunched.buttons["تم"].tap()
        XCTAssertTrue(element("qiraat-word-1:4:1", in: relaunched).waitForExistence(timeout: 20))
    }

    private func saveScreenshot(named name: String, app: XCUIApplication) {
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] {
            try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
