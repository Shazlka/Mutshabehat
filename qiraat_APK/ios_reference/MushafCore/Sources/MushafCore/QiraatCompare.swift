import Foundation

// Compare mode: what two readers or narrators read at one tapped word, side by side.
//
// The data stores only what differs from Hafs, so a reading's text at a word is the variant that
// names it, or the Mushaf text when none does; an أصول ruling that does not name it leaves it on the
// base. Everything shown comes from the selection's variants and rulings; nothing is inferred beyond
// that rule.

/// What one reader or narrator reads at a word.
public struct QiraatComparedReading: Hashable, Sendable {
    /// One way the word's text is read.
    public struct Wajh: Hashable, Sendable {
        public enum Source: Hashable, Sendable {
            /// A recorded variant names this reading.
            case variant
            /// No variant names it, so it reads the Mushaf text. `sameAsHafs` is true only when Hafs
            /// has no recorded variant here either (so «كحفص» is what the data says).
            case base(sameAsHafs: Bool)
        }

        public let text: String
        /// The way it is recited when the text itself does not change (إشمام، صلة …).
        public let note: String?
        public let source: Source

        public init(text: String, note: String?, source: Source) {
            self.text = text; self.note = note; self.source = source
        }
    }

    /// One recorded وجه of an أصول ruling for this reading.
    public struct UsulEntry: Hashable, Sendable {
        public let action: String
        public let condition: String?
        public let wajhOrder: Int?
        public let wajhNote: String?

        public init(action: String, condition: String?, wajhOrder: Int?, wajhNote: String?) {
            self.action = action; self.condition = condition; self.wajhOrder = wajhOrder; self.wajhNote = wajhNote
        }
    }

    /// How one أصول ruling on the word applies to this reading.
    public struct Usul: Hashable, Sendable, Identifiable {
        public enum Status: Hashable, Sendable {
            /// Recorded entries, ordered by wajh.
            case entries([UsulEntry])
            /// Not named by the ruling: it stays on the base. `sameAsHafs` as for `Wajh.Source.base`.
            case base(sameAsHafs: Bool)
        }

        public var id: String { groupId }
        /// The category/locus group being compared. Several raw ruling rows can belong to it.
        public let groupId: String
        public let sourceRulingIds: [String]
        public let categoryAr: String
        /// The usul family colour.
        public let color: String
        public let status: Status

        /// Compatibility for callers that handled one raw ruling. Aggregated groups use `groupId`
        /// and `sourceRulingIds` instead.
        public var rulingId: String { sourceRulingIds.count == 1 ? sourceRulingIds[0] : groupId }

        public init(groupId: String, sourceRulingIds: [String], categoryAr: String, color: String, status: Status) {
            self.groupId = groupId; self.sourceRulingIds = sourceRulingIds
            self.categoryAr = categoryAr; self.color = color; self.status = status
        }

        public init(rulingId: String, categoryAr: String, color: String, status: Status) {
            self.init(groupId: rulingId, sourceRulingIds: [rulingId], categoryAr: categoryAr,
                      color: color, status: status)
        }

        public var isRecorded: Bool {
            if case .entries = status { return true }
            return false
        }
    }

    /// The reading itself, without who reads it: two narrators agree when their contents are equal.
    public struct Content: Hashable, Sendable {
        public let wajhs: [Wajh]
        public let usul: [Usul]

        public init(wajhs: [Wajh], usul: [Usul]) { self.wajhs = wajhs; self.usul = usul }
    }

    /// One column entry: a narrator, or a reader whose narrators all read alike.
    public struct Voice: Hashable, Sendable, Identifiable {
        public enum Kind: Hashable, Sendable { case reader, narrator }

        public var id: String { authorityId }
        public let authorityId: String
        /// «الإمام حمزة» or «الراوي ورش», as the web names them.
        public let name: String
        public let color: String
        public let kind: Kind
        /// The narrator ids this voice stands for.
        public let narratorIds: [String]
        public let content: Content
    }

    /// The id that was asked for (a reader id or a narrator id).
    public let authorityId: String
    /// One voice; or, for a reader whose narrators differ here, one per narrator. Empty when the
    /// catalog does not know the id.
    public let voices: [Voice]
}

/// One exact Quran locus selected for comparison. Overlapping spans are separate loci so concurrent
/// differences are never presented as alternative wajhs of one reading.
public struct QiraatComparisonLocus: Hashable, Sendable, Identifiable {
    public let surah: Int
    public let ayah: Int
    public let startToken: Int
    public let endAyah: Int
    public let endToken: Int
    public let selection: QiraatSelection

    public var id: String { "\(surah):\(ayah):\(startToken)-\(endAyah):\(endToken)" }

    /// Existing source text for the locus, never reconstructed or invented.
    public var baseText: String? {
        selection.variants.lazy.map(\.hafsText).first { !$0.isEmpty }
            ?? selection.rulings.lazy.map(\.baseText).first { !$0.isEmpty }
    }
}

/// Raw أصول rows combined by their category and complete Quran locus.
public struct QiraatComparedUsulGroup: Hashable, Sendable, Identifiable {
    public let id: String
    public let category: String
    public let categoryAr: String
    public let color: String
    public let surah: Int
    public let ayah: Int
    public let startToken: Int
    public let endAyah: Int
    public let endToken: Int
    public let rulings: [QiraatRuling]
}

public enum QiraatCompare {
    /// حفص عن عاصم: the text of the Mushaf this app shows.
    public static let hafsReadingId = "Q05-R02"

    /// Separates a tapped word's unfiltered data into exact spans. The caller must choose one before
    /// comparing, because overlapping spans can describe simultaneous differences.
    public static func loci(selection: QiraatSelection) -> [QiraatComparisonLocus] {
        struct Key: Hashable {
            let surah: Int
            let ayah: Int
            let startToken: Int
            let endAyah: Int
            let endToken: Int
        }

        var keys: [Key] = []
        for variant in selection.variants {
            let key = Key(surah: variant.surah, ayah: variant.ayah, startToken: variant.startToken,
                          endAyah: variant.ayah, endToken: variant.endToken)
            if !keys.contains(key) { keys.append(key) }
        }
        for ruling in selection.rulings {
            let key = Key(surah: ruling.surah, ayah: ruling.ayah, startToken: ruling.startToken,
                          endAyah: ruling.endAyah ?? ruling.ayah, endToken: ruling.endToken)
            if !keys.contains(key) { keys.append(key) }
        }
        keys.sort {
            ($0.surah, $0.ayah, $0.startToken, $0.endAyah, $0.endToken)
                < ($1.surah, $1.ayah, $1.startToken, $1.endAyah, $1.endToken)
        }
        return keys.map { key in
            let variants = selection.variants.filter {
                $0.surah == key.surah && $0.ayah == key.ayah && $0.startToken == key.startToken
                    && $0.endToken == key.endToken && key.endAyah == key.ayah
            }
            let rulings = selection.rulings.filter {
                $0.surah == key.surah && $0.ayah == key.ayah && $0.startToken == key.startToken
                    && ($0.endAyah ?? $0.ayah) == key.endAyah && $0.endToken == key.endToken
            }
            return QiraatComparisonLocus(surah: key.surah, ayah: key.ayah, startToken: key.startToken,
                                         endAyah: key.endAyah, endToken: key.endToken,
                                         selection: QiraatSelection(variants: variants, rulings: rulings))
        }
    }

    /// The place to show first when comparison opens on a tapped word: the word's own single-word place if it
    /// has a text variant (that is the difference the reader tapped to see), then any place with a text
    /// variant, then the word's own place, then the first. Position order alone would put an أصول span that
    /// starts in an earlier ayah (the idgham across an ayah end) ahead of the word itself.
    public static func defaultLocus(in loci: [QiraatComparisonLocus], word: MushafWord) -> QiraatComparisonLocus? {
        func isWordItself(_ locus: QiraatComparisonLocus) -> Bool {
            locus.surah == word.ayahKey.surah && locus.ayah == word.ayahKey.ayah && locus.endAyah == locus.ayah
                && locus.startToken == word.indexInAyah && locus.endToken == word.indexInAyah
        }
        return loci.first { isWordItself($0) && !$0.selection.variants.isEmpty }
            ?? loci.first { !$0.selection.variants.isEmpty }
            ?? loci.first(where: isWordItself)
            ?? loci.first
    }

    /// Requires the complete page selection. Nil means comparison is unavailable; a filtered
    /// fallback would falsely make omitted readers appear to follow the Mushaf base.
    public static func unfilteredSelection(for word: MushafWord, marks: QiraatMarks?) -> QiraatSelection? {
        marks?.selection(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah,
                         token: word.indexInAyah, filter: .all)
    }

    /// Raw أصول rows become one comparison group per category and complete locus.
    public static func usulGroups(selection: QiraatSelection) -> [QiraatComparedUsulGroup] {
        struct Key: Hashable {
            let category: String
            let surah: Int
            let ayah: Int
            let startToken: Int
            let endAyah: Int
            let endToken: Int
        }

        var orderedKeys: [Key] = []
        var grouped: [Key: [QiraatRuling]] = [:]
        for ruling in selection.rulings {
            let key = Key(category: ruling.category, surah: ruling.surah, ayah: ruling.ayah,
                          startToken: ruling.startToken, endAyah: ruling.endAyah ?? ruling.ayah,
                          endToken: ruling.endToken)
            if grouped[key] == nil { orderedKeys.append(key) }
            grouped[key, default: []].append(ruling)
        }
        return orderedKeys.compactMap { key in
            guard let rulings = grouped[key], let first = rulings.first else { return nil }
            let id = "\(key.category)|\(key.surah):\(key.ayah):\(key.startToken)-\(key.endAyah):\(key.endToken)"
            return QiraatComparedUsulGroup(id: id, category: key.category, categoryAr: first.categoryAr,
                                           color: first.color, surah: key.surah, ayah: key.ayah,
                                           startToken: key.startToken, endAyah: key.endAyah,
                                           endToken: key.endToken, rulings: rulings)
        }
    }

    /// What `readingId` (a narrator id, or a reader id) reads at one exact `locus`. The locus must
    /// come from the word's unfiltered selection.
    public static func reading(of readingId: String, locus: QiraatComparisonLocus, word: MushafWord,
                               catalog: QiraatCatalog) -> QiraatComparedReading {
        if let narrator = catalog.narrator(readingId) {
            return QiraatComparedReading(authorityId: readingId,
                                         voices: [voice(narrator, selection: locus.selection, word: word,
                                                        catalog: catalog)])
        }
        guard let reader = catalog.reader(readingId) else {
            return QiraatComparedReading(authorityId: readingId, voices: [])
        }
        let narrators = catalog.narrators(of: reader.id)
        let voices = narrators.map { voice($0, selection: locus.selection, word: word, catalog: catalog) }
        // A reader stands for his narrators only when they read alike here; otherwise both are shown.
        if let first = voices.first, voices.allSatisfy({ $0.content == first.content }) {
            let merged = QiraatComparedReading.Voice(
                authorityId: reader.id, name: "الإمام \(reader.nameArShort)", color: reader.color, kind: .reader,
                narratorIds: narrators.map(\.id), content: first.content)
            return QiraatComparedReading(authorityId: readingId, voices: [merged])
        }
        return QiraatComparedReading(authorityId: readingId, voices: voices)
    }

    /// Compatibility for a selection that has one locus. When old callers pass overlaps, this
    /// chooses one exact locus instead of combining their records into false alternative wajhs.
    public static func reading(of readingId: String, selection: QiraatSelection, word: MushafWord,
                               catalog: QiraatCatalog) -> QiraatComparedReading {
        guard let locus = loci(selection: selection).first else {
            return QiraatComparedReading(authorityId: readingId, voices: [])
        }
        return reading(of: readingId, locus: locus, word: word, catalog: catalog)
    }

    /// Both readings, and whether they read the word the same way.
    public static func compare(_ a: String, _ b: String, locus: QiraatComparisonLocus, word: MushafWord,
                               catalog: QiraatCatalog) -> (QiraatComparedReading, QiraatComparedReading, isSame: Bool) {
        let first = reading(of: a, locus: locus, word: word, catalog: catalog)
        let second = reading(of: b, locus: locus, word: word, catalog: catalog)
        let same = !first.voices.isEmpty && first.voices.map(\.content) == second.voices.map(\.content)
        return (first, second, same)
    }

    /// Compatibility overload; new UI should expose and pass an explicit locus.
    public static func compare(_ a: String, _ b: String, selection: QiraatSelection, word: MushafWord,
                               catalog: QiraatCatalog) -> (QiraatComparedReading, QiraatComparedReading, isSame: Bool) {
        guard let locus = loci(selection: selection).first else {
            let first = QiraatComparedReading(authorityId: a, voices: [])
            let second = QiraatComparedReading(authorityId: b, voices: [])
            return (first, second, false)
        }
        return compare(a, b, locus: locus, word: word, catalog: catalog)
    }

    /// A sensible first pair: Hafs, and the first other narrator or reader the locus data names.
    public static func defaultPair(selection: QiraatSelection, catalog: QiraatCatalog) -> (String, String)? {
        let named = selection.variants.flatMap(\.readingIds)
            + selection.rulings.flatMap { $0.attribution.map(\.authorityId) + $0.readings.map(\.readingId) }
        let hafsReaderId = catalog.readerId(ofReading: hafsReadingId)
        guard let other = named.first(where: {
            $0 != hafsReadingId && $0 != hafsReaderId && (catalog.narrator($0) != nil || catalog.reader($0) != nil)
        }) else { return nil }
        return (hafsReadingId, other)
    }

    // MARK: Per narrator

    private static func voice(_ narrator: QiraatCatalog.Narrator, selection: QiraatSelection, word: MushafWord,
                              catalog: QiraatCatalog) -> QiraatComparedReading.Voice {
        QiraatComparedReading.Voice(
            authorityId: narrator.id, name: "الراوي \(narrator.nameAr)", color: narrator.color, kind: .narrator,
            narratorIds: [narrator.id],
            content: QiraatComparedReading.Content(wajhs: wajhs(narrator.id, selection: selection, word: word),
                                                   usul: usul(narrator, selection: selection, catalog: catalog)))
    }

    private static func displayText(_ variant: QiraatVariant) -> String {
        // Same choice as the sheet's variant card.
        variant.uthmaniText ?? (variant.isPerformanceOnly ? variant.hafsText : variant.variantText)
    }

    private static func wajhs(_ readingId: String, selection: QiraatSelection,
                              word: MushafWord) -> [QiraatComparedReading.Wajh] {
        var result: [QiraatComparedReading.Wajh] = []
        for variant in selection.variants where variant.readingIds.contains(readingId) {
            let wajh = QiraatComparedReading.Wajh(text: displayText(variant), note: variant.performanceNote, source: .variant)
            // The snapshot can hold the same reading twice (two sources); it is one وجه.
            if !result.contains(wajh) { result.append(wajh) }
        }
        if !result.isEmpty { return result }
        let hafsRecorded = selection.variants.contains { $0.readingIds.contains(hafsReadingId) }
        return [QiraatComparedReading.Wajh(text: baseText(selection: selection, word: word), note: nil,
                                           source: .base(sameAsHafs: !hafsRecorded))]
    }

    /// The Mushaf text for this exact locus, so both columns cover the same words.
    private static func baseText(selection: QiraatSelection, word: MushafWord) -> String {
        if let text = selection.variants.lazy.map(\.hafsText).first(where: { !$0.isEmpty }) { return text }
        if let text = selection.rulings.lazy.map(\.baseText).first(where: { !$0.isEmpty }) { return text }
        return word.textUthmani
    }

    private static func names(_ authorityId: String, _ narrator: QiraatCatalog.Narrator) -> Bool {
        authorityId == narrator.id || authorityId == narrator.readerId
    }

    private static func entries(of group: QiraatComparedUsulGroup,
                                for narrator: QiraatCatalog.Narrator) -> [QiraatComparedReading.UsulEntry] {
        var found: [QiraatComparedReading.UsulEntry] = []
        for ruling in group.rulings {
            let attributed = ruling.attribution.filter { names($0.authorityId, narrator) }
            if !attributed.isEmpty {
                found += attributed.map {
                    QiraatComparedReading.UsulEntry(action: $0.action ?? ruling.categoryAr,
                                                    condition: $0.condition ?? ruling.condition,
                                                    wajhOrder: $0.wajhOrder, wajhNote: $0.wajhNote)
                }
            } else {
                found += ruling.readings.filter { names($0.readingId, narrator) }
                    .map { QiraatComparedReading.UsulEntry(action: $0.action.isEmpty ? ruling.categoryAr : $0.action,
                                                           condition: ruling.condition, wajhOrder: nil, wajhNote: nil) }
            }
        }
        var unique: [QiraatComparedReading.UsulEntry] = []
        for entry in found where !unique.contains(entry) { unique.append(entry) }
        // Stable: entries without a wajh number keep their place after the numbered ones.
        return unique.enumerated().sorted {
            let l = $0.element.wajhOrder ?? Int.max, r = $1.element.wajhOrder ?? Int.max
            return l == r ? $0.offset < $1.offset : l < r
        }.map(\.element)
    }

    private static func usul(_ narrator: QiraatCatalog.Narrator, selection: QiraatSelection,
                             catalog: QiraatCatalog) -> [QiraatComparedReading.Usul] {
        let hafsReader = catalog.readerId(ofReading: hafsReadingId)
        return usulGroups(selection: selection).map { group in
            let found = entries(of: group, for: narrator)
            let status: QiraatComparedReading.Usul.Status
            if found.isEmpty {
                let hafsNamed = group.rulings.contains { ruling in
                    ruling.attribution.contains { $0.authorityId == hafsReadingId || $0.authorityId == hafsReader }
                        || ruling.readings.contains { $0.readingId == hafsReadingId }
                }
                status = .base(sameAsHafs: !hafsNamed)
            } else {
                status = .entries(found)
            }
            return QiraatComparedReading.Usul(groupId: group.id, sourceRulingIds: group.rulings.map(\.id),
                                              categoryAr: group.categoryAr, color: group.color, status: status)
        }
    }
}
