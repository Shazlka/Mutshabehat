import Foundation

/// One ayah that a batch changes: the stored row before (nil when it had none) and the row after.
public struct AyahChange: Equatable, Sendable {
    public let key: AyahKey
    public let before: AyahMemorizationRecord?
    public let after: AyahMemorizationRecord

    public init(key: AyahKey, before: AyahMemorizationRecord?, after: AyahMemorizationRecord) {
        self.key = key
        self.before = before
        self.after = after
    }
}

/// Exactly what an update or review will change, computed before anything is written, so the
/// confirmation can say how many ayat change and the database can apply the whole batch at once.
public struct BatchPlan: Equatable, Sendable {
    public var kind: BatchKind
    public var label: String
    public var scopeJSON: String
    /// How many ayat the selection covers, including those that already have the requested state.
    public var selectionCount: Int
    public var changes: [AyahChange]
    /// True when the batch moved at least one ayah up into mastered or with-errors, or is a review.
    public var countsForStreak: Bool
    /// Ayat that moved from needs-Mushaf / not-memorized to mastered / with-errors.
    public var gainAyahs: Int

    public var unchangedCount: Int { selectionCount - changes.count }

    public init(kind: BatchKind, label: String, scopeJSON: String, selectionCount: Int, changes: [AyahChange],
                countsForStreak: Bool, gainAyahs: Int) {
        self.kind = kind
        self.label = label
        self.scopeJSON = scopeJSON
        self.selectionCount = selectionCount
        self.changes = changes
        self.countsForStreak = countsForStreak
        self.gainAyahs = gainAyahs
    }
}

extension MemorizationSelection {
    /// A compact JSON description stored with the batch (shown in history, kept in backups).
    public var scopeJSON: String {
        struct Scope: Encodable {
            var type: String
            var surah: Int?
            var from: Int?
            var to: Int?
            var page: ClosedRange<Int>?
            var juz: Int?
            var count: Int?
            var fromKey: String?
            var toKey: String?
        }
        let scope: Scope
        switch self {
        case let .surah(number): scope = Scope(type: "surah", surah: number)
        case let .ayahRange(surah, from, to): scope = Scope(type: "ayahRange", surah: surah, from: from, to: to)
        case let .pageRange(pages): scope = Scope(type: "pageRange", page: pages)
        case let .juz(number): scope = Scope(type: "juz", juz: number)
        case let .ayat(keys): scope = Scope(type: "ayat", count: keys.count)
        case let .span(from, to): scope = Scope(type: "span", fromKey: from.description, toKey: to.description)
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return (try? encoder.encode(scope)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }
}

public enum MemorizationPlanner {
    private static func isMemorized(_ status: MemorizationStatus) -> Bool {
        status == .mastered || status == .memorizedWithErrors
    }

    /// Plans setting `status` (and optionally the "currently learning" flag) on every selected ayah.
    /// Ayat that already have exactly that state are dropped from `changes`. Becoming mastered clears the
    /// learning flag unless `learning` is explicitly true; `learning == nil` otherwise leaves it alone.
    public static func planUpdate(selection: MemorizationSelection, label: String, status: MemorizationStatus,
                                  learning: Bool?, records: [AyahKey: AyahMemorizationRecord], index: QuranIndex,
                                  now rawNow: Date) -> BatchPlan {
        let now = rawNow.normalizedToMilliseconds
        let keys = selection.resolve(in: index)
        var changes: [AyahChange] = []
        var gain = 0
        var improved = false

        for key in keys {
            let current = records[key]
            let base = current ?? AyahMemorizationRecord.blank(key, now: now)
            let statusChanges = base.status != status
            var newLearning = base.isCurrentlyLearning
            if let learning {
                newLearning = learning
            } else if statusChanges && status == .mastered {
                newLearning = false
            }
            guard statusChanges || newLearning != base.isCurrentlyLearning else { continue }

            var after = base
            after.status = status
            after.isCurrentlyLearning = newLearning
            after.updatedAt = now
            if statusChanges {
                after.lastStatusChangedAt = now
                if isMemorized(status), after.firstMemorizedAt == nil { after.firstMemorizedAt = now }
                if isMemorized(status), status.rawValue < base.status.rawValue { improved = true }
                if isMemorized(status), !isMemorized(base.status) { gain += 1 }
            }
            changes.append(AyahChange(key: key, before: current, after: after))
        }

        return BatchPlan(kind: .update, label: label, scopeJSON: selection.scopeJSON, selectionCount: keys.count,
                         changes: changes, countsForStreak: improved, gainAyahs: gain)
    }

    /// A whole surah, or more ayat than the policy threshold, must be confirmed before it is applied.
    public static func needsConfirmation(selection: MemorizationSelection, plan: BatchPlan, index: QuranIndex,
                                         policy: MemorizationPolicy = .standard) -> Bool {
        selection.isWholeSurah(in: index) || plan.selectionCount > policy.confirmationAyahThreshold
    }
}
