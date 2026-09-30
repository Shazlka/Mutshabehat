import XCTest

/// End-to-end checks on a simulator. Pages are found by accessibility identifier "mushaf-page-<n>".
/// `@MainActor`: every XCUIApplication / XCUIElement API is main-actor isolated under Swift 6.
@MainActor
final class ReaderUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    /// Launches with the stored reading position forced through the argument domain.
    private func launch(atPage page: Int, arabic: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-mushaf1441:last-page:v1", "\(page)"]
        if arabic { app.launchArguments += ["-AppleLanguages", "(ar)", "-AppleLocale", "ar_SA"] }
        app.launch()
        return app
    }

    private func page(_ number: Int, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)["mushaf-page-\(number)"]
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

    func testOpensOnTheStoredPage() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))
        saveScreenshot(named: "page-50")
    }

    func testOutOfRangeStoredPageIsClamped() {
        let app = launch(atPage: 9999)
        XCTAssertTrue(page(604, in: app).waitForExistence(timeout: 10))
    }
}
