import XCTest
@testable import Mutshabehat

final class DesignFixesTests: XCTestCase {
    func testSurfaceStaysTranslucentByDefault() {
        XCTAssertFalse(AdaptiveSurfacePolicy.usesOpaqueFill(reduceTransparency: false, increasedContrast: false))
    }

    func testReduceTransparencyForcesOpaqueFill() {
        XCTAssertTrue(AdaptiveSurfacePolicy.usesOpaqueFill(reduceTransparency: true, increasedContrast: false))
    }

    func testIncreasedContrastForcesOpaqueFill() {
        XCTAssertTrue(AdaptiveSurfacePolicy.usesOpaqueFill(reduceTransparency: false, increasedContrast: true))
    }

    func testBothSettingsStayOpaque() {
        XCTAssertTrue(AdaptiveSurfacePolicy.usesOpaqueFill(reduceTransparency: true, increasedContrast: true))
    }
}
