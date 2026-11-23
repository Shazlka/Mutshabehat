import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// The surah banner styles: the stored choice, and every illuminated banner drawn whole (its pieces, the two
/// numbers in their medallions and the title in the centre).
final class SurahBannerTests: XCTestCase {
    func testRoyalIsTheDefaultAndAnUnknownStoredValueFallsBackToIt() {
        XCTAssertEqual(SurahBannerStyle(stored: ""), .royal)
        XCTAssertEqual(SurahBannerStyle(stored: "something"), .royal)
        for style in SurahBannerStyle.allCases { XCTAssertEqual(SurahBannerStyle(stored: style.rawValue), style) }
    }

    func testFiveIlluminatedBannersAndTheClassicOne() {
        XCTAssertEqual(SurahBannerStyle.allCases.filter { $0.art != nil }.count, 5)
        XCTAssertNil(SurahBannerStyle.classic.art)
        XCTAssertEqual(Set(SurahBannerStyle.allCases.compactMap { $0.art?.asset }), [1, 2, 3, 4, 5])
    }

    /// Drawn at a page banner's proportions (12:1), each banner shows its centre panel between the wings, ink in
    /// both medallions (the numbers) and ink in the centre (the title), and nothing of the title over the medallions.
    @MainActor
    func testEveryIlluminatedBannerDrawsItsNumbersAndTitle() throws {
        let size = CGSize(width: 960, height: 80)
        for style in SurahBannerStyle.allCases {
            guard let art = style.art else { continue }
            XCTAssertNotNil(art.images, "\(style): the pieces load")
            let blank = try Bitmap(size: size) { context in
                Self.draw(art, title: "", context: context, size: size, numbers: false)
            }
            let full = try Bitmap(size: size) { context in
                Self.draw(art, title: "سُورَةُ الحَشْرِ", context: context, size: size, numbers: true)
            }
            let scale = size.height / art.sourceHeight
            let medallion = art.medallionX * scale, radius = art.medallionRadius * scale
            func changed(in rect: CGRect) -> Int { full.pixelsDiffering(from: blank, in: rect, by: 60) }

            // The centre strip is drawn, not left empty: the panel beside the title is opaque.
            XCTAssertEqual(blank.alpha(at: CGPoint(x: size.width * 0.35, y: size.height / 2)), 255, "\(style)")
            let left = CGRect(x: medallion - radius * 0.7, y: size.height / 2 - radius * 0.7,
                              width: radius * 1.4, height: radius * 1.4)
            let right = left.offsetBy(dx: size.width - 2 * medallion, dy: 0)
            XCTAssertGreaterThan(changed(in: left), 20, "\(style): the ayah count in the left medallion")
            XCTAssertGreaterThan(changed(in: right), 20, "\(style): the surah number in the right medallion")
            let centre = CGRect(x: size.width * 0.4, y: 0, width: size.width * 0.2, height: size.height)
            XCTAssertGreaterThan(changed(in: centre), 200, "\(style): the title")
            // Away from the title and the numbers, nothing changes.
            let between = CGRect(x: medallion + radius * 1.5, y: 0, width: size.width * 0.1, height: size.height)
            XCTAssertEqual(changed(in: between), 0, "\(style): nothing beside the medallion")
        }
    }

    @MainActor
    private static func draw(_ art: SurahBannerArt, title: String, context: CGContext, size: CGSize, numbers: Bool) {
        if numbers {
            art.draw(in: CGRect(origin: .zero, size: size), title: title, prefixLength: 7, surahNumber: 59,
                     ayahCount: 24, titleFont: { MushafLibrary.mushafFont(size: $0) }, context: context)
        } else {
            // The same pieces with nothing written on them: the numbers and the title drawn in clear.
            art.draw(in: CGRect(origin: .zero, size: size), title: title, prefixLength: 0, surahNumber: 0,
                     ayahCount: 0, titleFont: { MushafLibrary.mushafFont(size: $0) }, context: context, writes: false)
        }
    }
}

/// An RGBA bitmap drawn by a closure in a top-left context.
private struct Bitmap {
    let width: Int, height: Int
    let bytes: [UInt8]

    init(size: CGSize, draw: (CGContext) -> Void) throws {
        width = Int(size.width); height = Int(size.height)
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let context = try XCTUnwrap(CGContext(data: &buffer, width: width, height: height, bitsPerComponent: 8,
                                              bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(context)
        draw(context)
        UIGraphicsPopContext()
        bytes = buffer
    }

    func alpha(at point: CGPoint) -> UInt8 { bytes[(Int(point.y) * width + Int(point.x)) * 4 + 3] }

    func pixelsDiffering(from other: Bitmap, in rect: CGRect, by threshold: Int) -> Int {
        var count = 0
        for y in max(0, Int(rect.minY))..<min(height, Int(rect.maxY)) {
            for x in max(0, Int(rect.minX))..<min(width, Int(rect.maxX)) {
                let i = (y * width + x) * 4
                let d = (0..<3).map { abs(Int(bytes[i + $0]) - Int(other.bytes[i + $0])) }.reduce(0, +)
                if d > threshold { count += 1 }
            }
        }
        return count
    }
}
