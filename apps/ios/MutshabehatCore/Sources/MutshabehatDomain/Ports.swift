import Foundation

public protocol GroupRepository: Sendable {
    func allGroups() throws -> [Group]
    func group(id: UUID) throws -> Group?
    func verses(inGroup: UUID) throws -> [Verse]
    func parts(inVerse: UUID) throws -> [Part]
    func search(_ query: String) throws -> [Group]
    func upsert(_ group: Group, verses: [Verse], parts: [Part]) throws
    func delete(groupID: UUID) throws
}

public protocol AnnotationRepository: Sendable {
    func annotations(page: PageNumber) throws -> [Annotation]
    func annotations(ayah: AyahKey) throws -> [Annotation]
    func upsert(_ annotation: Annotation) throws
    func delete(id: UUID) throws
}
