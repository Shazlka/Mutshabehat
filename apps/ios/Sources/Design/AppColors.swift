import SwiftUI
import UIKit

// Semantic colours for the app's chrome (statistics, memorization, Mutshabehat, settings).
// The Mushaf page keeps its own palette in `MushafAppearance`, and Qiraat colours come from the web.
//
// Every text colour here measures at least 4.5:1 (WCAG AA) on the system backgrounds of its mode and
// on an 18% wash of itself; the system `.green` / `.orange` measure about 2.2:1 on white.

extension UIColor {
    /// `0xRRGGBB` in light mode, another in dark mode.
    static func dynamic(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { $0.userInterfaceStyle == .dark ? UIColor(rgb: dark) : UIColor(rgb: light) }
    }

    convenience init(rgb: UInt32) {
        self.init(red: CGFloat((rgb >> 16) & 0xFF) / 255,
                  green: CGFloat((rgb >> 8) & 0xFF) / 255,
                  blue: CGFloat(rgb & 0xFF) / 255,
                  alpha: 1)
    }

    /// WCAG relative luminance.
    var relativeLuminance: CGFloat {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        func channel(_ c: CGFloat) -> CGFloat { c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }

    func contrast(with other: UIColor) -> CGFloat {
        let l1 = relativeLuminance, l2 = other.relativeLuminance
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
    }

    /// This colour, darkened (light mode) or lightened (dark mode) only as much as it takes to read as
    /// text on the system background: for colours the user picks, such as a Mutshabehat group's.
    func readable(minimumContrast: CGFloat = 4.5) -> UIColor {
        UIColor { traits in
            let dark = traits.userInterfaceStyle == .dark
            let background = UIColor.secondarySystemGroupedBackground.resolvedColor(with: traits)
            let target: UIColor = dark ? .white : .black
            var color = self.resolvedColor(with: traits)
            var step = 0
            while color.contrast(with: background) < minimumContrast, step < 20 {
                color = color.mixed(with: target, amount: 0.08)
                step += 1
            }
            return color
        }
    }

    private func mixed(with other: UIColor, amount: CGFloat) -> UIColor {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return UIColor(red: r1 + (r2 - r1) * amount, green: g1 + (g2 - g1) * amount,
                       blue: b1 + (b2 - b1) * amount, alpha: a1)
    }
}

/// Declared on `ShapeStyle where Self == Color` (not on `Color`) so both `Color.progress` and the
/// shorthand `.foregroundStyle(.progress)` resolve without ambiguity.
extension ShapeStyle where Self == Color {
    /// Reading progress and completion: text, icons, rings.
    static var progress: Color { AppPalette.progress }
    /// A filled progress shape that carries white content (a check, a selected chip's label).
    static var progressFill: Color { AppPalette.progressFill }
    /// Something to look at but not an error: a disconnected sync, a remaining count, undo.
    static var caution: Color { AppPalette.caution }
    /// A filled caution shape that carries white content.
    static var cautionFill: Color { AppPalette.cautionFill }
    /// Neutral information: page counts, time read.
    static var info: Color { AppPalette.info }
    /// A second, quieter category: khatmas, recitation from memory, automated groups.
    static var insight: Color { AppPalette.insight }
    /// The favourite star.
    static var favorite: Color { AppPalette.favorite }
    /// Errors and destructive actions.
    static var danger: Color { AppPalette.danger }
}

private enum AppPalette {
    static let progress = Color(uiColor: .dynamic(light: 0x1A7340, dark: 0x5FD38D))
    static let progressFill = Color(uiColor: .dynamic(light: 0x1A7340, dark: 0x23854D))
    static let caution = Color(uiColor: .dynamic(light: 0xA14D07, dark: 0xF7A65E))
    static let cautionFill = Color(uiColor: .dynamic(light: 0xA14D07, dark: 0xA8530C))
    static let info = Color(uiColor: .dynamic(light: 0x1B5FC1, dark: 0x80B4FF))
    static let insight = Color(uiColor: .dynamic(light: 0x6A3DB0, dark: 0xC3A5F7))
    static let favorite = Color(uiColor: .dynamic(light: 0x8F6A00, dark: 0xF2C94C))
    static let danger = Color(uiColor: .dynamic(light: 0xB4232A, dark: 0xFF8A8A))
}
