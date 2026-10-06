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
        element("memo-update-set-current", in: app).tap()
        chooseStatus(3, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
        let current = element("memo-current", in: app)
        XCTAssertTrue(current.staticTexts.allElementsBoundByIndex.contains { $0.label.contains("آل عمران") })
    }

    // MARK: Page grid, ayah list and history (Task 15)

    func testPageGridShowsStateShapesAndLegend() {
        let app = launch()
        let tile = element("memo-tile-pages", in: app)
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        XCTAssertTrue(element("memo-page-grid", in: app).waitForExistence(timeout: 10))
        let cell1 = element("memo-page-cell-1", in: app)
        XCTAssertTrue(cell1.waitForExistence(timeout: 5))
        XCTAssertTrue(cell1.label.contains("متقن"), cell1.label)
        let cell4 = element("memo-page-cell-4", in: app)
        XCTAssertTrue(cell4.waitForExistence(timeout: 5))
        XCTAssertTrue(cell4.label.contains("محفوظ مع أخطاء"), cell4.label)
        XCTAssertTrue(element("memo-page-legend", in: app).exists)
    }

    func testTappingPageOpensMushafPage() {
        let app = launch(extra: ["-mushaf1441:last-page:v1", "1"])
        let tile = element("memo-tile-pages", in: app)
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        let cell4 = element("memo-page-cell-4", in: app)
        XCTAssertTrue(cell4.waitForExistence(timeout: 10))
        cell4.tap()
        let mushafPage4 = app.descendants(matching: .any)["mushaf-page-4"]
        XCTAssertTrue(mushafPage4.waitForExistence(timeout: 10))
    }

    func testStatusRowOpensFilteredList() {
        let app = launch()
        let row = element("memo-status-row-2", in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 15))
        if !row.isHittable {
            app.swipeUp()
        }
        row.tap()
        XCTAssertTrue(element("memo-ayah-list", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element("memo-ayah-row-2-21", in: app).waitForExistence(timeout: 5))
        XCTAssertFalse(element("memo-ayah-row-2-1", in: app).exists)
    }

    func testHistoryListsBatchAndUndoes() {
        let app = launch()
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        let initial = strictLabel(app)
        openUpdateSheet(app)
        search("البقرة 100", in: app)
        chooseStatus(1, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
        XCTAssertNotEqual(strictLabel(app), initial)

        let historyLink = element("memo-history-link", in: app)
        if !historyLink.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(historyLink.waitForExistence(timeout: 10))
        historyLink.tap()

        XCTAssertTrue(element("memo-history", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element("memo-history-row-0", in: app).waitForExistence(timeout: 5))
        let undoButton = element("memo-history-undo-0", in: app)
        XCTAssertTrue(undoButton.waitForExistence(timeout: 5))
        undoButton.tap()

        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertEqual(strictLabel(app), initial)
    }

    func testHistoryWarnsWhenNewerBatchOverlaps() {
        // Review focus: undo after a later overlapping batch
        let app = launch()
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        openUpdateSheet(app)
        search("البقرة 100", in: app)
        chooseStatus(1, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))

        openUpdateSheet(app)
        search("البقرة 100", in: app)
        chooseStatus(2, in: app)
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))

        let strictBefore = strictLabel(app)
        let historyLink = element("memo-history-link", in: app)
        if !historyLink.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(historyLink.waitForExistence(timeout: 10))
        historyLink.tap()

        XCTAssertTrue(element("memo-history", in: app).waitForExistence(timeout: 10))
        let undo1 = element("memo-history-undo-1", in: app)
        XCTAssertTrue(undo1.waitForExistence(timeout: 5))
        undo1.tap()

        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.buttons["تراجع على أي حال"].exists)
        let cancelButton = alert.buttons["إلغاء"]
        XCTAssertTrue(cancelButton.exists)
        cancelButton.tap()

        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertEqual(strictLabel(app), strictBefore)
    }

    func testDueForReviewListShowsMemorizedUnreviewedAyat() {
        let app = launch()
        let dueCount = element("memo-due-count", in: app)
        XCTAssertTrue(dueCount.waitForExistence(timeout: 15))
        if !dueCount.isHittable {
            app.swipeUp()
        }
        dueCount.tap()
        XCTAssertTrue(element("memo-ayah-list", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element("memo-ayah-row-1-1", in: app).waitForExistence(timeout: 5))
    }
}
