import XCTest

/// The word card's review section (DEBUG builds) against the in-memory review stub (`-review-stub`): approve,
/// delete with undo, and edit straight from the card. The stub seeds an unreviewed usul face on the first
/// word of page 2 (2:1:1, «الٓمٓ»), which the Qiraat layer also marks.
@MainActor
final class QiraatCardReviewUITests: XCTestCase {
    override nonisolated func setUp() { continueAfterFailure = false }

    private let wordID = "qiraat-word-2:1:1"
    private let faceID = "r-2-1"

    private func launch(extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication.isolated()
        app.launchArguments = ["-review-stub", "-mushaf1441:last-page:v1", "2", "-mushaf1441:reader-layer:v1", "qiraat",
                               "-mushaf1441:qiraat-filter:v1", "all", "-reading-fresh", "-app:language:v1", "ar"] + extra
        app.launch()
        return app
    }

    private func element(_ id: String, in app: XCUIApplication) -> XCUIElement { app.descendants(matching: .any)[id] }

    private func openCard(_ app: XCUIApplication) {
        let word = element(wordID, in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 30))
        word.tap()
        XCTAssertTrue(element("qiraat-card-review", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(element("qiraat-card-face-\(faceID)", in: app).waitForExistence(timeout: 20))
    }

    private func waitForLabel(_ id: String, containing text: String, in app: XCUIApplication, timeout: TimeInterval = 20) -> Bool {
        let status = element(id, in: app)
        let predicate = NSPredicate(format: "label CONTAINS %@", text)
        return XCTWaiter().wait(for: [expectation(for: predicate, evaluatedWith: status)], timeout: timeout) == .completed
    }

    /// Settings → المطور → «المراجعة والتحرير في بطاقة الكلمة» off: the card opens without its review section. The
    /// switch is set by a launch argument, which lasts for this launch only, so no later test inherits it.
    func testWithTheSwitchOffTheCardHasNoReviewSection() {
        let app = launch(extra: ["-developer:card-review:v1", "NO"])
        let word = element(wordID, in: app)
        XCTAssertTrue(word.waitForExistence(timeout: 30))
        word.tap()
        XCTAssertTrue(app.buttons["qiraat-sheet-close"].waitForExistence(timeout: 20), "the card opened")
        XCTAssertFalse(element("qiraat-card-review", in: app).waitForExistence(timeout: 15), "the review section stays hidden")
    }

    /// The switch is in Settings → المطور and is on until someone turns it off.
    func testTheSwitchIsInTheDeveloperSettingsAndOnByDefault() {
        let app = launch()
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.80, dy: 0.09)).tap()   // margin tap shows the chrome
        let settings = app.buttons["settings-button"]
        XCTAssertTrue(settings.waitForExistence(timeout: 20))
        settings.tap()
        let toggle = app.switches["developer-card-review-toggle"].firstMatch
        var swipes = 0
        while !toggle.isHittable && swipes < 8 { app.swipeUp(); swipes += 1 }
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        XCTAssertEqual(toggle.value as? String, "1")
    }

    func testTheCardShowsTheFaceWaitingForReviewAndApprovesIt() {
        let app = launch()
        openCard(app)
        XCTAssertTrue(waitForLabel("qiraat-card-status-\(faceID)", containing: "بانتظار", in: app))
        let approve = element("qiraat-card-approve-\(faceID)", in: app)
        XCTAssertTrue(approve.waitForExistence(timeout: 10))
        approve.tap()
        XCTAssertTrue(waitForLabel("qiraat-card-status-\(faceID)", containing: "معتمد", in: app))
        XCTAssertFalse(element("qiraat-card-approve-\(faceID)", in: app).exists, "an approved face has nothing left to approve")
    }

    func testDeletingAFaceAsksFirstAndCanBeUndone() {
        let app = launch()
        openCard(app)
        element("qiraat-card-delete-\(faceID)", in: app).tap()
        let confirm = app.buttons["qiraat-card-confirm-delete"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        let undo = element("qiraat-card-undo-delete", in: app)
        XCTAssertTrue(undo.waitForExistence(timeout: 20))
        XCTAssertFalse(element("qiraat-card-face-\(faceID)", in: app).exists)
        undo.tap()
        XCTAssertTrue(element("qiraat-card-face-\(faceID)", in: app).waitForExistence(timeout: 20))
    }

    func testEditOpensTheEditorOnTheEditStepWithoutLeavingTheCard() {
        let app = launch()
        openCard(app)
        element("qiraat-card-edit-\(faceID)", in: app).tap()
        XCTAssertTrue(element("review-sheet-word", in: app).waitForExistence(timeout: 20))
        element("review-sheet-close", in: app).tap()
        XCTAssertTrue(element("qiraat-card-review", in: app).waitForExistence(timeout: 20))
    }
}
