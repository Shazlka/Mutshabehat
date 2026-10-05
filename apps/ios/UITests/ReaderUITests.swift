import XCTest

/// End-to-end checks on a simulator: the reader opens where it was left, turns the right way, and
/// the index jumps. Pages are found by accessibility identifier "mushaf-page-<n>".
/// `@MainActor`: every XCUIApplication / XCUIElement API is main-actor isolated under Swift 6.
@MainActor
final class ReaderUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    /// Launches with the stored reading position forced through the argument domain.
    private func launch(atPage page: Int, arabic: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        // Paging tests run on the plain mushaf: with the Qiraat layer on, a tap on a marked word
        // opens its card instead of the chrome.
        app.launchArguments = ["-mushaf1441:last-page:v1", "\(page)", "-mushaf1441:reader-layer:v1", "none",
                               "-app:language:v1", "ar"]
        if arabic { app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_SA"] }
        app.launch()
        return app
    }

    /// UIKit mirrors layout for Arabic; the pager forces LTR geometry so the curl must not flip.
    func testTurnDirectionIsTheSameWhenTheDeviceIsInArabic() {
        let app = launch(atPage: 50, arabic: true)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        let left = app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.6))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.6))
        left.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(page(51, in: app).waitForExistence(timeout: 5), "left edge → next page, in Arabic too")
    }

    private func page(_ number: Int, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)["mushaf-page-\(number)"]
    }

    func testOpensOnTheStoredPage() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
    }

    func testLiftingTheLeftEdgeTurnsForwardAndTheRightEdgeTurnsBack() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))

        let left = app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.6))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.6))
        left.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(page(51, in: app).waitForExistence(timeout: 5), "left edge → next page")

        right.press(forDuration: 0.05, thenDragTo: left)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 5), "right edge → previous page")
    }

    func testReopensOnThePageItWasLeftOn() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        let left = app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.6))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.6))
        left.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(page(51, in: app).waitForExistence(timeout: 5))
        app.terminate()

        let relaunched = XCUIApplication()  // no launch arguments: only what the app saved
        relaunched.launch()
        XCTAssertTrue(page(51, in: relaunched).waitForExistence(timeout: 10))
    }

    func testCannotTurnBeforePageOne() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))
        let left = app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.6))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.6))
        right.press(forDuration: 0.05, thenDragTo: left)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 3))
    }

    func testIndexJumpsToASurah() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()  // show chrome
        app.buttons["open-index"].tap()
        app.buttons["index-row-آل عمران"].tap()
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 5))
    }

    func testSettingsContainsThemeAndQiraatControlsWithoutBurgerMenu() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()

        XCTAssertFalse(app.buttons["reader-menu"].exists)
        let settingsButton = app.buttons["settings-button"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 3))
        settingsButton.tap()

        XCTAssertTrue(app.navigationBars["الإعدادات"].waitForExistence(timeout: 3))
        app.buttons["open-theme-settings"].tap()
        XCTAssertTrue(app.buttons["theme-system"].exists)
        XCTAssertTrue(app.buttons["theme-light"].exists)
        XCTAssertTrue(app.buttons["theme-dark"].exists)
        XCTAssertTrue(app.buttons["theme-whitePage"].exists)
        XCTAssertTrue(app.buttons["theme-blackPage"].exists)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.buttons["open-language-settings"].exists)
        XCTAssertTrue(app.switches["qiraat-toggle"].exists)
        XCTAssertTrue(app.buttons["open-qiraat-picker"].exists)
        XCTAssertFalse(app.buttons["settings-mutshabehat"].exists)
    }

    func testQiraatReaderPickerOpensFullScreenWithColoredReaders() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        app.buttons["settings-button"].tap()
        app.switches["qiraat-toggle"].tap()
        app.buttons["open-qiraat-picker"].tap()

        XCTAssertTrue(app.navigationBars["اختر القارئ أو الراوي"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["qiraat-reader-Q01"].exists)
        XCTAssertTrue(app.buttons["qiraat-narrator-Q01-R02"].exists)
    }

    func testMutshabehatOpensAsAFullScreenReaderDestination() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        app.buttons["mutshabehat-button"].tap()
        XCTAssertTrue(app.navigationBars["المتشابهات"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["settings-button"].exists)
    }

    func testSettingsOpensMutshabehatModule() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        let settingsButton = app.buttons["settings-button"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 3))
        settingsButton.tap()

        let mutshabehatLink = app.buttons["settings-mutshabehat"]
        XCTAssertTrue(mutshabehatLink.waitForExistence(timeout: 3))
        mutshabehatLink.tap()

        XCTAssertTrue(app.navigationBars["المتشابهات"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["الشخصية"].exists)
        XCTAssertTrue(app.buttons["الآلية"].exists)
    }

    func testTopBarShowsFullSurahWithoutMovingThePage() {
        let app = launch(atPage: 50)
        let mushafPage = page(50, in: app)
        XCTAssertTrue(mushafPage.waitForExistence(timeout: 10))
        let frameBeforeShowingChrome = mushafPage.frame
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()

        let index = app.buttons["open-index"]
        XCTAssertTrue(index.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["surah-title"].label.contains("آل عمران"))
        XCTAssertEqual(mushafPage.frame, frameBeforeShowingChrome, "Showing chrome must overlay the fixed Mushaf page")
        XCTAssertTrue(app.staticTexts["page-number"].exists, "Page number is shown on top")
        XCTAssertFalse(app.sliders["page-slider"].exists, "Lower banner slider is removed")
    }

    func testDeveloperDatabaseTransferControlsAreVisibleInDebugBuilds() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        app.buttons["settings-button"].tap()
        app.buttons["open-database-settings"].tap()
        XCTAssertTrue(app.buttons["export-qiraat-database"].exists)
        XCTAssertTrue(app.buttons["import-qiraat-database"].exists)
        XCTAssertTrue(app.buttons["export-mutshabehat-database"].exists)
        XCTAssertTrue(app.buttons["import-mutshabehat-database"].exists)
    }

    func testLanguageSelectionChangesSettingsMenusToEnglish() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        app.buttons["settings-button"].tap()
        app.buttons["open-language-settings"].tap()

        XCTAssertTrue(app.buttons["language-ar"].exists)
        app.buttons["language-en"].tap()
        XCTAssertTrue(app.navigationBars["Language"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["English"].exists)
    }

    func testSearchFindsAnAyahAndJumpsToItsPage() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        let searchButton = app.buttons["search-button"]
        XCTAssertTrue(searchButton.waitForExistence(timeout: 3))
        searchButton.tap()

        let field = app.textFields["search-field"].exists ? app.textFields["search-field"] : app.searchFields["search-field"]
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText("الله لا اله الا هو")
        app.buttons["search-submit"].tap()
        let result = app.buttons["search-result-2:255"]
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        result.tap()
        XCTAssertTrue(page(42, in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["search-highlighted-word"].waitForExistence(timeout: 3))
    }

    func testSmartSearchFindsModernSpellingOfUthmaniWord() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        app.buttons["search-button"].tap()

        let field = app.textFields["search-field"].exists ? app.textFields["search-field"] : app.searchFields["search-field"]
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText("الصلاة")
        app.buttons["search-submit"].tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'search-result-'")).firstMatch
            .waitForExistence(timeout: 5))
        XCTAssertTrue(app.segmentedControls["search-mode"].exists)
    }

    func testIPadLandscapeShowsASpreadAndTurnsTwoPagesAtATime() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad only") }
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(atPage: 50)  // spread (49 right, 50 left)
        XCTAssertTrue(page(49, in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(page(50, in: app).exists)
        XCTAssertLessThan(page(50, in: app).frame.midX, page(49, in: app).frame.midX, "odd page on the right")
        XCTAssertEqual(page(50, in: app).frame.maxX, page(49, in: app).frame.minX, accuracy: 1, "pages meet at the spine")
        saveScreenshot(named: "ipad-spread-49-50")

        let left = app.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.6))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.6))
        left.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(page(51, in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(page(52, in: app).exists)
        saveScreenshot(named: "ipad-spread-51-52")

        XCUIDevice.shared.orientation = .portrait  // back to a single page, same place
        XCTAssertTrue(page(51, in: app).waitForExistence(timeout: 5))
        XCTAssertFalse(page(52, in: app).exists)
    }

    /// Tapping edges or anywhere does not turn pages (turning is swipe-only); tapping toggles chrome.
    func testTappingEdgeDoesNotTurnPagesAndTapsToggleChrome() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))

        // Tapping the outer edge does NOT turn the page
        let leftEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5))
        leftEdge.tap()
        XCTAssertTrue(app.buttons["open-index"].waitForExistence(timeout: 3))
        XCTAssertTrue(page(50, in: app).exists)
        XCTAssertFalse(page(51, in: app).exists)

        // Swiping left to right turns the page
        let left = app.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.6))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.6))
        left.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(page(51, in: app).waitForExistence(timeout: 5))
    }

    func testTappingTheMiddleOfASpreadShowsTheChrome() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad only") }
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(atPage: 50)
        XCTAssertTrue(page(49, in: app).waitForExistence(timeout: 10))
        // The middle of the screen is the spine: it belongs to the reader, not to page turning.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(app.buttons["open-index"].waitForExistence(timeout: 3))
    }

    /// Keeps a screenshot with the test result (and in SCREENSHOT_DIR when the runner sets it).
    private func saveScreenshot(named name: String) {
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
