/// A marked word, retaining the page and token needed to rebuild the sheet selection and font.
public struct MarkedWordRef: Identifiable, Hashable, Sendable {
    public let word: MushafWord
    public var id: String { word.id }

    public init(word: MushafWord) { self.word = word }
}

public enum QiraatWordOrder {
    public static func comesBefore(_ lhs: MushafWord, _ rhs: MushafWord) -> Bool {
        (lhs.ayahKey.surah, lhs.ayahKey.ayah, lhs.indexInAyah, lhs.page, lhs.line, lhs.indexInLine)
            < (rhs.ayahKey.surah, rhs.ayahKey.ayah, rhs.indexInAyah, rhs.page, rhs.line, rhs.indexInLine)
    }

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
        }.sorted(by: comesBefore).map(MarkedWordRef.init)
    }
}

public extension Array where Element == MarkedWordRef {
    /// No wraparound.
    func next(after current: MarkedWordRef) -> MarkedWordRef? {
        guard let index = firstIndex(where: { $0.id == current.id }), index + 1 < count else { return nil }
        return self[index + 1]
    }

    func previous(before current: MarkedWordRef) -> MarkedWordRef? {
        guard let index = firstIndex(where: { $0.id == current.id }), index > 0 else { return nil }
        return self[index - 1]
    }

    /// Keep a sheet usable when filtering or a live update removes its selected word. Prefer the
    /// next marked word in Quran reading order, falling back to the final preceding word.
    func nearest(to current: MarkedWordRef) -> MarkedWordRef? {
        if let exact = first(where: { $0.id == current.id }) { return exact }
        return first(where: { !QiraatWordOrder.comesBefore($0.word, current.word) }) ?? last
    }
}

/// Number the word's displayed faces in appearance order. A lone face needs no number.
public func variantWajhNumbers(_ variants: [QiraatVariant]) -> [String: Int] {
    struct FaceKey: Hashable {
        let surah: Int
        let ayah: Int
        let startToken: Int
        let endToken: Int
        let displayedText: String
        let performanceNote: String
        let readingIds: [String]

        init(_ variant: QiraatVariant) {
            surah = variant.surah
            ayah = variant.ayah
            startToken = variant.startToken
            endToken = variant.endToken
            displayedText = variant.uthmaniText ?? variant.variantText
            performanceNote = variant.performanceNote ?? ""
            readingIds = Array(Set(variant.readingIds)).sorted()
        }
    }

    var faceNumbers: [FaceKey: Int] = [:]
    var numbers: [String: Int] = [:]
    for variant in variants {
        let key = FaceKey(variant)
        let number = faceNumbers[key] ?? (faceNumbers.count + 1)
        faceNumbers[key] = number
        if numbers[variant.id] == nil { numbers[variant.id] = number }
    }
    return faceNumbers.count > 1 ? numbers : [:]
}
