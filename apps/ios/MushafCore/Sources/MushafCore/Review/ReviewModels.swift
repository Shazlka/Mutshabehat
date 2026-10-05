import Foundation

// Models of the web review API (`/api/mushaf-1441/qiraat-review`). They mirror
// `src/app/mushaf-1441/review/_lib/types.ts`; the server is the only authority on every value.

public enum ReviewStatus: String, Codable, Sendable, Hashable { case unreviewed, reviewed, flagged }
public enum ReadingKind: String, Codable, Sendable, Hashable { case farsh, usul }

/// Any JSON value; used where the server reports arbitrary old/new values (edit history).
public enum JSONValue: Codable, Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

/// An update field that is either left out of the request or set to a value or to `null`.
public enum Patch<Value: Hashable & Sendable>: Hashable, Sendable {
    case unset
    case set(Value?)

    public var isSet: Bool { if case .set = self { return true } else { return false } }
}

public struct ReviewWord: Codable, Hashable, Sendable, Identifiable {
    public var id: String { key }
    public let key: String
    public let surah: Int
    public let ayah: Int
    public let word: Int
    public let line: Int
    public let text: String
}

public struct ReviewNarrator: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var code: String?
    public var nameAr: String
    public var action: String?
    public var wajhOrder: Int
    public var wajhNote: String?

    public init(id: String, code: String? = nil, nameAr: String, action: String? = nil,
                wajhOrder: Int = 1, wajhNote: String? = nil) {
        self.id = id; self.code = code; self.nameAr = nameAr
        self.action = action; self.wajhOrder = wajhOrder; self.wajhNote = wajhNote
    }

    enum CodingKeys: String, CodingKey { case id, code, nameAr, action, wajhOrder, wajhNote }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        code = try c.decodeIfPresent(String.self, forKey: .code)
        nameAr = try c.decodeIfPresent(String.self, forKey: .nameAr) ?? id
        action = try c.decodeIfPresent(String.self, forKey: .action)
        wajhOrder = try c.decodeIfPresent(Int.self, forKey: .wajhOrder) ?? 1
        wajhNote = try c.decodeIfPresent(String.self, forKey: .wajhNote)
    }
}

public struct ReviewFlag: Codable, Hashable, Sendable, Identifiable {
    public enum State: String, Codable, Sendable, Hashable { case open, verified, corrected, ignored }
    public let id: Int
    public let type: String
    public let issueAr: String
    public let status: State
    public let createdAt: String?
    public let resolvedNote: String?
    public let resolvedAt: String?

    enum CodingKeys: String, CodingKey { case id, type, issueAr, status, createdAt, resolvedNote, resolvedAt }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? ""
        issueAr = try c.decodeIfPresent(String.self, forKey: .issueAr) ?? ""
        status = (try? c.decode(State.self, forKey: .status)) ?? .open
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        resolvedNote = try c.decodeIfPresent(String.self, forKey: .resolvedNote)
        resolvedAt = try c.decodeIfPresent(String.self, forKey: .resolvedAt)
    }
}

public enum HamzahTreatment: String, Codable, Sendable, Hashable, CaseIterable {
    case tahqiq = "تحقيق"
    case tasheel = "تسهيل"
    case ibdal = "إبدال"
    case naql = "نقل"
    case hadhf = "حذف"
    case isqat = "إسقاط"
    case saktBeforeHamz = "سكت قبل الهمز"
}

public enum HarakahRelation: String, Codable, Sendable, Hashable {
    case mutafiqatan = "متفقتان"
    case mukhtalifatan = "مختلفتان"
}

/// Structured Hamzah value for the تغيير الهمز / الهمزتان من كلمة / الهمزتان من كلمتين chapters.
/// UI-defined: the database stores it as opaque JSON, so the shape here must equal the web's exactly.
public enum HamzahDetail: Codable, Hashable, Sendable {
    public struct WordKeys: Codable, Hashable, Sendable {
        public var first: String
        public var second: String
        public init(first: String, second: String) { self.first = first; self.second = second }
    }

    case single(treatment: HamzahTreatment)
    case kalima(first: HamzahTreatment, second: HamzahTreatment, idkhalAlif: Bool?)
    case kalimatayn(harakahRelation: HarakahRelation, firstTreatment: HamzahTreatment,
                    secondTreatment: HamzahTreatment, isqatFirst: Bool?, isqatSecond: Bool?,
                    ibdalMadd: Bool?, wordKeys: WordKeys?)

    enum CodingKeys: String, CodingKey {
        case mode, treatment, first, second, idkhalAlif
        case harakahRelation, firstTreatment, secondTreatment, isqatFirst, isqatSecond, ibdalMadd, wordKeys
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .mode) {
        case "single":
            self = .single(treatment: try c.decode(HamzahTreatment.self, forKey: .treatment))
        case "kalima":
            self = .kalima(first: try c.decode(HamzahTreatment.self, forKey: .first),
                           second: try c.decode(HamzahTreatment.self, forKey: .second),
                           idkhalAlif: try c.decodeIfPresent(Bool.self, forKey: .idkhalAlif))
        case "kalimatayn":
            self = .kalimatayn(harakahRelation: try c.decode(HarakahRelation.self, forKey: .harakahRelation),
                               firstTreatment: try c.decode(HamzahTreatment.self, forKey: .firstTreatment),
                               secondTreatment: try c.decode(HamzahTreatment.self, forKey: .secondTreatment),
                               isqatFirst: try c.decodeIfPresent(Bool.self, forKey: .isqatFirst),
                               isqatSecond: try c.decodeIfPresent(Bool.self, forKey: .isqatSecond),
                               ibdalMadd: try c.decodeIfPresent(Bool.self, forKey: .ibdalMadd),
                               wordKeys: try c.decodeIfPresent(WordKeys.self, forKey: .wordKeys))
        default:
            throw DecodingError.dataCorruptedError(forKey: .mode, in: c, debugDescription: "unknown hamzah mode")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .single(let treatment):
            try c.encode("single", forKey: .mode)
            try c.encode(treatment, forKey: .treatment)
        case .kalima(let first, let second, let idkhalAlif):
            try c.encode("kalima", forKey: .mode)
            try c.encode(first, forKey: .first)
            try c.encode(second, forKey: .second)
            try c.encodeIfPresent(idkhalAlif, forKey: .idkhalAlif)
        case .kalimatayn(let relation, let first, let second, let isqatFirst, let isqatSecond, let ibdalMadd, let wordKeys):
            try c.encode("kalimatayn", forKey: .mode)
            try c.encode(relation, forKey: .harakahRelation)
            try c.encode(first, forKey: .firstTreatment)
            try c.encode(second, forKey: .secondTreatment)
            try c.encodeIfPresent(isqatFirst, forKey: .isqatFirst)
            try c.encodeIfPresent(isqatSecond, forKey: .isqatSecond)
            try c.encodeIfPresent(ibdalMadd, forKey: .ibdalMadd)
            try c.encodeIfPresent(wordKeys, forKey: .wordKeys)
        }
    }
}

public struct ReviewRow: Codable, Hashable, Sendable, Identifiable {
    public var id: String { entryId }
    public var entryId: String
    public var locationId: String
    public var version: String
    public var kind: ReadingKind
    public var categoryCode: String?
    public var categoryNameAr: String?
    public var surah: Int
    public var ayah: Int
    public var startWord: Int
    public var endAyah: Int
    public var endWord: Int
    public var startKey: String
    public var endKey: String
    public var page: Int
    public var hafsText: String
    public var readingText: String?
    public var uthmaniText: String?
    public var description: String?
    public var performanceNote: String?
    public var variantType: String?
    public var rulingText: String?
    public var options: [String]?
    public var notes: String?
    public var reviewStatus: ReviewStatus
    public var locationReviewStatus: ReviewStatus
    public var verificationStatus: String
    public var legacyRef: String?
    public var entryOrder: Int
    public var deleted: Bool
    public var appliesWasl: Bool
    public var appliesWaqf: Bool
    public var hamzahDetail: HamzahDetail?
    public var narrators: [ReviewNarrator]
    public var flags: [ReviewFlag]

    public init(entryId: String, locationId: String = "", version: String = "", kind: ReadingKind,
                categoryCode: String? = nil, categoryNameAr: String? = nil, surah: Int, ayah: Int, startWord: Int,
                endAyah: Int? = nil, endWord: Int? = nil, startKey: String = "", endKey: String = "", page: Int = 0,
                hafsText: String = "", readingText: String? = nil, uthmaniText: String? = nil,
                description: String? = nil, performanceNote: String? = nil, variantType: String? = nil,
                rulingText: String? = nil, options: [String]? = nil, notes: String? = nil,
                reviewStatus: ReviewStatus = .unreviewed, locationReviewStatus: ReviewStatus = .unreviewed,
                verificationStatus: String = "", legacyRef: String? = nil, entryOrder: Int = 0, deleted: Bool = false,
                appliesWasl: Bool = true, appliesWaqf: Bool = true, hamzahDetail: HamzahDetail? = nil,
                narrators: [ReviewNarrator] = [], flags: [ReviewFlag] = []) {
        self.entryId = entryId; self.locationId = locationId; self.version = version; self.kind = kind
        self.categoryCode = categoryCode; self.categoryNameAr = categoryNameAr
        self.surah = surah; self.ayah = ayah; self.startWord = startWord
        self.endAyah = endAyah ?? ayah; self.endWord = endWord ?? startWord
        self.startKey = startKey; self.endKey = endKey; self.page = page; self.hafsText = hafsText
        self.readingText = readingText; self.uthmaniText = uthmaniText; self.description = description
        self.performanceNote = performanceNote; self.variantType = variantType; self.rulingText = rulingText
        self.options = options; self.notes = notes; self.reviewStatus = reviewStatus
        self.locationReviewStatus = locationReviewStatus; self.verificationStatus = verificationStatus
        self.legacyRef = legacyRef; self.entryOrder = entryOrder; self.deleted = deleted
        self.appliesWasl = appliesWasl; self.appliesWaqf = appliesWaqf; self.hamzahDetail = hamzahDetail
        self.narrators = narrators; self.flags = flags
    }

    public var isActive: Bool { !deleted }

    /// True when `word` of `ayah` lies inside the span this entry covers (one word, two words, or
    /// words running from one ayah into the next).
    public func spansWord(surah: Int, ayah: Int, word: Int) -> Bool {
        guard surah == self.surah else { return false }
        let here = (ayah, word)
        let start = (self.ayah, startWord)
        let end = (endAyah, endWord)
        return !(here < start) && !(end < here)
    }

    enum CodingKeys: String, CodingKey {
        case entryId, locationId, version, kind, categoryCode, categoryNameAr, surah, ayah, startWord, endAyah,
             endWord, startKey, endKey, page, hafsText, readingText, uthmaniText, description, performanceNote,
             variantType, rulingText, options, notes, reviewStatus, locationReviewStatus, verificationStatus,
             legacyRef, entryOrder, deleted, appliesWasl, appliesWaqf, hamzahDetail, narrators, flags
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        entryId = try c.decode(String.self, forKey: .entryId)
        locationId = try c.decodeIfPresent(String.self, forKey: .locationId) ?? ""
        version = try c.decode(String.self, forKey: .version)
        kind = try c.decode(ReadingKind.self, forKey: .kind)
        categoryCode = try c.decodeIfPresent(String.self, forKey: .categoryCode)
        categoryNameAr = try c.decodeIfPresent(String.self, forKey: .categoryNameAr)
        surah = try c.decode(Int.self, forKey: .surah)
        ayah = try c.decode(Int.self, forKey: .ayah)
        startWord = try c.decode(Int.self, forKey: .startWord)
        endAyah = try c.decodeIfPresent(Int.self, forKey: .endAyah) ?? ayah
        endWord = try c.decodeIfPresent(Int.self, forKey: .endWord) ?? startWord
        startKey = try c.decodeIfPresent(String.self, forKey: .startKey) ?? ""
        endKey = try c.decodeIfPresent(String.self, forKey: .endKey) ?? ""
        page = try c.decodeIfPresent(Int.self, forKey: .page) ?? 0
        hafsText = try c.decodeIfPresent(String.self, forKey: .hafsText) ?? ""
        readingText = try c.decodeIfPresent(String.self, forKey: .readingText)
        uthmaniText = try c.decodeIfPresent(String.self, forKey: .uthmaniText)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        performanceNote = try c.decodeIfPresent(String.self, forKey: .performanceNote)
        variantType = try c.decodeIfPresent(String.self, forKey: .variantType)
        rulingText = try c.decodeIfPresent(String.self, forKey: .rulingText)
        options = try c.decodeIfPresent([String].self, forKey: .options)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        reviewStatus = try c.decodeIfPresent(ReviewStatus.self, forKey: .reviewStatus) ?? .unreviewed
        locationReviewStatus = try c.decodeIfPresent(ReviewStatus.self, forKey: .locationReviewStatus) ?? reviewStatus
        verificationStatus = try c.decodeIfPresent(String.self, forKey: .verificationStatus) ?? ""
        legacyRef = try c.decodeIfPresent(String.self, forKey: .legacyRef)
        entryOrder = try c.decodeIfPresent(Int.self, forKey: .entryOrder) ?? 0
        deleted = try c.decodeIfPresent(Bool.self, forKey: .deleted) ?? false
        appliesWasl = try c.decodeIfPresent(Bool.self, forKey: .appliesWasl) ?? true
        appliesWaqf = try c.decodeIfPresent(Bool.self, forKey: .appliesWaqf) ?? true
        hamzahDetail = try c.decodeIfPresent(HamzahDetail.self, forKey: .hamzahDetail)
        narrators = try c.decodeIfPresent([ReviewNarrator].self, forKey: .narrators) ?? []
        flags = try c.decodeIfPresent([ReviewFlag].self, forKey: .flags) ?? []
    }
}

private func < (lhs: (Int, Int), rhs: (Int, Int)) -> Bool {
    lhs.0 != rhs.0 ? lhs.0 < rhs.0 : lhs.1 < rhs.1
}

public struct CatalogNarrator: Codable, Hashable, Sendable, Identifiable {
    public enum Kind: String, Codable, Sendable, Hashable { case reader, narrator, route, other }
    public let id: String
    public let code: String?
    public let nameAr: String
    public let parentId: String?
    public let type: Kind
    public let color: String?

    enum CodingKeys: String, CodingKey { case id, code, nameAr, parentId, type, color }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        code = try c.decodeIfPresent(String.self, forKey: .code)
        nameAr = try c.decodeIfPresent(String.self, forKey: .nameAr) ?? id
        parentId = try c.decodeIfPresent(String.self, forKey: .parentId)
        type = (try? c.decode(Kind.self, forKey: .type)) ?? .other
        color = try c.decodeIfPresent(String.self, forKey: .color)
    }
}

public struct ReviewCategory: Codable, Hashable, Sendable, Identifiable {
    public var id: String { code }
    public let code: String
    public let nameAr: String
}

public struct PageStats: Codable, Hashable, Sendable {
    public let total: Int
    public let unreviewed: Int
    public let reviewed: Int
    public let flagged: Int
    public let deleted: Int

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        total = try c.decodeIfPresent(Int.self, forKey: .total) ?? 0
        unreviewed = try c.decodeIfPresent(Int.self, forKey: .unreviewed) ?? 0
        reviewed = try c.decodeIfPresent(Int.self, forKey: .reviewed) ?? 0
        flagged = try c.decodeIfPresent(Int.self, forKey: .flagged) ?? 0
        deleted = try c.decodeIfPresent(Int.self, forKey: .deleted) ?? 0
    }

    enum CodingKeys: String, CodingKey { case total, unreviewed, reviewed, flagged, deleted }

    public init(total: Int, unreviewed: Int, reviewed: Int, flagged: Int, deleted: Int) {
        self.total = total; self.unreviewed = unreviewed; self.reviewed = reviewed
        self.flagged = flagged; self.deleted = deleted
    }
}

public struct ReviewPage: Codable, Hashable, Sendable {
    public var page: Int
    public var words: [ReviewWord]
    public var rows: [ReviewRow]
    public var stats: PageStats
    public var narrators: [CatalogNarrator]
    public var categories: [ReviewCategory]
    public var variantTypes: [String]
}

public struct PageProgress: Codable, Hashable, Sendable {
    public let page: Int
    public let total: Int
    public let unreviewed: Int
    public let reviewed: Int
    public let flagged: Int

    public init(page: Int, total: Int, unreviewed: Int, reviewed: Int, flagged: Int) {
        self.page = page; self.total = total; self.unreviewed = unreviewed
        self.reviewed = reviewed; self.flagged = flagged
    }
}

public struct ReviewOverview: Codable, Hashable, Sendable {
    public let isEditor: Bool
    public let pages: [PageProgress]

    public init(isEditor: Bool, pages: [PageProgress]) { self.isEditor = isEditor; self.pages = pages }
}

public struct HistoryChange: Codable, Hashable, Sendable {
    public let table: String
    public let rowId: String
    public let op: String
    public let field: String?
    public let old: JSONValue
    public let new: JSONValue

    enum CodingKeys: String, CodingKey { case table, rowId, op, field, old, new }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        table = try c.decode(String.self, forKey: .table)
        rowId = try c.decodeIfPresent(String.self, forKey: .rowId) ?? ""
        op = try c.decodeIfPresent(String.self, forKey: .op) ?? ""
        field = try c.decodeIfPresent(String.self, forKey: .field)
        old = try c.decodeIfPresent(JSONValue.self, forKey: .old) ?? .null
        new = try c.decodeIfPresent(JSONValue.self, forKey: .new) ?? .null
    }
}

public struct HistoryTransaction: Codable, Hashable, Sendable, Identifiable {
    public var id: Int { txid }
    public let txid: Int
    public let at: String
    public let deviceId: String?
    public let undone: Bool
    public let entryId: String?
    public let changes: [HistoryChange]
}

public struct NarratorInput: Codable, Hashable, Sendable {
    public var id: String
    public var action: String?
    public var wajhOrder: Int?
    public var wajhNote: String?

    public init(id: String, action: String? = nil, wajhOrder: Int? = nil, wajhNote: String? = nil) {
        self.id = id; self.action = action; self.wajhOrder = wajhOrder; self.wajhNote = wajhNote
    }
}

public struct CreateEntryInput: Codable, Hashable, Sendable {
    public var surah: Int
    public var ayah: Int
    public var startWord: Int
    public var endAyah: Int?
    public var endWord: Int?
    public var kind: ReadingKind
    public var readingText: String?
    public var uthmaniText: String?
    public var description: String?
    public var performanceNote: String?
    public var variantType: String?
    public var categoryCode: String?
    public var rulingText: String?
    public var notes: String?
    public var narrators: [NarratorInput]
    public var appliesWasl: Bool?
    public var appliesWaqf: Bool?
    public var hamzahDetail: HamzahDetail?

    public init(surah: Int, ayah: Int, startWord: Int, endAyah: Int? = nil, endWord: Int? = nil,
                kind: ReadingKind, readingText: String? = nil, uthmaniText: String? = nil,
                description: String? = nil, performanceNote: String? = nil, variantType: String? = nil,
                categoryCode: String? = nil, rulingText: String? = nil, notes: String? = nil,
                narrators: [NarratorInput], appliesWasl: Bool? = nil, appliesWaqf: Bool? = nil,
                hamzahDetail: HamzahDetail? = nil) {
        self.surah = surah; self.ayah = ayah; self.startWord = startWord
        self.endAyah = endAyah; self.endWord = endWord; self.kind = kind
        self.readingText = readingText; self.uthmaniText = uthmaniText
        self.description = description; self.performanceNote = performanceNote
        self.variantType = variantType; self.categoryCode = categoryCode
        self.rulingText = rulingText; self.notes = notes; self.narrators = narrators
        self.appliesWasl = appliesWasl; self.appliesWaqf = appliesWaqf; self.hamzahDetail = hamzahDetail
    }
}

/// A partial update of an entry: only the fields that were set are sent, and `.set(nil)` sends `null`.
public struct EntryFields: Encodable, Hashable, Sendable {
    public var kind: Patch<ReadingKind> = .unset
    public var notes: Patch<String> = .unset
    public var readingText: Patch<String> = .unset
    public var uthmaniText: Patch<String> = .unset
    public var description: Patch<String> = .unset
    public var performanceNote: Patch<String> = .unset
    public var variantType: Patch<String> = .unset
    public var categoryCode: Patch<String> = .unset
    public var rulingText: Patch<String> = .unset
    public var appliesWasl: Patch<Bool> = .unset
    public var appliesWaqf: Patch<Bool> = .unset
    public var hamzahDetail: Patch<HamzahDetail> = .unset

    public init() {}

    public var isEmpty: Bool {
        !(kind.isSet || notes.isSet || readingText.isSet || uthmaniText.isSet || description.isSet
            || performanceNote.isSet || variantType.isSet || categoryCode.isSet || rulingText.isSet
            || appliesWasl.isSet || appliesWaqf.isSet || hamzahDetail.isSet)
    }

    enum CodingKeys: String, CodingKey {
        case kind, notes, readingText, uthmaniText, description, performanceNote, variantType, categoryCode,
             rulingText, appliesWasl, appliesWaqf, hamzahDetail
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        func put<T: Encodable & Hashable & Sendable>(_ patch: Patch<T>, _ key: CodingKeys) throws {
            guard case .set(let value) = patch else { return }
            if let value { try c.encode(value, forKey: key) } else { try c.encodeNil(forKey: key) }
        }
        try put(kind, .kind)
        try put(notes, .notes)
        try put(readingText, .readingText)
        try put(uthmaniText, .uthmaniText)
        try put(description, .description)
        try put(performanceNote, .performanceNote)
        try put(variantType, .variantType)
        try put(categoryCode, .categoryCode)
        try put(rulingText, .rulingText)
        try put(appliesWasl, .appliesWasl)
        try put(appliesWaqf, .appliesWaqf)
        try put(hamzahDetail, .hamzahDetail)
    }
}

/// One learned suggestion built from approved entries only (`qiraat_review_suggestions`).
public struct ReviewSuggestion: Codable, Hashable, Sendable, Identifiable {
    public enum Tier: String, Codable, Sendable, Hashable { case exact, pattern }

    public struct Narrator: Codable, Hashable, Sendable {
        public let id: String
        public let nameAr: String
        public let action: String?
        public let wajhOrder: Int?
        public let wajhNote: String?
    }

    public struct Config: Codable, Hashable, Sendable {
        public let kind: ReadingKind
        public let categoryCode: String?
        public let categoryNameAr: String?
        public let variantType: String?
        public let rulingText: String?
        public let description: String?
        public let performanceNote: String?
        public let readingText: String?
        public let uthmaniText: String?
        public let appliesWasl: Bool?
        public let appliesWaqf: Bool?
        public let hamzahDetail: HamzahDetail?
        public let narrators: [Narrator]
    }

    public var id: String { key }
    public let key: String
    public let tier: Tier
    public let support: Int
    public let shapeTotal: Int?
    public let shape: String?
    public let sourceEntryId: String
    public let sources: [String]
    public let config: Config
}

public struct OccurrenceCandidate: Codable, Hashable, Sendable, Identifiable {
    public enum Status: String, Codable, Sendable, Hashable { case exists, add }
    public var id: String { canonicalKey }
    public let surah: Int
    public let ayah: Int
    public let word: Int
    public let page: Int
    public let canonicalKey: String
    public let text: String
    public let status: Status
    public let existingEntryId: String?
}

public struct BulkApplyResult: Codable, Hashable, Sendable {
    public struct Added: Codable, Hashable, Sendable { public let entryId: String; public let surah: Int; public let ayah: Int; public let word: Int }
    public struct Skipped: Codable, Hashable, Sendable { public let surah: Int; public let ayah: Int; public let word: Int; public let existingEntryId: String }
    public struct Failure: Codable, Hashable, Sendable { public let surah: Int; public let ayah: Int; public let word: Int; public let message: String }
    public let sourceEntryId: String
    public let added: [Added]
    public let skipped: [Skipped]
    public let errors: [Failure]
}
