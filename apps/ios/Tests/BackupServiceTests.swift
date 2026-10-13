import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

/// Counts how often the (expensive) Qiraat archive is built; the backup worker calls it off the main actor.
private final class QiraatBox: @unchecked Sendable {
    private let lock = NSLock()
    private var _calls = 0
    private var _payload = Data("qiraat-v1".utf8)
    var calls: Int { lock.lock(); defer { lock.unlock() }; return _calls }
    var payload: Data { lock.lock(); defer { lock.unlock() }; return _payload }
    func next() -> Data { lock.lock(); defer { lock.unlock() }; _calls += 1; return _payload }
    func setPayload(_ data: Data) { lock.lock(); _payload = data; lock.unlock() }
    func reset() { lock.lock(); _calls = 0; _payload = Data("qiraat-v1".utf8); lock.unlock() }
}

@MainActor
final class BackupServiceTests: XCTestCase {
    private var root: URL!          // stands in for the iCloud Drive folder
    private var data: URL!          // stands in for Application Support
    private var clock = Date(epochMilliseconds: 1_790_000_000_000)
    private let qiraat = QiraatBox()
    private var calendar: Calendar = {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "UTC")!
        return value
    }()

    override func setUp() async throws {
        try await super.setUp()
        let base = FileManager.default.temporaryDirectory.appendingPathComponent("backup-\(UUID().uuidString)")
        root = base.appendingPathComponent("iCloud")
        data = base.appendingPathComponent("data")
        for url in [root!, data!] { try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true) }
        for name in ["memorization", "reading", "mutshabehat"] { try makeDatabase(name, rows: 3) }
        qiraat.reset()
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: root.deletingLastPathComponent())
        try await super.tearDown()
    }

    // MARK: - Helpers

    private func databaseURL(_ name: String) -> URL { data.appendingPathComponent("\(name).sqlite") }

    private func makeDatabase(_ name: String, rows: Int) throws {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(databaseURL(name).path, &handle), SQLITE_OK)
        sqlite3_exec(handle, "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS t (x INTEGER);", nil, nil, nil)
        for i in 0..<rows { sqlite3_exec(handle, "INSERT INTO t VALUES (\(i));", nil, nil, nil) }
        sqlite3_close(handle)
    }

    private func addRow(_ name: String) throws {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(databaseURL(name).path, &handle), SQLITE_OK)
        sqlite3_exec(handle, "INSERT INTO t VALUES (999);", nil, nil, nil)
        sqlite3_close(handle)
    }

    private func export() -> MemorizationExport {
        var record = AyahMemorizationRecord.blank(AyahKey(surah: 1, ayah: 1), now: clock)
        record.status = .mastered
        return MemorizationExport(exportedAt: clock, deviceID: "dev", records: [record], batches: [], events: [],
                                  goals: [], meta: [:])
    }

    private func makeService(folderProvider: (@Sendable () -> URL?)? = nil) -> BackupService {
        let provider = folderProvider ?? { [root] in root }
        let snapshot = export()
        let box = qiraat
        let sources = BackupService.Sources(
            memorizationExport: { snapshot },
            memorizationFileURL: databaseURL("memorization"),
            readingFileURL: databaseURL("reading"),
            mutshabehatFileURL: databaseURL("mutshabehat"),
            qiraatArchive: { box.next() },
            deviceID: "dev", appVersion: "test")
        return BackupService(folder: BackupFolder(provider: provider), sources: sources,
                             now: { [unowned self] in self.clock }, calendar: calendar,
                             defaults: UserDefaults(suiteName: "backup-test-\(UUID().uuidString)")!)
    }

    private var backups: URL { root.appendingPathComponent("Backups") }

    private func historyFolders() -> [String] {
        ((try? FileManager.default.contentsOfDirectory(atPath: backups.appendingPathComponent("history").path)) ?? []).sorted()
    }

    private func manifest(at folder: URL) throws -> BackupManifest {
        try BackupCoding.decoder().decode(BackupManifest.self, from: Data(contentsOf: folder.appendingPathComponent("manifest.json")))
    }

    // MARK: - Tests

    func testBackupWritesCompleteVerifiedSet() async throws {
        let service = makeService()
        let result = try await service.runBackup(reason: .manual)
        XCTAssertFalse(result.skipped)

        let latest = backups.appendingPathComponent("latest")
        let manifest = try manifest(at: latest)
        let names = Set(manifest.files.map(\.name))
        XCTAssertTrue(Set(["memorization.json", "memorization.sqlite", "reading.sqlite", "mutshabehat.sqlite"])
            .isSubset(of: names), "\(names)")
        let qiraatEntry = try XCTUnwrap(manifest.files.first { $0.name.hasPrefix("shared/qiraat-") })
        for entry in manifest.files where !entry.name.hasPrefix("shared/") {
            let file = latest.appendingPathComponent(entry.name)
            XCTAssertEqual(try BackupHash.sha256Hex(ofFileAt: file), entry.sha256, entry.name)
        }
        let shared = backups.appendingPathComponent(qiraatEntry.name)
        XCTAssertEqual(try Data(contentsOf: shared), qiraat.payload)
        XCTAssertEqual(historyFolders().count, 1)
        XCTAssertEqual(try MemorizationExport.decode(Data(contentsOf: latest.appendingPathComponent("memorization.json"))).records.count, 1)
        XCTAssertTrue(SQLiteSnapshot.integrityCheck(at: latest.appendingPathComponent("reading.sqlite")))
        XCTAssertEqual(service.lastSuccess, clock)
        XCTAssertNil(service.lastError)
    }

    func testSecondRunWithoutChangesIsSkipped() async throws {
        let service = makeService()
        _ = try await service.runBackup(reason: .manual)
        clock = clock.addingTimeInterval(120)
        let second = try await service.runBackup(reason: .debounced)
        XCTAssertTrue(second.skipped)
        XCTAssertEqual(historyFolders().count, 1)
        XCTAssertEqual(service.lastSuccess, clock, "an unchanged run still means the data is safe now")
    }

    func testChangeInMemorizationProducesNewHistorySet() async throws {
        let service = makeService()
        _ = try await service.runBackup(reason: .manual)
        try addRow("memorization")
        clock = clock.addingTimeInterval(86_400)      // retention keeps one set per day, so use the next day
        let second = try await service.runBackup(reason: .debounced)
        XCTAssertFalse(second.skipped)
        XCTAssertEqual(historyFolders().count, 2)
    }

    func testQiraatArchiveIsRefreshedOnlyWhenMissingOrOnManualBackup() async throws {
        let service = makeService()
        _ = try await service.runBackup(reason: .debounced)
        XCTAssertEqual(qiraat.calls, 1, "missing archive is written once")

        try addRow("reading")
        clock = clock.addingTimeInterval(120)
        _ = try await service.runBackup(reason: .debounced)
        XCTAssertEqual(qiraat.calls, 1, "automatic runs do not rebuild the 13 MB archive")

        qiraat.setPayload(Data("qiraat-v2".utf8))
        try addRow("reading")
        clock = clock.addingTimeInterval(120)
        _ = try await service.runBackup(reason: .manual)
        XCTAssertEqual(qiraat.calls, 2)
        let latestManifest = try manifest(at: backups.appendingPathComponent("latest"))
        let entry = try XCTUnwrap(latestManifest.files.first { $0.name.hasPrefix("shared/qiraat-") })
        XCTAssertEqual(try Data(contentsOf: backups.appendingPathComponent(entry.name)), qiraat.payload)
        XCTAssertEqual(entry.sha256, BackupHash.sha256Hex(qiraat.payload))
    }

    func testOlderSnapshotKeepsItsQiraatArchiveAfterARefresh() async throws {
        let service = makeService()
        _ = try await service.runBackup(reason: .manual)
        let oldManifest = try manifest(at: backups.appendingPathComponent("latest"))
        let oldEntry = try XCTUnwrap(oldManifest.files.first { $0.name.hasPrefix("shared/qiraat-") })

        qiraat.setPayload(Data("qiraat-v2".utf8))
        try addRow("reading")
        clock = clock.addingTimeInterval(86_400)
        _ = try await service.runBackup(reason: .manual)
        let newManifest = try manifest(at: backups.appendingPathComponent("latest"))
        let newEntry = try XCTUnwrap(newManifest.files.first { $0.name.hasPrefix("shared/qiraat-") })

        XCTAssertNotEqual(oldEntry.name, newEntry.name)
        XCTAssertEqual(try BackupHash.sha256Hex(ofFileAt: backups.appendingPathComponent(oldEntry.name)), oldEntry.sha256)
        XCTAssertEqual(try BackupHash.sha256Hex(ofFileAt: backups.appendingPathComponent(newEntry.name)), newEntry.sha256)
    }

    func testRetentionKeepsFourteenDays() async throws {
        let service = makeService()
        for day in 0..<20 {
            clock = Date(epochMilliseconds: 1_790_000_000_000 + Int64(day) * 86_400_000)
            try addRow("memorization")
            _ = try await service.runBackup(reason: .debounced)
        }
        XCTAssertEqual(historyFolders().count, 14)
        let newest = try manifest(at: backups.appendingPathComponent("latest"))
        XCTAssertEqual(newest.createdAt, clock)
    }

    func testFailedVerificationLeavesPreviousLatestIntact() async throws {
        let service = makeService()
        _ = try await service.runBackup(reason: .manual)
        let before = try Data(contentsOf: backups.appendingPathComponent("latest/manifest.json"))

        try addRow("memorization")
        clock = clock.addingTimeInterval(120)
        service.beforeVerify = { staging in
            try? Data("garbage".utf8).write(to: staging.appendingPathComponent("reading.sqlite"))
        }
        do {
            _ = try await service.runBackup(reason: .manual)
            XCTFail("verification should have failed")
        } catch let error as BackupError {
            guard case .verificationFailed = error else { return XCTFail("\(error)") }
        }
        XCTAssertEqual(try Data(contentsOf: backups.appendingPathComponent("latest/manifest.json")), before)
        XCTAssertEqual(historyFolders().count, 1)
        let leftovers = try FileManager.default.contentsOfDirectory(atPath: backups.path).filter { $0.hasPrefix(".staging") }
        XCTAssertTrue(leftovers.isEmpty, "\(leftovers)")
        XCTAssertNotNil(service.lastError)
    }

    func testMissingFolderThrowsAndTouchesNothing() async throws {
        // Review focus: no folder never crashes, never writes anywhere, and is reported.
        let service = makeService(folderProvider: { nil })
        do {
            _ = try await service.runBackup(reason: .manual)
            XCTFail("expected folderUnavailable")
        } catch let error as BackupError {
            XCTAssertEqual(error.localizedDescription, BackupError.folderUnavailable.localizedDescription)
        }
        XCTAssertNotNil(service.lastError)
        XCTAssertNil(service.lastSuccess)
        XCTAssertFalse(FileManager.default.fileExists(atPath: backups.path))
    }

    func testListSnapshotsIsNewestFirst() async throws {
        let service = makeService()
        for _ in 0..<3 {
            try addRow("memorization")
            _ = try await service.runBackup(reason: .debounced)
            clock = clock.addingTimeInterval(86_400)
        }
        let snapshots = service.listSnapshots()
        XCTAssertEqual(snapshots.count, 3)
        XCTAssertEqual(snapshots.map(\.createdAt), snapshots.map(\.createdAt).sorted(by: >))
        XCTAssertTrue(snapshots.allSatisfy { !$0.manifest.files.isEmpty })
    }

    func testStaleStagingFoldersAreRemoved() async throws {
        let stale = backups.appendingPathComponent(".staging-old")
        try FileManager.default.createDirectory(at: stale, withIntermediateDirectories: true)
        try FileManager.default.setAttributes([.modificationDate: clock.addingTimeInterval(-7_200)], ofItemAtPath: stale.path)
        let service = makeService()
        _ = try await service.runBackup(reason: .manual)
        XCTAssertFalse(FileManager.default.fileExists(atPath: stale.path))
    }

    func testTwoBackupsInTheSameSecondKeepOnlyTheNewestForThatDay() async throws {
        let service = makeService()
        _ = try await service.runBackup(reason: .manual)
        try addRow("memorization")
        _ = try await service.runBackup(reason: .manual)   // the clock did not move: the folder name gets a suffix
        let folders = historyFolders()
        XCTAssertEqual(folders.count, 1, "one set per day is kept")
        XCTAssertTrue(folders[0].hasSuffix("-1"), folders[0])
        let latest = try manifest(at: backups.appendingPathComponent("latest"))
        let kept = try manifest(at: backups.appendingPathComponent("history/\(folders[0])"))
        XCTAssertEqual(latest, kept)
    }
}
