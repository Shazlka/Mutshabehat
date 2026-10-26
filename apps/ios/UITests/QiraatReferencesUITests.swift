import XCTest

/// The references row of the Qiraat card, against the synthetic set the DEBUG build serves for
/// `-qiraat-references-fixture`. The text is a placeholder, never real matn text.
@MainActor
final class QiraatReferencesUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    func testTheReferencesRowOpensInlineAndShowsTheVerseAndItsWork() {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-mushaf1441:last-page:v1", "1", "-mushaf1441:qiraat-filter:v1", "all",
                               "-mushaf1441:reader-layer:v1", "qiraat", "-qiraat-references-fixture"]
        app.launch()
        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 20))
        word.tap()

        let row = app.buttons["qiraat-references-row"].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 20))
        var swipes = 0
        while !row.isHittable, swipes < 6 { app.swipeUp(); swipes += 1 }
        XCTAssertTrue(row.isHittable)
        XCTAssertGreaterThanOrEqual(row.frame.height, 44, "the row meets the 44 pt target")
        for work in ["shatibiyyah", "durrah", "tayyibah"] {
            XCTAssertTrue(app.descendants(matching: .any)["qiraat-reference-chip-\(work)"].firstMatch.exists, "\(work) chip")
        }
        XCTAssertFalse(app.descendants(matching: .any)["qiraat-reference-lines"].firstMatch.exists, "closed until tapped")

        row.tap()
        let lines = app.descendants(matching: .any)["qiraat-reference-lines"].firstMatch
        XCTAssertTrue(lines.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["qiraat-sheet-close"].exists, "the card stayed open: the references open inline")

        row.tap()
        XCTAssertFalse(lines.waitForExistence(timeout: 1), "tapping again closes it")
    }

    func testWithoutReferencesTheCardShowsNoReferencesRow() {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-mushaf1441:last-page:v1", "1", "-mushaf1441:qiraat-filter:v1", "all",
                               "-mushaf1441:reader-layer:v1", "qiraat"]
        app.launch()
        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 20))
        word.tap()
        XCTAssertTrue(app.staticTexts["qiraat-variant-text"].firstMatch.waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["qiraat-references-row"].exists)
    }
}
