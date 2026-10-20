#if DEBUG
import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat
#if DEBUG
@testable import ReviewEditor
#endif

@MainActor
final class ReviewPageCanvasTests: XCTestCase {
    func testTintsFollowTheWordStatus() {
        XCTAssertNil(ReviewWordStyle.tint(for: nil))
        XCTAssertEqual(ReviewWordStyle.tint(for: .reviewed), .reviewed)
        XCTAssertEqual(ReviewWordStyle.tint(for: .unreviewed), .unreviewed)
        XCTAssertEqual(ReviewWordStyle.tint(for: .flagged), .flagged)
        // Three different colours, never the same one for two states.
        let colours = [ReviewWordStyle.Tint.reviewed, .unreviewed, .flagged].map { $0.color.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light)) }
        XCTAssertEqual(Set(colours.map { $0.description }).count, 3)
    }

    func testSelectionIsARingNotAFill() {
        XCTAssertTrue(ReviewWordStyle.drawsRing(selected: true))
        XCTAssertFalse(ReviewWordStyle.drawsRing(selected: false))
    }

    func testOnlyRealWordsAreTappableAndKeyed() throws {
        let library = try MushafLibrary()
        let page = try XCTUnwrap(library.page(8))
        let keyed = page.lines.flatMap(\.words).compactMap { ReviewWordKeys.key(for: $0) }
        XCTAssertGreaterThan(keyed.count, 80)
        XCTAssertEqual(Set(keyed).count, keyed.count)      // no two words share a key
    }

    func testTappingAWordReportsItsKey() throws {
        let library = try MushafLibrary()
        let page = try XCTUnwrap(library.page(8))
        let view = ReviewPageUIView(frame: CGRect(x: 0, y: 0, width: 390, height: 390 / PageLayoutConstants.pageAspect))
        var tapped: String?
        view.configure(page: page, library: .make(library: library), statusFor: { _ in nil }, selectedKeys: []) { tapped = $0 }
        view.layoutIfNeeded()
        let layout = try XCTUnwrap(view.currentLayout)
        let box = try XCTUnwrap(layout.lines.flatMap(\.boxes).first { ReviewWordKeys.key(for: $0.word) != nil })
        view.handleTap(at: CGPoint(x: box.frame.midX, y: box.frame.midY))
        XCTAssertEqual(tapped, ReviewWordKeys.key(for: box.word))
    }
}
#endif
