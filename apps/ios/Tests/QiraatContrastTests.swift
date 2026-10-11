import Foundation
import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// WCAG 2.1 AA (4.5:1) for every text/background pair of the Qiraat detail sheet, in light and dark.
final class QiraatContrastTests: XCTestCase {
    private let styles: [(String, UIUserInterfaceStyle)] = [("light", .light), ("dark", .dark)]

    private func assertContrast(_ text: UIColor, on background: UIColor, _ name: String,
                                minimum: CGFloat = 4.5, file: StaticString = #filePath, line: UInt = #line) {
        for (label, style) in styles {
            let traits = UITraitCollection(userInterfaceStyle: style)
            let ratio = text.resolvedColor(with: traits).contrast(with: background.resolvedColor(with: traits))
            XCTAssertGreaterThanOrEqual(ratio, minimum, "\(name) in \(label) mode: \(ratio)", file: file, line: line)
        }
    }

    func testEveryQiraatTokenPairReadsAtAAInBothModes() {
        let p = QiraatPalette.self
        assertContrast(p.variantInk, on: p.cardFill, "variant word on card")
        assertContrast(p.badgeInk, on: p.badgeFill, "badge")
        assertContrast(p.badgeInk, on: p.cardFill, "badge ink on card (المزيد)")
        assertContrast(p.badgeInk, on: .mushafPaper, "badge ink on paper (hint)")
        assertContrast(p.reviewInk, on: p.reviewFill, "needs-review badge")
        assertContrast(.mushafInk, on: p.cardFill, "pill name on card")
        assertContrast(.mushafBrown, on: p.cardFill, "brown text on card")
        assertContrast(.mushafBrown, on: .mushafPaper, "section heading on paper")
        assertContrast(.mushafInk, on: .mushafPaper, "word glyph on paper")
    }

    func testCardOutlineIsDistinctFromCardFillInBothModes() {
        for (label, style) in styles {
            let traits = UITraitCollection(userInterfaceStyle: style)
            let ratio = QiraatPalette.cardStroke.resolvedColor(with: traits)
                .contrast(with: QiraatPalette.cardFill.resolvedColor(with: traits))
            XCTAssertGreaterThanOrEqual(ratio, 1.5, "card outline in \(label) mode: \(ratio)")
        }
    }

    /// Text on a colour that comes from the data (a ruling category, a reader dot) uses whichever of the two
    /// inks reads better; every colour the bundled data uses reaches AA with one of them.
    func testInkOnEveryDataColourInTheBundledQiraatDataReachesAA() throws {
        let folder = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        var hexes = Set<String>()
        for file in try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
        where file.pathExtension == "json" {
            let text = try String(contentsOf: file, encoding: .utf8)
            hexes.formUnion(try colorHexes(in: text))
        }
        XCTAssertFalse(hexes.isEmpty)
        for hex in hexes {
            let fill = UIColor(qiraatHex: hex)
            let ratio = UIColor.qiraatInk(onFill: fill).contrast(with: fill)
            XCTAssertGreaterThanOrEqual(ratio, 4.5, "\(hex): \(ratio)")

            for (label, style) in styles {
                let traits = UITraitCollection(userInterfaceStyle: style)
                let card = QiraatPalette.cardFill.resolvedColor(with: traits)
                let pill = fill.mixed(over: card, alpha: 0.10)
                let pillRatio = UIColor.mushafInk.resolvedColor(with: traits).contrast(with: pill)
                XCTAssertGreaterThanOrEqual(pillRatio, 4.5, "pill \(hex) in \(label) mode: \(pillRatio)")
            }
        }
    }

    func testPillInitialSkipsTheKindLabelAndTheArticle() {
        XCTAssertEqual(AuthorityPill.initial(ofName: "الإمام نافع"), "ن")
        XCTAssertEqual(AuthorityPill.initial(ofName: "الراوي ورش"), "و")
        XCTAssertEqual(AuthorityPill.initial(ofName: "الراوي الدوري"), "د")
        XCTAssertEqual(AuthorityPill.initial(ofName: "الإمام ابن كثير"), "ا")
    }

    private func colorHexes(in text: String) throws -> [String] {
        let regex = try NSRegularExpression(pattern: "\"color\"\\s*:\\s*\"(#[0-9a-fA-F]{6})\"")
        let source = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: source.length))
            .map { source.substring(with: $0.range(at: 1)) }
    }
}

private extension UIColor {
    func mixed(over background: UIColor, alpha: CGFloat) -> UIColor {
        var foregroundRed: CGFloat = 0, foregroundGreen: CGFloat = 0, foregroundBlue: CGFloat = 0
        var backgroundRed: CGFloat = 0, backgroundGreen: CGFloat = 0, backgroundBlue: CGFloat = 0
        getRed(&foregroundRed, green: &foregroundGreen, blue: &foregroundBlue, alpha: nil)
        background.getRed(&backgroundRed, green: &backgroundGreen, blue: &backgroundBlue, alpha: nil)
        return UIColor(
            red: foregroundRed * alpha + backgroundRed * (1 - alpha),
            green: foregroundGreen * alpha + backgroundGreen * (1 - alpha),
            blue: foregroundBlue * alpha + backgroundBlue * (1 - alpha),
            alpha: 1
        )
    }
}
