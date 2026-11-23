import SQLite3
import XCTest
@testable import Mutshabehat

/// Runs one SQL batch on a second connection to the file (to set up states the app itself cannot produce).
private func rawExec(_ url: URL, _ sql: String, file: StaticString = #filePath, line: UInt = #line) {
    var handle: OpaquePointer?
    XCTAssertEqual(sqlite3_open(url.path, &handle), SQLITE_OK, file: file, line: line)
    XCTAssertEqual(sqlite3_exec(handle, sql, nil, nil, nil), SQLITE_OK, file: file, line: line)
    sqlite3_close(handle)
}

private func temporaryURL(_ name: String = "sync_fixes") -> URL {
    URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("\(name)_\(UUID().uuidString).sqlite")
}

private func removeFiles(_ urls: URL...) {
    for url in urls {
        for suffix in ["", "-wal", "-shm"] { try? FileManager.default.removeItem(atPath: url.path + suffix) }
    }
}

private func makeGroup(title: String) -> PersonalGroup {
    let groupId = UUID().uuidString
    let part = PersonalPart(id: UUID().uuidString, type: "normal", text: title, sortOrder: 0)
    let verse = PersonalVerse(id: UUID().uuidString, groupId: groupId, surah: "الكهف", ayah: 1, parts: [part])
    return PersonalGroup(id: groupId, title: title, color: "#6366F1", verses: [verse])
}

final class MutshabehatSyncFixesTests: XCTestCase {

    func testGroupDeletedLocallyDoesNotComeBackFromAMerge() throws {
        let localURL = temporaryURL(), sourceURL = temporaryURL()
        defer { removeFiles(localURL, sourceURL) }
        let group = makeGroup(title: "محذوفة")
        do {
            let source = MutshabehatDatabase(url: sourceURL)
            XCTAssertTrue(source.savePersonalGroup(group))
        }
        let local = MutshabehatDatabase(url: localURL)
        try local.mergeDatabase(from: sourceURL)
        XCTAssertNotNil(local.fetchPersonalGroup(id: group.id))

        XCTAssertTrue(local.deletePersonalGroup(groupId: group.id))
        try local.mergeDatabase(from: sourceURL)
        XCTAssertNil(local.fetchPersonalGroup(id: group.id))
    }

    func testMergeFromAnOlderFileWithoutDeletionTableStillWorks() throws {
        let localURL = temporaryURL(), sourceURL = temporaryURL()
        defer { removeFiles(localURL, sourceURL) }
        let group = makeGroup(title: "من ملف قديم")
        do {
            let source = MutshabehatDatabase(url: sourceURL)
            XCTAssertTrue(source.savePersonalGroup(group))
        }
        rawExec(sourceURL, "DROP TABLE group_deletions;")
        let local = MutshabehatDatabase(url: localURL)
        try local.mergeDatabase(from: sourceURL)
        XCTAssertEqual(local.fetchPersonalGroup(id: group.id)?.title, "من ملف قديم")
    }

    func testLocalFavoriteSurvivesAMergeWithAnOlderRemoteCopy() throws {
        let localURL = temporaryURL(), sourceURL = temporaryURL()
        defer { removeFiles(localURL, sourceURL) }
        let group = makeGroup(title: "مفضلة")
        do {
            let source = MutshabehatDatabase(url: sourceURL)
            XCTAssertTrue(source.savePersonalGroup(group))
        }
        rawExec(sourceURL, "UPDATE groups SET updated_at = '2021-01-01T00:00:00Z', favorite = 0;")

        let local = MutshabehatDatabase(url: localURL)
        XCTAssertTrue(local.savePersonalGroup(group))
        rawExec(localURL, "UPDATE groups SET updated_at = '2020-01-01T00:00:00Z';")

        XCTAssertTrue(local.toggleFavorite(groupId: group.id))
        XCTAssertNotEqual(local.fetchPersonalGroup(id: group.id)?.updatedAt, "2020-01-01T00:00:00Z")

        try local.mergeDatabase(from: sourceURL)
        XCTAssertEqual(local.fetchPersonalGroup(id: group.id)?.favorite, true)
    }

    func testFailedAutomatedCopyLeavesNoPartialGroupAndNoCopiedFlag() throws {
        let url = temporaryURL()
        defer { removeFiles(url) }
        let db = MutshabehatDatabase(url: url)
        let json = #"[{"id":1,"title":"مرشح","verses":[{"surah":"الكهف","ayah":1,"parts":[{"type":"normal","text":"أ"}]}]}]"#
        XCTAssertEqual(try db.importAutomatedJSON(data: Data(json.utf8)), 1)

        rawExec(url, "CREATE TRIGGER fail_parts BEFORE INSERT ON parts BEGIN SELECT RAISE(ABORT, 'boom'); END;")
        XCTAssertFalse(db.copyAutomatedToPersonal(automatedId: 1))
        XCTAssertTrue(db.fetchPersonalGroups().isEmpty)
        XCTAssertEqual(db.fetchAutomatedGroups().first?.copied, false)

        rawExec(url, "DROP TRIGGER fail_parts;")
        XCTAssertTrue(db.copyAutomatedToPersonal(automatedId: 1))
        let copied = db.fetchPersonalGroups()
        XCTAssertEqual(copied.count, 1)
        XCTAssertEqual(copied.first?.verses.first?.parts.count, 1)
        XCTAssertEqual(db.fetchAutomatedGroups().first?.copied, true)
    }
}

@MainActor
final class QiraatNotesSkippedRowTests: XCTestCase {

    func testOneInvalidRowIsSkippedAndTheOtherNotesStayUsable() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("notes-skip-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("notes.sqlite")

        var first: QiraatNotesStore? = QiraatNotesStore(url: url)
        try first?.setNote("Test fixture: valid", page: 1, surah: 1, ayah: 1, token: 1)
        first = nil

        // id is not a UUID: passes the table's CHECKs, fails the store's validation.
        rawExec(url, "INSERT INTO qiraat_notes VALUES ('not-a-uuid', 1, 2, 1, 1, 0, 'bad', 1000, 1000);")

        let store = QiraatNotesStore(url: url)
        XCTAssertNil(store.loadError)
        XCTAssertEqual(store.notes.map(\.note), ["Test fixture: valid"])
        XCTAssertEqual(store.skippedRowCount, 1)

        try store.setNote("Test fixture: second", page: 1, surah: 1, ayah: 3, token: 1)
        XCTAssertEqual(store.notes.count, 2)

        // Writing on the unreadable row's word replaces it instead of keeping its bad id.
        try store.setNote("Test fixture: over the bad row", page: 1, surah: 1, ayah: 2, token: 1)
        XCTAssertEqual(store.notes.count, 3)
        XCTAssertEqual(store.skippedRowCount, 0)
    }
}
