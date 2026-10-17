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

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
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
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()  // margin tap to toggle chrome safely
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
        relaunched.launchArguments = ["-mushaf1441:last-page:v1", "1", "-reading-fresh"]
        relaunched.launch()
        XCTAssertTrue(element("mushaf-page-1", in: relaunched).waitForExistence(timeout: 20))
        XCTAssertFalse(element("qiraat-word-1:4:1", in: relaunched).exists)

        // Leave the device as a new install would be, so the other tests start from the default.
        relaunched.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
        relaunched.buttons["settings-button"].tap()
        relaunched.switches["qiraat-toggle"].switches.firstMatch.tap()
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
