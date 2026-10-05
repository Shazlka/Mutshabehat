import Foundation

public let mushafPageCount = 604
public let mushafLinesPerPage = 15

public struct AyahKey: Hashable, Sendable, CustomStringConvertible {
    public let surah: Int
    public let ayah: Int
    public init(surah: Int, ayah: Int) { self.surah = surah; self.ayah = ayah }
    /// Parses "2:255". Returns nil for anything else.
    public init?(_ text: String) {
        let parts = text.split(separator: ":")
        guard parts.count == 2, let s = Int(parts[0]), let a = Int(parts[1]), s >= 1, s <= 114, a >= 1 else { return nil }
        self.init(surah: s, ayah: a)
    }
    public var description: String { "\(surah):\(ayah)" }
}

public enum CharType: String, Sendable {
    case word, end, pause, sajdah
    case rubElHizb = "rub-el-hizb"
    case other
}

public struct MushafWord: Identifiable, Hashable, Sendable {
    public let id: String
    public let page: Int
    public let line: Int
    public let indexInLine: Int
    public let ayahKey: AyahKey
    public let indexInAyah: Int
    public let charType: CharType
    /// One QCF V2 code point (Private Use Area) that only renders with this page's font.
    public let glyph: String
    public let textUthmani: String
}

public struct LineDecoration: Hashable, Sendable {
    public var surahHeader: Int?
    public var basmala: Bool
}

public struct MushafLine: Hashable, Sendable {
    public let number: Int
    /// In reading order (right to left on screen).
    public let words: [MushafWord]
    public let decoration: LineDecoration?
}

public struct PageMetadata: Hashable, Sendable {
    public let page: Int
    public let firstAyah: AyahKey
    public let lastAyah: AyahKey
    public let surahNames: [String]
    public let juz: Int
    public let hizb: Int
    public let rubInJuz: Int
}

public struct Surah: Hashable, Sendable, Identifiable {
    public var id: Int { number }
    public let number: Int
    public let name: String
    public let ayahCount: Int
    public let firstPage: Int
    public let lastPage: Int
}

public struct AyahSearchResult: Hashable, Sendable, Identifiable {
    public var id: String { matchedWordIDs.first ?? ayah.description }
    public let ayah: AyahKey
    public let page: Int
    public let text: String
    public let matchedWordIDs: [String]
    public let wordIndex: Int
    public let uthmaniWord: String
    public let matchedText: String
    public let matchType: QuranSearchMatchType
    public let score: Int

    public init(ayah: AyahKey, page: Int, text: String, matchedWordIDs: [String] = [],
                wordIndex: Int = 0, uthmaniWord: String = "",
                matchedText: String = "",
                matchType: QuranSearchMatchType = .plain, score: Int = 95) {
        self.ayah = ayah
        self.page = page
        self.text = text
        self.matchedWordIDs = matchedWordIDs
        self.wordIndex = wordIndex
        self.uthmaniWord = uthmaniWord
        self.matchedText = matchedText.isEmpty ? uthmaniWord : matchedText
        self.matchType = matchType
        self.score = score
    }
}

public struct MushafPage: Hashable, Sendable {
    public let number: Int
    /// Always 15 slots, in order; empty slots are kept so geometry matches the printed page.
    public let lines: [MushafLine]
    public let metadata: PageMetadata
    /// The right-hand page of a spread is the odd page (page 1 is on the right).
    public var isRightHandPage: Bool { number % 2 == 1 }
}
