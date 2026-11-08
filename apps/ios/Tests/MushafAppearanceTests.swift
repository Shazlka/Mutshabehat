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

}
