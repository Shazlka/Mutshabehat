import XCTest

extension XCUIApplication {
    /// The app as UI tests must launch it: `QIRAAT_TEST_ISOLATION=1` keeps the Qiraat layer on the bundled
    /// snapshot (no live fetch from the production site, no imported or overlay pages from earlier runs) and keeps
    /// the real iCloud folder out of reach, so a test result never depends on what the live database holds.
    ///
    /// `animations: false` also turns UI animations off on iPad. The memorization sheets use the keyboard, and
    /// there the runner can wait minutes for a keyboard animation that never reports completion. It is not the
    /// default: other screens (the legend sheet's scrolling, page turns) behave differently without animations.
    static func isolated(animations: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["QIRAAT_TEST_ISOLATION"] = "1"
        if !animations && UIDevice.current.userInterfaceIdiom == .pad { app.launchEnvironment["QIRAAT_UI_TEST_NO_ANIMATIONS"] = "1" }
        return app
    }
}

extension XCUIApplication {
    /// Dismisses the number keyboard of the memorization sheets. On iPhone the keyboard has the app's «تم»
    /// accessory button; the iPad's number keyboard is a full keyboard whose Return key submits the field (the
    /// accessory button is not hittable there).
    func dismissNumberKeyboard() {
        if UIDevice.current.userInterfaceIdiom == .pad {
            typeText("\n")
        } else {
            let done = buttons["memo-keyboard-done"]
            if done.waitForExistence(timeout: 2) { done.tap() }
        }
    }
}
