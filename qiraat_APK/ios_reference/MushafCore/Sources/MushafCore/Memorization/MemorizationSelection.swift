import Foundation

/// What a memorization update or review applies to. Every case resolves to ayah keys in Mushaf order.
public enum MemorizationSelection: Equatable, Sendable {
    case surah(Int)
    case ayahRange(surah: Int, from: Int, to: Int)
    case pageRange(ClosedRange<Int>)
    case juz(Int)
    case ayat(Set<AyahKey>)
    /// From one ayah to another in Mushaf order, possibly across surahs, in either direction.
    case span(from: AyahKey, to: AyahKey)

    /// The selected ayat in Mushaf order, without duplicates. Out-of-range values are clamped or dropped;
    /// a selection that matches nothing resolves to an empty list.
    public func resolve(in index: QuranIndex) -> [AyahKey] {
        switch self {
        case let .surah(number):
            return index.ayat(ofSurah: number)
        case let .ayahRange(surah, from, to):
            let count = index.ayahCount(surah: surah)
            let lower = max(1, min(from, to))
            let upper = min(count, max(from, to))
            guard count > 0, lower <= upper else { return [] }
            return (lower...upper).map { AyahKey(surah: surah, ayah: $0) }.filter { index.ordinal(of: $0) != nil }
        case let .pageRange(pages):
            return index.ayat(inPages: pages)
        case let .juz(number):
            return index.ayat(ofJuz: number)
        case let .ayat(keys):
            return keys.compactMap { key in index.ordinal(of: key).map { (key, $0) } }
                .sorted { $0.1 < $1.1 }.map(\.0)
        case let .span(from, to):
            return index.ayat(from: from, to: to)
        }
    }

    /// True when the selection is exactly the ayat of one whole surah (such an update asks for confirmation).
    public func isWholeSurah(in index: QuranIndex) -> Bool {
        let keys = resolve(in: index)
        guard let first = keys.first else { return false }
        return keys.allSatisfy { $0.surah == first.surah } && keys.count == index.ayahCount(surah: first.surah)
    }
}

/// Where typed text such as «البقرة 255» or «صفحة 42» leads.
public enum SelectionTarget: Equatable, Sendable {
    case selection(MemorizationSelection)
    case surahDetail(Int)
    case page(Int)
    case ayah(AyahKey)
    case juz(Int)

    /// The selection an update sheet should preselect for this target.
    public var asSelection: MemorizationSelection {
        switch self {
        case let .selection(selection): selection
        case let .surahDetail(number): .surah(number)
        case let .page(number): .pageRange(number...number)
        case let .ayah(key): .ayahRange(surah: key.surah, from: key.ayah, to: key.ayah)
        case let .juz(number): .juz(number)
        }
    }
}

public enum SelectionParser {
    /// Understands «يس», «سورة يس», «البقرة 255», «صفحة 42», «ص 42», «الجزء 30» with Latin, Arabic-Indic and
    /// Eastern Arabic digits; harakat, alef and ta marbuta variants are ignored. Nil for anything else,
    /// including a page outside 1…604, a juz outside 1…30 or an ayah the surah does not have.
    public static func parse(_ text: String, surahNames: [Int: String], index: QuranIndex) -> SelectionTarget? {
        let tokens = latinDigits(text).split(whereSeparator: \.isWhitespace).map(String.init)
        guard let first = tokens.first else { return nil }

        if tokens.count == 2, let number = Int(tokens[1]) {
            let keyword = canonical(first)
            if pageKeywords.contains(keyword) { return (1...mushafPageCount).contains(number) ? .page(number) : nil }
            if juzKeywords.contains(keyword) { return (1...30).contains(number) ? .juz(number) : nil }
        }

        var nameTokens = tokens
        var ayah: Int?
        if nameTokens.count > 1, let number = Int(nameTokens[nameTokens.count - 1]) {
            ayah = number
            nameTokens.removeLast()
        }
        if nameTokens.count > 1, canonical(nameTokens[0]) == surahKeyword { nameTokens.removeFirst() }
        guard let surah = matchSurah(canonical(nameTokens.joined(separator: " ")), names: surahNames) else { return nil }
        guard let ayah else { return .surahDetail(surah) }
        guard ayah >= 1, ayah <= index.ayahCount(surah: surah) else { return nil }
        return .ayah(AyahKey(surah: surah, ayah: ayah))
    }

    private static let pageKeywords: Set<String> = [canonical("صفحة"), canonical("صفحه"), canonical("ص")]
    private static let juzKeywords: Set<String> = [canonical("الجزء"), canonical("جزء"), canonical("ج")]
    private static let surahKeyword = canonical("سورة")

    private static func canonical(_ text: String) -> String { QuranSearchNormalizer.canonical(text) }

    private static func latinDigits(_ text: String) -> String {
        String(String.UnicodeScalarView(text.unicodeScalars.map { scalar -> Unicode.Scalar in
            switch scalar.value {
            case 0x0660...0x0669: Unicode.Scalar(scalar.value - 0x0660 + 0x30)!
            case 0x06F0...0x06F9: Unicode.Scalar(scalar.value - 0x06F0 + 0x30)!
            default: scalar
            }
        }))
    }

    /// An exact match (with or without the leading «ال») wins; otherwise a prefix that fits one surah only.
    private static func matchSurah(_ query: String, names: [Int: String]) -> Int? {
        guard !query.isEmpty else { return nil }
        let article = canonical("ال")
        var prefixMatches: [Int] = []
        for (number, name) in names.sorted(by: { $0.key < $1.key }) {
            let full = canonical(name)
            let bare = full.hasPrefix(article) && full.count > article.count ? String(full.dropFirst(article.count)) : full
            if full == query || bare == query { return number }
            if query.count >= 2, full.hasPrefix(query) || bare.hasPrefix(query) { prefixMatches.append(number) }
        }
        return prefixMatches.count == 1 ? prefixMatches[0] : nil
    }
}
