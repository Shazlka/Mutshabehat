import XCTest
@testable import Mutshabehat

/// Which layout the reader uses: one page, a two-page spread, or (iPad landscape, «تعلّم») one page with the
/// Qiraat side bar.
final class ReaderLayoutTests: XCTestCase {
    func testPortraitAndNarrowScreensAreOnePageWhateverTheChoice() {
        for choice in LandscapeView.allCases {
            XCTAssertEqual(ReaderLayout.resolve(width: 1024, height: 1366, landscapeView: choice), .single)
            XCTAssertEqual(ReaderLayout.resolve(width: 874, height: 402, landscapeView: choice), .single)
        }
    }

    func testIPadLandscapeIsASpreadForReadingAndOnePageWithTheSideBarForLearning() {
        XCTAssertEqual(ReaderLayout.resolve(width: 1366, height: 1024, landscapeView: .reading), .spread)
        XCTAssertEqual(ReaderLayout.resolve(width: 1366, height: 1024, landscapeView: .learning), .learning)
        XCTAssertEqual(ReaderLayout.resolve(width: 1180, height: 820, landscapeView: .learning), .learning)
    }

    func testReadingIsTheDefaultAndAnUnknownStoredValueFallsBackToIt() {
        XCTAssertEqual(LandscapeView(stored: ""), .reading)
        XCTAssertEqual(LandscapeView(stored: "something"), .reading)
        XCTAssertEqual(LandscapeView(stored: "learning"), .learning)
    }

    /// The side bar is wide enough for a variant card and never takes more than a third of the screen.
    func testTheSideBarWidth() {
        XCTAssertEqual(ReaderLayout.sideBarWidth(screenWidth: 1366), 400)
        XCTAssertEqual(ReaderLayout.sideBarWidth(screenWidth: 1024), 1024 / 3, accuracy: 0.5)
    }
}
