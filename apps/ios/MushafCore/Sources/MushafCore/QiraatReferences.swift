import Foundation
#if canImport(os)
import os
#endif

/// The three متون a variant can be traced to. The same symbol letter means different people in the Shatibiyyah and the
/// Durrah, so a reference always carries its work and is only ever compared inside that work's own scope.
public enum QiraatMatn: String, Codable, CaseIterable, Sendable {
    case shatibiyyah, durrah, tayyibah

    public var labelAr: String {
        switch self {
        case .shatibiyyah: "الشاطبية"
        case .durrah: "الدرة"
        case .tayyibah: "طيبة النشر"
        }
    }

    /// The readers the work speaks about: the seven, the three who complete the ten, all ten.
    var readerIds: Set<String> {
        switch self {
        case .shatibiyyah: ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07"]
        case .durrah: ["Q08", "Q09", "Q10"]
        case .tayyibah: ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07", "Q08", "Q09", "Q10"]
        }
    }

    /// The narrator reading ids inside the work's scope.
    public func scope(in catalog: QiraatCatalog) -> Set<String> {
        let readers = readerIds
        return Set(catalog.narrators.filter { readers.contains($0.readerId) }.map(\.id))
    }
}

/// One place in a متن that documents a variant: the verse as printed, where it stands, and which readers it names.
public struct QiraatReference: Codable, Sendable, Hashable {
    public enum Status: String, Codable, Sendable { case extracted, reviewed, verified }
    /// `variant`: the named readers read the variant's own text. `complement`: they read the Hafs-side text, so the
    /// variant is read by the rest of the work's scope.
    public enum Side: String, Codable, Sendable { case variant, complement }

    public let variantId: String?
    public let variantKey: String
    public let work: QiraatMatn
    public let verse: Int?
    /// The verse exactly as the source prints it. It is not Quran text.
    public let lines: [String]
    public let symbolText: String?
    public let side: Side
    public let readingIds: [String]
    public let printedPage: String?
    public let sourceBookId: Int?
    public let sourceUrl: String?
    public let status: Status
    public let note: String?

    public init(variantId: String? = nil, variantKey: String, work: QiraatMatn, verse: Int? = nil, lines: [String],
                symbolText: String? = nil, side: Side, readingIds: [String], printedPage: String? = nil,
                sourceBookId: Int? = nil, sourceUrl: String? = nil, status: Status, note: String? = nil) {
        self.variantId = variantId; self.variantKey = variantKey; self.work = work; self.verse = verse
        self.lines = lines; self.symbolText = symbolText; self.side = side; self.readingIds = readingIds
        self.printedPage = printedPage; self.sourceBookId = sourceBookId; self.sourceUrl = sourceUrl
        self.status = status; self.note = note
    }
}

public enum QiraatReferenceConsistency: Equatable, Sendable {
    case consistent
    /// The readers the work names are not the readers the variant's own data names (both limited to the work's scope).
    case mismatch(expected: Set<String>, named: Set<String>)
    /// The reference names no reader inside its work's scope, so nothing can be compared.
    case unknown
}

/// The references file (`Generated/QiraatReferences/references.json`), indexed for lookup by variant. A missing,
/// unreadable or newer-format file gives an empty store: the references row then shows nothing.
public struct QiraatReferenceStore: Sendable {
    public static let fileName = "references.json"
    public static let supportedSchemaVersion = 1

    private let byId: [String: [QiraatReference]]
    private let byKey: [String: [QiraatReference]]
    public let count: Int
    public var isEmpty: Bool { count == 0 }

    public static let empty = QiraatReferenceStore(entries: [])

    public init(entries: [QiraatReference]) {
        var ids: [String: [QiraatReference]] = [:]
        var keys: [String: [QiraatReference]] = [:]
        for entry in entries {
            if let id = entry.variantId, !id.isEmpty { ids[id, default: []].append(entry) }
            keys[entry.variantKey, default: []].append(entry)
        }
        byId = ids
        byKey = keys
        count = entries.count
    }

    /// Reads `references.json` from `directory`; never throws.
    public init(directory: URL) {
        let url = directory.appendingPathComponent(Self.fileName)
        guard let data = try? Data(contentsOf: url) else {
            self = .empty
            return
        }
        guard let file = try? JSONDecoder().decode(File.self, from: data) else {
            Self.log("references file is not readable")
            self = .empty
            return
        }
        guard file.schemaVersion == Self.supportedSchemaVersion else {
            Self.log("references file has schema version \(file.schemaVersion), expected \(Self.supportedSchemaVersion)")
            self = .empty
            return
        }
        let entries = file.entries.compactMap(\.value)
        if entries.count != file.entries.count {
            Self.log("skipped \(file.entries.count - entries.count) unreadable reference entries")
        }
        self.init(entries: entries)
    }

    /// The key a reference uses when the variant's id has changed since the file was made.
    public static func key(for variant: QiraatVariant) -> String {
        "\(variant.surah):\(variant.ayah):\(variant.startToken)-\(variant.endToken):\(variant.variantText.precomposedStringWithCanonicalMapping)"
    }

    /// References for one variant: those carrying its id, then (when the id is not enough) those with its key.
    /// A performance-only variant (same text as Hafs) never matches by key: the key cannot tell two such faces apart.
    /// Order: الشاطبية، الدرة، طيبة النشر, then verse number.
    public func references(for variant: QiraatVariant) -> [QiraatReference] {
        var found = byId[variant.id] ?? []
        if !variant.isPerformanceOnly {
            for entry in byKey[Self.key(for: variant)] ?? [] where !found.contains(entry) { found.append(entry) }
        }
        let order = Dictionary(uniqueKeysWithValues: QiraatMatn.allCases.enumerated().map { ($1, $0) })
        return found.enumerated().sorted { a, b in
            let (x, y) = (a.element, b.element)
            if x.work != y.work { return order[x.work, default: 0] < order[y.work, default: 0] }
            let (vx, vy) = (x.verse ?? Int.max, y.verse ?? Int.max)
            if vx != vy { return vx < vy }
            return a.offset < b.offset
        }.map(\.element)
    }

    /// Does the work name the same readers as the variant's own data? Both sides are cut to the work's scope.
    public func consistency(_ reference: QiraatReference, variant: QiraatVariant, catalog: QiraatCatalog) -> QiraatReferenceConsistency {
        let scope = reference.work.scope(in: catalog)
        var named: Set<String> = []
        for id in reference.readingIds {
            if catalog.reader(id) != nil { named.formUnion(catalog.narrators(of: id).map(\.id)) } else { named.insert(id) }
        }
        named.formIntersection(scope)
        guard !named.isEmpty else { return .unknown }
        let variantSet = Set(variant.readingIds).intersection(scope)
        let expected = reference.side == .variant ? variantSet : scope.subtracting(variantSet)
        return named == expected ? .consistent : .mismatch(expected: expected, named: named)
    }

    // MARK: - File format

    private struct File: Decodable {
        let schemaVersion: Int
        let entries: [Lossy]
    }

    /// One entry that may not decode; the others still load.
    private struct Lossy: Decodable {
        let value: QiraatReference?
        init(from decoder: Decoder) throws { value = try? QiraatReference(from: decoder) }
    }

    private static func log(_ message: String) {
#if canImport(os)
        Logger(subsystem: "com.shazlka.qiraat", category: "references").error("\(message, privacy: .public)")
#endif
    }
}
