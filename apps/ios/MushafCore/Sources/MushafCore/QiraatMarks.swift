import Foundation

// Port of the web reader's marker rules (src/app/mushaf-1441/_components/qiraat/qiraatWordMarker.ts
// and packages/qiraat-core/attribution.ts). Change both or neither.
//
// Visibility matches the web default ("include reviewed" on): every record in the snapshot is shown;
// NEEDS_MANUAL_REVIEW is labelled in the detail sheet, never hidden or promoted.

/// Narrows the page to one reader or one narrator, exactly like the web's comparison filter.
public enum QiraatFilter: Hashable, Sendable {
    case all
    case reader(String)
    case reading(String)
}

/// "Who reads this variant", as one marker (never one underline per reader).
public struct VariantMarker: Hashable, Sendable {
    public enum Style: Hashable, Sendable {
        /// No attribution the catalog knows yet: a neutral grey, never a guessed reader colour.
        case unresolved
        /// Every variant here only changes the recitation, not the text.
        case performance
        /// One narrator, or one reader with both narrators.
        case single(color: String)
        /// Several readers: one equal segment per reader, in canonical reader order.
        case multiReader(colors: [String])
    }

    public let style: Style
    public let variants: [QiraatVariant]
}

public struct RulingMarker: Hashable, Sendable {
    /// The first ruling's family colour.
    public let color: String
    public let rulings: [QiraatRuling]
    /// More than one usul family on this word.
    public let multiple: Bool
    /// Some reading here has a second valid وجه («بخلف عنه») — drawn as ذو وجهين.
    public let hasAlternate: Bool
}

/// One dot per word: filled when any matched reading is إمالة, a ring when only تقليل.
public struct ImalahTaqlilMarker: Hashable, Sendable {
    public let color: String
    public let filled: Bool

    public init(color: String, filled: Bool) { self.color = color; self.filled = filled }
}

/// Everything a page view needs to draw one word in the Qiraat layer.
public struct WordMarks: Hashable, Sendable {
    public enum Underline: Hashable, Sendable {
        case solid(String)
        case segments([String])
    }

    public let textColor: String
    /// The variant marker under the word.
    public let underline: Underline?
    /// Dotted underline in the ruling colour when the word is ذو وجهين.
    public let dottedUnderlineColor: String?
    /// Small dot at the word's top-left when more than one usul family applies.
    public let familyDotColor: String?
    /// إمالة/تقليل dot at the word's bottom-left.
    public let imalahDot: ImalahTaqlilMarker?
}

/// What a tap on a word shows.
public struct QiraatSelection: Hashable, Sendable {
    public let variants: [QiraatVariant]
    public let rulings: [QiraatRuling]
}

/// Marker computations for one page of Qiraat data.
public struct QiraatMarks: Sendable {
    public let catalog: QiraatCatalog
    public let page: QiraatPageData

    public init(catalog: QiraatCatalog, page: QiraatPageData) {
        self.catalog = catalog
        self.page = page
    }

    // MARK: Variants

    public func variants(surah: Int, ayah: Int, token: Int) -> [QiraatVariant] {
        page.variants.filter { $0.surah == surah && $0.ayah == ayah && token >= $0.startToken && token <= $0.endToken }
    }

    public func matches(_ variant: QiraatVariant, _ filter: QiraatFilter) -> Bool {
        switch filter {
        case .all: true
        case .reader(let readerId): variant.readingIds.contains { catalog.readerId(ofReading: $0) == readerId }
        case .reading(let readingId): variant.readingIds.contains(readingId)
        }
    }

    /// Port of `comparisonMarkerForWord`.
    public func variantMarker(surah: Int, ayah: Int, token: Int, filter: QiraatFilter) -> VariantMarker? {
        let filtered = variants(surah: surah, ayah: ayah, token: token).filter { matches($0, filter) }
        guard !filtered.isEmpty else { return nil }

        var known: [String] = []
        for id in filtered.flatMap(\.readingIds) where catalog.narrator(id) != nil && !known.contains(id) {
            known.append(id)
        }
        if known.isEmpty { return VariantMarker(style: .unresolved, variants: filtered) }
        if filtered.allSatisfy(\.isPerformanceOnly) { return VariantMarker(style: .performance, variants: filtered) }

        let scoped: [String] = switch filter {
        case .all: known
        case .reader(let readerId): known.filter { catalog.readerId(ofReading: $0) == readerId }
        case .reading(let readingId): known.filter { $0 == readingId }
        }
        guard let style = attributionStyle(scoped) else { return nil }
        return VariantMarker(style: style, variants: filtered)
    }

    /// Port of `computeAttribution`: one narrator → narrator colour; one reader with all of their
    /// narrators → reader colour; several readers → one segment per reader.
    func attributionStyle(_ readingIds: [String]) -> VariantMarker.Style? {
        let narrators = readingIds.compactMap(catalog.narrator)
        var readerIds: [String] = []
        for n in narrators where !readerIds.contains(n.readerId) { readerIds.append(n.readerId) }
        guard let first = readerIds.first else { return nil }
        if readerIds.count == 1 {
            if narrators.count >= catalog.narrators(of: first).count, let reader = catalog.reader(first) {
                return .single(color: reader.color)
            }
            return .single(color: narrators[0].color)
        }
        let ordered = catalog.readers.sorted { $0.sortOrder < $1.sortOrder }.filter { readerIds.contains($0.id) }
        return .multiReader(colors: ordered.map(\.color))
    }

    /// The colour the word's text takes for a variant marker.
    public func textColor(of marker: VariantMarker) -> String {
        switch marker.style {
        case .unresolved: catalog.unresolvedColor
        case .performance: catalog.performanceColor
        case .single(let color): color
        case .multiReader: catalog.multiReaderColor
        }
    }

    // MARK: أصول rulings

    public func matches(_ ruling: QiraatRuling, _ filter: QiraatFilter) -> Bool {
        switch filter {
        case .all: true
        case .reader(let readerId): ruling.readings.contains { catalog.readerId(ofReading: $0.readingId) == readerId }
        case .reading(let readingId): ruling.readings.contains { $0.readingId == readingId }
        }
    }

    /// Port of `rulingMarkerForWord`.
    public func rulingMarker(surah: Int, ayah: Int, token: Int, filter: QiraatFilter) -> RulingMarker? {
        let matched = page.rulings.filter {
            $0.wordAnchored && $0.touches(surah: surah, ayah: ayah, token: token) && matches($0, filter)
        }
        guard let first = matched.first else { return nil }
        let hasAlternate = matched.contains { ruling in
            guard ruling.hasAlternate else { return false }
            switch filter {
            case .all:
                return true
            case .reader(let readerId):
                return ruling.readings.contains { catalog.readerId(ofReading: $0.readingId) == readerId && !$0.isDefault }
                    || ruling.attribution.contains { $0.authorityId == readerId && ($0.condition?.contains("بخلف") ?? false) }
            case .reading(let readingId):
                return ruling.readings.contains { $0.readingId == readingId && !$0.isDefault }
            }
        }
        return RulingMarker(color: first.color, rulings: matched, multiple: Set(matched.map(\.color)).count > 1,
                            hasAlternate: hasAlternate)
    }

    /// Port of `imalahTaqlilMarkerForWord`.
    public func imalahTaqlilMarker(surah: Int, ayah: Int, token: Int, filter: QiraatFilter) -> ImalahTaqlilMarker? {
        let matched = page.rulings.filter {
            $0.category == "IMALAH_TAQLIL" && $0.wordAnchored && $0.touches(surah: surah, ayah: ayah, token: token)
                && matches($0, filter)
        }
        guard let first = matched.first else { return nil }
        var imalah = false
        var taqlil = false
        for reading in matched.flatMap(\.readings) {
            if reading.action.contains("إمالة") { imalah = true } else if reading.action.contains("تقليل") { taqlil = true }
        }
        guard imalah || taqlil else { return nil }
        return ImalahTaqlilMarker(color: first.color, filled: imalah)
    }

    // MARK: Words

    /// Nil for page furniture (ayah ends, pause marks) and for words with nothing to show.
    public func wordMarks(for word: MushafWord, filter: QiraatFilter) -> WordMarks? {
        guard word.charType == .word else { return nil }
        let s = word.ayahKey.surah, a = word.ayahKey.ayah, t = word.indexInAyah
        let variant = variantMarker(surah: s, ayah: a, token: t, filter: filter)
        let ruling = rulingMarker(surah: s, ayah: a, token: t, filter: filter)
        guard variant != nil || ruling != nil else { return nil }

        let variantColor = variant.map(textColor(of:))
        let underline: WordMarks.Underline? = variant.map {
            if case .multiReader(let colors) = $0.style { return .segments(colors) }
            return .solid(variantColor!)
        }
        return WordMarks(
            textColor: variantColor ?? ruling!.color,
            underline: underline,
            dottedUnderlineColor: ruling?.hasAlternate == true ? ruling?.color : nil,
            familyDotColor: ruling?.multiple == true ? ruling?.color : nil,
            imalahDot: imalahTaqlilMarker(surah: s, ayah: a, token: t, filter: filter))
    }

    /// What the detail sheet lists for a tapped word (port of `qiraatSelectionForWord`).
    public func selection(surah: Int, ayah: Int, token: Int, filter: QiraatFilter) -> QiraatSelection? {
        let rulings = rulingMarker(surah: surah, ayah: ayah, token: token, filter: filter)?.rulings ?? []
        let variants = variants(surah: surah, ayah: ayah, token: token).filter { matches($0, filter) }
        guard !rulings.isEmpty || !variants.isEmpty else { return nil }
        return QiraatSelection(variants: variants, rulings: rulings)
    }
}
