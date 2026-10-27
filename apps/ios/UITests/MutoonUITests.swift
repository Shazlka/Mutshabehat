import XCTest

/// «المزيد» → «المتون»: the three books, a book's chapters, a chapter's verses, and search. Runs on the synthetic set
/// the DEBUG build serves for `-mutoon-fixture`; its text is a placeholder, never real matn text.
@MainActor
final class MutoonUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-mushaf1441:last-page:v1", "1", "-mushaf1441:reader-layer:v1", "none", "-app:language:v1", "ar",
                               "-reading-fresh", "-memorization-seed", "empty", "-backup-folder", "none", "-mutoon-fixture"]
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement { app.descendants(matching: .any)[id] }

    private func openMutoon(_ app: XCUIApplication) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()   // margin tap shows the chrome
        let more = app.buttons["more-button"]
        XCTAssertTrue(more.waitForExistence(timeout: 20))
        more.tap()
        let row = app.buttons["mutoon-button"]
        XCTAssertTrue(row.waitForExistence(timeout: 20))
        row.tap()
    }

    func testTheMoreMenuOpensTheBooksAndAChaptersVerses() {
        let app = launch()
        openMutoon(app)
        for work in ["shatibiyyah", "durrah", "tayyibah"] {
            XCTAssertTrue(element("mutoon-work-\(work)", in: app).waitForExistence(timeout: 20), work)
        }
        element("mutoon-work-durrah", in: app).tap()
        let chapter = element("mutoon-chapter-1", in: app)
        XCTAssertTrue(chapter.waitForExistence(timeout: 10))
        chapter.tap()
        let verse = element("mutoon-verse-3", in: app)
        XCTAssertTrue(verse.waitForExistence(timeout: 10))
        XCTAssertTrue(verse.label.contains("بيت من الفرش"), verse.label)
    }

    func testSearchFindsAWordInEveryBookAndCloses() {
        let app = launch()
        openMutoon(app)
        XCTAssertTrue(element("mutoon-work-shatibiyyah", in: app).waitForExistence(timeout: 20))
        let field = app.textFields["mutoon-search-field"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText("مالك")
        let results = app.descendants(matching: .any).matching(identifier: "mutoon-search-result")
        XCTAssertTrue(results.firstMatch.waitForExistence(timeout: 10))
        XCTAssertEqual(results.count, 3, "one verse in each book")

        // «إغلاق» stays reachable while searching.
        let close = app.buttons["mutoon-close"].firstMatch
        XCTAssertTrue(close.isHittable)
        close.tap()
        XCTAssertFalse(element("mutoon-work-shatibiyyah", in: app).waitForExistence(timeout: 3))
    }
}
