import XCTest
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
}
