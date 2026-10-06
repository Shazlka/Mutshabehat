import Foundation

/// How well one ayah is memorized (Hafs only). Raw values are persisted and must never change.
public enum MemorizationStatus: Int, Codable, CaseIterable, Sendable {
    case mastered = 1
    case memorizedWithErrors = 2
    case needsMushaf = 3
    case notMemorized = 4
}

/// The result of the last review of an ayah. Raw values are persisted and must never change.
public enum ReviewStrength: Int, Codable, CaseIterable, Sendable {
    case strong = 1
    case good = 2
    case needsReview = 3
    case weak = 4
    case notReviewed = 5
}

/// What the person reports after reciting an ayah or a range from memory.
public enum ReviewResult: Int, Codable, CaseIterable, Sendable {
    case excellent = 1
    case good = 2
    case mistakes = 3
    case forgot = 4
}

/// One ayah's memorization state. An ayah with no stored record is `blank`.
public struct AyahMemorizationRecord: Codable, Equatable, Sendable {
    public var surah: Int
    public var ayah: Int
    public var status: MemorizationStatus
    public var reviewStrength: ReviewStrength
    public var isCurrentlyLearning: Bool
    public var firstMemorizedAt: Date?
    public var lastStatusChangedAt: Date?
    public var lastReviewedAt: Date?
    public var nextReviewAt: Date?
    public var reviewCount: Int
    public var successfulReviewCount: Int
    public var consecutiveSuccessfulReviews: Int
    public var errorCount: Int
    public var updatedAt: Date

    public init(surah: Int, ayah: Int, status: MemorizationStatus, reviewStrength: ReviewStrength,
                isCurrentlyLearning: Bool, firstMemorizedAt: Date? = nil, lastStatusChangedAt: Date? = nil,
                lastReviewedAt: Date? = nil, nextReviewAt: Date? = nil, reviewCount: Int = 0,
                successfulReviewCount: Int = 0, consecutiveSuccessfulReviews: Int = 0, errorCount: Int = 0,
                updatedAt: Date) {
        self.surah = surah
        self.ayah = ayah
        self.status = status
        self.reviewStrength = reviewStrength
        self.isCurrentlyLearning = isCurrentlyLearning
        self.firstMemorizedAt = firstMemorizedAt
        self.lastStatusChangedAt = lastStatusChangedAt
        self.lastReviewedAt = lastReviewedAt
        self.nextReviewAt = nextReviewAt
        self.reviewCount = reviewCount
        self.successfulReviewCount = successfulReviewCount
        self.consecutiveSuccessfulReviews = consecutiveSuccessfulReviews
        self.errorCount = errorCount
        self.updatedAt = updatedAt
    }

    public var key: AyahKey { AyahKey(surah: surah, ayah: ayah) }

    /// The state of an ayah that has never been touched.
    public static func blank(_ key: AyahKey, now: Date) -> AyahMemorizationRecord {
        AyahMemorizationRecord(surah: key.surah, ayah: key.ayah, status: .notMemorized,
                               reviewStrength: .notReviewed, isCurrentlyLearning: false, updatedAt: now)
    }
}

public enum BatchKind: String, Codable, Sendable {
    case update, review, undo, `import`
}

/// One user action (an update, a review, an undo or an import) that changed one or more ayat.
public struct BatchRecord: Codable, Equatable, Sendable {
    public var id: UUID
    public var createdAt: Date
    public var kind: BatchKind
    public var label: String
    public var scopeJSON: String
    public var ayahCount: Int
    public var deviceID: String
    public var countsForStreak: Bool
    public var gainAyahs: Int
    public var undoneAt: Date?
    public var undoesBatchID: UUID?

    public init(id: UUID, createdAt: Date, kind: BatchKind, label: String, scopeJSON: String, ayahCount: Int,
                deviceID: String, countsForStreak: Bool, gainAyahs: Int, undoneAt: Date?, undoesBatchID: UUID?) {
        self.id = id
        self.createdAt = createdAt
        self.kind = kind
        self.label = label
        self.scopeJSON = scopeJSON
        self.ayahCount = ayahCount
        self.deviceID = deviceID
        self.countsForStreak = countsForStreak
        self.gainAyahs = gainAyahs
        self.undoneAt = undoneAt
        self.undoesBatchID = undoesBatchID
    }
}

/// One ayah changed by one batch, with the full row before (nil when it had none) and after.
public struct ChangeEvent: Codable, Equatable, Sendable {
    public var batchID: UUID
    public var surah: Int
    public var ayah: Int
    public var at: Date
    public var before: AyahMemorizationRecord?
    public var after: AyahMemorizationRecord

    public init(batchID: UUID, surah: Int, ayah: Int, at: Date, before: AyahMemorizationRecord?,
                after: AyahMemorizationRecord) {
        self.batchID = batchID
        self.surah = surah
        self.ayah = ayah
        self.at = at
        self.before = before
        self.after = after
    }

    public var key: AyahKey { AyahKey(surah: surah, ayah: ayah) }
}
