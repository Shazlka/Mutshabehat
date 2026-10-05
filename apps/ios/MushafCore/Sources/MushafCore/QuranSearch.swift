import Foundation

public enum QuranSearchMode: String, CaseIterable, Sendable {
    case smart
    case exact
    case broad
}

public enum QuranSearchMatchType: String, Sendable {
    case exact, plain, imlai, canonical, alias, fuzzy, rasm
}

public struct QuranSearchQuery: Hashable, Sendable {
    public let original: String
    public let plain: String
    public let canonical: String
    public let imlai: String
    public let rasmKey: String
    public let tokens: [QuranSearchToken]
}

public struct QuranSearchToken: Hashable, Sendable {
    public let original: String
    public let plain: String
    public let canonical: String
    public let imlai: String
    public let rasmKey: String
}

/// Search-only Arabic normalization. It never mutates or replaces authoritative Mushaf text.
public enum QuranSearchNormalizer {
    private static let controls = CharacterSet.controlCharacters
    private static let marks = CharacterSet.nonBaseCharacters

    public static func query(_ text: String) -> QuranSearchQuery {
        let prepared = cleanup(text)
            .replacingOccurrences(of: "يا أيها", with: "يأيها")
            .replacingOccurrences(of: "يا ايها", with: "يايها")
        let tokens = prepared.split(whereSeparator: \.isWhitespace).map { token(String($0)) }
        return QuranSearchQuery(
            original: text,
            plain: tokens.map(\.plain).joined(separator: " "),
            canonical: tokens.map(\.canonical).joined(separator: " "),
            imlai: tokens.map(\.imlai).joined(separator: " "),
            rasmKey: tokens.map(\.rasmKey).joined(separator: " "),
            tokens: tokens
        )
    }

    public static func token(_ text: String) -> QuranSearchToken {
        let plain = plain(text)
        let canonical = canonical(plain)
        return QuranSearchToken(original: text, plain: plain, canonical: canonical,
                                imlai: imlai(canonical), rasmKey: rasm(canonical))
    }

    public static func cleanup(_ text: String) -> String {
        text.precomposedStringWithCanonicalMapping.unicodeScalars.compactMap { scalar -> String? in
            if scalar.value == 0x0640 || (0x06D6...0x06ED).contains(scalar.value)
                || scalar.value == 0x200B || scalar.value == 0x200C || scalar.value == 0x200D
                || scalar.value == 0xFEFF || marks.contains(scalar) || controls.contains(scalar) { return nil }
            return String(scalar)
        }.joined().split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    public static func plain(_ text: String) -> String {
        cleanup(text).unicodeScalars.map { scalar -> String in
            scalar.value == 0x0671 ? "ا" : String(scalar)
        }.joined()
    }

    public static func canonical(_ text: String) -> String {
        plain(text).unicodeScalars.map { scalar -> String in
            switch scalar.value {
            case 0x0621, 0x0622, 0x0623, 0x0625, 0x0671: "ا" // hamza and alef variants
            case 0x0649: "ي"                         // alef maqsura
            case 0x0629: "ه"                         // final ta marbuta search form
            case 0x0624: "و"                         // seated hamza fallback
            case 0x0626: "ي"
            default: String(scalar)
            }
        }.joined()
    }

    public static func imlai(_ canonical: String) -> String {
        var value = canonical
        for (source, target) in orthographyRules where value.contains(source) {
            value = value.replacingOccurrences(of: source, with: target)
        }
        return value
    }

    public static func rasm(_ canonical: String) -> String {
        canonical.replacingOccurrences(of: "ا", with: "")
            .replacingOccurrences(of: "و", with: "")
            .replacingOccurrences(of: "ي", with: "")
            .replacingOccurrences(of: "ه", with: "")
    }

    /// High-confidence lexical rules. The database also stores generated aliases, so this list can
    /// grow independently of the authoritative Quran data.
    public static let orthographyRules: [(String, String)] = [
        ("الصلوه", "الصلاه"), ("صلوه", "صلاه"),
        ("الزكوه", "الزكاه"), ("زكوه", "زكاه"),
        ("الحيوه", "الحياه"), ("حيوه", "حياه"),
        ("الربوا", "الربا"), ("الربو", "الربا"),
        ("ايمن", "ايمان"), ("الكتب", "الكتاب"), ("قراان", "قران"), ("اامن", "امن"),
        ("اادم", "ادم"), ("يبني", "بني"), ("اسراييل", "اسرايل"),
        ("العلمين", "العالمين"), ("الانهر", "الانهار"), ("رجعون", "راجعون"),
        ("جنت", "جنات"),
        ("مشكوه", "مشكاه"), ("نجوه", "نجاه"),
        ("منوه", "مناه"), ("الغدوه", "الغداه")
    ]
}

extension QuranSearchNormalizer {
    static func similarity(_ lhs: String, _ rhs: String) -> Double {
        guard !lhs.isEmpty, !rhs.isEmpty else { return 0 }
        let a = Array(lhs), b = Array(rhs)
        var previous = Array(0...b.count)
        for (i, left) in a.enumerated() {
            var current = [i + 1] + Array(repeating: 0, count: b.count)
            for (j, right) in b.enumerated() {
                current[j + 1] = min(min(current[j] + 1, previous[j + 1] + 1),
                                     previous[j] + (left == right ? 0 : 1))
            }
            previous = current
        }
        return 1 - Double(previous[b.count]) / Double(max(a.count, b.count))
    }
}
