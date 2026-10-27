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
        XCTAssertTrue(element("mutoon-verse-3", in: app).waitForExistence(timeout: 10))
        let line = element("mutoon-line-3-0", in: app)
        XCTAssertTrue(line.exists)
        XCTAssertTrue((line.value as? String ?? line.label).contains("بيت من الفرش"), line.debugDescription)
    }

    /// The fixture marks the ب of «بيت» in verse 3: ابن وردان in الدرة. The ت of «تجربة» right under it is plain.
    func testARedSymbolNamesItsNarratorAndTheSwitchTurnsItOff() {
        let app = launch()
        openMutoon(app)
        // The switch is kept on the device (an isolated launch keeps UserDefaults): start from "on".
        let rootToggle = element("mutoon-symbols-toggle", in: app).firstMatch
        XCTAssertTrue(rootToggle.waitForExistence(timeout: 20))
        if (rootToggle.value as? String) == "0" { rootToggle.tap() }
        XCTAssertTrue(element("mutoon-symbols-key", in: app).waitForExistence(timeout: 10), "the key is shown")
        element("mutoon-work-durrah", in: app).tap()
        element("mutoon-chapter-1", in: app).tap()
        XCTAssertTrue(element("mutoon-line-3-1", in: app).waitForExistence(timeout: 10))
        // A red symbol is a link inside its hemistich: the ب of «بيت», and nothing in «تجربة» under it.
        let symbols = element("mutoon-line-3-0", in: app).links
        XCTAssertTrue(symbols.firstMatch.waitForExistence(timeout: 10), "the ب is a tappable symbol")
        XCTAssertEqual(symbols.count, 1)
        XCTAssertEqual(symbols.firstMatch.label, "ب")
        XCTAssertEqual(element("mutoon-line-3-1", in: app).links.count, 0, "the ت under it is not a symbol")
        symbols.firstMatch.tap()

        let names = element("mutoon-symbol-names", in: app)
        XCTAssertTrue(names.waitForExistence(timeout: 10))
        XCTAssertTrue(names.label.contains("ابن وردان"), names.label)
        XCTAssertTrue(element("mutoon-symbol-reader", in: app).label.contains("أبو جعفر"))
        app.buttons["mutoon-symbol-done"].tap()

        let toggle = element("mutoon-symbols-toggle", in: app).firstMatch
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        toggle.tap()
        XCTAssertFalse(symbols.firstMatch.waitForExistence(timeout: 2), "off: no red symbol")
        toggle.tap()   // leave the device setting as it was
        XCTAssertTrue(symbols.firstMatch.waitForExistence(timeout: 5))
    }

    func testSearchFindsAWordInEveryBookAndCloses() {
        let app = launch()
        openMutoon(app)
        XCTAssertTrue(element("mutoon-work-shatibiyyah", in: app).waitForExistence(timeout: 20))
        let field = app.textFields["mutoon-search-field"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        // Letter by letter: the results replacing the books list must not take the keyboard away mid-word.
        for letter in "مالك" { field.typeText(String(letter)) }
        XCTAssertEqual(field.value as? String, "مالك")
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
