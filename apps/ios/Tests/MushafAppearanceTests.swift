import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

final class MushafAppearanceTests: XCTestCase {
    /// The strip around the page (under the header and footer) is the page's own colour in every theme and
    /// both system styles, never a darker desk.
    func testTheDeskIsThePaperInEveryTheme() {
        for style in [UIUserInterfaceStyle.light, .dark] {
            let traits = UITraitCollection(userInterfaceStyle: style)
            for appearance in MushafAppearance.allCases {
                XCTAssertEqual(appearance.desk(for: traits), appearance.paper(for: traits),
                               "\(appearance) in \(style.rawValue)")
            }
        }
    }

    /// No reader chosen: the paper is untouched. A reader's wash moves the paper toward that reader's colour only,
    /// and the desk around the page takes the same wash so no plain strip shows.
    func testAReadersWashTintsPaperAndDeskTogether() {
        let tint = QiraatColor(hex: "#EA580C")
        for style in [UIUserInterfaceStyle.light, .dark] {
            let traits = UITraitCollection(userInterfaceStyle: style)
            for appearance in MushafAppearance.allCases {
                XCTAssertEqual(appearance.paper(for: traits, tint: nil), appearance.paper(for: traits))
                let washed = appearance.paper(for: traits, tint: tint)
                XCTAssertNotEqual(washed, appearance.paper(for: traits), "\(appearance) in \(style.rawValue)")
                XCTAssertEqual(appearance.desk(for: traits, tint: tint), washed)
            }
        }
    }

    /// The bookmark ribbons are a non-text cue: 3:1 against the page (WCAG 1.4.11) on every theme, with and without a
    /// reader's wash. The fixed crimson sat at exactly 3.00:1 on the dark page and fell under it with a wash.
    func testTheBookmarkRibbonHoldsThreeToOneOnEveryPage() throws {
        let readerColours = ["#2563EB", "#16A34A", "#0891B2", "#7C3AED", "#EA580C", "#DC2626", "#DB2777",
                             "#CA8A04", "#B45309", "#475569"].map { QiraatColor(hex: $0) }
        for style in [UIUserInterfaceStyle.light, .dark] {
            let traits = UITraitCollection(userInterfaceStyle: style)
            for appearance in MushafAppearance.allCases {
                for tint in [nil] + readerColours {
                    let paper = appearance.paper(for: traits, tint: tint)
                    let ribbon = appearance.bookmarkRibbon(for: traits, tint: tint)
                    XCTAssertGreaterThanOrEqual(ribbon.contrast(with: paper), 3,
                                                "\(appearance) in \(style.rawValue), wash \(String(describing: tint))")
                }
            }
        }
    }
}
