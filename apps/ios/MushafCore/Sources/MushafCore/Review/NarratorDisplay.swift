#if DEBUG
import Foundation

public struct NarratorRef: Hashable, Sendable {
    public let id: String
    public let nameAr: String
    public init(id: String, nameAr: String) { self.id = id; self.nameAr = nameAr }
}

public struct NarratorDisplayItem: Codable, Hashable, Sendable, Identifiable {
    public var id: String { key }
    public let key: String
    public let label: String
    public let color: String
    public init(key: String, label: String, color: String) { self.key = key; self.label = label; self.color = color }
}

/// Port of `narratorDisplay.ts`: when BOTH narrators of a reader are present they collapse into one item
/// naming the reader (in his colour); one narrator keeps its own name in its reader's colour.
public enum NarratorDisplay {
    public static func describe(_ narrators: [NarratorRef]) -> [NarratorDisplayItem] {
        var items: [NarratorDisplayItem] = []
        var emitted = Set<String>()
        for narrator in narrators {
            guard let reader = CanonicalReaders.all.first(where: { $0.narrators.contains { $0.id == narrator.id } }) else {
                items.append(NarratorDisplayItem(key: narrator.id, label: narrator.nameAr.isEmpty ? narrator.id : narrator.nameAr,
                                                 color: "#888"))
                continue
            }
            if emitted.contains(reader.id) { continue }
            let bothPresent = reader.narrators.allSatisfy { n in narrators.contains { $0.id == n.id } }
            if bothPresent {
                emitted.insert(reader.id)
                items.append(NarratorDisplayItem(key: reader.id, label: reader.nameAr, color: reader.color))
            } else {
                items.append(NarratorDisplayItem(key: narrator.id, label: narrator.nameAr, color: reader.color))
            }
        }
        return items
    }

    public static func text(_ narrators: [NarratorRef]) -> String {
        describe(narrators).map(\.label).joined(separator: "، ")
    }
}

/// Next wajh number for a narrator: after its highest existing wajh. Hafs (D8) never takes wajh 1.
public enum WajhOrder {
    public static func next(_ narrators: [NarratorInput], for id: String) -> Int {
        let highest = narrators.reduce(0) { $1.id == id ? max($0, $1.wajhOrder ?? 1) : $0 }
        return max(highest + 1, id == CanonicalReaders.hafsId ? 2 : 1)
    }
}
#endif
