import Foundation
import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

@MainActor
final class QiraatNotesTests: XCTestCase {
    private var directory: URL!
    private var store: QiraatNotesStore!

    override func setUp() async throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("notes-test-\(UUID())")
        store = QiraatNotesStore(url: directory.appendingPathComponent("notes.sqlite"))
        XCTAssertNil(store.loadError)
    }

    override func tearDown() async throws {
        store = nil
        try FileManager.default.removeItem(at: directory)
    }

    func testCRUDPreservesIdentityAndIndependentFieldsAfterReopen() throws {
        // Synthetic user-note fixture, not Quran or Qiraat content.
        try store.setNote("Test fixture: revisit this word", page: 1, surah: 1, ayah: 1, token: 1)
        let original = try XCTUnwrap(store.list().first)
        try store.setFavorite(true, page: 1, surah: 1, ayah: 1, token: 1)
        try store.setNote("Test fixture: revised", page: 1, surah: 1, ayah: 1, token: 1)
        let url = store.fileURL
        store = nil
        store = QiraatNotesStore(url: url)
        let saved = try XCTUnwrap(store.list().first)
        XCTAssertEqual(saved.id, original.id)
        XCTAssertEqual(saved.createdAt, original.createdAt)
        XCTAssertGreaterThanOrEqual(saved.updatedAt, original.updatedAt)
        XCTAssertTrue(saved.favorite)
        XCTAssertEqual(saved.note, "Test fixture: revised")
        XCTAssertEqual(try store.list().count, 1)
        try store.delete(id: saved.id)
        XCTAssertTrue(try store.list().isEmpty)
    }

    func testRemovingFavoriteKeepsNoteAndClearingLastFieldDeletesRow() throws {
        try store.setFavorite(true, page: 1, surah: 1, ayah: 1, token: 1)
        try store.setNote("Test fixture", page: 1, surah: 1, ayah: 1, token: 1)
        try store.setFavorite(false, page: 1, surah: 1, ayah: 1, token: 1)
        XCTAssertEqual(try store.list().first?.note, "Test fixture")
        try store.setNote("  \n ", page: 1, surah: 1, ayah: 1, token: 1)
        XCTAssertTrue(try store.list().isEmpty)
    }

    func testInvalidAnchorIsRejectedWithoutChangingNotes() throws {
        XCTAssertThrowsError(try store.setFavorite(true, page: 605, surah: 1, ayah: 1, token: 1))
        XCTAssertThrowsError(try store.setNote("Test fixture", page: 1, surah: 0, ayah: 1, token: 1))
        XCTAssertThrowsError(try store.setNote("Test fixture", page: 1, surah: 1, ayah: 0, token: 1))
        XCTAssertThrowsError(try store.setNote("Test fixture", page: 1, surah: 1, ayah: 1, token: 0))
        XCTAssertTrue(try store.list().isEmpty)
    }

    func testBackupWipeRestoreRoundTripVerifiesManifestAndSafetyCopy() async throws {
        try seedNotes()
        let expected = try store.list()
        let (backup, restore) = services()
        let result = try await backup.runBackup(reason: .manual)
        let snapshot = try XCTUnwrap(backup.listSnapshots().first)
        let manifestData = try Data(contentsOf: snapshot.url.appendingPathComponent("manifest.json"))
        let manifest = try BackupCoding.decoder().decode(BackupManifest.self, from: manifestData)
        let entry = try XCTUnwrap(manifest.files.first { $0.name == "qiraat-notes.sqlite" })
        XCTAssertTrue(result.files.contains(entry))
        XCTAssertEqual(entry.sha256, try BackupHash.sha256Hex(ofFileAt: snapshot.url.appendingPathComponent(entry.name)))
        XCTAssertTrue(try restore.preview(snapshot).stores.contains(.qiraatNotes))
        for note in expected { try store.delete(id: note.id) }
        XCTAssertTrue(try store.list().isEmpty)
        let report = try restore.restore(snapshot, stores: [.qiraatNotes], memorizationMode: .merge)
        XCTAssertEqual(report.restored, [.qiraatNotes])
        XCTAssertTrue(report.failed.isEmpty)
        XCTAssertEqual(try store.list(), expected)
        XCTAssertEqual(try QiraatNotesStore(url: store.fileURL).list(), expected)
        let safety = try XCTUnwrap(report.safetyCopy).appendingPathComponent("qiraat-notes.sqlite")
        XCTAssertTrue(SQLiteSnapshot.integrityCheck(at: safety))
        XCTAssertTrue(try QiraatNotesStore(url: safety).list().isEmpty)
    }

    func testTamperedNotesHashRefusesRestoreBeforeMutation() async throws {
        try seedNotes()
        let expected = try store.list()
        let (backup, restore) = services()
        _ = try await backup.runBackup(reason: .manual)
        let snapshot = try XCTUnwrap(backup.listSnapshots().first)
        let file = snapshot.url.appendingPathComponent("qiraat-notes.sqlite")
        var bytes = try Data(contentsOf: file)
        bytes[bytes.count - 1] ^= 0xFF
        try bytes.write(to: file)
        XCTAssertThrowsError(try restore.restore(snapshot, stores: [.qiraatNotes], memorizationMode: .replace)) {
            XCTAssertEqual($0 as? RestoreError, .hashMismatch("qiraat-notes.sqlite"))
        }
        XCTAssertEqual(try store.list(), expected)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent("safety").path))
    }

    func testForeignDatabaseImportIsRejectedWithoutMutation() throws {
        try seedNotes()
        let expected = try store.list()
        let foreign = directory.appendingPathComponent("foreign.sqlite")
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(foreign.path, &db), SQLITE_OK)
        XCTAssertEqual(sqlite3_exec(db, "CREATE TABLE unrelated (id INTEGER);", nil, nil, nil), SQLITE_OK)
        sqlite3_close(db)
        XCTAssertThrowsError(try store.importDatabase(Data(contentsOf: foreign)))
        XCTAssertEqual(try store.list(), expected)
    }

    func testClearingNotePreservesFavoriteAndListingUsesWordOrder() throws {
        // Synthetic user-note fixtures, deliberately inserted out of order.
        try store.setNote("Test fixture: second", page: 1, surah: 1, ayah: 1, token: 2)
        try store.setFavorite(true, page: 1, surah: 1, ayah: 1, token: 1)
        try store.setNote("Test fixture: first", page: 1, surah: 1, ayah: 1, token: 1)
        try store.setNote("", page: 1, surah: 1, ayah: 1, token: 1)
        XCTAssertEqual(try store.list().map(\.token), [1, 2])
        XCTAssertTrue(try XCTUnwrap(store.list().first).favorite)
        XCTAssertEqual(try store.list().first?.note, "")
    }

    func testOldBackupWithoutNotesLeavesCurrentNotesUntouched() async throws {
        try seedNotes()
        let expected = try store.list()
        let (backup, restore) = services(includeNotes: false)
        _ = try await backup.runBackup(reason: .manual)
        let snapshot = try XCTUnwrap(backup.listSnapshots().first)
        XCTAssertFalse(try restore.preview(snapshot).stores.contains(.qiraatNotes))
        let report = try restore.restore(snapshot, stores: [.qiraatNotes], memorizationMode: .merge)
        XCTAssertTrue(report.restored.isEmpty)
        XCTAssertNotNil(report.failed[.qiraatNotes])
        XCTAssertEqual(try store.list(), expected)
    }

    func testMissingNotesFileRefusesRestoreBeforeMutation() async throws {
        try seedNotes()
        let expected = try store.list()
        let (backup, restore) = services()
        _ = try await backup.runBackup(reason: .manual)
        let snapshot = try XCTUnwrap(backup.listSnapshots().first)
        try FileManager.default.removeItem(at: snapshot.url.appendingPathComponent("qiraat-notes.sqlite"))
        XCTAssertThrowsError(try restore.restore(snapshot, stores: [.qiraatNotes], memorizationMode: .merge)) {
            XCTAssertEqual($0 as? RestoreError, .fileMissing("qiraat-notes.sqlite"))
        }
        XCTAssertEqual(try store.list(), expected)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent("safety").path))
    }

    func testMalformedImportedValuesAreRejectedWithoutMutation() throws {
        try seedNotes()
        let expected = try store.list()
        var notifications = 0
        store.onDataChanged = { notifications += 1 }
        for mutation in [
            "UPDATE qiraat_notes SET favorite = 4294967297;",
            "UPDATE qiraat_notes SET note = CAST(X'610062' AS TEXT);",
            "UPDATE qiraat_notes SET note = CAST(X'FF' AS TEXT);",
            "UPDATE qiraat_notes SET updated_at = 9223372036854775807;",
            "PRAGMA user_version = 2;"
        ] {
            XCTAssertThrowsError(try store.importDatabase(importFixture(mutation: mutation)), mutation)
            XCTAssertEqual(try store.list(), expected)
        }
        XCTAssertEqual(notifications, 0)
    }

    func testDuplicateImportedAnchorsRollBackReplacement() throws {
        try seedNotes()
        let expected = try store.list()
        let data = try importFixture(mutation: """
            INSERT INTO qiraat_notes SELECT '00000000-0000-0000-0000-000000000002',
                surah, ayah, token, page, favorite, note, created_at, updated_at FROM qiraat_notes;
            """)
        XCTAssertThrowsError(try store.importDatabase(data))
        XCTAssertEqual(try store.list(), expected)
        XCTAssertEqual(try QiraatNotesStore(url: store.fileURL).list(), expected)
    }

    func testUnavailableStoreReportsFailureInsteadOfSaving() throws {
        let unavailable = QiraatNotesStore(url: directory)
        XCTAssertNotNil(unavailable.loadError)
        XCTAssertThrowsError(try unavailable.list())
        XCTAssertThrowsError(try unavailable.setFavorite(true, page: 1, surah: 1, ayah: 1, token: 1))
        XCTAssertTrue(unavailable.notes.isEmpty)
    }

    /// Deliberately unconstrained synthetic database to exercise validation and transaction rollback.
    private func importFixture(mutation: String) throws -> Data {
        let url = directory.appendingPathComponent("import-fixture-\(UUID()).sqlite")
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(url.path, &db), SQLITE_OK)
        defer { sqlite3_close(db) }
        XCTAssertEqual(sqlite3_exec(db, """
            PRAGMA user_version = 1;
            CREATE TABLE qiraat_notes (id TEXT, surah INTEGER, ayah INTEGER, token INTEGER,
                page INTEGER, favorite INTEGER, note TEXT, created_at INTEGER, updated_at INTEGER);
            INSERT INTO qiraat_notes VALUES ('00000000-0000-0000-0000-000000000001',
                1, 1, 1, 1, 1, 'Test fixture', 0, 0);
            \(mutation)
            """, nil, nil, nil), SQLITE_OK)
        return try Data(contentsOf: url)
    }

    private func seedNotes() throws {
        try store.setFavorite(true, page: 1, surah: 1, ayah: 1, token: 1)
        try store.setNote("Test fixture: note only", page: 1, surah: 1, ayah: 1, token: 2)
        try store.setNote("Test fixture: favourite and note", page: 1, surah: 1, ayah: 1, token: 1)
    }

    private func services(includeNotes: Bool = true) -> (BackupService, RestoreService) {
        let export = MemorizationExport(exportedAt: Date(epochMilliseconds: 1_790_000_000_000),
                                       deviceID: "test-fixture", records: [], batches: [], events: [], goals: [], meta: [:])
        let missing = directory.appendingPathComponent("not-present.sqlite")
        let folderURL = directory.appendingPathComponent("backups-fixture")
        let folder = BackupFolder(provider: { folderURL })
        let sources = BackupService.Sources(memorizationExport: { export }, memorizationFileURL: missing,
            readingFileURL: missing, mutshabehatFileURL: missing, qiraatArchive: nil,
            deviceID: "test-fixture", appVersion: "test", qiraatNotesFileURL: includeNotes ? store.fileURL : nil)
        let backup = BackupService(folder: folder, sources: sources,
            defaults: UserDefaults(suiteName: "notes-test-\(UUID())")!)
        let notes = store!
        let targets = RestoreService.Targets(memorizationCurrentExport: { export }, memorizationMerge: { _ in },
            memorizationReplace: { _ in }, memorizationFileURL: missing, readingFileURL: missing,
            mutshabehatFileURL: missing, readingImport: { _ in }, mutshabehatImport: { _ in }, qiraatInstall: nil,
            qiraatNotesFileURL: notes.fileURL, qiraatNotesImport: { try notes.importDatabase($0) })
        return (backup, RestoreService(backupsRoot: folder.backupsRoot()!, targets: targets,
                                       safetyDirectory: directory.appendingPathComponent("safety")))
    }
}
