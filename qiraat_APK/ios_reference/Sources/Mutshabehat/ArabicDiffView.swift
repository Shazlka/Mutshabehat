import SwiftUI
import UIKit

public struct ArabicDiffView: View {
    public let parts: [PersonalPart]

    /// The Mushaf text size, 23 pt at the default text size, following Dynamic Type. Capped so a card preview with
    /// a line limit still shows whole words at the largest accessibility sizes.
    @ScaledMetric(relativeTo: .title3) private var fontSize: CGFloat = 23
    private static let maximumFontSize: CGFloat = 40

    public init(parts: [PersonalPart]) {
        self.parts = parts
    }

    public var body: some View {
        Text(attributedText)
            .environment(\.layoutDirection, .rightToLeft)
            .multilineTextAlignment(.leading)
            .lineSpacing(10)
            .font(mushafFont)
            // Read the parts with their kind, so a VoiceOver user hears which words differ, not one flat ayah.
            .accessibilityLabel(Text(verbatim: ArabicDiffAccessibility.label(for: parts)))
    }

    private var attributedText: AttributedString {
        var result = AttributedString("")
        for (index, part) in parts.enumerated() {
            var str = AttributedString(part.text)
            str.font = mushafFont

            if let style = MutshabehatPartStyle(rawType: part.type) {
                str.foregroundColor = Color(uiColor: style.foreground)
                str.backgroundColor = Color(uiColor: style.background)
                // A cue that does not depend on colour (WCAG 1.4.1), always on, in the part's own colour.
                if let pattern = style.nonColorUnderline {
                    str.underlineStyle = Text.LineStyle(pattern: pattern, color: Color(uiColor: style.foreground))
                }
            } else {
                str.foregroundColor = Color(uiColor: .label)
            }

            result.append(str)

            // Web app spacing rule (ArabicDiff.tsx):
            // Only insert a space between adjacent parts if the current part doesn't end
            // with a space and the next part doesn't start with a space.
            let next = index + 1 < parts.count ? parts[index + 1] : nil
            let needsSpace = next != nil
                && !part.text.hasSuffix(" ")
                && !next!.text.hasPrefix(" ")
            if needsSpace {
                var spaceStr = AttributedString(" ")
                spaceStr.font = mushafFont
                result.append(spaceStr)
            }
        }
        return result
    }

    private var mushafFont: Font {
        let size = min(fontSize, Self.maximumFontSize)
        let font = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: size)
            ?? UIFont(name: "Damascus", size: size)
            ?? UIFont.systemFont(ofSize: size)
        return Font(font)
    }
}

/// The spoken form of a diff: each coloured part is followed by its kind ("…، اختلاف"), shared and blank parts are
/// read as plain text. Pure, so it is unit-tested; the kind names follow the app language.
enum ArabicDiffAccessibility {
    static func label(for parts: [PersonalPart]) -> String {
        parts.compactMap { part -> String? in
            let text = part.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            guard let style = MutshabehatPartStyle(rawType: part.type), let kind = style.spokenKind else { return text }
            return appLocalized("\(text)، \(kind)")
        }
        .joined(separator: " ")
    }
}

/// Matches the semantic color classes and CSS variables in the web app:
/// .part-shared, .part-diff, .part-diff2, .part-diff3, .part-addition, .part-unique, .part-blank
public enum MutshabehatPartStyle: String, CaseIterable, Sendable {
    case shared
    case difference
    case difference2
    case difference3
    case addition
    case unique
    case blank

    public init?(rawType: String) {
        switch rawType {
        case "shared":
            self = .shared
        case "diff", "difference":
            self = .difference
        case "diff2", "difference2":
            self = .difference2
        case "diff3", "difference3":
            self = .difference3
        case "addition", "added":
            self = .addition
        case "unique", "removed":
            self = .unique
        case "blank":
            self = .blank
        default:
            return nil
        }
    }

    public var title: String {
        switch self {
        case .shared: "مشترك"
        case .difference: "اختلاف"
        case .difference2: "اختلاف ٢"
        case .difference3: "اختلاف ٣"
        case .addition: "زيادة"
        case .unique: "فريد"
        case .blank: "فراغ"
        }
    }

    /// The kind as VoiceOver says it after the part, in the app language; nil for the parts read as plain text
    /// (shared words carry no difference, a blank is a gap).
    public var spokenKind: String? {
        switch self {
        case .shared, .blank: nil
        case .difference: appLocalized("اختلاف")
        case .difference2: appLocalized("اختلاف ٢")
        case .difference3: appLocalized("اختلاف ٣")
        case .addition: appLocalized("زيادة")
        case .unique: appLocalized("فريد")
        }
    }

    /// The underline that marks a part without relying on colour: solid for the differences, dashed for an
    /// addition, dotted for a unique part. Underlines, not bold: the Uthmani Mushaf font has no bold face, and a
    /// line under the word stays clear of the harakat above it. The colour legend (`MutshabehatView`) shows the same lines.
    public var nonColorUnderline: Text.LineStyle.Pattern? {
        switch self {
        case .shared, .blank: nil
        case .difference, .difference2, .difference3: .solid
        case .addition: .dash
        case .unique: .dot
        }
    }

    /// Exact foreground color matching globals.css (OKLCH mapped to sRGB with dark mode adaptation)
    public var foreground: UIColor {
        switch self {
        case .shared:
            // web: oklch(0.46 0.110 150) -> #1D6835; dark: #4ADE80
            return UIColor.adaptive(lightHex: "#1D6835", darkHex: "#4ADE80")
        case .difference:
            // web: oklch(0.52 0.110 80) -> #8A6000; dark: #FACC15
            return UIColor.adaptive(lightHex: "#8A6000", darkHex: "#FACC15")
        case .difference2:
            // web: oklch(0.48 0.140 295) -> #6549A3; dark: #C084FC
            return UIColor.adaptive(lightHex: "#6549A3", darkHex: "#C084FC")
        case .difference3:
            // web: oklch(0.50 0.080 195) -> #157171; dark: #2DD4BF
            return UIColor.adaptive(lightHex: "#157171", darkHex: "#2DD4BF")
        case .addition:
            // web: oklch(0.48 0.130 250) -> #0C60A3; dark: #60A5FA
            return UIColor.adaptive(lightHex: "#0C60A3", darkHex: "#60A5FA")
        case .unique:
            // web: oklch(0.52 0.140 25) -> #AB413E; dark: #F87171
            return UIColor.adaptive(lightHex: "#AB413E", darkHex: "#F87171")
        case .blank:
            // web: oklch(0.36 0.140 265) -> #173485; dark: #93C5FD
            return UIColor.adaptive(lightHex: "#173485", darkHex: "#93C5FD")
        }
    }

    /// Exact background color matching globals.css
    public var background: UIColor {
        switch self {
        case .shared:
            // web: oklch(0.96 0.040 150) -> #E0FAE4; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#E0FAE4", darkHex: "#1D6835", darkAlpha: 0.35)
        case .difference:
            // web: oklch(0.96 0.060 85) -> #FFF0C5; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#FFF0C5", darkHex: "#8A6000", darkAlpha: 0.35)
        case .difference2:
            // web: oklch(0.96 0.040 295) -> #F3EDFF; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#F3EDFF", darkHex: "#6549A3", darkAlpha: 0.35)
        case .difference3:
            // web: oklch(0.96 0.030 195) -> #DCF9F8; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#DCF9F8", darkHex: "#157171", darkAlpha: 0.35)
        case .addition:
            // web: oklch(0.96 0.040 250) -> #DEF5FF; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#DEF5FF", darkHex: "#0C60A3", darkAlpha: 0.35)
        case .unique:
            // web: oklch(0.96 0.040 25) -> #FFE8E4; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#FFE8E4", darkHex: "#AB413E", darkAlpha: 0.35)
        case .blank:
            // web: oklch(0.93 0.050 265) -> #D8E8FF; dark: translucent dark tint
            return UIColor.adaptive(lightHex: "#D8E8FF", darkHex: "#173485", darkAlpha: 0.35)
        }
    }
}

extension UIColor {
    fileprivate convenience init(hexString: String, alpha: CGFloat = 1.0) {
        let clean = hexString.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: clean).scanHexInt64(&int)
        let r, g, b: CGFloat
        switch clean.count {
        case 3:
            r = CGFloat((int >> 8) * 17) / 255.0
            g = CGFloat((int >> 4 & 0xF) * 17) / 255.0
            b = CGFloat((int & 0xF) * 17) / 255.0
        case 6:
            r = CGFloat((int >> 16) & 0xFF) / 255.0
            g = CGFloat((int >> 8) & 0xFF) / 255.0
            b = CGFloat(int & 0xFF) / 255.0
        default:
            r = 0; g = 0; b = 0
        }
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }

    fileprivate static func adaptive(lightHex: String, darkHex: String, lightAlpha: CGFloat = 1.0, darkAlpha: CGFloat = 1.0) -> UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hexString: darkHex, alpha: darkAlpha)
                : UIColor(hexString: lightHex, alpha: lightAlpha)
        }
    }
}
