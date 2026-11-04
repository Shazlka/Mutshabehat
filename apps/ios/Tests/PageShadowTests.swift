import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// The page's drop shadow follows an explicit path, so Core Animation does not render the page offscreen to find its
/// outline on every frame of a page curl, and the shadow is defined in one place only.
@MainActor
final class PageShadowTests: XCTestCase {
    private func makeView(spreadHalf: Bool = false) throws -> MushafPageView {
        let library = try MushafLibrary()
        let view = MushafPageView(page: try XCTUnwrap(library.page(3)), library: library, appearance: .light)
        view.frame = CGRect(x: 0, y: 0, width: 402, height: 692)
        view.isSpreadHalf = spreadHalf
        view.layoutIfNeeded()
        return view
    }

    func testTheShadowHasAnExplicitPathTheSizeOfThePage() throws {
        let view = try makeView()
        let path = try XCTUnwrap(view.layer.shadowPath, "a shadow without a path is rendered offscreen every frame")
        XCTAssertEqual(path.boundingBox, view.bounds)
    }

    func testThePathFollowsAResize() throws {
        let view = try makeView()
        view.frame = CGRect(x: 0, y: 0, width: 300, height: 520)
        view.layoutIfNeeded()
        XCTAssertEqual(try XCTUnwrap(view.layer.shadowPath).boundingBox, view.bounds)
    }

    func testThereIsOneShadowDefinition() throws {
        let view = try makeView()
        XCTAssertEqual(view.layer.shadowRadius, 8)
        XCTAssertEqual(view.layer.shadowOffset, CGSize(width: 0, height: 3))
        XCTAssertEqual(view.layer.shadowColor, UIColor.black.cgColor)
    }
}
