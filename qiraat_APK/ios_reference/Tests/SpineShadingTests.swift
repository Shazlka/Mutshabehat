import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// The shading where the two pages of a spread meet darkens smoothly toward the spine, with no flat box and no edge
/// anywhere on the paper (the top and bottom corners used to carry 74 pt rectangles with a hard side).
@MainActor
final class SpineShadingTests: XCTestCase {
    private func render(page number: Int, spine: PageLayoutConstants.SpineSide) throws -> UIImage {
        let library = try MushafLibrary()
        let view = MushafPageView(page: try XCTUnwrap(library.page(number)), library: library, appearance: .light)
        view.frame = CGRect(x: 0, y: 0, width: 600, height: 858)
        view.isSpreadHalf = true
        view.spineSide = spine
        view.layoutIfNeeded()
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: view.bounds.size, format: format).image { context in
            UIColor.mushafPaper.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light)).setFill()
            context.fill(view.bounds)
            view.draw(view.bounds)
        }
    }

    /// Brightness (0…255) of each pixel of one row, from `fromX` to `toX`.
    private func row(_ image: UIImage, y: Int, from fromX: Int, to toX: Int) throws -> [Int] {
        let cg = try XCTUnwrap(image.cgImage)
        let width = cg.width, height = cg.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let context = try XCTUnwrap(CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8,
                                              bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
        let flippedY = height - 1 - y
        return stride(from: fromX, through: toX, by: fromX <= toX ? 1 : -1).map { x in
            let i = (flippedY * width + x) * 4
            return (Int(pixels[i]) + Int(pixels[i + 1]) + Int(pixels[i + 2])) / 3
        }
    }

    /// Rows in the top margin (above the first line of text) and the bottom margin, read from 140 pt away from the
    /// spine to 5 pt from it (the fold itself is meant to be dark): never lighter toward the spine, and never a step
    /// of more than 4 levels between neighbours.
    func testTheSpineShadeHasNoEdgeInTheMargins() throws {
        for (number, spine) in [(52, PageLayoutConstants.SpineSide.right), (53, .left)] {
            let image = try render(page: number, spine: spine)
            let width = Int(image.size.width)
            for y in [4, 10, 848, 854] {
                let values = spine == .right
                    ? try row(image, y: y, from: width - 141, to: width - 6)
                    : try row(image, y: y, from: 140, to: 5)
                for (a, b) in zip(values, values.dropFirst()) {
                    XCTAssertLessThanOrEqual(b, a + 1, "page \(number) row \(y): lighter toward the spine")
                    XCTAssertLessThanOrEqual(a - b, 4, "page \(number) row \(y): an edge in the shade (\(a) → \(b))")
                }
                XCTAssertLessThan(values.last!, values.first! - 10, "page \(number) row \(y): the spine is shaded")
            }
        }
    }
}
