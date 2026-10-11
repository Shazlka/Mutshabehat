/// A marked word, retaining the page and token needed to rebuild the sheet selection and font.
public struct MarkedWordRef: Identifiable, Hashable, Sendable {
    public let word: MushafWord
    public var id: String { word.id }

    public init(word: MushafWord) { self.word = word }
}

public enum QiraatWordOrder {
    /// Uses the page view's exact marking predicate. For a spread, supply words and combined
    /// variant/ruling data for both pages in `marks`; its `pageNumber` does not affect matching.
    /// Quran coordinates determine order, regardless of line layout or a [left, right] page list.
    public static func markedWords(pages: [Int], words: [MushafWord], marks: QiraatMarks,
                                   filter: QiraatFilter) -> [MarkedWordRef] {
        let includedPages = Set(pages)
        var seen = Set<String>()
        return words.filter {
            includedPages.contains($0.page) && marks.wordMarks(for: $0, filter: filter) != nil
                && seen.insert($0.id).inserted
        }.sorted {
            ($0.ayahKey.surah, $0.ayahKey.ayah, $0.indexInAyah, $0.page, $0.line, $0.indexInLine)
                < ($1.ayahKey.surah, $1.ayahKey.ayah, $1.indexInAyah, $1.page, $1.line, $1.indexInLine)
        }.map(MarkedWordRef.init)
    }
}

public extension Array where Element == MarkedWordRef {
    /// No wraparound; a selection removed by filtering or live updates has no neighbour.
    func next(after current: MarkedWordRef) -> MarkedWordRef? {
        guard let index = firstIndex(where: { $0.id == current.id }), index + 1 < count else { return nil }
        return self[index + 1]
    }

    func previous(before current: MarkedWordRef) -> MarkedWordRef? {
        guard let index = firstIndex(where: { $0.id == current.id }), index > 0 else { return nil }
        return self[index - 1]
    }
}

/// Number the word's displayed faces in appearance order. A lone face needs no number.
public func variantWajhNumbers(_ variants: [QiraatVariant]) -> [String: Int] {
    var numbers: [String: Int] = [:]
    for variant in variants where numbers[variant.id] == nil {
        numbers[variant.id] = numbers.count + 1
    }
    return numbers.count > 1 ? numbers : [:]
}
