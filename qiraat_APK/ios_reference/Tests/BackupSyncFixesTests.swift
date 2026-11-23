import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

private final class FixesRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var _events: [String] = []
    var events: [String] { lock.lock(); defer { lock.unlock() }; return _events }
    func log(_ text: String) { lock.lock(); _events.append(text); lock.unlock() }
}

/// Backup, restore and sync fixes: the maintenance gate, manifest name checks, safety-copy retention, the
/// scoped-folder lease, iCloud placeholders and the live-sync size caps.
@MainActor
final class BackupSyncFixesTests: XCTestCase {
    private var base: URL!
    private var root: URL { base.appendingPathComponent("iCloud") }
    private var data: URL { base.appendingPathComponent("data") }
    private var safety: URL { base.appendingPathComponent("safety") }
    private let recorder = FixesRecorder()
    private var clock = Date(epochMilliseconds: 1_790_000_000_000)
    private var calendar: Calendar = {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "UTC")!
        return value
    }()

    override func setUp() async throws {
        try await super.setUp()
        base = FileManager.default.temporaryDirectory.appendingPathComponent("backup-fixes-\(UUID().uuidString)")
        for url in [root, data, safety] { try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true) }
        for name in ["memorization", "reading", "mutshabehat"] { try makeDatabase(name) }
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: base)
        try await super.tearDown()
    }

    // MARK: Helpers

    private func databaseURL(_ name: String) -> URL { data.appendingPathComponent("\(name).sqlite") }

    private func makeDatabase(_ name: String) throws {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(databaseURL(name).path, &handle), SQLITE_OK)
        sqlite3_exec(handle, "PRAGMA journal_mode = WAL; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);", nil, nil, nil)
        sqlite3_close(handle)
    }

    private func insertRow(into name: String, value: Int) {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(databaseURL(name).path, &handle), SQLITE_OK)
        sqlite3_exec(handle, "INSERT INTO t VALUES (\(value)); PRAGMA wal_checkpoint(TRUNCATE);", nil, nil, nil)
        sqlite3_close(handle)
    }

    private func sampleExport() -> MemorizationExport {
        var record = AyahMemorizationRecord.blank(AyahKey(surah: 1, ayah: 1), now: clock)
        record.status = .mastered
        return MemorizationExport(formatVersion: 1, exportedAt: clock, deviceID: "dev", records: [record],
                                  batches: [], events: [], goals: [], meta: [:])
    }

    private func makeBackupService() -> BackupService {
        let export = sampleExport()
        let sources = BackupService.Sources(
            memorizationExport: { export }, memorizationFileURL: databaseURL("memorization"),
            readingFileURL: databaseURL("reading"), mutshabehatFileURL: databaseURL("mutshabehat"),
            qiraatArchive: nil, deviceID: "dev", appVersion: "test")
        return BackupService(folder: BackupFolder(provider: { [root] in root }), sources: sources,
                             now: { [unowned self] in self.clock }, calendar: calendar,
                             defaults: UserDefaults(suiteName: "backup-fixes-\(UUID().uuidString)")!)
    }

    private func makeRestoreService() -> RestoreService {
        let log = recorder
        let export = sampleExport()
        let targets = RestoreService.Targets(
            memorizationCurrentExport: { export },
            memorizationMerge: { _ in log.log("memorization.merge") },
            memorizationReplace: { _ in log.log("memorization.replace") },
            memorizationFileURL: databaseURL("memorization"), readingFileURL: databaseURL("reading"),
            mutshabehatFileURL: databaseURL("mutshabehat"),
            readingImport: { _ in log.log("reading.import") },
            mutshabehatImport: { _ in log.log("mutshabehat.import") },
            qiraatInstall: nil)
        return RestoreService(backupsRoot: root.appendingPathComponent("Backups"), targets: targets, safetyDirectory: safety,
                              now: { [unowned self] in self.clock }, calendar: calendar)
    }

    private func firstSnapshot(of service: BackupService) async throws -> SnapshotInfo {
        _ = try await service.runBackup(reason: .manual)
        return try XCTUnwrap(service.listSnapshots().first)
    }

    // MARK: Maintenance gate

    func testGateServesWaitersOneAtATimeInOrder() async throws {
        let gate = StoreMaintenanceGate()
        let log = FixesRecorder()
        let firstHolds = AsyncStream<Void>.makeStream()
        let first = Task {
            try await gate.hold {
                log.log("first.start")
                var iterator = firstHolds.stream.makeAsyncIterator()
                _ = await iterator.next()
                log.log("first.end")
            }
        }
        while log.events.isEmpty { try await Task.sleep(for: .milliseconds(10)) }
        let second = Task { try await gate.hold { log.log("second") } }
        let third = Task { try await gate.hold { log.log("third") } }
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertEqual(log.events, ["first.start"], "a second holder waits while the first one holds the gate")
        firstHolds.continuation.yield()
        try await first.value
        try await second.value
        try await third.value
        XCTAssertEqual(log.events, ["first.start", "first.end", "second", "third"])
    }

    func testGateIsReleasedWhenTheBodyThrows() async throws {
        struct Boom: Error {}
        let gate = StoreMaintenanceGate()
        do { try await gate.hold { () -> Void in throw Boom() } } catch {}
        var ran = false
        try await gate.hold { ran = true }
        XCTAssertTrue(ran)
    }

    func testRestoreWaitsForARunningBackup() async throws {
        let backup = makeBackupService()
        let info = try await firstSnapshot(of: backup)

        // A change, on another day (retention keeps the newest set of each day), so the next run is not skipped.
        insertRow(into: "reading", value: 2)
        clock = clock.addingTimeInterval(2 * 86_400)
        let entered = expectation(description: "the backup reached verification")
        let release = DispatchSemaphore(value: 0)
        backup.beforeVerify = { _ in
            entered.fulfill()
            release.wait()
        }
        let running = Task { try await backup.runBackup(reason: .manual) }
        await fulfillment(of: [entered], timeout: 20)

        let restore = makeRestoreService()
        let restoring = Task { try await restore.restoreAsync(info, stores: [.reading], memorizationMode: .merge) }
        try await Task.sleep(for: .milliseconds(400))
        XCTAssertTrue(recorder.events.isEmpty, "the restore must not touch a store while a backup is running")

        release.signal()
        let result = try await running.value
        XCTAssertFalse(result.skipped)
        let report = try await restoring.value
        XCTAssertEqual(report.restored, [.reading])
        XCTAssertEqual(recorder.events, ["reading.import"])
    }

    func testAsyncRestoreAndPreviewMatchTheSynchronousOnes() async throws {
        let info = try await firstSnapshot(of: makeBackupService())
        let service = makeRestoreService()
        let syncPreview = try service.preview(info)
        let asyncPreview = try await service.previewAsync(info)
        XCTAssertEqual(syncPreview, asyncPreview)
        let report = try await service.restoreAsync(info, stores: [.memorization, .reading, .mutshabehat], memorizationMode: .merge)
        XCTAssertEqual(report.restored, [.memorization, .reading, .mutshabehat])
        XCTAssertEqual(recorder.events, ["memorization.merge", "reading.import", "mutshabehat.import"])
        let listed = await makeBackupService().loadSnapshots()
        XCTAssertEqual(listed.map(\.name), [info.name])
    }

    // MARK: Manifest names and safety copies

    func testManifestNameGuard() {
        XCTAssertTrue(ManifestNameGuard.isSafe("reading.sqlite"))
        XCTAssertTrue(ManifestNameGuard.isSafe("shared/qiraat-abc.qiraatdata"))
        XCTAssertFalse(ManifestNameGuard.isSafe(""))
        XCTAssertFalse(ManifestNameGuard.isSafe("../evil.sqlite"))
        XCTAssertFalse(ManifestNameGuard.isSafe("shared/../../evil"))
        XCTAssertFalse(ManifestNameGuard.isSafe("/etc/passwd"))
        XCTAssertFalse(ManifestNameGuard.isSafe("a\\b.sqlite"))
    }

    func testRestoreRefusesManifestNamesThatClimbOutOfTheFolder() async throws {
        let info = try await firstSnapshot(of: makeBackupService())
        for bad in ["../evil.sqlite", "/abs.sqlite", "dir\\x.sqlite"] {
            var manifest = info.manifest
            manifest.files.append(BackupFileEntry(name: bad, sha256: "00", size: 1, rowCount: nil))
            let tampered = SnapshotInfo(name: info.name, url: info.url, createdAt: info.createdAt, manifest: manifest)
            XCTAssertThrowsError(try makeRestoreService().restore(tampered, stores: [.reading], memorizationMode: .merge)) {
                XCTAssertEqual($0 as? RestoreError, .hashMismatch(bad))
            }
            XCTAssertThrowsError(try makeRestoreService().preview(tampered))
            do {
                _ = try await makeRestoreService().restoreAsync(tampered, stores: [.reading], memorizationMode: .merge)
                XCTFail("the tampered manifest must be refused")
            } catch {
                XCTAssertEqual(error as? RestoreError, .hashMismatch(bad))
            }
        }
        XCTAssertTrue(recorder.events.isEmpty)
        XCTAssertTrue((try? FileManager.default.contentsOfDirectory(atPath: safety.path))?.isEmpty ?? true,
                      "nothing is copied before the set is verified")
    }

    func testSafetyRetentionKeepsTheFirstAndTheNewestTwo() {
        XCTAssertEqual(SafetyCopyRetention.namesToDelete(sortedNames: []), [])
        XCTAssertEqual(SafetyCopyRetention.namesToDelete(sortedNames: ["a", "b", "c"]), [])
        XCTAssertEqual(SafetyCopyRetention.namesToDelete(sortedNames: ["a", "b", "c", "d"]), ["b"])
        XCTAssertEqual(SafetyCopyRetention.namesToDelete(sortedNames: ["a", "b", "c", "d", "e"]), ["b", "c"])
    }

    func testTheFirstEverSafetyCopySurvivesPruning() async throws {
        let info = try await firstSnapshot(of: makeBackupService())
        let service = makeRestoreService()
        var names: [String] = []
        for _ in 0..<6 {
            clock = clock.addingTimeInterval(60)
            let copy = try XCTUnwrap(try service.restore(info, stores: [.reading], memorizationMode: .merge).safetyCopy)
            names.append(copy.lastPathComponent)
        }
        let kept = try FileManager.default.contentsOfDirectory(atPath: safety.path).sorted()
        XCTAssertEqual(kept, [names[0], names[4], names[5]])
    }

    // MARK: Scoped folder lease and iCloud placeholders

    func testLeaseEndsOnceAndOnlyWhatItStarted() {
        // Whether a plain temp folder counts as "started" differs between the simulator and a device; what must hold
        // everywhere is that ending is idempotent and leaves the lease inactive.
        let lease = ScopedFolderLease(url: base)
        lease.end()
        lease.end()
        XCTAssertFalse(lease.isActive)
    }

    func testPlaceholderDestination() {
        let placeholder = URL(fileURLWithPath: "/tmp/ReadingDevices/.dev-a.sqlite.icloud")
        XCTAssertEqual(ICloudPlaceholder.destination(of: placeholder)?.path, "/tmp/ReadingDevices/dev-a.sqlite")
        XCTAssertNil(ICloudPlaceholder.destination(of: URL(fileURLWithPath: "/tmp/ReadingDevices/dev-a.sqlite")))
        XCTAssertNil(ICloudPlaceholder.destination(of: URL(fileURLWithPath: "/tmp/.icloud")))
        XCTAssertNil(ICloudPlaceholder.destination(of: URL(fileURLWithPath: "/tmp/x.icloud")))
    }

    func testAnUndownloadedDeviceFileDoesNotStopTheMergeOrOurPublish() throws {
        let folder = base.appendingPathComponent("Mushaf_Qiraat")
        let devices = folder.appendingPathComponent("ReadingDevices")
        try FileManager.default.createDirectory(at: devices, withIntermediateDirectories: true)
        try Data().write(to: devices.appendingPathComponent(".other-device.sqlite.icloud"))
        try Data().write(to: folder.appendingPathComponent(".reading.sqlite.icloud"))

        let suite = "backup-fixes-sync-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let serviceReading = QuranReadingDatabase(url: base.appendingPathComponent("service-reading.sqlite"))
        let service = ICloudDatabaseSyncService(
            defaults: defaults,
            stores: UserStores(mutshabehat: MutshabehatDatabase(url: base.appendingPathComponent("m.sqlite")),
                               reading: serviceReading, tracker: { ReadingTracker.shared },
                               qiraatNotes: { QiraatNotesStore.shared }),
            folderProvider: { folder })
        let target = QuranReadingDatabase(url: base.appendingPathComponent("target-reading.sqlite"))

        XCTAssertNoThrow(try service.syncReadingSnapshots(in: folder, database: target, deviceID: "this-device"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: devices.appendingPathComponent("this-device.sqlite").path),
                      "our own snapshot is still published")
    }

    // MARK: Live sync size caps

    func testResponseLimitsAreCheckedBeforeDecoding() throws {
        let small = QiraatLiveSync.FetchResponse(data: Data(count: 10))
        XCTAssertNoThrow(try QiraatLiveSync.requireWithinLimit(small, limit: 10))
        XCTAssertThrowsError(try QiraatLiveSync.requireWithinLimit(small, limit: 9)) {
            XCTAssertEqual(($0 as? URLError)?.code, .dataLengthExceedsMaximum)
        }
        XCTAssertEqual(QiraatLiveSync.maxPageBytes, 8 * 1024 * 1024)
        XCTAssertEqual(QiraatLiveSync.maxMutoonBytes, 32 * 1024 * 1024)
        let page = QiraatLiveSync.request(url: AppEndpoints.publicQiraatPage(3))
        let mutoon = QiraatLiveSync.request(url: AppEndpoints.publicMutoon())
        XCTAssertEqual(QiraatLiveSync.maxBytes(for: page), QiraatLiveSync.maxPageBytes)
        XCTAssertEqual(QiraatLiveSync.maxBytes(for: mutoon), QiraatLiveSync.maxMutoonBytes)
    }

    func testAnOversizedPageAnswerIsNotInstalled() async throws {
        let live = base.appendingPathComponent("live")
        let snapshot = base.appendingPathComponent("snapshot")
        try FileManager.default.createDirectory(at: snapshot, withIntermediateDirectories: true)
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        try FileManager.default.copyItem(at: bundled.appendingPathComponent("catalog.json"),
                                         to: snapshot.appendingPathComponent("catalog.json"))
        let store = try QiraatStore(directory: snapshot, overlayDirectory: live)

        let oversized = Data(count: QiraatLiveSync.maxPageBytes + 1)
        let refusing = QiraatLiveSync(fetch: { _ in .init(data: oversized) }, minInterval: 0)
        let outcome = await refusing.refresh(page: 7, store: store, force: true)
        XCTAssertEqual(outcome, .failed)
        XCTAssertNil(store.page(7))

        let accepting = QiraatLiveSync(fetch: { _ in
            .init(data: Data(#"{"pageNumber":7,"variants":[],"rulings":[],"rules":[]}"#.utf8))
        }, minInterval: 0)
        let installed = await accepting.refresh(page: 7, store: store, force: true)
        XCTAssertEqual(installed, .updated, "a normal answer is still installed")
    }
}
