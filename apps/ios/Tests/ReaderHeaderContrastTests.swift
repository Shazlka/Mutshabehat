import Foundation
import MushafCore
import SwiftUI
import UIKit
import XCTest
@testable import Mutshabehat

/// WCAG 2.1 AA (4.5:1) for the two coloured labels of the reading header: the reader/narrator filter chip, whose
/// fill is the reader's own colour, and the khatma percent, whose hue runs from red to green.
final class ReaderHeaderContrastTests: XCTestCase {
    private let styles: [(String, UIUserInterfaceStyle)] = [("light", .light), ("dark", .dark)]

    private func bundledCatalog() throws -> QiraatCatalog {
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        return try JSONDecoder().decode(QiraatCatalog.self,
                                        from: Data(contentsOf: bundled.appendingPathComponent("catalog.json")))
    }

    func testFilterChipLabelReadsOnEveryReaderAndNarratorColour() throws {
        let catalog = try bundledCatalog()
        let colours = catalog.readers.map { ($0.id, $0.color) } + catalog.narrators.map { ($0.id, $0.color) }
        XCTAssertEqual(colours.count, 30)
        for (id, hex) in colours {
            let fill = UIColor(qiraatHex: hex)
            let ratio = UIColor.chipLabel(on: fill).contrast(with: fill)
            XCTAssertGreaterThanOrEqual(ratio, 4.5, "\(id) \(hex): \(ratio)")
        }
    }

    /// The app's own green fills keep their white label, as before.
    func testFilterChipKeepsWhiteOnTheProgressFill() {
        for (label, style) in styles {
            let fill = UIColor(Color.progressFill).resolvedColor(with: UITraitCollection(userInterfaceStyle: style))
            XCTAssertEqual(UIColor.chipLabel(on: fill), .white, "progress fill in \(label) mode")
        }
    }

    func testKhatmaPercentReadsOnItsChipThroughTheWholeKhatma() {
        for appearance in MushafAppearance.allCases {
            for (label, style) in styles {
                let traits = UITraitCollection(userInterfaceStyle: style)
                for percent in 0...100 {
                    let fraction = Double(percent) / 100
                    let text = ProgressTint.text(fraction, appearance: appearance, traits: traits)
                    let chip = ProgressTint.chipFill(fraction, appearance: appearance, traits: traits)
                    let ratio = text.contrast(with: chip)
                    XCTAssertGreaterThanOrEqual(ratio, 4.5, "\(appearance) \(label) \(percent)%: \(ratio)")
                }
            }
        }
    }

    /// The percent keeps the hue of the ring: it is shaded, never swapped for another colour.
    func testKhatmaPercentKeepsTheRingHue() {
        let traits = UITraitCollection(userInterfaceStyle: .light)
        for percent in [10, 50, 90] {
            let fraction = Double(percent) / 100
            var ringHue: CGFloat = 0, textHue: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            ProgressTint.uiColor(fraction).getHue(&ringHue, saturation: &s, brightness: &b, alpha: &a)
            ProgressTint.text(fraction, appearance: .light, traits: traits)
                .getHue(&textHue, saturation: &s, brightness: &b, alpha: &a)
            XCTAssertEqual(textHue, ringHue, accuracy: 0.02, "\(percent)%")
        }
    }
}
