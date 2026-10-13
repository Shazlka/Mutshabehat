import XCTest

/// End-to-end checks for the new Qiraat features wired into the reader:
/// legend, filter chip, sheet navigator, page summary, search, usul index,
/// compare, reader picker half-sheet, and favorite note persistence.
@MainActor
final class QiraatFeaturesUITests: XCTestCase {
    override nonisolated func setUp() {
        continueAfterFailure = false
    }

    // MARK: - Launch & Navigation Helpers

    /// Launches the app with fresh reading and notes databases, pinned Arabic locale,
    /// and forced Qiraat preferences.
    private func launch(
        atPage page: Int = 1,
        layer: String = "qiraat",
        filter: String = "all",
        extra: [String] = []
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-mushaf1441:last-page:v1", "\(page)",
            "-mushaf1441:reader-layer:v1", layer,
            "-mushaf1441:qiraat-filter:v1", filter,
            "-reading-fresh",
            "-qiraat-notes-fresh",
            "-app:language:v1", "ar",
            "-AppleLanguages", "(ar)",
            "-AppleLocale", "ar_SA",
        ] + extra
        app.launch()
        return app
    }

    /// Accessor for a Mushaf page element.
    private func page(_ number: Int, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)["mushaf-page-\(number)"]
    }

    /// Taps the page centre to toggle navigation chrome / top bar controls.
    /// A menu entry of any kind whose label contains every given word (interpolated names carry invisible direction marks).
    private func byLabel(_ words: String..., in app: XCUIApplication) -> XCUIElement {
        let predicates = words.map { NSPredicate(format: "label CONTAINS %@", $0) }
        return app.descendants(matching: .any).matching(NSCompoundPredicate(andPredicateWithSubpredicates: predicates)).firstMatch
    }

    /// A tap in the left margin shows or hides the controls; with the Qiraat layer on, the page centre can be a marked word.
    private func showControls(in app: XCUIApplication) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5)).tap()
    }

    /// Scrolls the settings collection view to bring a target row into view.
    private func settingsRow(
        _ id: String,
        in app: XCUIApplication,
        kind: XCUIElement.ElementType = .button
    ) -> XCUIElement {
        let row = app.descendants(matching: kind)[id]
        let list = app.collectionViews.firstMatch
        for _ in 0..<4 where !(row.exists && row.isHittable) { list.swipeUp() }
        for _ in 0..<4 where !(row.exists && row.isHittable) { list.swipeDown() }
        return row
    }

    // MARK: - Tests

    /// Flow 1: Legend opens from reader menu, lists reader rows, and closes cleanly.
    func testLegendOpensListsReaderRowsAndCloses() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))

        showControls(in: app)
        let qiraatButton = app.buttons["qiraat-button"]
        XCTAssertTrue(qiraatButton.waitForExistence(timeout: 5))
        qiraatButton.tap()

        let legendItem = app.buttons["qiraat-hub-legend"]
        XCTAssertTrue(legendItem.waitForExistence(timeout: 5))
        legendItem.tap()

        let legend = app.descendants(matching: .any)["qiraat-legend"]
        XCTAssertTrue(legend.waitForExistence(timeout: 5))

        let nafiRow = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'نافع'")).firstMatch
        var swipes = 0
        while !nafiRow.exists && swipes < 8 {   // the reader rows are below the mark samples
            legend.swipeUp()
            swipes += 1
        }
        XCTAssertTrue(nafiRow.waitForExistence(timeout: 5), "Legend must list reader rows such as Imam Nafi")

        let asimRow = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'عاصم'")).firstMatch
        swipes = 0
        while !asimRow.exists && swipes < 8 {
            legend.swipeUp()
            swipes += 1
        }
        XCTAssertTrue(asimRow.waitForExistence(timeout: 5), "Legend must list reader rows such as Imam Asim")

        let closeButton = app.buttons["qiraat-legend-close"]
        XCTAssertTrue(closeButton.waitForExistence(timeout: 5))
        closeButton.tap()

        XCTAssertFalse(legend.waitForExistence(timeout: 5), "Legend sheet must dismiss when close button is tapped")
    }

    /// Flow 2: Filter change from reader shows qiraat-filter-chip and the page frame does not move.
    func testFilterChangeFromReaderShowsFilterChipAndPageFrameDoesNotMove() {
        let app = launch(atPage: 1, filter: "all")
        let mushafPage = page(1, in: app)
        XCTAssertTrue(mushafPage.waitForExistence(timeout: 10))
        let frameBefore = mushafPage.frame

        let filterChip = app.descendants(matching: .any)["qiraat-filter-chip"]
        XCTAssertFalse(filterChip.exists, "Filter chip must not be shown when filter is all")

        showControls(in: app)
        let qiraatButton = app.buttons["qiraat-button"]
        XCTAssertTrue(qiraatButton.waitForExistence(timeout: 5))
        qiraatButton.tap()

        let filterSubmenu = app.buttons["qiraat-filter"]
        XCTAssertTrue(filterSubmenu.waitForExistence(timeout: 5))
        filterSubmenu.tap()

        let nafi = byLabel("الإمام", "نافع", in: app)
        XCTAssertTrue(nafi.waitForExistence(timeout: 5))
        nafi.tap()
        let warsh = byLabel("الراوي", "ورش", in: app)
        XCTAssertTrue(warsh.waitForExistence(timeout: 5))
        warsh.tap()

        showControls(in: app)

        XCTAssertTrue(filterChip.waitForExistence(timeout: 5), "Filter chip must appear in reading header when active filter is not all")
        XCTAssertEqual(mushafPage.frame, frameBefore, "Changing filter must not alter or shift the Mushaf page frame")

        filterChip.tap()
        let menuPresented = app.buttons.matching(NSPredicate(format: "label CONTAINS 'الكل' OR label CONTAINS 'نافع' OR identifier CONTAINS 'qiraat-filter'")).firstMatch
        XCTAssertTrue(menuPresented.waitForExistence(timeout: 5), "Tapping filter chip must open filter options")
    }

    /// Flow 3: Word sheet next/prev changes the shown word without closing the sheet.
    func testSheetNextAndPreviousChangesShownWord() {
        let app = launch(atPage: 2)
        XCTAssertTrue(page(2, in: app).waitForExistence(timeout: 10))

        let firstWord = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'qiraat-word-'")).firstMatch
        XCTAssertTrue(firstWord.waitForExistence(timeout: 10))
        firstWord.tap()

        let sheetTitle = app.navigationBars["القراءات العشر"]
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5))

        let position = app.descendants(matching: .any)["qiraat-sheet-position"]
        XCTAssertTrue(position.waitForExistence(timeout: 5))
        let initialPosition = position.label

        let nextButton = app.buttons["qiraat-sheet-next"]
        XCTAssertTrue(nextButton.waitForExistence(timeout: 5))
        XCTAssertTrue(nextButton.isEnabled)
        nextButton.tap()

        let nextPosition = position.label
        XCTAssertNotEqual(nextPosition, initialPosition, "Tapping next must advance position to the next marked word")
        XCTAssertTrue(sheetTitle.exists, "Sheet must remain open when advancing to next word")

        let prevButton = app.buttons["qiraat-sheet-prev"]
        XCTAssertTrue(prevButton.waitForExistence(timeout: 5))
        XCTAssertTrue(prevButton.isEnabled)
        prevButton.tap()

        let prevPosition = position.label
        XCTAssertEqual(prevPosition, initialPosition, "Tapping previous must return to the initial marked word")
        XCTAssertTrue(sheetTitle.exists, "Sheet must remain open when returning to previous word")

        let closeButton = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(closeButton.waitForExistence(timeout: 5))
        closeButton.tap()
        XCTAssertFalse(sheetTitle.waitForExistence(timeout: 5))
    }

    /// Flow 4: Page summary on page 2 lists rows and tapping one opens that word's sheet.
    func testPageSummaryOnPageTwoListsRowsAndOpensWordSheet() {
        let app = launch(atPage: 2)
        XCTAssertTrue(page(2, in: app).waitForExistence(timeout: 10))

        showControls(in: app)
        let qiraatButton = app.buttons["qiraat-button"]
        XCTAssertTrue(qiraatButton.waitForExistence(timeout: 5))
        qiraatButton.tap()

        let summaryButton = app.buttons["qiraat-hub-page-summary"]
        XCTAssertTrue(summaryButton.waitForExistence(timeout: 5))
        summaryButton.tap()

        let summaryView = app.descendants(matching: .any)["qiraat-page-summary"]
        XCTAssertTrue(summaryView.waitForExistence(timeout: 5))

        let emptyNotice = app.descendants(matching: .any)["qiraat-page-summary-empty"]
        XCTAssertFalse(emptyNotice.exists, "Page 2 must contain differences and not display empty summary state")

        let summaryRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'qiraat-summary-'")).firstMatch
        XCTAssertTrue(summaryRow.waitForExistence(timeout: 5))
        summaryRow.tap()

        XCTAssertFalse(summaryView.waitForExistence(timeout: 5), "Tapping a summary row must close the page summary view")

        let sheetTitle = app.navigationBars["القراءات العشر"]
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5), "Tapping a summary row must open that word's Qiraat sheet")

        let closeButton = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(closeButton.waitForExistence(timeout: 5))
        closeButton.tap()
        XCTAssertFalse(sheetTitle.waitForExistence(timeout: 5))
    }

    /// Flow 5: Search for a narrator returns results and tapping one opens the page and sheet.
    func testSearchForNarratorReturnsResultsAndOpensPage() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))

        showControls(in: app)
        let qiraatButton = app.buttons["qiraat-button"]
        XCTAssertTrue(qiraatButton.waitForExistence(timeout: 5))
        qiraatButton.tap()

        let searchButton = app.buttons["qiraat-hub-search"]
        XCTAssertTrue(searchButton.waitForExistence(timeout: 5))
        searchButton.tap()

        let searchView = app.descendants(matching: .any)["qiraat-search"]
        XCTAssertTrue(searchView.waitForExistence(timeout: 5))

        let searchField = app.textFields["qiraat-search-field"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText("ورش")

        let warshOption = app.buttons.matching(NSPredicate(format: "label CONTAINS 'ورش'")).firstMatch
        XCTAssertTrue(warshOption.waitForExistence(timeout: 5))
        warshOption.tap()

        let resultRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'qiraat-search-result-'")).firstMatch
        XCTAssertTrue(resultRow.waitForExistence(timeout: 10), "Searching for narrator must return result rows")

        let resultId = resultRow.identifier.replacingOccurrences(of: "qiraat-search-result-", with: "")
        let targetPage = Int(resultId.split(separator: "-")[0]) ?? 1

        resultRow.tap()

        XCTAssertFalse(searchView.waitForExistence(timeout: 5), "Tapping a search result must dismiss search view")
        XCTAssertTrue(page(targetPage, in: app).waitForExistence(timeout: 5), "Tapping a search result must turn to its page")

        let sheetTitle = app.navigationBars["القراءات العشر"]
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5), "Tapping a search result must open that word's Qiraat sheet")

        let closeButton = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(closeButton.waitForExistence(timeout: 5))
        closeButton.tap()
        XCTAssertFalse(sheetTitle.waitForExistence(timeout: 5))
    }

    /// Flow 6: Usul index lists categories and a place opens its page.
    func testUsulIndexListsCategoriesAndPlaceOpensItsPage() {
        let app = launch(atPage: 50)
        XCTAssertTrue(page(50, in: app).waitForExistence(timeout: 10))

        showControls(in: app)
        let qiraatButton = app.buttons["qiraat-button"]
        XCTAssertTrue(qiraatButton.waitForExistence(timeout: 5))
        qiraatButton.tap()

        let usulButton = app.buttons["qiraat-hub-usul-index"]
        XCTAssertTrue(usulButton.waitForExistence(timeout: 5))
        usulButton.tap()

        let usulView = app.descendants(matching: .any)["usul-index"]
        XCTAssertTrue(usulView.waitForExistence(timeout: 10))

        let categoryRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'usul-category-'")).firstMatch
        XCTAssertTrue(categoryRow.waitForExistence(timeout: 10), "Usul index must list category rows")
        categoryRow.tap()

        let placeRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'usul-place-'")).firstMatch
        XCTAssertTrue(placeRow.waitForExistence(timeout: 10), "Selecting category must list place rows")

        let placeId = placeRow.identifier.replacingOccurrences(of: "usul-place-", with: "")
        let targetPage = Int(placeId.split(separator: "-")[0]) ?? 1

        placeRow.tap()

        XCTAssertFalse(usulView.waitForExistence(timeout: 5), "Tapping a place must dismiss usul index")
        XCTAssertTrue(page(targetPage, in: app).waitForExistence(timeout: 5), "Tapping a place must navigate to that place's page")
    }

    /// Flow 7: Compare opens from the sheet and shows two columns and a verdict.
    func testCompareOpensFromSheetAndShowsTwoColumnsAndVerdict() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))

        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()

        let sheetTitle = app.navigationBars["القراءات العشر"]
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5))

        let compareOpen = app.descendants(matching: .any)["qiraat-compare-open"]
        XCTAssertTrue(compareOpen.waitForExistence(timeout: 5))
        compareOpen.tap()

        let compareView = app.descendants(matching: .any)["qiraat-compare"]
        XCTAssertTrue(compareView.waitForExistence(timeout: 5))

        let colFirst = app.descendants(matching: .any)["qiraat-compare-column-first"]
        XCTAssertTrue(colFirst.waitForExistence(timeout: 5), "Compare view must display first reader column")

        let colSecond = app.descendants(matching: .any)["qiraat-compare-column-second"]
        XCTAssertTrue(colSecond.waitForExistence(timeout: 5), "Compare view must display second reader column")

        let verdict = app.descendants(matching: .any)["qiraat-compare-verdict"]
        XCTAssertTrue(verdict.waitForExistence(timeout: 5), "Compare view must display comparison verdict")
        XCTAssertTrue(
            verdict.label.contains("تتفقان") || verdict.label.contains("تختلفان"),
            "Verdict label must declare agreement or difference between readings"
        )

        let pickerFirst = app.descendants(matching: .any)["qiraat-compare-picker-first"]
        XCTAssertTrue(pickerFirst.exists, "Compare view must have first reader picker")

        let pickerSecond = app.descendants(matching: .any)["qiraat-compare-picker-second"]
        XCTAssertTrue(pickerSecond.exists, "Compare view must have second reader picker")
    }

    /// Flow 8: Picker opens as a sheet from Settings, search narrows rows, single tap selects and dismisses.
    func testReaderPickerOpensAsSheetSearchNarrowsAndSingleTapSelects() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))

        showControls(in: app)
        let settingsButton = app.buttons["settings-button"]
        XCTAssertTrue(settingsButton.waitForExistence(timeout: 5))
        settingsButton.tap()

        XCTAssertTrue(app.navigationBars["الإعدادات"].waitForExistence(timeout: 5))

        let pickerRow = settingsRow("open-qiraat-picker", in: app)
        XCTAssertTrue(pickerRow.waitForExistence(timeout: 5))
        pickerRow.tap()

        let pickerNavBar = app.navigationBars["اختر القارئ أو الراوي"]
        XCTAssertTrue(pickerNavBar.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["qiraat-reader-all"].exists)

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.tap()
        searchField.typeText("عاصم")

        let asimRow = app.buttons["qiraat-reader-Q05"]
        XCTAssertTrue(asimRow.waitForExistence(timeout: 5), "Search must display matching reader row")
        XCTAssertFalse(app.buttons["qiraat-reader-all"].exists, "Search must filter out non-matching rows")

        asimRow.tap()

        XCTAssertFalse(pickerNavBar.waitForExistence(timeout: 5), "Single tap on a reader row must dismiss the picker sheet")
        XCTAssertTrue(app.navigationBars["الإعدادات"].exists, "Settings view must remain presented after picker dismissal")
    }

    /// Flow 9: Favourite toggle persists state after closing and reopening the sheet.
    func testFavoriteTogglePersistsAfterClosingAndReopeningSheet() {
        let app = launch(atPage: 1, extra: ["-qiraat-notes-fresh"])
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))

        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()

        let sheetTitle = app.navigationBars["القراءات العشر"]
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5))

        let favToggle = app.descendants(matching: .any)["qiraat-favorite-toggle"]
        XCTAssertTrue(favToggle.waitForExistence(timeout: 5))

        let stateBefore = (favToggle.isSelected, favToggle.value as? String, favToggle.label)
        favToggle.tap()
        let stateAfter = (favToggle.isSelected, favToggle.value as? String, favToggle.label)

        XCTAssertTrue(
            stateBefore.0 != stateAfter.0 || stateBefore.1 != stateAfter.1 || stateBefore.2 != stateAfter.2,
            "Tapping favorite toggle must alter its selected, value, or label state"
        )

        let closeButton = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(closeButton.waitForExistence(timeout: 5))
        closeButton.tap()
        XCTAssertFalse(sheetTitle.waitForExistence(timeout: 5))

        word.tap()
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5))

        let reopenedFav = app.descendants(matching: .any)["qiraat-favorite-toggle"]
        XCTAssertTrue(reopenedFav.waitForExistence(timeout: 5))
        let reopenedState = (reopenedFav.isSelected, reopenedFav.value as? String, reopenedFav.label)

        XCTAssertEqual(reopenedState.0, stateAfter.0, "Favorite isSelected state must persist across sheet close and reopen")
        XCTAssertEqual(reopenedState.1, stateAfter.1, "Favorite value state must persist across sheet close and reopen")
        XCTAssertEqual(reopenedState.2, stateAfter.2, "Favorite label state must persist across sheet close and reopen")

        closeButton.tap()
        XCTAssertFalse(sheetTitle.waitForExistence(timeout: 5))
    }

    // MARK: - Flow 10: Classification and drawn word in word sheet details

    /// Flow 10: Word sheet details show classification line and drawn word for readings and rulings.
    func testWordSheetDetailsShowClassificationAndDrawnWord() {
        let app = launch(atPage: 1)
        XCTAssertTrue(page(1, in: app).waitForExistence(timeout: 10))

        let word = app.descendants(matching: .any)["qiraat-word-1:4:1"]
        XCTAssertTrue(word.waitForExistence(timeout: 10))
        word.tap()

        let sheetTitle = app.navigationBars["القراءات العشر"]
        XCTAssertTrue(sheetTitle.waitForExistence(timeout: 5))

        let classification = app.descendants(matching: .any)["qiraat-classification"].firstMatch
        XCTAssertTrue(classification.waitForExistence(timeout: 5), "Word details must display classification line")
        XCTAssertTrue(
            classification.label.contains("أصول القراءات") || classification.label.contains("فرش الحروف"),
            "Classification label must contain «أصول القراءات» or «فرش الحروف»"
        )

        let variantText = app.descendants(matching: .any)["qiraat-variant-text"].firstMatch
        let rulingWord = app.descendants(matching: .any)["qiraat-ruling-word"].firstMatch
        XCTAssertTrue(
            variantText.waitForExistence(timeout: 5) || rulingWord.waitForExistence(timeout: 5),
            "Word details must draw the word as read (qiraat-variant-text or qiraat-ruling-word)"
        )

        let closeButton = app.buttons["qiraat-sheet-close"]
        XCTAssertTrue(closeButton.waitForExistence(timeout: 5))
        closeButton.tap()
        XCTAssertFalse(sheetTitle.waitForExistence(timeout: 5))
    }
}

