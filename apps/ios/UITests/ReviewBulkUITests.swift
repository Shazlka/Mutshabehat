#if DEBUG
import XCTest

@MainActor
final class ReviewBulkUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(page: Int = 8) -> XCUIApplication {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-review-stub", "-mushaf1441:last-page:v1", "\(page)", "-review:last-page:v1", "\(page)",
                               "-mushaf1441:reader-layer:v1", "none"]
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement { app.descendants(matching: .any)[id] }

    private func openSettings(_ app: XCUIApplication) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()   // margin tap shows the chrome
        let settings = app.buttons["settings-button"]
        XCTAssertTrue(settings.waitForExistence(timeout: 20))
        settings.tap()
    }

    private func scrollTo(_ id: String, in app: XCUIApplication) -> XCUIElement {
        let target = element(id, in: app)
        var swipes = 0
        while !target.isHittable && swipes < 8 { app.swipeUp(); swipes += 1 }
        return target
    }

    /// Settings → المطور → المحرر → متابعة, then waits for the page.
    private func openEditorPage(_ app: XCUIApplication) {
        openSettings(app)
        let row = scrollTo("open-review-editor", in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 20))
        row.tap()
        XCTAssertTrue(app.buttons["review-continue"].waitForExistence(timeout: 20))
        app.buttons["review-continue"].tap()
        XCTAssertTrue(element("review-page-canvas", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("review-word-002:049:001", in: app).waitForExistence(timeout: 20))
    }

    func testFirstWordShowsSuggestionAndAddButton() {
        let app = launch(page: 8)
        openEditorPage(app)
        element("review-word-002:049:001", in: app).tap()
        XCTAssertTrue(element("review-sheet-word", in: app).waitForExistence(timeout: 20))
        element("review-sheet-word", in: app).swipeUp()
        // The card sits low in a lazy list: one swipe does not always lift the sheet off its half detent
        // (a slow machine drops it), so drag the list until the card is built.
        let card = element("review-suggestion-stub-exact", in: app)
        var drags = 0
        while !card.waitForExistence(timeout: 2) && drags < 6 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)))
            drags += 1
        }
        XCTAssertTrue(card.waitForExistence(timeout: 20))
        let add = app.buttons["review-suggestion-add-stub-exact"]
        XCTAssertTrue(add.exists)
        XCTAssertEqual(add.label, "➕ إضافة")
        XCTAssertTrue(add.isEnabled)
    }
}
#endif
