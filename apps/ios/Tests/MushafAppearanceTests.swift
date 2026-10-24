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
}
