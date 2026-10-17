import XCTest

/// The developer review editor end to end against the in-memory stub (`-review-stub`): no network and no
/// real data. Also proves the Settings rows that existed before are all still there.
@MainActor
final class ReviewEditorUITests: XCTestCase {
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

    func testTheEditorRowOpensTheHomeAndAPage() {
        let app = launch()
        openSettings(app)
        let row = scrollTo("open-review-editor", in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 15))
        row.tap()
        XCTAssertTrue(element("review-home-progress", in: app).waitForExistence(timeout: 20))
        app.buttons["review-continue"].tap()
        XCTAssertTrue(element("review-page-canvas", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("review-stats-bar", in: app).waitForExistence(timeout: 20))
        let word = element("review-word-002:049:001", in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 20))
        word.tap()
        XCTAssertTrue(element("review-sheet-word", in: app).waitForExistence(timeout: 15))
    }

    /// Settings → المطور → المحرر → متابعة, then waits for the page.
    private func openEditorPage(_ app: XCUIApplication) {
        openSettings(app)
        let row = scrollTo("open-review-editor", in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 15))
        row.tap()
        XCTAssertTrue(app.buttons["review-continue"].waitForExistence(timeout: 20))
        app.buttons["review-continue"].tap()
        XCTAssertTrue(element("review-page-canvas", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("review-word-002:049:001", in: app).waitForExistence(timeout: 20))
    }

    func testTappingAWordShowsItsFacesAndTheStepsAndTheApproveButton() {
        let app = launch()
        openEditorPage(app)
        element("review-word-002:049:001", in: app).tap()
        XCTAssertTrue(element("review-sheet-word", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(element("review-face-r-8-1", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(element("review-steps", in: app).exists)
        XCTAssertTrue(app.buttons["review-approve"].exists)
        app.buttons["٢ المراجع"].tap()
        XCTAssertTrue(element("review-reference-source", in: app).waitForExistence(timeout: 15))
    }

    func testApprovingMovesOnToTheNextUnreviewedWordAndShowsTheSaveStatus() {
        let app = launch()
        openEditorPage(app)
        element("review-word-002:049:001", in: app).tap()
        XCTAssertTrue(element("review-face-r-8-1", in: app).waitForExistence(timeout: 15))
        app.buttons["review-approve"].tap()
        // Word 2 carries the next unreviewed face (word 1's is now approved).
        XCTAssertTrue(element("review-face-r-8-2", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(element("review-save-status", in: app).waitForExistence(timeout: 20))
    }

    /// iPad: the word's steps sit beside the page, not in a sheet over it.
    func testReviewEditorOnIPadShowsSideBySide() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad only") }
        let app = launch()
        openEditorPage(app)
        XCTAssertTrue(element("review-side-placeholder", in: app).waitForExistence(timeout: 15))
        element("review-word-002:049:001", in: app).tap()
        let panel = element("review-sheet-word", in: app)
        XCTAssertTrue(panel.waitForExistence(timeout: 15))
        let canvas = element("review-page-canvas", in: app)
        XCTAssertTrue(canvas.isHittable, "the page stays usable while the word panel is open")
        XCTAssertFalse(panel.frame.intersects(canvas.frame), "panel and page sit side by side")
        XCTAssertFalse(element("review-side-placeholder", in: app).exists)
    }

    /// Every button the editor shows says what it does to VoiceOver.
    func testEveryReviewControlHasAccessibilityLabel() {
        let app = launch()
        openEditorPage(app)
        element("review-word-002:049:001", in: app).tap()
        XCTAssertTrue(element("review-face-r-8-1", in: app).waitForExistence(timeout: 15))
        var unlabeled: [String] = []
        for step in ["", "٢ المراجع", "٣ التحرير"] {
            if !step.isEmpty { app.buttons[step].tap() }
            // The page's words are content, not controls (their label is the word); checking each of them
            // is hundreds of round trips and races with the canvas rebuilding its elements.
            let controls = app.buttons.matching(NSPredicate(format: "NOT (identifier BEGINSWITH 'review-word-')"))
            for button in controls.allElementsBoundByIndex where button.exists && button.isHittable {
                if button.label.trimmingCharacters(in: .whitespaces).isEmpty {
                    unlabeled.append("\(step)/\(button.identifier)")
                }
            }
        }
        XCTAssertEqual(unlabeled, [], "buttons without an accessibility label")
    }

    func testAddingAFaceByHandCreatesItAndShowsItOnTheWord() {
        let app = launch()
        openEditorPage(app)
        element("review-word-002:049:008", in: app).tap()
        XCTAssertTrue(app.buttons["review-new-face"].waitForExistence(timeout: 15))
        app.buttons["review-new-face"].tap()
        XCTAssertTrue(element("review-edit-step", in: app).waitForExistence(timeout: 15))
        // The sheet opens half-height: drag it up so the readers are in view.
        element("review-sheet-word", in: app).swipeUp()
        let narrator = element("review-narrator-Q01-R02", in: app)
        var tries = 0
        while !narrator.isHittable && tries < 8 { element("review-edit-step", in: app).swipeUp(); tries += 1 }
        narrator.tap()
        let approve = app.buttons["review-approve"]
        XCTAssertTrue(approve.waitForExistence(timeout: 15))
        XCTAssertTrue(element("review-unsaved", in: app).exists)
        approve.tap()
        XCTAssertTrue(element("review-save-status", in: app).waitForExistence(timeout: 20))
        // The sheet moved on to the next unreviewed word; close it and look at the word again.
        app.buttons["review-sheet-close"].tap()
        XCTAssertTrue(element("review-word-002:049:008", in: app).waitForExistence(timeout: 15))
        element("review-word-002:049:008", in: app).tap()
        let created = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'review-face-r-new'")).firstMatch
        XCTAssertTrue(created.waitForExistence(timeout: 20))
    }

    /// Scrolls the edit list (or the builder list) until the whole element is on screen and clear of the
    /// home indicator: a button whose top edge has just scrolled in already counts as hittable, but a tap at
    /// its centre then lands off screen.
    private func reveal(_ id: String, in app: XCUIApplication, listID: String) -> XCUIElement {
        let target = element(id, in: app)
        let bottom = app.windows.firstMatch.frame.maxY - 44
        var tries = 0
        while (!target.isHittable || target.frame.maxY > bottom) && tries < 10 { element(listID, in: app).swipeUp(); tries += 1 }
        return target
    }

    func testAnImalahFaceIsBuiltWithThePresetAndSaved() {
        let app = launch()
        openEditorPage(app)
        // Word 7 carries a seeded الممال والمقلل face (no keyboard or category picking needed).
        element("review-word-002:049:007", in: app).tap()
        let face = app.descendants(matching: .any).matching(identifier: "review-face-r-8-5").firstMatch
        XCTAssertTrue(face.waitForExistence(timeout: 15))
        face.tap()
        XCTAssertTrue(element("review-edit-step", in: app).waitForExistence(timeout: 15))
        element("review-sheet-word", in: app).swipeUp()                       // the sheet to full height
        let builder = app.buttons["منشئ أوجه الممال والمقلل"]
        XCTAssertTrue(builder.waitForExistence(timeout: 15))
        builder.tap()
        let warshOnly = app.buttons["ورش فقط"]
        XCTAssertTrue(warshOnly.waitForExistence(timeout: 15))
        warshOnly.tap()
        reveal("review-builder-add", in: app, listID: "review-builder").tap()
        XCTAssertTrue(app.staticTexts["تمت إضافة الوجه لـ (1) رواة ✓"].waitForExistence(timeout: 15))
        app.navigationBars.buttons["BackButton"].firstMatch.tap()             // back to the sheet, where saving lives
        let approve = app.buttons["review-approve"]
        XCTAssertTrue(approve.waitForExistence(timeout: 15))
        approve.tap()
        XCTAssertTrue(element("review-save-status", in: app).waitForExistence(timeout: 20))
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
