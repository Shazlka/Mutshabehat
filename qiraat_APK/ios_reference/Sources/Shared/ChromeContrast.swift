import SwiftUI

/// When the reader's chrome (bars, chips, the footer menu) should be drawn as an opaque fill with a hairline edge
/// instead of glass or a translucent wash: the user asked for less transparency, or for more contrast. Never applied
/// to the Mushaf page itself.
enum ChromeContrast {
    static func prefersOpaque(reduceTransparency: Bool, contrast: ColorSchemeContrast) -> Bool {
        reduceTransparency || contrast == .increased
    }

    /// The width of the edge an opaque surface gets.
    static let separatorWidth: CGFloat = 0.5
}
