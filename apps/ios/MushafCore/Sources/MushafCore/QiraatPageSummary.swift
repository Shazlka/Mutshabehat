import Foundation

/// One marked word, with source records retained for navigation and the detail sheet.
public struct QiraatPageSummaryItem: Identifiable, Hashable, Sendable {
    public let word: MushafWord
    public let variants: [Variant]
    public let rulings: [Ruling]

    public var page: Int { word.page }
    public var surah: Int { word.ayahKey.surah }
    public var ayah: Int { word.ayahKey.ayah }
    public var token: Int { word.indexInAyah }
    public var id: String { "qiraat-summary-\(surah)-\(ayah)-\(token)" }
    public var selection: QiraatSelection {
        QiraatSelection(variants: variants.map(\.variant), rulings: rulings.map(\.ruling))
    }

    /// Source rows for one باب share one visual heading while retaining every ruling.
    public var rulingGroups: [RulingCategoryGroup] {
        var order: [String] = []
        var grouped: [String: [Ruling]] = [:]
        for ruling in rulings {
            let category = ruling.ruling.category
            if grouped[category] == nil { order.append(category) }
            grouped[category, default: []].append(ruling)
        }
        return order.compactMap { category in
            guard let rulings = grouped[category], let first = rulings.first else { return nil }
            return RulingCategoryGroup(category: category, categoryAr: first.categoryAr, rulings: rulings)
        }
    }

    public struct Variant: Identifiable, Hashable, Sendable {
        public let variant: QiraatVariant
        public let authorities: [AuthorityPill]
        public var id: String { variant.id }
        public var readingText: String { variant.uthmaniText ?? variant.variantText }
    }

    public struct Ruling: Identifiable, Hashable, Sendable {
        public let ruling: QiraatRuling
        public let actionGroups: [ActionGroup]
        public var id: String { ruling.id }
        public var categoryAr: String { ruling.categoryAr }
    }

    public struct ActionGroup: Hashable, Sendable {
        public let action: String
        public let entries: [QiraatRulingAttribution]
        public let authorities: [AuthorityPill]
    }

    public struct RulingCategoryGroup: Identifiable, Hashable, Sendable {
        public let category: String
        public let categoryAr: String
        public let rulings: [Ruling]
        public var id: String { category }
    }
}

public enum QiraatPageSummary {
    /// Pass data and marks from the same page snapshot. Word visibility is exactly the predicate
    /// MushafPageView uses, including performance-only and unresolved variants.
    public static func build(page: Int, words: [MushafWord], data: QiraatPageData,
                             marks: QiraatMarks, catalog: QiraatCatalog,
                             filter: QiraatFilter) -> [QiraatPageSummaryItem] {
        guard page == data.pageNumber, page == marks.page.pageNumber else { return [] }
        let ordered = words.filter { $0.page == page }.sorted {
            if $0.line != $1.line { return $0.line < $1.line }
            return $0.indexInLine < $1.indexInLine
        }
        var seen: Set<String> = []
        return ordered.compactMap { word in
            guard marks.wordMarks(for: word, filter: filter) != nil else { return nil }
            let surah = word.ayahKey.surah, ayah = word.ayahKey.ayah, token = word.indexInAyah
            guard seen.insert("\(surah):\(ayah):\(token)").inserted else { return nil }
            let variants = data.variants.filter {
                $0.surah == surah && $0.ayah == ayah && token >= $0.startToken
                    && token <= $0.endToken && marks.matches($0, filter)
            }.map { variant in
                QiraatPageSummaryItem.Variant(variant: variant, authorities: rollupAuthorityPills(
                    variant.readingIds.filter { matchesAuthority($0, filter: filter, catalog: catalog) }, catalog: catalog))
            }
            let rulings = data.rulings.filter {
                $0.wordAnchored && $0.touches(surah: surah, ayah: ayah, token: token) && marks.matches($0, filter)
            }.compactMap { ruling -> QiraatPageSummaryItem.Ruling? in
                var groups = ruling.attributionByAction.compactMap { group -> QiraatPageSummaryItem.ActionGroup? in
                    let entries = group.entries.filter { matchesAuthority($0.authorityId, filter: filter, catalog: catalog) }
                    guard !entries.isEmpty else { return nil }
                    return QiraatPageSummaryItem.ActionGroup(action: group.action, entries: entries,
                        authorities: rollupAuthorityPills(entries.map(\.authorityId), catalog: catalog))
                }
                if groups.isEmpty {
                    groups = readingActionGroups(ruling, filter: filter, catalog: catalog)
                }
                guard !groups.isEmpty else { return nil }
                return QiraatPageSummaryItem.Ruling(ruling: ruling, actionGroups: groups)
            }
            guard !variants.isEmpty || !rulings.isEmpty else { return nil }
            return QiraatPageSummaryItem(word: word, variants: variants, rulings: rulings)
        }
    }

    /// Some imports carry filter-authoritative `readings` without equivalent attribution rows.
    /// Preserve their source actions by adapting those readings into the summary's display model.
    private static func readingActionGroups(
        _ ruling: QiraatRuling,
        filter: QiraatFilter,
        catalog: QiraatCatalog
    ) -> [QiraatPageSummaryItem.ActionGroup] {
        var order: [String] = []
        var entriesByAction: [String: [QiraatRulingAttribution]] = [:]
        for reading in ruling.readings where matchesAuthority(reading.readingId, filter: filter, catalog: catalog) {
            let action = reading.action.isEmpty ? ruling.categoryAr : reading.action
            if entriesByAction[action] == nil { order.append(action) }
            entriesByAction[action, default: []].append(QiraatRulingAttribution(
                authorityId: reading.readingId,
                action: action
            ))
        }
        return order.compactMap { action in
            guard let entries = entriesByAction[action], !entries.isEmpty else { return nil }
            return QiraatPageSummaryItem.ActionGroup(
                action: action,
                entries: entries,
                authorities: rollupAuthorityPills(entries.map(\.authorityId), catalog: catalog)
            )
        }
    }

    private static func matchesAuthority(_ id: String, filter: QiraatFilter, catalog: QiraatCatalog) -> Bool {
        switch filter {
        case .all: true
        case .reader(let reader): id == reader || catalog.readerId(ofReading: id) == reader
        case .reading(let reading): id == reading || catalog.readerId(ofReading: reading) == id
        }
    }
}
