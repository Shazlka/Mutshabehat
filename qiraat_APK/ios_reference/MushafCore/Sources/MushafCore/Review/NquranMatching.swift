#if DEBUG
import Foundation

/// One word of an ayah as the editor knows it (1-based word number and its Hafs text).
public struct AyahWord: Hashable, Sendable {
    public let word: Int
    public let text: String
    public init(word: Int, text: String) { self.word = word; self.text = text }
}

/// The clicked word's place in its ayah (1-based) and the ayah's words on this page.
public struct NquranAyahContext: Hashable, Sendable {
    public let wordIndex: Int
    public let ayahWords: [AyahWord]
    public init(wordIndex: Int, ayahWords: [AyahWord]) { self.wordIndex = wordIndex; self.ayahWords = ayahWords }

    /// Only trusted when it covers the ayah from its first word and contains the clicked word.
    var isComplete: Bool {
        !ayahWords.isEmpty && ayahWords.enumerated().allSatisfy { $0.element.word == $0.offset + 1 }
            && wordIndex >= 1 && wordIndex <= ayahWords.count
    }
}

public enum ResolvedReaderLabel: Hashable, Sendable {
    case reader(String)
    case narrator(String)
    case remainder
    case all
    case unresolved(String)
}

public struct ResolvedNquranGroup: Hashable, Sendable {
    public let group: NquranReaderGroup
    /// Concrete narrator ids this group covers; empty when every label in it was unresolved.
    public let narratorIds: [String]
    public let unresolvedLabels: [String]
}

/// Port of `src/app/mushaf-1441/review/_lib/nquranReference.ts`: which nquran.com differences are about
/// the clicked word, and which narrators each reader group means. Matching is by whole words in the
/// word's own ayah, never by substring.
public enum NquranMatching {
    public static func entry(in entries: [NquranAyahEntry], ayah: Int) -> NquranAyahEntry? {
        entries.first { $0.ayah == ayah }
    }

    // MARK: Keys (UTF-16 arrays: the web's JavaScript string semantics)

    typealias Key = [UInt16]

    /// `normalizeArabic` with the hamza letter and every alef dropped, so «أأنذرتهم» and «ءَأَنذَرْتَهُمْ»
    /// meet. (ئ is dropped before normalising, hamza and alef after.)
    static func phraseKey(_ text: String) -> Key {
        let withoutYehHamza = Arabic.removing(text, [0x0626])
        let normalized = Arabic.normalize(withoutYehHamza)
        return Array(Arabic.removing(normalized, [0x0621, 0x0627]).utf16)
    }

    /// Looser second tier: the consonant skeleton (also without و and ي).
    static func skeletonKey(_ text: String) -> Key {
        let key = String(decoding: phraseKey(text), as: UTF16.self)
        return Array(Arabic.removing(key, [0x0648, 0x064A]).utf16)
    }

    private static func indexOf(_ hay: Key, _ needle: Key, from: Int) -> Int {
        guard !needle.isEmpty, hay.count >= needle.count, from <= hay.count - needle.count else { return -1 }
        var i = from
        while i <= hay.count - needle.count {
            if hay[i] == needle[0] && hay[i..<(i + needle.count)].elementsEqual(needle) { return i }
            i += 1
        }
        return -1
    }

    struct WordRange: Equatable { let first: Int; let last: Int }

    /// Word ranges (0-based, inclusive) that spell `phrase` when the keys are concatenated, starting and
    /// ending on word boundaries; a phrase that begins at the end of the ayah and runs on into the next
    /// is returned as the words that close it.
    static func phraseRanges(_ keys: [Key], _ phrase: Key) -> [WordRange] {
        guard !phrase.isEmpty else { return [] }
        var starts: [Int] = []
        var concat: Key = []
        for key in keys { starts.append(concat.count); concat += key }
        var wordAt: [Int: Int] = [:]
        var ends: [Int: Int] = [:]
        for (index, offset) in starts.enumerated() {
            wordAt[offset] = index
            ends[offset + keys[index].count] = index
        }
        var ranges: [WordRange] = []
        var from = indexOf(concat, phrase, from: 0)
        while from != -1 {
            if let first = wordAt[from], let last = ends[from + phrase.count], last >= first {
                ranges.append(WordRange(first: first, last: last))
            }
            from = indexOf(concat, phrase, from: from + 1)
        }
        if phrase.count > 1 {
            for head in 1..<phrase.count {
                guard head <= concat.count, let first = wordAt[concat.count - head] else { continue }
                if concat.suffix(head).elementsEqual(phrase.prefix(head)) {
                    ranges.append(WordRange(first: first, last: keys.count - 1))
                }
            }
        }
        return ranges
    }

    /// The rule of these differences sits on the first word of the phrase; the second only decides how it is
    /// read (صلة ميم الجمع before a vowel, صلة هاء الضمير).
    static func ruleSitsOnFirstWord(_ difference: NquranDifference) -> Bool {
        let text = Array(Arabic.normalize(difference.groups.map(\.reading).joined(separator: " ")).utf16)
        return contains(text, Array(Arabic.normalize("ميم الجمع").utf16))
            || contains(text, Array(Arabic.normalize("هاء الضمير").utf16))
    }

    private static func contains(_ hay: Key, _ needle: Key) -> Bool { indexOf(hay, needle, from: 0) != -1 }

    /// `location.split(/\s+-\s+/)`
    static func segments(of location: String) -> [String] {
        let pattern = try! NSRegularExpression(pattern: "\\s+-\\s+")
        let ns = location as NSString
        var parts: [String] = []
        var cursor = 0
        for match in pattern.matches(in: location, range: NSRange(location: 0, length: ns.length)) {
            parts.append(ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor)))
            cursor = match.range.location + match.range.length
        }
        parts.append(ns.substring(from: cursor))
        return parts
    }

    // MARK: Matching

    /// Indices (into `differences`) of those about the clicked word. With the ayah's words the location
    /// must also occur in THIS ayah around the clicked word; without them (or when the location's spelling
    /// cannot be found in it) it falls back to whole-token equality.
    public static func matchingIndices(differences: [NquranDifference], wordText: String,
                                       context: NquranAyahContext?) -> [Int] {
        let wanted = phraseKey(wordText)
        guard !wanted.isEmpty else { return [] }
        let complete = context.flatMap { $0.isComplete ? $0 : nil }
        let keys = complete?.ayahWords.map { phraseKey($0.text) }
        let skeletons = complete?.ayahWords.map { skeletonKey($0.text) }

        return differences.indices.filter { index in
            let difference = differences[index]
            let firstOnly = ruleSitsOnFirstWord(difference)
            return segments(of: difference.location).contains { segment in
                let tokens = Arabic.words(segment).map(phraseKey).filter { !$0.isEmpty }
                guard !tokens.isEmpty else { return false }
                let onlyFirst = firstOnly && tokens.count > 1
                if let keys, let skeletons, let complete {
                    let at = complete.wordIndex - 1
                    let exact = phraseRanges(keys, tokens.flatMap { $0 })
                    let ranges = !exact.isEmpty ? exact
                        : phraseRanges(skeletons, tokens.flatMap { skeletonKey(String(decoding: $0, as: UTF16.self)) })
                    if !ranges.isEmpty {
                        return ranges.contains { onlyFirst ? at == $0.first : (at >= $0.first && at <= $0.last) }
                    }
                }
                if tokens.flatMap({ $0 }) == wanted { return true }
                return onlyFirst ? tokens[0] == wanted : tokens.contains(wanted)
            }
        }
    }

    public static func differences(_ differences: [NquranDifference], wordText: String,
                                   context: NquranAyahContext?) -> [NquranDifference] {
        matchingIndices(differences: differences, wordText: wordText, context: context).map { differences[$0] }
    }

    // MARK: Reader labels → narrator ids

    private static let readerWholeByLabel: [String: String] = [
        "نافع": "Q01", "ابن كثير": "Q02", "أبو عمرو": "Q03", "ابن عامر": "Q04", "عاصم": "Q05",
        "حمزة": "Q06", "الكسائي": "Q07", "أبو جعفر": "Q08", "يعقوب": "Q09", "خلف العاشر": "Q10",
    ]

    private static let narratorByLabel: [String: String] = [
        "قالون عن نافع": "Q01-R01", "ورش عن نافع": "Q01-R02",
        "البزي عن ابن كثير": "Q02-R01", "قنبل عن ابن كثير": "Q02-R02",
        "الدوري عن أبي عمرو": "Q03-R01", "السوسي عن أبي عمرو": "Q03-R02",
        "هشام عن ابن عامر": "Q04-R01", "ابن ذكوان عن ابن عامر": "Q04-R02",
        "شعبة عن عاصم": "Q05-R01", "حفص عن عاصم": "Q05-R02",
        "خلف عن حمزة": "Q06-R01", "خلاد عن حمزة": "Q06-R02",
        "أبو الحارث عن الكسائي": "Q07-R01", "الدوري عن الكسائي": "Q07-R02",
        "ابن وردان عن أبي جعفر": "Q08-R01", "ابن جماز عن أبي جعفر": "Q08-R02",
        "رويس عن يعقوب": "Q09-R01", "روح عن يعقوب": "Q09-R02",
        "إسحاق عن خلف العاشر": "Q10-R01", "إدريس عن خلف العاشر": "Q10-R02",
    ]

    private static func normLabel(_ label: String) -> String { Arabic.normalize(label) }
    private static let readerWholeNorm = Dictionary(uniqueKeysWithValues: readerWholeByLabel.map { (normLabel($0.key), $0.value) })
    private static let narratorNorm = Dictionary(uniqueKeysWithValues: narratorByLabel.map { (normLabel($0.key), $0.value) })
    private static let remainderNorm: Set<String> = Set(["باقي الرواة", "باقي القراء"].map(normLabel))
    private static let allReadersNorm: Set<String> = Set(["كل الرواة", "جميع الرواة", "كل القراء"].map(normLabel))

    public static func resolveReaderLabel(_ label: String) -> ResolvedReaderLabel {
        let key = normLabel(label)
        if let id = narratorNorm[key] { return .narrator(id) }
        if let id = readerWholeNorm[key] { return .reader(id) }
        if remainderNorm.contains(key) { return .remainder }
        if allReadersNorm.contains(key) { return .all }
        return .unresolved(label)
    }

    /// Resolves every group of a difference to concrete narrator ids, computing «باقي الرواة» as the
    /// complement of every other group's ids within the 20 narrators (order-independent).
    public static func resolveDifferenceGroups(_ difference: NquranDifference) -> [ResolvedNquranGroup] {
        var explicit: [ResolvedNquranGroup] = []
        var remainderGroups: [NquranReaderGroup] = []
        var used = Set<String>()

        for group in difference.groups {
            var ids: [String] = []
            var seen = Set<String>()
            func add(_ id: String) { if seen.insert(id).inserted { ids.append(id) } }
            var unresolved: [String] = []
            var isRemainderOnly = !group.readers.isEmpty
            for label in group.readers {
                switch resolveReaderLabel(label) {
                case .narrator(let id): add(id); isRemainderOnly = false
                case .reader(let id): CanonicalReaders.narratorIds(ofReader: id).forEach(add); isRemainderOnly = false
                case .all: CanonicalReaders.allNarratorIds.forEach(add); isRemainderOnly = false
                case .unresolved(let text): unresolved.append(text); isRemainderOnly = false
                case .remainder: break
                }
            }
            if isRemainderOnly { remainderGroups.append(group); continue }
            used.formUnion(ids)
            explicit.append(ResolvedNquranGroup(group: group, narratorIds: ids, unresolvedLabels: unresolved))
        }

        let remainderIds = CanonicalReaders.allNarratorIds.filter { !used.contains($0) }
        return explicit + remainderGroups.map { ResolvedNquranGroup(group: $0, narratorIds: remainderIds, unresolvedLabels: []) }
    }
}
#endif
