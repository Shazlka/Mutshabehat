import XCTest

/// The Qiraat layer end to end: marked words, the detail sheet, the filter, and the remembered toggle.
/// Marked words are exposed as accessibility elements "qiraat-word-<surah>:<ayah>:<token>".
@MainActor
final class QiraatUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(atPage page: Int, layer: String? = "qiraat", filter: String = "all") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-mushaf1441:last-page:v1", "\(page)", "-mushaf1441:qiraat-filter:v1", filter,
                               "-reading-fresh", "-app:language:v1", "ar"]
        if let layer { app.launchArguments += ["-mushaf1441:reader-layer:v1", layer] }
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    func testColdLaunchWordTapsSurviveBackgroundAndSettingsWithoutAPageTurn() {
        let app = launch(atPage: 1)
        let wordID = "qiraat-word-1:4:1"
        let word = element(wordID, in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 10))

        func openAndCloseWord() {
            element(wordID, in: app).tap()
            let close = app.buttons["qiraat-sheet-close"]
            XCTAssertTrue(close.waitForExistence(timeout: 5))
            XCTAssertTrue(app.staticTexts["الإمام نافع"].exists)
            close.tap()
            XCTAssertTrue(element("mushaf-page-1", in: app).exists)
        }

        openAndCloseWord()
        XCUIDevice.shared.press(.home)
        app.activate()
        openAndCloseWord()

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        app.buttons["settings-button"].tap()
        let done = app.buttons["تم"]
        XCTAssertTrue(done.waitForExistence(timeout: 5))
        done.tap()
        openAndCloseWord()
    }

    /// 1:4 مَـٰلِكِ / مَلِكِ: six readers read ملك; عاصم reads it like Hafs, so he is not listed.
    func testTappingAMarkedWordShowsWhoReadsIt() {
        let app = launch(atPage: 1)
        let word = element("qiraat-word-1:4:1", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()
        XCTAssertTrue(app.staticTexts["الإمام نافع"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["الإمام أبو جعفر"].exists)
        XCTAssertFalse(app.staticTexts["الإمام عاصم"].exists)
        saveScreenshot(named: "qiraat-sheet-1-4", app: app)
    }

    func testANarratorFilterNarrowsTheCardToThatNarrator() {
        let app = launch(atPage: 1, filter: "reading:Q01-R02")
        let word = element("qiraat-word-1:4:1", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()
        XCTAssertTrue(app.staticTexts["الراوي ورش"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["الإمام ابن كثير"].exists)
    }

    func testANewInstallStartsWithTheQiraatLayerOn() {
        let app = launch(atPage: 1, layer: nil)
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 10))
    }

    func testTheLayerToggleTurnsMarksOffAndIsRemembered() {
        let app = launch(atPage: 1)
        XCTAssertTrue(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 10))
        saveScreenshot(named: "qiraat-page-1", app: app)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()  // margin tap to toggle chrome safely
        let settingsButton = app.buttons["settings-button"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 5))
        settingsButton.tap()

        let toggle = app.switches["qiraat-toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        toggle.switches.firstMatch.tap()   // the row is one element; only the switch inside it reacts
        let done = app.buttons["تم"]
        XCTAssertTrue(done.waitForExistence(timeout: 5))
        done.tap()

        XCTAssertFalse(element("qiraat-word-1:4:1", in: app).waitForExistence(timeout: 2))
        app.terminate()

        let relaunched = XCUIApplication()
        relaunched.launchArguments = ["-mushaf1441:last-page:v1", "1", "-reading-fresh"]
        relaunched.launch()
        XCTAssertTrue(element("mushaf-page-1", in: relaunched).waitForExistence(timeout: 10))
        XCTAssertFalse(element("qiraat-word-1:4:1", in: relaunched).exists)

        // Leave the device as a new install would be, so the other tests start from the default.
        relaunched.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        relaunched.buttons["settings-button"].tap()
        relaunched.switches["qiraat-toggle"].switches.firstMatch.tap()
        relaunched.buttons["تم"].tap()
        XCTAssertTrue(element("qiraat-word-1:4:1", in: relaunched).waitForExistence(timeout: 5))
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
