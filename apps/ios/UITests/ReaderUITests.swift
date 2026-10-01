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
        app.launchArguments = ["-mushaf1441:last-page:v1", "\(page)", "-mushaf1441:reader-layer:v1", "none"]
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

    /// Several slider jumps in a row land on a page without crashing. XCUITest waits for the app to
    /// go idle between gestures, so this cannot overlap two curls; that case is still unverified.
    func testSeveralSliderJumpsInARowLandOnAPage() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let slider = app.sliders["page-slider"]
        XCTAssertTrue(slider.waitForExistence(timeout: 3))
        slider.adjust(toNormalizedSliderPosition: 0.3)
        slider.adjust(toNormalizedSliderPosition: 0.6)
        slider.adjust(toNormalizedSliderPosition: 0.1)
        XCTAssertEqual(app.state, .runningForeground)
        let shown = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'mushaf-page-'"))
        XCTAssertTrue(shown.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(app.state, .runningForeground)
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

    func testOutOfRangeStoredPageIsClamped() {
        let app = launch(atPage: 9999)
        XCTAssertTrue(page(604, in: app).waitForExistence(timeout: 10))
    }
}
