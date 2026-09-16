import Foundation
import MutshabehatDomain
import MutshabehatPersistence
import Testing

private let groupID = UUID(uuidString: "10000000-0000-0000-0000-000000000001")!
private let userID = UUID(uuidString: "20000000-0000-0000-0000-000000000002")!
private let verseOneID = UUID(uuidString: "30000000-0000-0000-0000-000000000003")!
private let verseTwoID = UUID(uuidString: "40000000-0000-0000-0000-000000000004")!
private let partOneID = UUID(uuidString: "50000000-0000-0000-0000-000000000005")!
private let partTwoID = UUID(uuidString: "60000000-0000-0000-0000-000000000006")!
private let createdAt = Date(timeIntervalSince1970: 1_700_000_000.123)
private let updatedAt = Date(timeIntervalSince1970: 1_700_000_100.456)

private func makeAggregate(partText: String = "السماوات") -> (Group, [Verse], [Part]) {
    let group = Group(
        id: groupID,
        userID: userID,
        title: "مواضع السماوات",
        color: "#123456",
        note: nil,
        unote: "ملاحظة",
        status: .published,
        favorite: true,
        completed: false,
        createdAt: createdAt,
        updatedAt: updatedAt,
        sourceAutomatedID: 42
    )
    let verses = [
        Verse(id: verseOneID, groupID: groupID, surah: "البقرة", ayah: 29, label: nil, sortOrder: 0),
        Verse(id: verseTwoID, groupID: groupID, surah: "آل عمران", ayah: 83, label: "الثاني", sortOrder: 1),
    ]
    let parts = [
        Part(id: partOneID, verseID: verseOneID, type: .shared, text: partText, sortOrder: 0),
        Part(id: partTwoID, verseID: verseTwoID, type: .diff, text: "والأرض", sortOrder: 0),
    ]
    return (group, verses, parts)
}

private func expectSameGroup(_ actual: Group, _ expected: Group) {
    #expect(actual.id == expected.id)
    #expect(actual.userID == expected.userID)
    #expect(actual.title == expected.title)
    #expect(actual.color == expected.color)
    #expect(actual.note == expected.note)
    #expect(actual.unote == expected.unote)
    #expect(actual.status == expected.status)
    #expect(actual.favorite == expected.favorite)
    #expect(actual.completed == expected.completed)
    #expect(actual.createdAt == expected.createdAt)
    #expect(actual.updatedAt == expected.updatedAt)
    #expect(actual.sourceAutomatedID == expected.sourceAutomatedID)
}

@Suite("SQLite group repository")
struct GroupRepositoryTests {
    @Test("Group, verses, and parts round-trip through one aggregate upsert")
    func aggregateRoundTrip() throws {
        let database = try makeMigratedDatabase()
        let repository = SQLiteGroupRepository(database: database)
        let (group, verses, parts) = makeAggregate()
        try repository.upsert(group, verses: verses, parts: parts)

        let fetched = try repository.group(id: group.id)
        let stored = try #require(fetched)
        expectSameGroup(stored, group)
        #expect(try repository.allGroups().map(\.id) == [group.id])

        let storedVerses = try repository.verses(inGroup: group.id)
        #expect(storedVerses.count == 2)
        #expect(storedVerses[0].id == verses[0].id)
        #expect(storedVerses[0].label == nil)
        #expect(storedVerses[1].id == verses[1].id)
        #expect(storedVerses[1].label == "الثاني")

        let firstParts = try repository.parts(inVerse: verseOneID)
        let secondParts = try repository.parts(inVerse: verseTwoID)
        #expect(firstParts.count == 1)
        #expect(firstParts[0].id == parts[0].id)
        #expect(firstParts[0].type == parts[0].type)
        #expect(firstParts[0].text == parts[0].text)
        #expect(secondParts.count == 1)
        #expect(secondParts[0].id == parts[1].id)
    }

    @Test(
        "Search crosses plene and defective spellings",
        arguments: [
            (stored: "السموات", query: "السماوات"),
            (stored: "السماوات", query: "السموات"),
        ]
    )
    func searchCrossesSpellings(_ spelling: (stored: String, query: String)) throws {
        let database = try makeMigratedDatabase()
        let repository = SQLiteGroupRepository(database: database)
        let (group, verses, parts) = makeAggregate(partText: spelling.stored)
        try repository.upsert(group, verses: verses, parts: parts)
        #expect(try repository.search(spelling.query).map(\.id) == [group.id])
    }

    @Test("UUID text is lowercased on write and readable from lowercase input")
    func uuidStorageIsLowercase() throws {
        let database = try makeMigratedDatabase()
        let repository = SQLiteGroupRepository(database: database)
        let uppercase = "ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB"
        let lowercase = uppercase.lowercased()
        let uppercaseUUID = try #require(UUID(uuidString: uppercase))
        let lowercaseUUID = try #require(UUID(uuidString: lowercase))
        let group = Group(
            id: uppercaseUUID, userID: userID, title: "case", color: "#000000",
            note: nil, unote: nil, status: .draft, favorite: false, completed: false,
            createdAt: createdAt, updatedAt: updatedAt, sourceAutomatedID: nil
        )
        try repository.upsert(group, verses: [], parts: [])

        let statement = try database.prepare("SELECT id FROM groups")
        #expect(try statement.step())
        #expect(statement.string(at: 0) == lowercase)
        #expect(try repository.group(id: lowercaseUUID)?.id == uppercaseUUID)
    }

    @Test("Deleting through the repository also removes FTS rows")
    func deleteRemovesFTSRows() throws {
        let database = try makeMigratedDatabase()
        let repository = SQLiteGroupRepository(database: database)
        let (group, verses, parts) = makeAggregate()
        try repository.upsert(group, verses: verses, parts: parts)
        try repository.delete(groupID: group.id)
        #expect(try repository.group(id: group.id) == nil)
        #expect(try scalarInt(database, sql: "SELECT count(*) FROM parts_fts") == 0)
    }
}

@Suite("SQLite annotation repository")
struct AnnotationRepositoryTests {
    @Test("Annotation upsert, reads, and delete round-trip all columns")
    func annotationRoundTrip() throws {
        let database = try makeMigratedDatabase()
        let repository = SQLiteAnnotationRepository(database: database)
        let ayahKey = try #require(AyahKey("2:255"))
        let pageNumber = try #require(PageNumber(42))
        let annotation = Annotation(
            id: UUID(uuidString: "70000000-0000-0000-0000-000000000007")!,
            userID: userID,
            annotationType: .note,
            targetType: .ayah,
            ayahKey: ayahKey,
            pageNumber: pageNumber,
            wordID: nil,
            lineNumber: nil,
            wordIndexInLine: nil,
            wordRangeStartID: nil,
            wordRangeEndID: nil,
            title: "آية الكرسي",
            body: nil,
            textColor: "#111111",
            backgroundColor: nil,
            tags: ["حفظ", "مراجعة"],
            metadata: Data("{\"source\":\"test\"}".utf8),
            createdAt: createdAt,
            updatedAt: updatedAt
        )
        try repository.upsert(annotation)

        let byPage = try repository.annotations(page: pageNumber)
        let byAyah = try repository.annotations(ayah: ayahKey)
        #expect(byPage.count == 1)
        #expect(byAyah.map(\.id) == byPage.map(\.id))
        let stored = try #require(byPage.first)
        #expect(stored.id == annotation.id)
        #expect(stored.userID == annotation.userID)
        #expect(stored.annotationType == annotation.annotationType)
        #expect(stored.targetType == annotation.targetType)
        #expect(stored.ayahKey == annotation.ayahKey)
        #expect(stored.pageNumber == annotation.pageNumber)
        #expect(stored.wordID == nil)
        #expect(stored.title == annotation.title)
        #expect(stored.body == nil)
        #expect(stored.textColor == annotation.textColor)
        #expect(stored.backgroundColor == nil)
        #expect(stored.tags == annotation.tags)
        #expect(stored.metadata == annotation.metadata)
        #expect(stored.createdAt == annotation.createdAt)
        #expect(stored.updatedAt == annotation.updatedAt)

        try repository.delete(id: annotation.id)
        #expect(try repository.annotations(page: pageNumber).isEmpty)
    }
}
