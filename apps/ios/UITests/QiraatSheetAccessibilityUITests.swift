import XCTest

/// The Qiraat detail sheet at the largest accessibility text size: the variant word is still reachable and
/// stays inside the screen instead of being clipped.
@MainActor
final class QiraatSheetAccessibilityUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    func testVariantWordFitsAtAccessibilityExtraExtraLargeText() {
        let app = XCUIApplication()
        app.launchArguments = ["-mushaf1441:last-page:v1", "1", "-mushaf1441:qiraat-filter:v1", "all",
                               "-mushaf1441:reader-layer:v1", "qiraat",
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXL"]
        app.launch()
        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()

        let close = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(close.waitForExistence(timeout: 5))
        let variant = app.staticTexts["qiraat-variant-text"].firstMatch
        XCTAssertTrue(variant.waitForExistence(timeout: 5))

        // The sheet opens at a medium height; scroll its content until the word is on screen.
        let window = app.windows.firstMatch.frame
        var swipes = 0
        while (!variant.isHittable || variant.frame.maxY > window.maxY), swipes < 6 {
            app.swipeUp()
            swipes += 1
        }
        XCTAssertTrue(variant.isHittable, "the variant word is reachable at AX XXL text")

        let frame = variant.frame
        XCTAssertGreaterThan(frame.width, 40)
        XCTAssertGreaterThan(frame.height, 40)
        XCTAssertGreaterThanOrEqual(frame.minX, window.minX)
        XCTAssertLessThanOrEqual(frame.maxX, window.maxX)
        XCTAssertGreaterThanOrEqual(frame.minY, window.minY)
        XCTAssertLessThanOrEqual(frame.maxY, window.maxY)

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "qiraat-sheet-ax-xxl"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
