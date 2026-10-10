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

        public var id: String { rulingId }
        public let rulingId: String
        public let categoryAr: String
        /// The usul family colour.
        public let color: String
        public let status: Status

        public init(rulingId: String, categoryAr: String, color: String, status: Status) {
            self.rulingId = rulingId; self.categoryAr = categoryAr; self.color = color; self.status = status
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

public enum QiraatCompare {
    /// حفص عن عاصم: the text of the Mushaf this app shows.
    public static let hafsReadingId = "Q05-R02"

    /// What `readingId` (a narrator id, or a reader id) reads at `word`. `selection` must be the
    /// word's unfiltered selection (`QiraatMarks.selection(..., filter: .all)`): a filtered one drops
    /// the variants of other readers, which would then wrongly read as the Mushaf text.
    public static func reading(of readingId: String, selection: QiraatSelection, word: MushafWord,
                               catalog: QiraatCatalog) -> QiraatComparedReading {
        if let narrator = catalog.narrator(readingId) {
            return QiraatComparedReading(authorityId: readingId,
                                         voices: [voice(narrator, selection: selection, word: word, catalog: catalog)])
        }
        guard let reader = catalog.reader(readingId) else {
            return QiraatComparedReading(authorityId: readingId, voices: [])
        }
        let narrators = catalog.narrators(of: reader.id)
        let voices = narrators.map { voice($0, selection: selection, word: word, catalog: catalog) }
        // A reader stands for his narrators only when they read alike here; otherwise both are shown.
        if let first = voices.first, voices.allSatisfy({ $0.content == first.content }) {
            let merged = QiraatComparedReading.Voice(
                authorityId: reader.id, name: "الإمام \(reader.nameArShort)", color: reader.color, kind: .reader,
                narratorIds: narrators.map(\.id), content: first.content)
            return QiraatComparedReading(authorityId: readingId, voices: [merged])
        }
        return QiraatComparedReading(authorityId: readingId, voices: voices)
    }

    /// Both readings, and whether they read the word the same way.
    public static func compare(_ a: String, _ b: String, selection: QiraatSelection, word: MushafWord,
                               catalog: QiraatCatalog) -> (QiraatComparedReading, QiraatComparedReading, isSame: Bool) {
        let first = reading(of: a, selection: selection, word: word, catalog: catalog)
        let second = reading(of: b, selection: selection, word: word, catalog: catalog)
        let same = !first.voices.isEmpty && first.voices.map(\.content) == second.voices.map(\.content)
        return (first, second, same)
    }

    /// A sensible first pair: Hafs, and the first other narrator the word's data names.
    public static func defaultPair(selection: QiraatSelection, catalog: QiraatCatalog) -> (String, String)? {
        let named = selection.variants.flatMap(\.readingIds)
            + selection.rulings.flatMap { $0.attribution.map(\.authorityId) + $0.readings.map(\.readingId) }
        guard let other = named.first(where: { $0 != hafsReadingId && catalog.narrator($0) != nil }) else { return nil }
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

    /// The Mushaf text over the widest variant span here, so both columns cover the same words.
    private static func baseText(selection: QiraatSelection, word: MushafWord) -> String {
        let widest = selection.variants.max { ($0.endToken - $0.startToken) < ($1.endToken - $1.startToken) }
        if let widest, !widest.hafsText.isEmpty { return widest.hafsText }
        return word.textUthmani
    }

    private static func names(_ authorityId: String, _ narrator: QiraatCatalog.Narrator) -> Bool {
        authorityId == narrator.id || authorityId == narrator.readerId
    }

    private static func entries(of ruling: QiraatRuling,
                                for narrator: QiraatCatalog.Narrator) -> [QiraatComparedReading.UsulEntry] {
        var found: [QiraatComparedReading.UsulEntry] = ruling.attribution
            .filter { names($0.authorityId, narrator) }
            .map { QiraatComparedReading.UsulEntry(action: $0.action ?? ruling.categoryAr, condition: $0.condition,
                                                   wajhOrder: $0.wajhOrder, wajhNote: $0.wajhNote) }
        if found.isEmpty {
            found = ruling.readings.filter { names($0.readingId, narrator) }
                .map { QiraatComparedReading.UsulEntry(action: $0.action.isEmpty ? ruling.categoryAr : $0.action,
                                                       condition: nil, wajhOrder: nil, wajhNote: nil) }
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
        return selection.rulings.map { ruling in
            let found = entries(of: ruling, for: narrator)
            let status: QiraatComparedReading.Usul.Status
            if found.isEmpty {
                let hafsNamed = ruling.attribution.contains { $0.authorityId == hafsReadingId || $0.authorityId == hafsReader }
                    || ruling.readings.contains { $0.readingId == hafsReadingId }
                status = .base(sameAsHafs: !hafsNamed)
            } else {
                status = .entries(found)
            }
            return QiraatComparedReading.Usul(rulingId: ruling.id, categoryAr: ruling.categoryAr, color: ruling.color,
                                              status: status)
        }
    }
}
