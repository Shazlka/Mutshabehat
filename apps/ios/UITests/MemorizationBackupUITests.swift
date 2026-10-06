import XCTest

/// Backup and restore inside the memorization module. `-backup-folder none|temp` swaps the iCloud folder for
/// nothing or a throw-away folder (DEBUG builds), so the real folder is never touched.
@MainActor
final class MemorizationBackupUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(folder: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-memorization-seed", "demo", "-app:language:v1", "ar", "-mushaf1441:reader-layer:v1", "none",
                               "-open-memorization", "-backup-folder", folder]
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    private func scrollTo(_ id: String, in app: XCUIApplication) -> XCUIElement {
        let target = element(id, in: app)
        for _ in 0..<10 where !target.exists || !target.isHittable { app.swipeUp() }
        return target
    }

    private func openBackup(_ app: XCUIApplication) {
        let link = scrollTo("memo-backup-link", in: app)
        XCTAssertTrue(link.waitForExistence(timeout: 10))
        link.tap()
        XCTAssertTrue(element("memo-backup", in: app).waitForExistence(timeout: 5))
    }

    func testDashboardWarnsWhenNoBackupFolderIsSet() {
        let app = launch(folder: "none")
        XCTAssertTrue(scrollTo("memo-backup-banner", in: app).waitForExistence(timeout: 10))
    }

    func testUpdateSucceedsWhenBackupFolderIsMissing() {
        let app = launch(folder: "none")
        let button = app.buttons["memo-update-button"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        button.tap()
        let field = app.textFields["memo-update-search"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText("البقرة 100\n")
        let status = element("memo-status-1", in: app)
        XCTAssertTrue(status.waitForExistence(timeout: 5))
        status.tap()
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
    }

    func testBackupNowCreatesASnapshotAndSavesTheLastTime() {
        let app = launch(folder: "temp")
        openBackup(app)
        let now = element("memo-backup-now", in: app)
        XCTAssertTrue(now.waitForExistence(timeout: 5))
        now.tap()
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 30))
        XCTAssertTrue(alert.label.contains("تمت النسخة"), alert.label)
        alert.buttons["حسنًا"].tap()
        XCTAssertNotEqual(element("memo-backup-last", in: app).label, "لا توجد")
        let snapshot = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'memo-backup-snapshot-'")).firstMatch
        XCTAssertTrue(snapshot.waitForExistence(timeout: 5))
    }

    func testRestoreBringsBackTheBackedUpState() {
        let app = launch(folder: "temp")
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 15))
        let before = element("memo-strict", in: app).label

        openBackup(app)
        element("memo-backup-now", in: app).tap()
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 30))
        alert.buttons["حسنًا"].tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // Change the memorization after the backup: al-Baqarah 100-125 to mastered.
        let update = app.buttons["memo-update-button"]
        XCTAssertTrue(update.waitForExistence(timeout: 10))
        update.tap()
        let field = app.textFields["memo-update-search"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText("البقرة 100\n")
        let to = app.textFields["memo-update-to"]
        to.tap()
        to.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 3) + "125")
        app.buttons["memo-keyboard-done"].tap()
        element("memo-status-1", in: app).tap()
        app.buttons["memo-update-apply"].tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 5))
        XCTAssertNotEqual(element("memo-strict", in: app).label, before)

        openBackup(app)
        let snapshot = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'memo-backup-snapshot-'")).firstMatch
        XCTAssertTrue(snapshot.waitForExistence(timeout: 5))
        snapshot.tap()
        let replace = app.switches["memo-restore-replace"]
        XCTAssertTrue(replace.waitForExistence(timeout: 10))
        replace.tap()
        for dx in [0.08, 0.92] where replace.value as? String != "1" {
            replace.coordinate(withNormalizedOffset: CGVector(dx: dx, dy: 0.5)).tap()
        }
        element("memo-restore-apply", in: app).tap()
        let confirm = app.buttons.matching(identifier: "memo-restore-confirm").firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        confirm.tap()
        XCTAssertTrue(element("memo-restore-report", in: app).waitForExistence(timeout: 20))
        app.buttons["إغلاق"].tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(element("memo-strict", in: app).waitForExistence(timeout: 10))
        XCTAssertEqual(element("memo-strict", in: app).label, before)
    }
}
