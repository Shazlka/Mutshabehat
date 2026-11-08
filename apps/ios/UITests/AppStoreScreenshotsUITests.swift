import XCTest

/// The App Store screenshot set from `docs/release/app-store-connect.md`.
///
/// This suite is opt-in because it launches the app six times per language and keeps every screenshot.
/// `scripts/app_store_screenshots.sh` supplies `QIRAAT_SCREENSHOTS=1` and exports the attachments.
@MainActor
final class AppStoreScreenshotsUITests: XCTestCase {
    override nonisolated func setUpWithError() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["QIRAAT_SCREENSHOTS"] == "1" else {
            throw XCTSkip("Set QIRAAT_SCREENSHOTS=1 to generate the App Store screenshot set")
        }
    }

    func testArabicScreenshots() {
        captureScreenshots(language: .arabic)
    }

    func testEnglishScreenshots() {
        captureScreenshots(language: .english)
    }

    private enum ScreenshotLanguage: String {
        case arabic = "ar"
        case english = "en"

        var appleLanguages: String { self == .arabic ? "(ar)" : "(en)" }
        var locale: String { self == .arabic ? "ar_SA" : "en_US" }
    }

    private var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    private func captureScreenshots(language: ScreenshotLanguage) {
        if isPad {
            XCUIDevice.shared.orientation = .landscapeLeft
            addTeardownBlock { XCUIDevice.shared.orientation = .portrait }
        }

        captureQiraatLayer(language: language)
        captureWordCard(language: language)
        captureNarratorSummary(language: language)
        captureMutoon(language: language)
    }

    /// Screenshot 1, deliberately first: the ten-readings word layer is the app's differentiator.
    private func captureQiraatLayer(language: ScreenshotLanguage) {
        let app = launch(
            language: language,
            page: 2,
            extra: ["-show-chrome", "-mushaf:landscapeView:v1", "reading"]
        )
        waitFor("mushaf-page-2", in: app)
        waitForQiraatWord(onPage: 2, in: app)
        saveScreenshot(1, screen: "qiraat-layer", language: language)
        app.terminate()
    }

    private func captureWordCard(language: ScreenshotLanguage) {
        let landscapeMode = isPad ? "learning" : "reading"
        let app = launch(
            language: language,
            page: 1,
            extra: ["-show-chrome", "-mushaf:landscapeView:v1", landscapeMode]
        )
        let word = element("qiraat-word-1:4:1", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 30), "The Fatihah مَـٰلِكِ variant must be visible")
        if isPad { waitFor("qiraat-side-bar", in: app) }
        word.tap()
        waitFor("qiraat-sheet-close", in: app)
        waitFor("qiraat-variant-text", in: app)
        saveScreenshot(2, screen: "word-card", language: language)
        app.terminate()
    }

    private func captureNarratorSummary(language: ScreenshotLanguage) {
        let app = launch(
            language: language,
            page: 2,
            filter: "reading:Q01-R02",
            extra: ["-show-chrome", "-mushaf:landscapeView:v1", "reading"]
        )
        waitFor("mushaf-page-2", in: app)
        waitFor("qiraat-filter-chip", in: app)
        openBarMenu(button: "qiraat-button", in: app)
        let summary = app.buttons["qiraat-hub-page-summary"]
        XCTAssertTrue(summary.waitForExistence(timeout: 20), "The page-summary action must be available")
        summary.tap()
        waitFor("qiraat-page-summary", in: app)
        saveScreenshot(3, screen: "warsh-summary", language: language)
        app.terminate()
    }

    private func captureMutoon(language: ScreenshotLanguage) {
        let app = launch(language: language, page: 1, extra: ["-show-chrome"])
        waitFor("mushaf-page-1", in: app)
        openBarMenu(button: "more-button", in: app)
        let mutoon = app.buttons["mutoon-button"]
        XCTAssertTrue(mutoon.waitForExistence(timeout: 20), "The Mutoon destination must be available")
        mutoon.tap()
        let shatibiyyah = element("mutoon-work-shatibiyyah", in: app)
        XCTAssertTrue(shatibiyyah.waitForExistence(timeout: 30), "The bundled Shatibiyyah must be available")
        shatibiyyah.tap()
        let chapter = element("mutoon-chapter-0", in: app)
        XCTAssertTrue(chapter.waitForExistence(timeout: 20), "The first Shatibiyyah chapter must be available")
        chapter.tap()
        waitFor("mutoon-verse-1", in: app)
        // Capture the poem chapter itself; do not open a verse action, which may show commentary.
        saveScreenshot(4, screen: "mutoon", language: language)
        app.terminate()
    }

    private func launch(
        language: ScreenshotLanguage,
        page: Int,
        filter: String = "all",
        extra: [String] = []
    ) -> XCUIApplication {
        let app = XCUIApplication.isolated(animations: false)
        app.launchArguments = [
            "-mushaf1441:last-page:v1", "\(page)",
            "-mushaf1441:reader-layer:v1", "qiraat",
            "-mushaf1441:qiraat-filter:v1", filter,
            "-qiraat:first-use-hint:v1", "true",
            "-reading-fresh",
            "-qiraat-notes-fresh",
            "-backup-folder", "none",
            "-app:language:v1", language.rawValue,
            "-AppleLanguages", language.appleLanguages,
            "-AppleLocale", language.locale,
        ] + extra
        app.launch()
        return app
    }

    private func openBarMenu(button identifier: String, in app: XCUIApplication) {
        let button = app.buttons[identifier]
        if !button.waitForExistence(timeout: 5) {
            app.chromeMarginCoordinate.tap()
        }
        XCTAssertTrue(button.waitForExistence(timeout: 20), "\(identifier) must be visible")
        button.tap()
    }

    private func waitForQiraatWord(onPage page: Int, in app: XCUIApplication) {
        let word = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH %@", "qiraat-word-"))
            .firstMatch
        XCTAssertTrue(word.waitForExistence(timeout: 30), "Page \(page) must show a marked Qiraat word")
    }

    private func waitFor(_ identifier: String, in app: XCUIApplication, timeout: TimeInterval = 30) {
        XCTAssertTrue(element(identifier, in: app).waitForExistence(timeout: timeout), "Missing \(identifier)")
    }

    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func saveScreenshot(_ number: Int, screen: String, language: ScreenshotLanguage) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = String(format: "%02d-%@-%@", number, screen, language.rawValue)
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
