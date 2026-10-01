import Foundation

// Text and pill rules of the web's Qiraat card (attribution.ts `rollupAuthorityPills`,
// Mushaf1441Viewer.tsx `distinctRulingText` / `isRedundantActionLabel`). Change both or neither.

public struct AuthorityPill: Hashable, Sendable, Identifiable {
    public enum Kind: Hashable, Sendable { case reader, narrator, other }
    public var id: String { key }
    public let key: String
    public let name: String
    public let color: String
    public let kind: Kind
}

/// «الإمام حمزة» when a reader is named or both of his narrators appear, «الراوي ورش» for one
/// narrator alone; readers in canonical order, then anything the catalog does not know, as given.
public func rollupAuthorityPills(_ authorityIds: [String], catalog: QiraatCatalog) -> [AuthorityPill] {
    var narratorsByReader: [String: Set<String>] = [:]
    var explicitReaders: Set<String> = []
    var others: [String] = []
    for id in authorityIds where !id.isEmpty {
        if let narrator = catalog.narrator(id) {
            narratorsByReader[narrator.readerId, default: []].insert(narrator.id)
        } else if catalog.reader(id) != nil {
            explicitReaders.insert(id)
        } else if !others.contains(id) {
            others.append(id)
        }
    }
    var pills: [AuthorityPill] = []
    for reader in catalog.readers.sorted(by: { $0.sortOrder < $1.sortOrder }) {
        let all = catalog.narrators(of: reader.id)
        let present = narratorsByReader[reader.id] ?? []
        if explicitReaders.contains(reader.id) || (!all.isEmpty && present.count >= all.count) {
            pills.append(AuthorityPill(key: reader.id, name: "الإمام \(reader.nameArShort)", color: reader.color, kind: .reader))
        } else {
            for narrator in all where present.contains(narrator.id) {
                pills.append(AuthorityPill(key: narrator.id, name: "الراوي \(narrator.nameAr)", color: narrator.color, kind: .narrator))
            }
        }
    }
    pills += others.map { AuthorityPill(key: $0, name: $0, color: "#8a7c5c", kind: .other) }
    return pills
}

/// Folds harakat, tatweel and alef forms so wording that differs only in marks compares equal.
private func folded(_ text: String) -> String {
    text.replacingOccurrences(of: "[\u{064B}-\u{065F}\u{0670}\u{0640}]", with: "", options: .regularExpression)
        .replacingOccurrences(of: "[ٱأإآ]", with: "ا", options: .regularExpression)
        .replacingOccurrences(of: "[\\s.،:؛-]+", with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespaces)
}

/// The ruling's general text, only when it says something the category badge and the per-reader
/// actions do not already say.
public func distinctRulingText(_ text: String?, categoryAr: String, actions: [String?]) -> String? {
    let t = folded(text ?? "")
    guard !t.isEmpty, t != folded(categoryAr) else { return nil }
    for action in actions {
        let a = folded(action ?? "")
        if !a.isEmpty, t == a || t.contains(a) || a.contains(t) { return nil }
    }
    return text?.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// An action line that only repeats the category name («ترك الغنة» under «ترك الغنة»).
public func isRedundantActionLabel(_ action: String?, categoryAr: String) -> Bool {
    func norm(_ s: String) -> String {
        s.replacingOccurrences(of: "[\u{064B}-\u{065F}\u{0670}\u{0640}]", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
    let a = norm(action ?? "")
    return a.isEmpty || a == norm(categoryAr)
}

public struct RulingActionGroup: Hashable, Sendable {
    public let action: String
    public let entries: [QiraatRulingAttribution]
}

extension QiraatRuling {
    /// Attribution grouped by action, in first-appearance order: «إمالة → حمزة، الكسائي» and
    /// «تقليل → ورش» stay two lines instead of one flattened list.
    public var attributionByAction: [RulingActionGroup] {
        var order: [String] = []
        var groups: [String: [QiraatRulingAttribution]] = [:]
        for entry in attribution {
            let action = entry.action ?? categoryAr
            if groups[action] == nil { order.append(action) }
            groups[action, default: []].append(entry)
        }
        return order.map { RulingActionGroup(action: $0, entries: groups[$0]!) }
    }

    /// Readings whose second وجه is also valid.
    public var alternateReadings: [QiraatRulingReading] { readings.filter { !$0.isDefault } }

    /// More than one وجه is recorded, so each attribution shows its wajh number.
    public var hasSeveralWajhs: Bool { attribution.contains { ($0.wajhOrder ?? 1) > 1 } }
}
