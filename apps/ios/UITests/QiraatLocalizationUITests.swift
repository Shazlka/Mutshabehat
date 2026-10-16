import XCTest

/// With the app language set to English, the Qiraat word sheet is translated: its title, its close button and its
/// chrome labels. The Quran text, reader and narrator names and ruling data stay Arabic.
///
/// The language is given as a launch argument (the argument domain shadows the stored value for this launch only),
/// so this test never writes the language into the simulator's stored settings and cannot affect the tests that run
/// after it. Switching the language in Settings is covered by `ReaderUITests.testLanguageSelectionChangesSettingsMenusToEnglish`.
@MainActor
final class QiraatLocalizationUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(language: String) -> XCUIApplication {
        let app = XCUIApplication.isolated()
        app.launchArguments = [
            "-mushaf1441:last-page:v1", "1",
            "-mushaf1441:reader-layer:v1", "qiraat",
            "-mushaf1441:qiraat-filter:v1", "all",
            "-app:language:v1", language,
        ]
        app.launch()
        return app
    }

    func testTheQiraatWordSheetIsEnglishWhenTheAppLanguageIsEnglish() {
        let app = launch(language: "en")
        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 15))
        word.tap()

        XCTAssertTrue(app.navigationBars["The Ten Qira\u{2019}at"].waitForExistence(timeout: 5), "sheet title is English")
        XCTAssertFalse(app.navigationBars["القراءات العشر"].exists)
        let close = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(close.waitForExistence(timeout: 3))
        XCTAssertEqual(close.label, "Close")
        XCTAssertTrue(classificationLine(containing: "Orthography", in: app).waitForExistence(timeout: 3),
                      "the difference-kind badge is English")
        XCTAssertFalse(classificationLine(containing: "خلاف في الرسم", in: app).exists)
        saveScreenshot(named: "qiraat-sheet-english", app: app)
    }

    func testTheQiraatWordSheetStaysArabicWhenTheAppLanguageIsArabic() {
        let app = launch(language: "ar")
        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 15))
        word.tap()

        XCTAssertTrue(app.navigationBars["القراءات العشر"].waitForExistence(timeout: 5), "sheet title is Arabic")
        XCTAssertTrue(classificationLine(containing: "خلاف في الرسم", in: app).waitForExistence(timeout: 3),
                      "the difference-kind badge is Arabic")
        XCTAssertFalse(classificationLine(containing: "Orthography", in: app).exists)
    }

    /// The word sheet's classification line («فرش الحروف › {sub-category}») whose spoken label contains `text`.
    private func classificationLine(containing text: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: "qiraat-classification")
            .matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
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
