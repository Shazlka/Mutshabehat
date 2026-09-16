import Foundation

public enum GroupStatus: String, Codable, Sendable {
    case draft
    case published
    case locked
}

public enum PartType: String, Codable, Sendable {
    case shared
    case diff
    case diff2
    case diff3
    case addition
    case unique
    case normal
}

public enum AnnotationType: String, Codable, Sendable {
    case note
    case highlight
    case bookmark
    case favorite
}

public enum AnnotationTarget: String, Codable, Sendable {
    case ayah
    case word
    case wordRange = "word-range"
}

public struct AyahKey: Hashable, Sendable {
    public let rawValue: String

    public init?(_ rawValue: String) {
        let components = rawValue.split(separator: ":", omittingEmptySubsequences: false)
        guard components.count == 2,
              !components[0].isEmpty,
              !components[1].isEmpty,
              components.allSatisfy({ component in
                  component.unicodeScalars.allSatisfy { (0x0030...0x0039).contains($0.value) }
              }) else {
            return nil
        }
        self.rawValue = rawValue
    }
}

public struct PageNumber: Hashable, Sendable {
    public let rawValue: Int

    public init?(_ rawValue: Int) {
        guard (1...604).contains(rawValue) else { return nil }
        self.rawValue = rawValue
    }
}

public struct Group: Sendable {
    public let id: UUID
    public let userID: UUID
    public let title: String
    public let color: String
    public let note: String?
    public let unote: String?
    public let status: GroupStatus
    public let favorite: Bool
    public let completed: Bool
    public let createdAt: Date
    public let updatedAt: Date
    public let sourceAutomatedID: Int64?

    public init(
        id: UUID,
        userID: UUID,
        title: String,
        color: String,
        note: String?,
        unote: String?,
        status: GroupStatus,
        favorite: Bool,
        completed: Bool,
        createdAt: Date,
        updatedAt: Date,
        sourceAutomatedID: Int64?
    ) {
        self.id = id
        self.userID = userID
        self.title = title
        self.color = color
        self.note = note
        self.unote = unote
        self.status = status
        self.favorite = favorite
        self.completed = completed
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.sourceAutomatedID = sourceAutomatedID
    }
}

public struct Verse: Sendable {
    public let id: UUID
    public let groupID: UUID
    public let surah: String
    public let ayah: Int
    public let label: String?
    public let sortOrder: Int

    public init(
        id: UUID,
        groupID: UUID,
        surah: String,
        ayah: Int,
        label: String?,
        sortOrder: Int
    ) {
        self.id = id
        self.groupID = groupID
        self.surah = surah
        self.ayah = ayah
        self.label = label
        self.sortOrder = sortOrder
    }
}

public struct Part: Sendable {
    public let id: UUID
    public let verseID: UUID
    public let type: PartType
    public let text: String
    public let sortOrder: Int

    public init(id: UUID, verseID: UUID, type: PartType, text: String, sortOrder: Int) {
        self.id = id
        self.verseID = verseID
        self.type = type
        self.text = text
        self.sortOrder = sortOrder
    }
}

public struct Annotation: Sendable {
    public let id: UUID
    public let userID: UUID
    public let annotationType: AnnotationType
    public let targetType: AnnotationTarget
    public let ayahKey: AyahKey
    public let pageNumber: PageNumber
    public let wordID: String?
    public let lineNumber: Int?
    public let wordIndexInLine: Int?
    public let wordRangeStartID: String?
    public let wordRangeEndID: String?
    public let title: String?
    public let body: String?
    public let textColor: String?
    public let backgroundColor: String?
    public let tags: [String]
    public let metadata: Data
    public let createdAt: Date
    public let updatedAt: Date

    public init(
        id: UUID,
        userID: UUID,
        annotationType: AnnotationType,
        targetType: AnnotationTarget,
        ayahKey: AyahKey,
        pageNumber: PageNumber,
        wordID: String?,
        lineNumber: Int?,
        wordIndexInLine: Int?,
        wordRangeStartID: String?,
        wordRangeEndID: String?,
        title: String?,
        body: String?,
        textColor: String?,
        backgroundColor: String?,
        tags: [String],
        metadata: Data,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.id = id
        self.userID = userID
        self.annotationType = annotationType
        self.targetType = targetType
        self.ayahKey = ayahKey
        self.pageNumber = pageNumber
        self.wordID = wordID
        self.lineNumber = lineNumber
        self.wordIndexInLine = wordIndexInLine
        self.wordRangeStartID = wordRangeStartID
        self.wordRangeEndID = wordRangeEndID
        self.title = title
        self.body = body
        self.textColor = textColor
        self.backgroundColor = backgroundColor
        self.tags = tags
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
