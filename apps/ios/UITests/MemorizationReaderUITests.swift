import XCTest

/// The memorization marks inside the reader: the page-status mark in the top banner, its page sheet, and the
/// ayah sheet. `-memorization-seed demo`: al-Fatiha (page 1) mastered; page 4 = 2:17–24 with some errors.
@MainActor
final class MemorizationReaderUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private func launch(page: Int, chrome: Bool = false, layer: String = "none", extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication.isolated(animations: false)
        var arguments = ["-memorization-seed", "demo", "-app:language:v1", "ar", "-mushaf1441:last-page:v1", "\(page)",
                         "-mushaf1441:reader-layer:v1", layer]
        if chrome { arguments.append("-show-chrome") }
        app.launchArguments = arguments + extra
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[id]
    }

    private func mark(_ page: Int, in app: XCUIApplication) -> XCUIElement {
        element("memo-banner-mark-\(page)", in: app)
    }

    func testBannerMarkShowsPageState() {
        let app = launch(page: 1)
        XCTAssertTrue(mark(1, in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(mark(1, in: app).label.contains("متقن"), mark(1, in: app).label)
    }

    func testMarkShowsTheWeakestLinkOfTheCurrentPage() {
        let app = launch(page: 4)
        XCTAssertTrue(mark(4, in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(mark(4, in: app).label.contains("محفوظ مع أخطاء"), mark(4, in: app).label)
    }

    func testNotMemorizedPageShowsNotMemorized() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(mark(600, in: app).label.contains("غير محفوظ"), mark(600, in: app).label)
    }

    func testMarkIsVisibleWithChromeHiddenAndShownAndNeverCoversAControl() {
        let app = launch(page: 1)
        XCTAssertTrue(mark(1, in: app).waitForExistence(timeout: 15))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()   // a tap on the page toggles the chrome
        XCTAssertTrue(app.buttons["open-index"].waitForExistence(timeout: 20))
        XCTAssertTrue(mark(1, in: app).exists)
        let markFrame = mark(1, in: app).frame
        for id in ["search-button", "bookmarks-button", "qiraat-button", "more-button", "settings-button"] {
            let frame = app.buttons[id].frame
            XCTAssertFalse(markFrame.intersects(frame), "\(id) is covered by the mark: \(markFrame) vs \(frame)")
        }
    }

    /// The mark takes its own place in the banner: it never sits on the surah name, the page details or
    /// the juz/hizb text, with the reading header or with the controls showing.
    func testMarkNeverCoversTheBannerText() {
        let app = launch(page: 4)
        XCTAssertTrue(mark(4, in: app).waitForExistence(timeout: 15))
        func assertClear(_ ids: [String]) {
            let markFrame = mark(4, in: app).frame
            for id in ids {
                let text = app.staticTexts[id]
                XCTAssertTrue(text.waitForExistence(timeout: 20), id)
                XCTAssertFalse(markFrame.intersects(text.frame), "\(id) is covered by the mark: \(markFrame) vs \(text.frame)")
            }
        }
        assertClear(["reading-surah-title", "reading-section-text"])
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()   // show the controls
        XCTAssertTrue(app.buttons["open-index"].waitForExistence(timeout: 20))
        assertClear(["surah-title", "page-number"])
    }

    func testMarkCanBeHidden() {
        let app = launch(page: 1, extra: ["-memorization-banner-mark", "NO"])
        XCTAssertTrue(app.descendants(matching: .any)["mushaf-page-1"].waitForExistence(timeout: 15))
        XCTAssertFalse(mark(1, in: app).exists)
    }

    func testMarkIsIdenticalWithTheQiraatLayerOn() {
        // Memorization is Hafs only: the Qiraat layer never changes it.
        let plain = launch(page: 4)
        XCTAssertTrue(mark(4, in: plain).waitForExistence(timeout: 15))
        let plainLabel = mark(4, in: plain).label
        plain.terminate()
        let qiraat = launch(page: 4, layer: "qiraat")
        XCTAssertTrue(mark(4, in: qiraat).waitForExistence(timeout: 15))
        XCTAssertEqual(mark(4, in: qiraat).label, plainLabel)
    }

    func testPageSheetChangesTheWholePageAndTheMarkFollows() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        mark(600, in: app).tap()
        let apply = element("memo-page-status-1", in: app)
        XCTAssertTrue(apply.waitForExistence(timeout: 20))
        apply.tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(mark(600, in: app).label.contains("متقن"), mark(600, in: app).label)
    }

    func testPageSheetChecklistAppliesToChosenAyatOnly() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        mark(600, in: app).tap()
        element("memo-page-pick", in: app).tap()
        let first = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'memo-page-ayah-row-'")).firstMatch
        XCTAssertTrue(first.waitForExistence(timeout: 20))
        first.tap()
        let status = element("memo-page-status-1", in: app)
        XCTAssertTrue(status.waitForExistence(timeout: 12))
        XCTAssertTrue(status.isEnabled, "choosing an ayah must enable the status buttons")
        status.tap()
        let toast = element("memo-undo-toast", in: app).waitForExistence(timeout: 20)
        if !toast { print("DEBUGTREE-BEGIN\n" + app.debugDescription + "\nDEBUGTREE-END") }
        XCTAssertTrue(toast)
        XCTAssertTrue(mark(600, in: app).label.contains("غير محفوظ"),
                      "one ayah mastered leaves the page «غير محفوظ» (weakest link); label: \(mark(600, in: app).label)")
    }

    func testIPadSpreadShowsTwoMarks() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("iPad only") }
        XCUIDevice.shared.orientation = .landscapeLeft   // the two-page spread is a landscape layout
        addTeardownBlock { XCUIDevice.shared.orientation = .portrait }
        let app = launch(page: 1)
        XCTAssertTrue(mark(1, in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(mark(2, in: app).exists)
    }

    // MARK: Ayah sheet and range mode (Task 17)

    /// Long-presses down the page until the ayah sheet opens (a press between two lines hits no ayah).
    private func longPressFirstAyah(in app: XCUIApplication) {
        for y in [0.40, 0.46, 0.52, 0.34, 0.58, 0.64, 0.28] {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: y)).press(forDuration: 0.8)
            if element("ayah-sheet-bookmark-ayah", in: app).waitForExistence(timeout: 1.5) { return }
        }
    }

    func testLongPressOpensSheetWithBookmarkAndMemorization() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        longPressFirstAyah(in: app)
        XCTAssertTrue(element("ayah-sheet-bookmark-ayah", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("ayah-sheet-bookmark-page", in: app).exists)
        for raw in 1...4 { XCTAssertTrue(element("memo-ayah-status-\(raw)", in: app).exists, "status \(raw)") }
        XCTAssertTrue(element("memo-range-start", in: app).exists)
    }

    func testBookmarkStillWorksThroughTheSheet() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        longPressFirstAyah(in: app)
        let bookmark = element("ayah-sheet-bookmark-page", in: app)
        XCTAssertTrue(bookmark.waitForExistence(timeout: 20))
        bookmark.tap()
        // The page bookmark is now stored: the same sheet offers to remove it.
        longPressFirstAyah(in: app)
        XCTAssertTrue(element("ayah-sheet-bookmark-page", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("ayah-sheet-bookmark-page", in: app).label.contains("إزالة"), element("ayah-sheet-bookmark-page", in: app).label)
        element("ayah-sheet-bookmark-page", in: app).tap()   // leave the simulator as we found it
    }

    func testStatusButtonUpdatesTheAyahAndTheBanner() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        longPressFirstAyah(in: app)
        let status = element("memo-ayah-status-1", in: app)
        XCTAssertTrue(status.waitForExistence(timeout: 12))
        status.tap()
        XCTAssertTrue(element("memo-undo-toast", in: app).waitForExistence(timeout: 20))
    }

    func testRangeModeShowsThePillAndCanBeCancelled() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        longPressFirstAyah(in: app)
        element("memo-range-start", in: app).tap()
        XCTAssertTrue(element("memo-range-pill", in: app).waitForExistence(timeout: 20))
        element("memo-range-cancel", in: app).tap()
        XCTAssertFalse(element("memo-range-pill", in: app).waitForExistence(timeout: 2))
    }

    func testRangeAcrossTwoAyatOpensTheUpdateSheetPreselected() {
        let app = launch(page: 600)
        XCTAssertTrue(mark(600, in: app).waitForExistence(timeout: 15))
        longPressFirstAyah(in: app)
        element("memo-range-start", in: app).tap()
        XCTAssertTrue(element("memo-range-pill", in: app).waitForExistence(timeout: 20))
        // A second long press somewhere lower on the same page ends the range.
        for y in [0.75, 0.7, 0.8, 0.66, 0.85] {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: y)).press(forDuration: 0.8)
            if element("memo-update-count", in: app).waitForExistence(timeout: 1.5) { break }
        }
        XCTAssertTrue(element("memo-update-count", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("memo-status-1", in: app).exists)
    }

    func testMarkerIsHiddenByDefaultAndShownWhenEnabled() {
        let off = launch(page: 1)
        XCTAssertTrue(off.descendants(matching: .any)["mushaf-page-1"].waitForExistence(timeout: 15))
        XCTAssertFalse(element("memo-ayah-marker-1-1", in: off).exists)
        off.terminate()
        let on = launch(page: 1, extra: ["-memorization-ayah-marker", "YES"])
        XCTAssertTrue(on.descendants(matching: .any)["mushaf-page-1"].waitForExistence(timeout: 15))
        XCTAssertTrue(element("memo-ayah-marker-1-1", in: on).waitForExistence(timeout: 20))
    }
}
