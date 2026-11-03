import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// The memorization status colours are used as text (the page mark, the lists, the dashboard), so each has to read at
/// WCAG AA (4.5:1) on the page and on the faint tint of its own colour the page mark sits on, in light and dark.
final class MemorizationThemeContrastTests: XCTestCase {
    private let statuses: [MemorizationStatus] = [.mastered, .memorizedWithErrors, .needsMushaf, .notMemorized]

    private func blended(_ foreground: UIColor, over background: UIColor, alpha: CGFloat) -> UIColor {
        var fr: CGFloat = 0, fg: CGFloat = 0, fb: CGFloat = 0, br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0
        foreground.getRed(&fr, green: &fg, blue: &fb, alpha: nil)
        background.getRed(&br, green: &bg, blue: &bb, alpha: nil)
        return UIColor(red: fr * alpha + br * (1 - alpha), green: fg * alpha + bg * (1 - alpha),
                       blue: fb * alpha + bb * (1 - alpha), alpha: 1)
    }

    func testEveryStatusColourReadsAsTextOnThePageAndOnItsOwnTint() {
        for (label, style) in [("light", UIUserInterfaceStyle.light), ("dark", .dark)] {
            let traits = UITraitCollection(userInterfaceStyle: style)
            let paper = UIColor.mushafPaper.resolvedColor(with: traits)
            for status in statuses {
                let text = MemorizationTheme.uiColor(status).resolvedColor(with: traits)
                XCTAssertGreaterThanOrEqual(text.contrast(with: paper), 4.5, "\(status) on the page in \(label) mode")
                let tint = blended(text, over: paper, alpha: 0.12)
                XCTAssertGreaterThanOrEqual(text.contrast(with: tint), 4.5, "\(status) on its tint in \(label) mode")
            }
        }
    }
}
