import SQLite3
import XCTest
import MushafCore
@testable import Mutshabehat

/// The sync service works on the stores and folder it is given, so a test never touches the app's real data
/// or the Mac's real iCloud folder.
@MainActor
final class ICloudSyncInjectionTests: XCTestCase {
    private var base: URL!

    override func setUp() async throws {
        try await super.setUp()
        base = FileManager.default.temporaryDirectory.appendingPathComponent("icloud-inject-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: base)
        try await super.tearDown()
    }

    func testSyncImportsIntoTheInjectedStoresAndLeavesTheSharedOnesAlone() async throws {
        let folder = base.appendingPathComponent("Mushaf_Qiraat")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        // An export, as the Mac writes it into the folder.
        let source = MutshabehatDatabase(url: base.appendingPathComponent("source.sqlite"))
        let groupId = UUID().uuidString
        let part = PersonalPart(id: UUID().uuidString, type: "normal", text: "نص", sortOrder: 0)
        let verse = PersonalVerse(id: UUID().uuidString, groupId: groupId, surah: "الكهف", ayah: 1, parts: [part])
        source.savePersonalGroup(PersonalGroup(id: groupId, title: "مجموعة مزامنة", color: "#6366F1", verses: [verse]))
        try source.exportDatabase().write(to: folder.appendingPathComponent("mutshabehat.sqlite"))

        let injectedMutshabehat = MutshabehatDatabase(url: base.appendingPathComponent("injected-mutshabehat.sqlite"))
        let injectedReading = QuranReadingDatabase(url: base.appendingPathComponent("injected-reading.sqlite"))
        let sharedGroupsBefore = MutshabehatDatabase.shared.fetchPersonalGroups().count
        let suite = "icloud-inject-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let service = ICloudDatabaseSyncService(
            defaults: defaults,
            stores: UserStores(mutshabehat: injectedMutshabehat, reading: injectedReading,
                               tracker: { ReadingTracker.shared }, qiraatNotes: { QiraatNotesStore.shared }),
            folderProvider: { folder })
        _ = try await service.syncFromICloud(library: nil, force: true)

        XCTAssertEqual(injectedMutshabehat.fetchPersonalGroup(id: groupId)?.title, "مجموعة مزامنة")
        XCTAssertEqual(MutshabehatDatabase.shared.fetchPersonalGroups().count, sharedGroupsBefore,
                       "the app's own Mutshabehat database must not be touched")
        let published = try FileManager.default.contentsOfDirectory(atPath: folder.appendingPathComponent("ReadingDevices").path)
        XCTAssertTrue(published.contains { $0.hasSuffix(".sqlite") }, "the injected reading database is published to the folder")
    }

    // MARK: - Merge, not replace; import only what changed

    private func makeFolder() throws -> URL {
        let folder = base.appendingPathComponent("Mushaf_Qiraat-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private func group(_ id: String = UUID().uuidString, title: String) -> PersonalGroup {
        let part = PersonalPart(id: UUID().uuidString, type: "normal", text: title, sortOrder: 0)
        let verse = PersonalVerse(id: UUID().uuidString, groupId: id, surah: "الكهف", ayah: 1, parts: [part])
        return PersonalGroup(id: id, title: title, color: "#6366F1", verses: [verse])
    }

    /// Writes an export of `groups` into `folder`, stamping every group's `updated_at` with `updatedAt`.
    private func writeExport(_ groups: [PersonalGroup], to folder: URL, updatedAt: String) throws {
        let source = MutshabehatDatabase(url: base.appendingPathComponent("export-\(UUID().uuidString).sqlite"))
        for group in groups { XCTAssertTrue(source.savePersonalGroup(group)) }
        let file = folder.appendingPathComponent("mutshabehat.sqlite")
        try source.exportDatabase().write(to: file)
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(file.path, &handle), SQLITE_OK)
        defer { sqlite3_close(handle) }
        XCTAssertEqual(sqlite3_exec(handle, "UPDATE groups SET updated_at = '\(updatedAt)'", nil, nil, nil), SQLITE_OK)
        XCTAssertEqual(sqlite3_exec(handle, "PRAGMA wal_checkpoint(TRUNCATE)", nil, nil, nil), SQLITE_OK)
    }

    private func makeService(folder: URL, mutshabehat: MutshabehatDatabase) throws -> ICloudDatabaseSyncService {
        let suite = "icloud-inject-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        addTeardownBlock { defaults.removePersistentDomain(forName: suite) }
        let reading = QuranReadingDatabase(url: base.appendingPathComponent("reading-\(UUID().uuidString).sqlite"))
        return ICloudDatabaseSyncService(
            defaults: defaults,
            stores: UserStores(mutshabehat: mutshabehat, reading: reading,
                               tracker: { ReadingTracker.shared }, qiraatNotes: { QiraatNotesStore.shared }),
            folderProvider: { folder })
    }

    func testSyncKeepsLocalGroupsAndTheirNewerEdits() async throws {
        let folder = try makeFolder()
        let local = MutshabehatDatabase(url: base.appendingPathComponent("local-\(UUID().uuidString).sqlite"))
        let sharedId = UUID().uuidString
        XCTAssertTrue(local.savePersonalGroup(group(title: "محلي فقط")))
        XCTAssertTrue(local.savePersonalGroup(group(sharedId, title: "تعديل محلي أحدث")))
        let remoteOnly = group(title: "من الماك فقط")
        try writeExport([group(sharedId, title: "نسخة قديمة"), remoteOnly], to: folder, updatedAt: "2000-01-01T00:00:00Z")

        let service = try makeService(folder: folder, mutshabehat: local)
        _ = try await service.syncFromICloud(library: nil, force: true)

        let titles = Set(local.fetchPersonalGroups().map(\.title))
        XCTAssertEqual(titles, ["محلي فقط", "تعديل محلي أحدث", "من الماك فقط"])
    }

    func testSyncTakesTheNewerRemoteCopyWithItsVerses() async throws {
        let folder = try makeFolder()
        let local = MutshabehatDatabase(url: base.appendingPathComponent("local-\(UUID().uuidString).sqlite"))
        let sharedId = UUID().uuidString
        var old = group(sharedId, title: "قديم")
        old.verses.append(PersonalVerse(id: UUID().uuidString, groupId: sharedId, surah: "هود", ayah: 2, parts: []))
        XCTAssertTrue(local.savePersonalGroup(old))
        try writeExport([group(sharedId, title: "أحدث من الماك")], to: folder, updatedAt: "2999-01-01T00:00:00Z")

        _ = try await makeService(folder: folder, mutshabehat: local).syncFromICloud(library: nil, force: true)

        let merged = try XCTUnwrap(local.fetchPersonalGroup(id: sharedId))
        XCTAssertEqual(merged.title, "أحدث من الماك")
        XCTAssertEqual(merged.verses.count, 1, "the old verses are replaced, not mixed with the new ones")
    }

    func testUnchangedFileIsNotImportedAgainUnlessForced() async throws {
        let folder = try makeFolder()
        let local = MutshabehatDatabase(url: base.appendingPathComponent("local-\(UUID().uuidString).sqlite"))
        let remote = group(title: "مجموعة الماك")
        try writeExport([remote], to: folder, updatedAt: "2000-01-01T00:00:00Z")
        let service = try makeService(folder: folder, mutshabehat: local)

        _ = try await service.syncFromICloud(library: nil)
        XCTAssertNotNil(local.fetchPersonalGroup(id: remote.id))

        try local.deleteGroup(groupId: remote.id)
        _ = try await service.syncFromICloud(library: nil)
        XCTAssertNil(local.fetchPersonalGroup(id: remote.id), "same file, nothing to import")

        _ = try await service.syncFromICloud(library: nil, force: true)
        XCTAssertNotNil(local.fetchPersonalGroup(id: remote.id), "a forced sync imports again")
    }

    func testAutomaticSyncShowsAFailureInsteadOfDroppingIt() async throws {
        let folder = try makeFolder()
        try Data("not a database".utf8).write(to: folder.appendingPathComponent("mutshabehat.sqlite"))
        let local = MutshabehatDatabase(url: base.appendingPathComponent("local-\(UUID().uuidString).sqlite"))
        let service = try makeService(folder: folder, mutshabehat: local)
        XCTAssertNil(service.lastError)

        await service.automaticSync(library: nil)
        XCTAssertNotNil(service.lastError, "a failed automatic sync is recorded for the sync settings")

        try writeExport([group(title: "سليمة")], to: folder, updatedAt: "2000-01-01T00:00:00Z")
        await service.automaticSync(library: nil)
        XCTAssertNil(service.lastError, "the next good sync clears it")
    }

    // MARK: - The live Qiraat pages survive an automatic sync

    func testAdoptingAnArchiveKeepsLivePagesUnlessAskedToDropThem() throws {
        let bundledQiraat = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        let installed = base.appendingPathComponent("installed", isDirectory: true)
        try FileManager.default.createDirectory(at: installed, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: bundledQiraat.appendingPathComponent("catalog.json"),
                                         to: installed.appendingPathComponent("catalog.json"))
        let store = try QiraatStore(directory: installed)
        let overlay = base.appendingPathComponent("overlay", isDirectory: true)
        try FileManager.default.createDirectory(at: overlay, withIntermediateDirectories: true)
        let livePage = overlay.appendingPathComponent("page-001.json")
        try Data("{}".utf8).write(to: livePage)

        let library = try MushafLibrary()
        try library.adoptInstalledQiraat(store, keepLivePages: true, overlayDirectory: overlay)
        XCTAssertTrue(FileManager.default.fileExists(atPath: livePage.path), "an automatic sync must not delete live pages")
        XCTAssertEqual(library.qiraat?.directory, installed)
        XCTAssertEqual(library.qiraat?.overlayDirectory, overlay)

        try library.adoptInstalledQiraat(store, keepLivePages: false, overlayDirectory: overlay)
        XCTAssertFalse(FileManager.default.fileExists(atPath: livePage.path), "an explicit restore drops them")
    }
}
