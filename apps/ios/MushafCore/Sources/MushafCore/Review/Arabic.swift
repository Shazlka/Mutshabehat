import Foundation

/// Port of `src/lib/arabic.ts` (`normalizeArabic`), the comparison key every reference match is built on.
/// Arabic text is compared as UTF-16 code units, exactly as the web compares JavaScript strings.
public enum Arabic {
    /// ا for أ إ آ ٱ and the dagger alef; ي for ى ئ; ه for ة; و for ؤ; tashkeel and tatweel dropped; trimmed.
    public static func normalize(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            let v = scalar.value
            switch v {
            case 0x0670: out.append("ا")
            case 0x0623, 0x0625, 0x0622, 0x0627, 0x0671: out.append("ا")
            case 0x0649, 0x0626: out.append("ي")
            case 0x0629: out.append("ه")
            case 0x0624: out.append("و")
            case 0x0640: continue
            case 0x064B...0x065F, 0x06D6...0x06ED, 0x08E0...0x08FE, 0x200B...0x200F: continue
            default: out.append(scalar)
            }
        }
        return trimJS(String(out))
    }

    /// JavaScript's `String.prototype.trim` whitespace set.
    static func isJSWhitespace(_ v: UInt32) -> Bool {
        switch v {
        case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: true
        default: false
        }
    }

    public static func trimJS(_ text: String) -> String {
        var scalars = Array(text.unicodeScalars)
        while let last = scalars.last, isJSWhitespace(last.value) { scalars.removeLast() }
        var start = 0
        while start < scalars.count, isJSWhitespace(scalars[start].value) { start += 1 }
        var view = String.UnicodeScalarView()
        view.append(contentsOf: scalars[start...])
        return String(view)
    }

    /// Splits on runs of whitespace like `text.split(/\s+/)`, keeping empty edges out.
    static func words(_ text: String) -> [String] {
        var parts: [String] = []
        var current = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if isJSWhitespace(scalar.value) {
                if !current.isEmpty { parts.append(String(current)); current = String.UnicodeScalarView() }
            } else { current.append(scalar) }
        }
        if !current.isEmpty { parts.append(String(current)) }
        return parts
    }

    static func removing(_ text: String, _ scalars: Set<UInt32>) -> String {
        var out = String.UnicodeScalarView()
        for s in text.unicodeScalars where !scalars.contains(s.value) { out.append(s) }
        return String(out)
    }
}
