#if DEBUG
import Foundation

public enum ReferenceSource: String, Codable, Sendable, Hashable { case nquran, shamil }

/// What the editor knows when ➕ is pressed on a reference group.
public struct ApplyContext: Codable, Hashable, Sendable {
    public struct FarshNarrator: Codable, Hashable, Sendable {
        public let id: String
        public let wajhOrder: Int
        public init(id: String, wajhOrder: Int) { self.id = id; self.wajhOrder = wajhOrder }
    }

    public var narrators: [NarratorInput]
    public var readingText: String
    /// The Hafs word the editor pre-fills into a new draft's reading field; it counts as "not typed yet".
    public var defaultReadingText: String
    public var kind: ReadingKind
    public var categoryCode: String?
    /// An add-mode draft with no narrators yet: nothing the reviewer typed can be overwritten.
    public var isFreshDraft: Bool
    /// Narrators of the word's OTHER active farsh rows (for the one-wajh-1-per-narrator rule).
    public var otherFarshNarrators: [FarshNarrator]

    public init(narrators: [NarratorInput], readingText: String, defaultReadingText: String, kind: ReadingKind,
                categoryCode: String?, isFreshDraft: Bool, otherFarshNarrators: [FarshNarrator]) {
        self.narrators = narrators; self.readingText = readingText; self.defaultReadingText = defaultReadingText
        self.kind = kind; self.categoryCode = categoryCode; self.isFreshDraft = isFreshDraft
        self.otherFarshNarrators = otherFarshNarrators
    }
}

/// Only the fields that change are set; nil means "leave the draft's value alone".
public struct ApplyPlan: Codable, Hashable, Sendable {
    public var narrators: [NarratorInput]
    public var readingText: String?
    public var kind: ReadingKind?
    public var appliesWasl: Bool?
    public var appliesWaqf: Bool?
    public var categoryCode: String?
    /// Part of the suggestion that was not applied; the panel offers it as a tap-to-apply chip.
    public var pendingSuggestion: ReferenceSuggestion?
}

/// Port of `referenceApply.ts`: what ➕ does to the draft, as a pure function. Nothing is saved here.
public enum ReferenceApply {
    private static func hafsNote(_ source: ReferenceSource) -> String {
        source == .nquran ? "مستورد من مرجع nquran.com" : "مستورد من مرجع الشامل"
    }

    public static func plan(source: ReferenceSource, group: ReferenceGroup, context ctx: ApplyContext) -> ApplyPlan {
        let performance: String? = group.performanceText.isEmpty ? nil : group.performanceText
        // wajh numbering also respects the other active farsh rows (DB rule QIRAAT_NARRATOR_TWICE), and Hafs is
        // floored at wajh 2 with a note (rule D8).
        var narrators = ctx.narrators
        for id in group.narratorIds {
            if narrators.contains(where: { $0.id == id && $0.action == performance }) { continue }
            let others = ctx.otherFarshNarrators.map { NarratorInput(id: $0.id, wajhOrder: $0.wajhOrder) }
            let wajhOrder = WajhOrder.next(others + narrators, for: id)
            let wajhNote = id == CanonicalReaders.hafsId ? (performance ?? hafsNote(source)) : nil
            narrators.append(NarratorInput(id: id, action: performance, wajhOrder: wajhOrder, wajhNote: wajhNote))
        }

        var plan = ApplyPlan(narrators: narrators)

        // Never overwrite what the reviewer typed; on a fresh draft the pre-filled Hafs word is replaced too.
        let typed = Arabic.trimJS(ctx.readingText)
        let untouched = typed.isEmpty || (ctx.isFreshDraft && typed == Arabic.trimJS(ctx.defaultReadingText))
        if let reading = group.readingText, !reading.isEmpty, untouched { plan.readingText = reading }

        let suggestion = group.suggestion
        if ctx.isFreshDraft {
            if let suggestion { plan.kind = suggestion.kind }
            if let condition = group.condition {
                plan.appliesWasl = condition != .waqf
                plan.appliesWaqf = condition != .wasl
            }
        }

        if let suggestion {
            let finalKind = plan.kind ?? ctx.kind
            let canApplyCategory = suggestion.categoryCode != nil && suggestion.kind == .usul
                && finalKind == .usul && ctx.categoryCode == nil
            if canApplyCategory { plan.categoryCode = suggestion.categoryCode }
            let categoryLeft = suggestion.categoryCode != nil && !canApplyCategory
            if categoryLeft || suggestion.kind != finalKind { plan.pendingSuggestion = suggestion }
        }
        return plan
    }
}
#endif
