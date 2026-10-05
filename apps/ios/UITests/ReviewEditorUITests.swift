import XCTest

/// The developer review editor end to end against the in-memory stub (`-review-stub`): no network and no
/// real data. Also proves the Settings rows that existed before are all still there.
@MainActor
final class ReviewEditorUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(page: Int = 8) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-review-stub", "-mushaf1441:last-page:v1", "\(page)", "-review:last-page:v1", "\(page)",
                               "-mushaf1441:reader-layer:v1", "none"]
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement { app.descendants(matching: .any)[id] }

    private func openSettings(_ app: XCUIApplication) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()   // margin tap shows the chrome
        let settings = app.buttons["settings-button"]
        XCTAssertTrue(settings.waitForExistence(timeout: 10))
        settings.tap()
    }

    private func scrollTo(_ id: String, in app: XCUIApplication) -> XCUIElement {
        let target = element(id, in: app)
        var swipes = 0
        while !target.isHittable && swipes < 8 { app.swipeUp(); swipes += 1 }
        return target
    }

    func testTheEditorRowOpensTheHomeAndAPage() {
        let app = launch()
        openSettings(app)
        let row = scrollTo("open-review-editor", in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()
        XCTAssertTrue(element("review-home-progress", in: app).waitForExistence(timeout: 10))
        app.buttons["review-continue"].tap()
        XCTAssertTrue(element("review-page-canvas", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element("review-stats-bar", in: app).waitForExistence(timeout: 10))
        let word = element("review-word-002:049:001", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()
        XCTAssertTrue(element("review-sheet-word", in: app).waitForExistence(timeout: 5))
    }

    /// Settings → المطور → المحرر → متابعة, then waits for the page.
    private func openEditorPage(_ app: XCUIApplication) {
        openSettings(app)
        let row = scrollTo("open-review-editor", in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()
        XCTAssertTrue(app.buttons["review-continue"].waitForExistence(timeout: 10))
        app.buttons["review-continue"].tap()
        XCTAssertTrue(element("review-page-canvas", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element("review-word-002:049:001", in: app).waitForExistence(timeout: 10))
    }

    func testTappingAWordShowsItsFacesAndTheStepsAndTheApproveButton() {
        let app = launch()
        openEditorPage(app)
        element("review-word-002:049:001", in: app).tap()
        XCTAssertTrue(element("review-sheet-word", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("review-face-r-8-1", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("review-steps", in: app).exists)
        XCTAssertTrue(app.buttons["review-approve"].exists)
        app.buttons["٢ المراجع"].tap()
        XCTAssertTrue(element("review-reference-source", in: app).waitForExistence(timeout: 5))
    }

    func testApprovingMovesOnToTheNextUnreviewedWordAndShowsTheSaveStatus() {
        let app = launch()
        openEditorPage(app)
        element("review-word-002:049:001", in: app).tap()
        XCTAssertTrue(element("review-face-r-8-1", in: app).waitForExistence(timeout: 5))
        app.buttons["review-approve"].tap()
        // Word 2 carries the next unreviewed face (word 1's is now approved).
        XCTAssertTrue(element("review-face-r-8-2", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("review-save-status", in: app).waitForExistence(timeout: 10))
    }

    func testTheSettingsRowsThatExistedBeforeAreAllStillThere() {
        let app = launch()
        openSettings(app)
        for id in ["open-reading-statistics", "open-bookmarks-settings", "open-icloud-sync-settings",
                   "open-theme-settings", "open-language-settings", "open-database-settings"] {
            XCTAssertTrue(scrollTo(id, in: app).exists, "missing settings row \(id)")
        }
    }
}
