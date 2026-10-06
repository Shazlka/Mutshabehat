import XCTest

/// End-to-end checks of the memorization module on a simulator. `-memorization-seed demo|empty|complete` gives a
/// throw-away, deterministic database (DEBUG builds), so the real data is never touched.
@MainActor
final class MemorizationUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(seed: String = "demo", openModule: Bool = true, extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        var arguments = ["-memorization-seed", seed, "-app:language:v1", "ar", "-mushaf1441:reader-layer:v1", "none"]
        if openModule { arguments.append("-open-memorization") }
        app.launchArguments = arguments + extra
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    private func openUpdateSheet(_ app: XCUIApplication) {
        let button = app.buttons["memo-update-button"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.tap()
        XCTAssertTrue(app.textFields["memo-update-search"].waitForExistence(timeout: 5))
    }

    private func search(_ text: String, in app: XCUIApplication) {
        let field = app.textFields["memo-update-search"]
        field.tap()
        field.typeText(text + "\n")
    }

    private func chooseStatus(_ raw: Int, in app: XCUIApplication) {
        let button = element("memo-status-\(raw)", in: app)
        XCTAssertTrue(button.waitForExistence(timeout: 5))
        button.tap()
    }

    private func replaceText(in field: XCUIElement, with text: String) {
        field.tap()
        if let current = field.value as? String, !current.isEmpty {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
        }
        field.typeText(text)
    }

    private func strictLabel(_ app: XCUIApplication) -> String {
        element("memo-strict", in: app).label
    }

    // MARK: Dashboard (Task 12)

    func testDashboardShowsHeadlineAndTiles() {
        let app = launch()
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        for id in ["memo-learning", "memo-recite", "memo-tile-surahs", "memo-tile-pages", "memo-tile-ayat",
                   "memo-current", "memo-status-bar", "memo-update-button"] {
            XCTAssertTrue(element(id, in: app).exists, id)
        }
        // Seed: al-Fatiha is the only complete surah, so the surahs tile reads 1 of 114 in Arabic-Indic digits.
        XCTAssertTrue(element("memo-tile-surahs", in: app).label.contains("١ / ١١٤"), element("memo-tile-surahs", in: app).label)
    }

    func testTopBarButtonOpensTheModule() {
        let app = launch(openModule: false, extra: ["-show-chrome"])
        let button = app.buttons["memorization-button"]
        XCTAssertTrue(button.waitForExistence(timeout: 15))
        button.tap()
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 10))
    }

    func testEmptyInstallShowsZeros() {
        // Review focus: a brand-new install is all zeros and nothing crashes.
        let app = launch(seed: "empty")
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(strictLabel(app).contains("٠٫٠"), strictLabel(app))
        XCTAssertTrue(element("memo-tile-surahs", in: app).label.contains("٠ / ١١٤"))
        XCTAssertTrue(element("memo-current", in: app).exists)
    }

    func testSearchShowsAResultForASurahName() {
        let app = launch()
        let field = app.textFields["memo-search"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.tap()
        field.typeText("يس\n")
        XCTAssertTrue(element("memo-search-result", in: app).waitForExistence(timeout: 5))
    }

    func testCompleteSeedShowsTheCompletionState() {
        let app = launch(seed: "complete")
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("memo-completed", in: app).exists)
        XCTAssertTrue(strictLabel(app).contains("١٠٠٫٠"), strictLabel(app))
    }

    // MARK: Update sheet (Task 13)

    func testSmallRangeAppliesWithoutConfirmation() {
        let app = launch()
        openUpdateSheet(app)
        search("البقرة 100", in: app)
        XCTAssertTrue(element("memo-update-count", in: app).label.contains("١ آية"), element("memo-update-count", in: app).label)
        chooseStatus(1, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertFalse(app.alerts.firstMatch.waitForExistence(timeout: 1.5), "a single ayah must not ask for confirmation")
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
    }

    func testWholeSurahAsksConfirmation() {
        let app = launch()
        let before = { self.strictLabel(app) }
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        let initial = before()
        openUpdateSheet(app)
        search("يس", in: app)
        chooseStatus(1, in: app)
        app.buttons["memo-update-apply"].tap()
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.staticTexts.allElementsBoundByIndex.contains { $0.label.contains("٨٣") }, alert.debugDescription)
        alert.buttons["إلغاء"].tap()
        XCTAssertFalse(element("memo-undo-toast", in: app).exists)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout: 5))
        app.alerts.firstMatch.buttons["تأكيد"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
        XCTAssertNotEqual(before(), initial, "mastering a whole surah must change the headline")
    }

    func testUndoFromToastRestores() {
        let app = launch()
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        let initial = strictLabel(app)
        openUpdateSheet(app)
        search("البقرة 100", in: app)
        // 30 ayat (not more than the confirmation threshold) so the one-decimal headline visibly moves.
        replaceText(in: app.textFields["memo-update-to"], with: "129")
        chooseStatus(1, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
        XCTAssertNotEqual(strictLabel(app), initial)
        element("memo-undo-button", in: app).tap()
        XCTAssertFalse(element("memo-undo-toast", in: app).waitForExistence(timeout: 2))
        XCTAssertEqual(strictLabel(app), initial)
    }

    func testTypedTargetPreselectsMode() {
        let app = launch()
        openUpdateSheet(app)
        search("صفحة 582", in: app)
        XCTAssertTrue(element("memo-update-count", in: app).label.contains("صفحة"), element("memo-update-count", in: app).label)
        XCTAssertTrue(element("memo-update-page-from", in: app).exists)
    }

    func testReversedRangeStillApplies() {
        // Review focus: from > to means the same range.
        let app = launch()
        openUpdateSheet(app)
        search("آل عمران 5", in: app)
        replaceText(in: app.textFields["memo-update-from"], with: "20")
        replaceText(in: app.textFields["memo-update-to"], with: "10")
        XCTAssertTrue(element("memo-update-count", in: app).label.contains("١١ آية"), element("memo-update-count", in: app).label)
        chooseStatus(1, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
    }

    func testSettingCurrentPositionShowsOnDashboard() {
        let app = launch(seed: "empty")
        openUpdateSheet(app)
        search("آل عمران 42", in: app)
        replaceText(in: app.textFields["memo-update-to"], with: "51")
        app.buttons["memo-keyboard-done"].tap()
        let toggle = app.switches["memo-update-set-current"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        // The row spans the sheet; in Arabic (right to left) the switch sits at the leading (left) edge.
        toggle.tap()
        for dx in [0.08, 0.92] where toggle.value as? String != "1" {
            toggle.coordinate(withNormalizedOffset: CGVector(dx: dx, dy: 0.5)).tap()
        }
        XCTAssertEqual(toggle.value as? String, "1")
        chooseStatus(3, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
        let range = element("memo-current-range", in: app)
        XCTAssertTrue(range.waitForExistence(timeout: 5))
        XCTAssertTrue(range.label.contains("آل عمران"), range.label)
    }

    // MARK: Review and suggestion

    private func scrollTo(_ id: String, in app: XCUIApplication) -> XCUIElement {
        let target = element(id, in: app)
        for _ in 0..<8 where !target.exists || !target.isHittable { app.swipeUp() }
        return target
    }

    func testDueSectionListsMemorizedUnreviewedAyat() {
        let app = launch()
        let count = scrollTo("memo-due-count", in: app)
        XCTAssertTrue(count.waitForExistence(timeout: 10))
        XCTAssertNotEqual(count.value as? String, "٠")
        XCTAssertTrue(element("memo-due-row-1", in: app).exists || element("memo-due-row-2", in: app).exists)
    }

    private func runReview(_ resultID: String, in app: XCUIApplication) {
        let start = scrollTo("memo-review-start", in: app)
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        start.tap()
        let result = element(resultID, in: app)
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        result.tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
    }

    func testReviewExcellentUpdatesTheDueCount() {
        let app = launch()
        let before = scrollTo("memo-due-count", in: app).value as? String
        XCTAssertNotEqual(before, "٠")
        runReview("memo-review-excellent", in: app)
        XCTAssertEqual(scrollTo("memo-due-count", in: app).value as? String, "٠")
    }

    func testReviewDoesNotChangeTheStatus() {
        let app = launch()
        let strict = element("memo-strict", in: app)
        XCTAssertTrue(strict.waitForExistence(timeout: 10))
        let before = strict.label
        runReview("memo-review-forgot", in: app)
        XCTAssertEqual(element("memo-strict", in: app).label, before)
    }

    func testSuggestionShowsTheLearningRangeFirst() {
        let app = launch()
        let card = scrollTo("memo-suggestion", in: app)
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        XCTAssertTrue(element("memo-suggestion-text", in: app).label.contains("يس"), element("memo-suggestion-text", in: app).label)
    }

    func testReviewIsUndoable() {
        let app = launch()
        let before = scrollTo("memo-due-count", in: app).value as? String
        runReview("memo-review-good", in: app)
        element("memo-undo-button", in: app).tap()
        XCTAssertEqual(scrollTo("memo-due-count", in: app).value as? String, before)
    }

    // MARK: Surah list and surah detail (Task 14)

    func testSurahListFiltersAndSorts() {
        let app = launch()
        let tile = element("memo-tile-surahs", in: app)
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        XCTAssertTrue(element("memo-surah-list", in: app).waitForExistence(timeout: 5))

        let filterMenu = element("memo-surah-filter", in: app)
        XCTAssertTrue(filterMenu.waitForExistence(timeout: 5))
        filterMenu.tap()
        let completeButton = app.buttons["المكتمل"]
        XCTAssertTrue(completeButton.waitForExistence(timeout: 5))
        completeButton.tap()

        XCTAssertTrue(element("memo-surah-row-1", in: app).waitForExistence(timeout: 5))
        XCTAssertFalse(element("memo-surah-row-2", in: app).exists)

        filterMenu.tap()
        let allButton = app.buttons["الكل"]
        XCTAssertTrue(allButton.waitForExistence(timeout: 5))
        allButton.tap()

        let sortMenu = element("memo-surah-sort", in: app)
        XCTAssertTrue(sortMenu.waitForExistence(timeout: 5))
        sortMenu.tap()
        let mostMemorizedButton = app.buttons["الأكثر حفظاً"]
        XCTAssertTrue(mostMemorizedButton.waitForExistence(timeout: 5))
        mostMemorizedButton.tap()

        let firstRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'memo-surah-row-'")).firstMatch
        XCTAssertTrue(firstRow.waitForExistence(timeout: 5))
        XCTAssertEqual(firstRow.identifier, "memo-surah-row-1")
    }

    func testSurahSearchMatchesArabicNameWithoutDiacritics() {
        let app = launch()
        let tile = element("memo-tile-surahs", in: app)
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        XCTAssertTrue(element("memo-surah-list", in: app).waitForExistence(timeout: 5))

        let searchField = app.textFields["memo-surah-search"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText("البقره\n")

        XCTAssertTrue(element("memo-surah-row-2", in: app).waitForExistence(timeout: 5))
        XCTAssertFalse(element("memo-surah-row-1", in: app).exists)
    }

    func testSurahDetailShowsRunsAndOpensMushaf() {
        let app = launch(extra: ["-mushaf1441:last-page:v1", "1"])
        let tile = element("memo-tile-surahs", in: app)
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        XCTAssertTrue(element("memo-surah-list", in: app).waitForExistence(timeout: 5))

        let row2 = element("memo-surah-row-2", in: app)
        XCTAssertTrue(row2.waitForExistence(timeout: 5))
        row2.tap()

        XCTAssertTrue(element("memo-surah-detail", in: app).waitForExistence(timeout: 5))

        for segId in ["memo-strip-seg-1", "memo-strip-seg-21", "memo-strip-seg-36", "memo-strip-seg-51"] {
            XCTAssertTrue(element(segId, in: app).waitForExistence(timeout: 5), segId)
        }

        element("memo-strip-seg-1", in: app).tap()
        let page2 = app.descendants(matching: .any)["mushaf-page-2"]
        XCTAssertTrue(page2.waitForExistence(timeout: 10))
    }

    func testSurahDetailUpdateButtonOpensTheSheetPreselected() {
        let app = launch()
        let tile = element("memo-tile-surahs", in: app)
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        XCTAssertTrue(element("memo-surah-list", in: app).waitForExistence(timeout: 5))

        let row2 = element("memo-surah-row-2", in: app)
        XCTAssertTrue(row2.waitForExistence(timeout: 5))
        row2.tap()

        XCTAssertTrue(element("memo-surah-detail", in: app).waitForExistence(timeout: 5))

        let updateButton = element("memo-detail-update", in: app)
        XCTAssertTrue(updateButton.waitForExistence(timeout: 5))
        updateButton.tap()

        let countLabel = element("memo-update-count", in: app)
        XCTAssertTrue(countLabel.waitForExistence(timeout: 5))
        XCTAssertTrue(countLabel.label.contains("سورة"), countLabel.label)
    }
}
