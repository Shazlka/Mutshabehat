import Foundation

public struct ReferenceSuggestion: Codable, Hashable, Sendable {
    public let kind: ReadingKind
    public let categoryCode: String?
    public init(kind: ReadingKind, categoryCode: String?) { self.kind = kind; self.categoryCode = categoryCode }
}

/// Source-agnostic shape of one «reader group» of an external reference (nquran.com, الشامل). Display-only:
/// nothing here writes anything.
public struct ReferenceGroup: Codable, Hashable, Sendable, Identifiable {
    public var id: String { key }
    public let key: String
    /// Shown before the colon.
    public let readersLabel: String
    /// Q-ids this group covers; empty when no reader label could be resolved.
    public let narratorIds: [String]
    /// Saved as each narrator's «الأداء» when the group is added.
    public let performanceText: String
    public let readingText: String?
    public let condition: ReferenceCondition?
    public let conditionBasis: String?
    public let suggestion: ReferenceSuggestion?
    public let unresolvedLabels: [String]?

    public init(key: String, readersLabel: String, narratorIds: [String], performanceText: String,
                readingText: String? = nil, condition: ReferenceCondition? = nil, conditionBasis: String? = nil,
                suggestion: ReferenceSuggestion? = nil, unresolvedLabels: [String]? = nil) {
        self.key = key; self.readersLabel = readersLabel; self.narratorIds = narratorIds
        self.performanceText = performanceText; self.readingText = readingText; self.condition = condition
        self.conditionBasis = conditionBasis; self.suggestion = suggestion; self.unresolvedLabels = unresolvedLabels
    }
}

public enum ReferenceDecisionStatus: String, Sendable, Hashable {
    case matched
    case recordedUnreviewed = "recorded_unreviewed"
    case partial
    case missing
    case unresolved
}

public struct ReferenceDecision: Sendable, Hashable {
    public let status: ReferenceDecisionStatus
    /// The existing entry (if any) the decision is based on.
    public let matchedRow: ReviewRow?
}

public struct BadgeVisibility: Sendable, Hashable {
    public let draft: Bool
    public let decision: Bool
}

/// Port of `referenceGroup.ts`: compares a reference group's narrators with the entries already recorded for
/// the selected word. It only labels a suggestion for the reviewer; it never writes.
public enum ReferenceDecider {
    /// - matched: a reviewed row covers the group (exactly or as a superset)
    /// - recordedUnreviewed: a row covers it but is not reviewed yet
    /// - partial: a row shares some but not all of its narrators (a real discrepancy)
    /// - missing: no row shares a narrator, so the source documents a reading with no entry here
    /// - unresolved: no reader label could be mapped, so no decision can be proposed
    public static func propose(narratorIds: [String], rows: [ReviewRow]) -> ReferenceDecision {
        if narratorIds.isEmpty { return ReferenceDecision(status: .unresolved, matchedRow: nil) }
        let wanted = Set(narratorIds)
        var best: (row: ReviewRow, overlap: Int, isSuperset: Bool)?
        for row in rows where !row.deleted {
            let ids = Set(row.narrators.map(\.id))
            let overlap = wanted.intersection(ids).count
            if overlap == 0 { continue }
            let isSuperset = overlap == wanted.count
            if best == nil || overlap > best!.overlap || (overlap == best!.overlap && isSuperset && !best!.isSuperset) {
                best = (row, overlap, isSuperset)
            }
        }
        guard let best else { return ReferenceDecision(status: .missing, matchedRow: nil) }
        if best.isSuperset {
            return ReferenceDecision(status: best.row.reviewStatus == .reviewed ? .matched : .recordedUnreviewed,
                                     matchedRow: best.row)
        }
        return ReferenceDecision(status: .partial, matchedRow: best.row)
    }

    /// Whether the open draft already carries every narrator of this group, so a second ➕ cannot create a
    /// false second wajh.
    public static func isGroupInDraft(narratorIds: [String], draftNarratorIds: [String]) -> Bool {
        if narratorIds.isEmpty { return false }
        let inDraft = Set(draftNarratorIds)
        return narratorIds.allSatisfy(inDraft.contains)
    }

    /// A group a saved row already covers always shows that saved status; «في المسودة» is only for a reading
    /// that exists in the draft alone.
    public static func badgeVisibility(decision: ReferenceDecision?, inDraft: Bool) -> BadgeVisibility {
        guard let decision else { return BadgeVisibility(draft: inDraft, decision: false) }
        if decision.status == .matched || decision.status == .recordedUnreviewed {
            return BadgeVisibility(draft: false, decision: true)
        }
        return inDraft ? BadgeVisibility(draft: true, decision: false) : BadgeVisibility(draft: false, decision: true)
    }
}

extension NquranMatching {
    /// One nquran difference as source-agnostic groups for the shared reference panel.
    public static func groups(for difference: NquranDifference) -> [ReferenceGroup] {
        resolveDifferenceGroups(difference).enumerated().map { index, resolved in
            ReferenceGroup(key: String(index), readersLabel: resolved.group.readers.joined(separator: "، "),
                           narratorIds: resolved.narratorIds, performanceText: resolved.group.reading,
                           unresolvedLabels: resolved.unresolvedLabels)
        }
    }
}
