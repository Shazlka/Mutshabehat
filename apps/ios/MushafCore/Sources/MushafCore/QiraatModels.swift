import Foundation

// The Qiraat data the web app serves at GET /api/mushaf-1441/qiraat?page=N, snapshotted by
// scripts/fetch_qiraat.py into Generated/Qiraat. Field names match packages/qiraat-core/types.ts.
// Arrays and flags the web treats as optional decode to their web defaults instead of failing a page.

/// One reading that differs from Hafs at a token span (a فرش variant, or a performance-only وجه).
public struct QiraatVariant: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let surah: Int
    public let ayah: Int
    public let startToken: Int
    public let endToken: Int
    public let operation: String?
    public let hafsText: String
    public let variantText: String
    public let uthmaniText: String?
    public let description: String?
    public let performanceNote: String?
    public let differenceType: String?
    public let verificationStatus: String
    /// Reading ids are narrator ids ("Q01-R02" = ورش عن نافع).
    public let readingIds: [String]
    public let notes: String?

    public init(id: String, surah: Int, ayah: Int, startToken: Int, endToken: Int, operation: String? = nil,
                hafsText: String, variantText: String, uthmaniText: String? = nil, description: String? = nil,
                performanceNote: String? = nil, differenceType: String? = nil, verificationStatus: String,
                readingIds: [String], notes: String? = nil) {
        self.id = id; self.surah = surah; self.ayah = ayah; self.startToken = startToken; self.endToken = endToken
        self.operation = operation; self.hafsText = hafsText; self.variantText = variantText
        self.uthmaniText = uthmaniText; self.description = description; self.performanceNote = performanceNote
        self.differenceType = differenceType; self.verificationStatus = verificationStatus
        self.readingIds = readingIds; self.notes = notes
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        surah = try c.decode(Int.self, forKey: .surah)
        ayah = try c.decode(Int.self, forKey: .ayah)
        startToken = try c.decode(Int.self, forKey: .startToken)
        endToken = try c.decodeIfPresent(Int.self, forKey: .endToken) ?? startToken
        operation = try c.decodeIfPresent(String.self, forKey: .operation)
        hafsText = try c.decodeIfPresent(String.self, forKey: .hafsText) ?? ""
        variantText = try c.decodeIfPresent(String.self, forKey: .variantText) ?? hafsText
        uthmaniText = try c.decodeIfPresent(String.self, forKey: .uthmaniText)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        performanceNote = try c.decodeIfPresent(String.self, forKey: .performanceNote)
        differenceType = try c.decodeIfPresent(String.self, forKey: .differenceType)
        verificationStatus = try c.decodeIfPresent(String.self, forKey: .verificationStatus) ?? "REVIEWED"
        readingIds = try c.decodeIfPresent([String].self, forKey: .readingIds) ?? []
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }

    /// The text does not change; only the way it is recited (إشمام، إمالة، سكت …).
    public var isPerformanceOnly: Bool { variantText == hafsText }
}

/// Who applies an أصول ruling, and how («إمالة», «تقليل وقفًا», a second وجه …).
public struct QiraatRulingAttribution: Codable, Sendable, Hashable {
    /// A reading id ("Q01-R02"), a reader id ("Q06"), or a count-school id the catalog does not know.
    public let authorityId: String
    public let action: String?
    public let condition: String?
    public let wajhOrder: Int?
    public let wajhNote: String?

    public init(authorityId: String, action: String?, condition: String? = nil, wajhOrder: Int? = nil, wajhNote: String? = nil) {
        self.authorityId = authorityId; self.action = action; self.condition = condition
        self.wajhOrder = wajhOrder; self.wajhNote = wajhNote
    }
}

public struct QiraatRulingReading: Codable, Sendable, Hashable {
    public let readingId: String
    public let action: String
    /// False for a second, also-valid وجه («بخلف عنه»).
    public let isDefault: Bool

    public init(readingId: String, action: String, isDefault: Bool) {
        self.readingId = readingId; self.action = action; self.isDefault = isDefault
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        readingId = try c.decode(String.self, forKey: .readingId)
        action = try c.decodeIfPresent(String.self, forKey: .action) ?? ""
        isDefault = try c.decodeIfPresent(Bool.self, forKey: .isDefault) ?? true
    }
}

/// An أصول ruling (إمالة، إدغام، ترقيق …). It never changes the rasm; it colours the word.
public struct QiraatRuling: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let category: String
    public let categoryAr: String
    /// The usul family colour, one per family (see the web's CATEGORY_COLORS).
    public let color: String
    /// False for page-level conventions (عد الآي …) that are listed but never colour a word.
    public let wordAnchored: Bool
    public let surah: Int
    public let ayah: Int
    public let startToken: Int
    public let endToken: Int
    public let endAyah: Int?
    public let baseText: String
    public let verificationStatus: String
    public let hasAlternate: Bool
    public let attribution: [QiraatRulingAttribution]
    public let readings: [QiraatRulingReading]
    public let text: String?
    public let condition: String?
    public let countSchools: [String]?
    public let notes: String?
    public let sourceNotes: [String]?

    public init(id: String, category: String, categoryAr: String, color: String, wordAnchored: Bool,
                surah: Int, ayah: Int, startToken: Int, endToken: Int, endAyah: Int? = nil, baseText: String,
                verificationStatus: String, hasAlternate: Bool, attribution: [QiraatRulingAttribution],
                readings: [QiraatRulingReading], text: String? = nil, condition: String? = nil,
                countSchools: [String]? = nil, notes: String? = nil, sourceNotes: [String]? = nil) {
        self.id = id; self.category = category; self.categoryAr = categoryAr; self.color = color
        self.wordAnchored = wordAnchored; self.surah = surah; self.ayah = ayah; self.startToken = startToken
        self.endToken = endToken; self.endAyah = endAyah; self.baseText = baseText
        self.verificationStatus = verificationStatus; self.hasAlternate = hasAlternate
        self.attribution = attribution; self.readings = readings; self.text = text; self.condition = condition
        self.countSchools = countSchools; self.notes = notes; self.sourceNotes = sourceNotes
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? "OTHER"
        categoryAr = try c.decodeIfPresent(String.self, forKey: .categoryAr) ?? category
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "#64748B"
        wordAnchored = try c.decodeIfPresent(Bool.self, forKey: .wordAnchored) ?? true
        surah = try c.decode(Int.self, forKey: .surah)
        ayah = try c.decode(Int.self, forKey: .ayah)
        startToken = try c.decode(Int.self, forKey: .startToken)
        endToken = try c.decodeIfPresent(Int.self, forKey: .endToken) ?? startToken
        endAyah = try c.decodeIfPresent(Int.self, forKey: .endAyah)
        baseText = try c.decodeIfPresent(String.self, forKey: .baseText) ?? ""
        verificationStatus = try c.decodeIfPresent(String.self, forKey: .verificationStatus) ?? "REVIEWED"
        hasAlternate = try c.decodeIfPresent(Bool.self, forKey: .hasAlternate) ?? false
        attribution = try c.decodeIfPresent([QiraatRulingAttribution].self, forKey: .attribution) ?? []
        readings = try c.decodeIfPresent([QiraatRulingReading].self, forKey: .readings) ?? []
        text = try c.decodeIfPresent(String.self, forKey: .text)
        condition = try c.decodeIfPresent(String.self, forKey: .condition)
        countSchools = try c.decodeIfPresent([String].self, forKey: .countSchools)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        sourceNotes = try c.decodeIfPresent([String].self, forKey: .sourceNotes)
    }

    /// Port of the web's `rulingTouchesToken`: every token of the declared span, across ayah ends;
    /// a reversed span touches nothing.
    public func touches(surah: Int, ayah: Int, token: Int) -> Bool {
        guard surah == self.surah else { return false }
        let last = endAyah ?? self.ayah
        guard last >= self.ayah, ayah >= self.ayah, ayah <= last else { return false }
        if self.ayah == last { return token >= startToken && token <= endToken }
        if ayah == self.ayah { return token >= startToken }
        if ayah == last { return token <= endToken }
        return true
    }
}

/// A page-level rule (عد الآي, الأوجه بين السورتين …): listed, never drawn on a word.
public struct QiraatPageRule: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let category: String?
    public let text: String?
    public let reading: String?
    public let attributionLabel: String?
    public let options: [String]?
    public let readingIds: [String]?
    public let notes: String?
}

public struct QiraatPageData: Codable, Sendable, Hashable {
    public let pageNumber: Int
    public let variants: [QiraatVariant]
    public let rulings: [QiraatRuling]
    public let rules: [QiraatPageRule]

    public init(pageNumber: Int, variants: [QiraatVariant], rulings: [QiraatRuling], rules: [QiraatPageRule]) {
        self.pageNumber = pageNumber; self.variants = variants; self.rulings = rulings; self.rules = rules
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pageNumber = try c.decode(Int.self, forKey: .pageNumber)
        variants = try c.decodeIfPresent([QiraatVariant].self, forKey: .variants) ?? []
        rulings = try c.decodeIfPresent([QiraatRuling].self, forKey: .rulings) ?? []
        rules = try c.decodeIfPresent([QiraatPageRule].self, forKey: .rules) ?? []
    }
}

/// The ten readers and twenty narrators, as packages/qiraat-core defines them, plus the fixed colours.
public struct QiraatCatalog: Codable, Sendable, Hashable {
    public struct Reader: Codable, Sendable, Hashable, Identifiable {
        public let id: String
        public let nameAr: String
        /// Never shortened past what the web uses: Q10 stays «خلف العاشر».
        public let nameArShort: String
        public let color: String
        public let sortOrder: Int
    }

    public struct Narrator: Codable, Sendable, Hashable, Identifiable {
        public let id: String
        public let readerId: String
        /// Disambiguated: «الدوري عن أبي عمرو» and «الدوري عن الكسائي» are two people.
        public let nameAr: String
        public let color: String
        public let sortOrder: Int
    }

    public let schemaVersion: Int
    public let source: String
    public let sourceUrl: String?
    public let fetchedAt: String
    public let pageCount: Int
    public let readers: [Reader]
    public let narrators: [Narrator]
    public let multiReaderColor: String
    public let performanceColor: String
    public let unresolvedColor: String

    public func reader(_ id: String) -> Reader? { readers.first { $0.id == id } }
    public func narrator(_ id: String) -> Narrator? { narrators.first { $0.id == id } }
    /// A reading id is a narrator id; nil when the catalog does not know it.
    public func readerId(ofReading id: String) -> String? { narrator(id)?.readerId }
    public func narrators(of readerId: String) -> [Narrator] {
        narrators.filter { $0.readerId == readerId }.sorted { $0.sortOrder < $1.sortOrder }
    }
}

/// An sRGB colour parsed from the web's "#RRGGBB" strings (no UIKit in MushafCore).
public struct QiraatColor: Hashable, Sendable {
    public let red: Double
    public let green: Double
    public let blue: Double

    public init(red: Double, green: Double, blue: Double) { self.red = red; self.green = green; self.blue = blue }

    public init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255,
                  blue: Double(value & 0xFF) / 255)
    }
}
