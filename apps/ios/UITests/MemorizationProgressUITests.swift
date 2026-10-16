import XCTest

/// Goals, the progress chart, gains, the streak and milestones, on a throw-away seeded database.
@MainActor
final class MemorizationProgressUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(seed: String = "demo") -> XCUIApplication {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-memorization-seed", seed, "-app:language:v1", "ar", "-mushaf1441:reader-layer:v1", "none",
                               "-open-memorization", "-backup-folder", "none"]
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    private func scrollTo(_ id: String, in app: XCUIApplication) -> XCUIElement {
        let target = element(id, in: app)
        for _ in 0..<12 where !target.exists || !target.isHittable { app.swipeUp() }
        return target
    }

    private func scrollUp(_ app: XCUIApplication) {
        for _ in 0..<12 { app.swipeDown() }
    }

    private func applyBaqarahRange(status: Int, in app: XCUIApplication) {
        scrollUp(app)
        let button = app.buttons["memo-update-button"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.tap()
        let field = app.textFields["memo-update-search"]
        XCTAssertTrue(field.waitForExistence(timeout: 12))
        field.tap()
        field.typeText("البقرة 100\n")
        let to = app.textFields["memo-update-to"]
        to.tap()
        to.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 3) + "125")
        if app.keyboards.firstMatch.waitForExistence(timeout: 2) { app.dismissNumberKeyboard() }
        element("memo-status-\(status)", in: app).tap()
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 10))
    }

    func testAddGoalShowsProgress() {
        let app = launch()
        let add = scrollTo("memo-goal-add", in: app)
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        let save = element("memo-goal-save", in: app)
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()
        let fraction = scrollTo("memo-goal-fraction", in: app)
        XCTAssertTrue(fraction.waitForExistence(timeout: 5))
        XCTAssertFalse(fraction.label.isEmpty)
    }

    func testChartRendersForEveryRange() {
        let app = launch()
        let picker = scrollTo("memo-chart-range", in: app)
        XCTAssertTrue(picker.waitForExistence(timeout: 10))
        for title in ["٧ أيام", "٣٠ يوم", "٣ أشهر", "٦ أشهر", "سنة", "الكل"] {
            scrollTo("memo-chart-range", in: app).tap()
            let option = app.buttons[title]
            XCTAssertTrue(option.waitForExistence(timeout: 5), title)
            option.tap()
            XCTAssertTrue(element("memo-chart", in: app).waitForExistence(timeout: 5), title)
        }
    }

    func testGainsGrowAfterAnUpdate() {
        let app = launch()
        let before = scrollTo("memo-gains-week", in: app).label
        applyBaqarahRange(status: 1, in: app)
        XCTAssertNotEqual(scrollTo("memo-gains-week", in: app).label, before)
        XCTAssertFalse(scrollTo("memo-gains-month", in: app).label.isEmpty)
    }

    func testStreakIsOneAfterAnUpdateAndZeroAfterUndo() {
        let app = launch(seed: "empty")
        XCTAssertTrue(scrollTo("memo-streak", in: app).label.contains("٠"), scrollTo("memo-streak", in: app).label)
        applyBaqarahRange(status: 1, in: app)
        XCTAssertTrue(scrollTo("memo-streak", in: app).label.contains("١"), scrollTo("memo-streak", in: app).label)
        element("memo-undo-button", in: app).tap()
        XCTAssertTrue(scrollTo("memo-streak", in: app).label.contains("٠"), scrollTo("memo-streak", in: app).label)
    }

    func testMilestoneAppearsInTheToastWhenASurahIsFinished() {
        let app = launch(seed: "empty")
        let button = app.buttons["memo-update-button"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.tap()
        let field = app.textFields["memo-update-search"]
        XCTAssertTrue(field.waitForExistence(timeout: 12))
        field.tap()
        field.typeText("الفاتحة\n")
        element("memo-status-1", in: app).tap()
        app.buttons["memo-update-apply"].tap()
        let confirm = app.alerts.firstMatch
        if confirm.waitForExistence(timeout: 2) { confirm.buttons.element(boundBy: 1).tap() }
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 10))
        let milestone = app.descendants(matching: .any).matching(identifier: "memo-milestone").firstMatch
        XCTAssertTrue(milestone.waitForExistence(timeout: 3))
        XCTAssertTrue(milestone.label.contains("الفاتحة"), milestone.label)
    }
}
