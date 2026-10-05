import Foundation
import SwiftUI

public struct PersonalPart: Identifiable, Hashable, Equatable, Sendable {
    public var id: String
    public var type: String  // "shared", "diff", "diff2", "diff3", "addition", "unique", "normal"
    public var text: String
    public var sortOrder: Int

    public init(id: String = UUID().uuidString, type: String = "normal", text: String = "", sortOrder: Int = 0) {
        self.id = id
        self.type = type
        self.text = text
        self.sortOrder = sortOrder
    }
}

public struct PersonalVerse: Identifiable, Hashable, Equatable, Sendable {
    public var id: String
    public var groupId: String
    public var surah: String
    public var ayah: Int
    public var label: String?
    public var sortOrder: Int
    public var parts: [PersonalPart]

    public init(id: String = UUID().uuidString, groupId: String = "", surah: String = "", ayah: Int = 1, label: String? = nil, sortOrder: Int = 0, parts: [PersonalPart] = []) {
        self.id = id
        self.groupId = groupId
        self.surah = surah
        self.ayah = ayah
        self.label = label
        self.sortOrder = sortOrder
        self.parts = parts
    }
}

public struct PersonalGroup: Identifiable, Hashable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var color: String
    public var status: String
    public var favorite: Bool
    public var completed: Bool
    public var note: String?
    public var unote: String?
    public var createdAt: String?
    public var updatedAt: String?
    public var verses: [PersonalVerse]

    public init(id: String = UUID().uuidString, title: String = "", color: String = "#55b94f", status: String = "draft", favorite: Bool = false, completed: Bool = false,
                note: String? = nil, unote: String? = nil, createdAt: String? = nil, updatedAt: String? = nil, verses: [PersonalVerse] = []) {
        self.id = id
        self.title = title
        self.color = color
        self.status = status
        self.favorite = favorite
        self.completed = completed
        self.note = note
        self.unote = unote
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.verses = verses
    }
}

public struct AutomatedVerse: Sendable, Hashable, Equatable {
    public let surah: String
    public let ayah: Int
    public let label: String?
    public let parts: [PersonalPart]

    public init(surah: String, ayah: Int, label: String?, parts: [PersonalPart]) {
        self.surah = surah
        self.ayah = ayah
        self.label = label
        self.parts = parts
    }
}

public struct AutomatedGroup: Identifiable, Sendable, Hashable, Equatable {
    public let id: Int
    public let legacyId: String?
    public let title: String
    public let color: String
    public let surahs: [String]
    public var copied: Bool
    public let verses: [AutomatedVerse]

    public init(id: Int, legacyId: String?, title: String, color: String, surahs: [String], copied: Bool, verses: [AutomatedVerse]) {
        self.id = id
        self.legacyId = legacyId
        self.title = title
        self.color = color
        self.surahs = surahs
        self.copied = copied
        self.verses = verses
    }
}
