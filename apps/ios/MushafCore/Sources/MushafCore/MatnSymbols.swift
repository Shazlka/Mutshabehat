import Foundation

/// What a symbol in a متن stands for.
public enum MatnSymbolKind: String, Codable, Sendable {
    /// One reader (both his narrators).
    case reader
    /// One narrator.
    case narrator
    /// Several readers or narrators (ث، ذ، ش… in الشاطبية; صحبة، سما، كفى… as words).
    case group
}

/// One symbol of one متن: the letter or word, whom it names, and the verses of the متن's introduction that define it.
/// The same letter means different people in different متون (أ is نافع in الشاطبية and طيبة النشر, أبو جعفر in الدرة;
/// ث is الكوفيون in الشاطبية and أبو جعفر in طيبة النشر), so a symbol never resolves without its متن.
public struct MatnSymbolDefinition: Sendable, Hashable {
    public let work: QiraatMatn
    /// The letter or word as the متن spells it in its introduction («أ»، «صحبة»).
    public let symbol: String
    public let kind: MatnSymbolKind
    /// Reader ids ("Q07", both narrators) and narrator ids ("Q04-R01").
    public let readingIds: [String]
    /// «الكسائي»، «هشام»، «حمزة والكسائي وشعبة».
    public let namesAr: String
    /// For a narrator, the reader he narrates from.
    public let readerAr: String?
    /// The verses of the متن that define the symbol («٤٥–٤٦»).
    public let definedIn: String

    /// The letters the symbol is looked up by (see `MatnSymbols.key`).
    public var key: String { MatnSymbols.key(symbol) }
}

/// The three symbol dictionaries, each taken from its own متن's introduction:
/// الشاطبية ٤٥–٥٥ (أبجد on the seven in order, then ثخذ ظغش and the eight word symbols),
/// الدرة ٥–٨ (the three readers take the letters of نافع، أبي عمرو and حمزة: أبج، حطي، فضق),
/// طيبة النشر ٣٦–٤٨ (أبج … ظغش on the ten in order, no letter for خلف العاشر, and the word symbols of ٤٢–٤٨).
public enum MatnSymbols {
    /// The ten readers in the order of the متون, with their two narrators: (reader id, name, R01, R02). خلف and الدوري
    /// are always named with whom they narrate from, so neither is ever bare.
    private static let readers: [(id: String, name: String, first: String, second: String)] = [
        ("Q01", "نافع", "قالون", "ورش"),
        ("Q02", "ابن كثير", "البزي", "قنبل"),
        ("Q03", "أبو عمرو", "الدوري عن أبي عمرو", "السوسي"),
        ("Q04", "ابن عامر", "هشام", "ابن ذكوان"),
        ("Q05", "عاصم", "شعبة", "حفص"),
        ("Q06", "حمزة", "خلف عن حمزة", "خلاد"),
        ("Q07", "الكسائي", "أبو الحارث", "الدوري عن الكسائي"),
        ("Q08", "أبو جعفر", "ابن وردان", "ابن جماز"),
        ("Q09", "يعقوب", "رويس", "روح"),
        ("Q10", "خلف العاشر", "إسحاق", "إدريس"),
    ]

    /// Three letters (reader, first narrator, second narrator) for each reader index, in a متن's own order.
    private static func letters(_ work: QiraatMatn, _ triples: [(reader: Int, letters: String)], definedIn: String) -> [MatnSymbolDefinition] {
        triples.flatMap { reader, letters -> [MatnSymbolDefinition] in
            let r = readers[reader]
            let l = Array(letters).map(String.init)
            return [
                MatnSymbolDefinition(work: work, symbol: l[0], kind: .reader, readingIds: [r.id], namesAr: r.name, readerAr: nil, definedIn: definedIn),
                MatnSymbolDefinition(work: work, symbol: l[1], kind: .narrator, readingIds: [r.id + "-R01"], namesAr: r.first, readerAr: r.name, definedIn: definedIn),
                MatnSymbolDefinition(work: work, symbol: l[2], kind: .narrator, readingIds: [r.id + "-R02"], namesAr: r.second, readerAr: r.name, definedIn: definedIn),
            ]
        }
    }

    private static func group(_ work: QiraatMatn, _ symbol: String, _ ids: [String], _ names: String, _ verses: String) -> MatnSymbolDefinition {
        MatnSymbolDefinition(work: work, symbol: symbol, kind: .group, readingIds: ids, namesAr: names, readerAr: nil, definedIn: verses)
    }

    public static let shatibiyyah: [MatnSymbolDefinition] =
        letters(.shatibiyyah, [(0, "أبج"), (1, "دهز"), (2, "حطي"), (3, "كلم"), (4, "نصع"), (5, "فضق"), (6, "رست")], definedIn: "٤٥–٤٦")
        + [
            group(.shatibiyyah, "ث", ["Q05", "Q06", "Q07"], "الكوفيون: عاصم وحمزة والكسائي", "٤٩"),
            group(.shatibiyyah, "خ", ["Q02", "Q03", "Q04", "Q05", "Q06", "Q07"], "السبعة غير نافع", "٤٩–٥٠"),
            group(.shatibiyyah, "ذ", ["Q04", "Q05", "Q06", "Q07"], "الكوفيون وابن عامر", "٥٠"),
            group(.shatibiyyah, "ظ", ["Q02", "Q05", "Q06", "Q07"], "الكوفيون وابن كثير", "٥١"),
            group(.shatibiyyah, "غ", ["Q03", "Q05", "Q06", "Q07"], "الكوفيون وأبو عمرو", "٥١"),
            group(.shatibiyyah, "ش", ["Q06", "Q07"], "حمزة والكسائي", "٥٢"),
            group(.shatibiyyah, "صحبة", ["Q06", "Q07", "Q05-R01"], "حمزة والكسائي وشعبة", "٥٢"),
            group(.shatibiyyah, "صحاب", ["Q06", "Q07", "Q05-R02"], "حمزة والكسائي وحفص", "٥٣"),
            group(.shatibiyyah, "عم", ["Q01", "Q04"], "نافع وابن عامر", "٥٣"),
            group(.shatibiyyah, "سما", ["Q01", "Q02", "Q03"], "نافع وابن كثير وأبو عمرو", "٥٣–٥٤"),
            group(.shatibiyyah, "حق", ["Q02", "Q03"], "ابن كثير وأبو عمرو", "٥٤"),
            group(.shatibiyyah, "نفر", ["Q02", "Q03", "Q04"], "ابن كثير وأبو عمرو وابن عامر", "٥٤"),
            group(.shatibiyyah, "حرمي", ["Q01", "Q02"], "نافع وابن كثير", "٥٥"),
            group(.shatibiyyah, "حصن", ["Q01", "Q05", "Q06", "Q07"], "نافع والكوفيون", "٥٥"),
        ]

    public static let durrah: [MatnSymbolDefinition] =
        letters(.durrah, [(7, "أبج"), (8, "حطي"), (9, "فضق")], definedIn: "٥–٨")

    public static let tayyibah: [MatnSymbolDefinition] =
        letters(.tayyibah, [(0, "أبج"), (1, "دهز"), (2, "حطي"), (3, "كلم"), (4, "نصع"), (5, "فضق"), (6, "رست"), (7, "ثخذ"), (8, "ظغش")],
                definedIn: "٣٦–٣٨")
        + [
            group(.tayyibah, "كفى", ["Q05", "Q06", "Q07", "Q10"], "الكوفيون: عاصم وحمزة والكسائي وخلف العاشر", "٤٢"),
            group(.tayyibah, "شفا", ["Q06", "Q07", "Q10"], "حمزة والكسائي وخلف العاشر", "٤٢"),
            group(.tayyibah, "صحب", ["Q06", "Q07", "Q10", "Q05-R02"], "حمزة والكسائي وخلف العاشر وحفص", "٤٣"),
            group(.tayyibah, "صحبة", ["Q06", "Q07", "Q10", "Q05-R01"], "حمزة والكسائي وخلف العاشر وشعبة", "٤٣"),
            group(.tayyibah, "صفا", ["Q10", "Q05-R01"], "خلف العاشر وشعبة", "٤٣–٤٤"),
            group(.tayyibah, "فتى", ["Q06", "Q10"], "حمزة وخلف العاشر", "٤٤"),
            group(.tayyibah, "رضى", ["Q06", "Q07"], "حمزة والكسائي", "٤٤"),
            group(.tayyibah, "روى", ["Q07", "Q10"], "الكسائي وخلف العاشر", "٤٥"),
            group(.tayyibah, "ثوى", ["Q08", "Q09"], "أبو جعفر ويعقوب", "٤٥"),
            group(.tayyibah, "مدا", ["Q01", "Q08"], "المدنيان: نافع وأبو جعفر", "٤٦"),
            group(.tayyibah, "حما", ["Q03", "Q09"], "البصريان: أبو عمرو ويعقوب", "٤٦"),
            group(.tayyibah, "سما", ["Q01", "Q08", "Q02", "Q03", "Q09"], "نافع وأبو جعفر وابن كثير وأبو عمرو ويعقوب", "٤٦"),
            group(.tayyibah, "حق", ["Q02", "Q03", "Q09"], "ابن كثير وأبو عمرو ويعقوب", "٤٧"),
            group(.tayyibah, "حرم", ["Q01", "Q08", "Q02"], "نافع وأبو جعفر وابن كثير", "٤٧"),
            group(.tayyibah, "عم", ["Q01", "Q08", "Q04"], "نافع وأبو جعفر وابن عامر", "٤٧"),
            group(.tayyibah, "حبر", ["Q02", "Q03"], "ابن كثير وأبو عمرو", "٤٨"),
            group(.tayyibah, "كنز", ["Q05", "Q06", "Q07", "Q10", "Q04"], "الكوفيون وابن عامر", "٤٨"),
        ]

    public static func definitions(_ work: QiraatMatn) -> [MatnSymbolDefinition] {
        switch work {
        case .shatibiyyah: shatibiyyah
        case .durrah: durrah
        case .tayyibah: tayyibah
        }
    }

    private static let byKey: [QiraatMatn: [String: MatnSymbolDefinition]] = Dictionary(uniqueKeysWithValues: QiraatMatn.allCases.map { work in
        (work, Dictionary(definitions(work).map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first }))
    })

    /// The symbol of `work` spelled `symbol` (marks and alef forms ignored), or nil.
    public static func definition(_ work: QiraatMatn, symbol: String) -> MatnSymbolDefinition? {
        if let found = byKey[work]?[key(symbol)] { return found }
        return definitions(work).first { $0.key.count > 1 && wordKey($0.symbol) == wordKey(symbol) }
    }

    /// A word symbol's letters with its last letter's two spellings made one: the متون write «رضى» and «رضا»، «صفا»
    /// and «صفي».
    public static func wordKey(_ text: String) -> String {
        let letters = key(text)
        guard letters.count > 1, letters.hasSuffix("ي") else { return letters }
        return String(letters.dropLast()) + "ا"
    }

    /// Letters only, the way a symbol is looked up: marks and tatweel dropped, ا for أ إ آ ٱ, ي for ى, ه for ة and هـ.
    public static func key(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            switch scalar.value {
            case 0x0623, 0x0625, 0x0622, 0x0671: out.append("ا")
            case 0x0649: out.append("ي")
            case 0x0629: out.append("ه")
            case 0x0640, 0x064B...0x065F, 0x0670, 0x06D6...0x06ED: continue
            default:
                if !CharacterSet.whitespacesAndNewlines.contains(scalar) { out.append(scalar) }
            }
        }
        return String(out)
    }
}

/// Whether a marked symbol has been checked against a شرح.
public enum MatnSymbolStatus: String, Codable, Sendable {
    /// Checked against a شرح; shown in red.
    case verified
    /// Found but not yet checked; never shown as a symbol.
    case extracted
}

/// How a verified mark was checked.
public enum MatnSymbolMethod: String, Codable, Sendable {
    /// Read against the شرح by hand.
    case hand
    /// Matched to the شرح by script: the readers its run of symbols stands for are exactly the readers the شرح names
    /// together for that verse.
    case match
}

/// A symbol marked in one hemistich of a verse: where it is, whom it names and on what authority. A layer over the
/// متن (`mutoon-symbols.json`); the verse text itself is never changed.
public struct MatnSymbolAnnotation: Codable, Sendable, Hashable, Identifiable {
    public let work: QiraatMatn
    public let verse: Int
    /// The hemistich, 0 or 1.
    public let line: Int
    /// The marked letters as character (grapheme) offsets in the hemistich, `start..<end`. A letter keeps its marks.
    public let start: Int
    public let end: Int
    /// The marked text exactly as the hemistich spells it.
    public let text: String
    /// The symbol it stands for in this متن («ر»، «صحبة»).
    public let symbol: String
    public let kind: MatnSymbolKind
    public let readingIds: [String]
    /// What it marks here («ر أول رَاوِيهِ: الكسائي، بالمد في مالك»).
    public let note: String
    /// The شرح it was checked against.
    public let source: String
    public let status: MatnSymbolStatus
    /// How it was checked; a file without the field means by hand.
    public let method: MatnSymbolMethod

    public var id: String { "\(work.rawValue)-\(verse)-\(line)-\(start)" }

    public init(work: QiraatMatn, verse: Int, line: Int, start: Int, end: Int, text: String, symbol: String,
                kind: MatnSymbolKind, readingIds: [String], note: String, source: String, status: MatnSymbolStatus,
                method: MatnSymbolMethod = .hand) {
        self.work = work; self.verse = verse; self.line = line; self.start = start; self.end = end; self.text = text
        self.symbol = symbol; self.kind = kind; self.readingIds = readingIds; self.note = note; self.source = source
        self.status = status; self.method = method
    }

    private enum CodingKeys: String, CodingKey {
        case work, verse, line, start, end, text, symbol, kind, readingIds, note, source, status, method
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        work = try c.decode(QiraatMatn.self, forKey: .work)
        verse = try c.decode(Int.self, forKey: .verse)
        line = try c.decode(Int.self, forKey: .line)
        start = try c.decode(Int.self, forKey: .start)
        end = try c.decode(Int.self, forKey: .end)
        text = try c.decode(String.self, forKey: .text)
        symbol = try c.decode(String.self, forKey: .symbol)
        kind = try c.decode(MatnSymbolKind.self, forKey: .kind)
        readingIds = try c.decode([String].self, forKey: .readingIds)
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? ""
        status = try c.decode(MatnSymbolStatus.self, forKey: .status)
        method = try c.decodeIfPresent(MatnSymbolMethod.self, forKey: .method) ?? .hand
    }

    /// The symbol's entry in its own متن's dictionary.
    public var definition: MatnSymbolDefinition? { MatnSymbols.definition(work, symbol: symbol) }

    /// Why the mark cannot be shown, or nil when it can. A mark is shown only when it is verified, sits on exactly the
    /// text it claims in `lines`, begins with its symbol's letter (a letter) or spells its symbol (a word), and names
    /// the same readers as its متن's dictionary.
    public func problem(in lines: [String]) -> String? {
        guard status == .verified else { return "not verified" }
        guard lines.indices.contains(line) else { return "no hemistich \(line)" }
        let characters = Array(lines[line])
        guard start >= 0, start < end, end <= characters.count, String(characters[start..<end]) == text else {
            return "text not at \(start)..<\(end)"
        }
        guard let definition else { return "«\(symbol)» is not a symbol of \(work.rawValue)" }
        guard definition.kind == kind, Set(definition.readingIds) == Set(readingIds) else {
            return "«\(symbol)» names other readers in \(work.rawValue)"
        }
        let marked = MatnSymbols.key(text)
        switch kind {
        case .reader, .narrator:
            guard end - start == 1, marked == definition.key else { return "«\(text)» is not the letter «\(symbol)»" }
        case .group:
            let isLetter = definition.key.count == 1
            guard isLetter ? (end - start == 1 && marked == definition.key)
                           : MatnSymbols.wordKey(text) == MatnSymbols.wordKey(definition.symbol) else {
                return "«\(text)» is not «\(symbol)»"
            }
        }
        return nil
    }
}

/// The marked symbols of the three متون. Only marks that pass `problem(in:)` are kept.
public struct MatnSymbolLayer: Sendable {
    public static let fileName = "mutoon-symbols.json"
    public static let supportedSchemaVersion = 1
    public static let empty = MatnSymbolLayer(marks: [:])

    private let marks: [String: [MatnSymbolAnnotation]]

    private init(marks: [String: [MatnSymbolAnnotation]]) { self.marks = marks }

    /// Keeps the marks that can be shown against `works`; the others are dropped (and reported in `rejected`).
    public init(annotations: [MatnSymbolAnnotation], works: [MatnWork]) {
        var verses: [String: [String]] = [:]
        for work in works {
            for chapter in work.chapters { for verse in chapter.verses { verses[Self.slot(work.work, verse.number)] = verse.lines } }
        }
        var marks: [String: [MatnSymbolAnnotation]] = [:]
        for mark in annotations {
            let slot = Self.slot(mark.work, mark.verse)
            guard let lines = verses[slot], mark.problem(in: lines) == nil else { continue }
            marks[slot, default: []].append(mark)
        }
        self.marks = marks.mapValues { $0.sorted { ($0.line, $0.start) < ($1.line, $1.start) } }
    }

    public var isEmpty: Bool { marks.isEmpty }
    public var count: Int { marks.values.reduce(0) { $0 + $1.count } }

    /// The marks shown on a verse, by hemistich then position.
    public func marks(_ work: QiraatMatn, verse: Int) -> [MatnSymbolAnnotation] { marks[Self.slot(work, verse)] ?? [] }

    private static func slot(_ work: QiraatMatn, _ verse: Int) -> String { "\(work.rawValue):\(verse)" }

    // MARK: - File format

    struct File: Decodable {
        let schemaVersion: Int
        let annotations: [Lossy]
    }

    /// A mark that may not decode (an unknown work or kind); the others still load.
    struct Lossy: Decodable {
        let value: MatnSymbolAnnotation?
        init(from decoder: Decoder) throws { value = try? MatnSymbolAnnotation(from: decoder) }
    }
}
