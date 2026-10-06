import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

/// Records what the restore asked each store to do, and can be told to fail one of them.
private final class Recorder: @unchecked Sendable {
    private let lock = NSLock()
    private var _events: [String] = []
    var failReadingImport = false
    var events: [String] { lock.lock(); defer { lock.unlock() }; return _events }
    func log(_ text: String) { lock.lock(); _events.append(text); lock.unlock() }
}

@MainActor
final class RestoreServiceTests: XCTestCase {
    private var base: URL!
    private var root: URL { base.appendingPathComponent("iCloud") }
    private var data: URL { base.appendingPathComponent("data") }
    private var safety: URL { base.appendingPathComponent("safety") }
    private let recorder = Recorder()
    private var clock = Date(epochMilliseconds: 1_790_000_000_000)
    private var calendar: Calendar = {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "UTC")!
        return value
    }()

    override func setUp() async throws {
        try await super.setUp()
        base = FileManager.default.temporaryDirectory.appendingPathComponent("restore-\(UUID().uuidString)")
        for url in [root, data, safety] { try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true) }
        for name in ["memorization", "reading", "mutshabehat"] { try makeDatabase(name) }
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: base)
        try await super.tearDown()
    }

    // MARK: - Helpers

    private func databaseURL(_ name: String) -> URL { data.appendingPathComponent("\(name).sqlite") }

    private func makeDatabase(_ name: String) throws {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(databaseURL(name).path, &handle), SQLITE_OK)
        sqlite3_exec(handle, "PRAGMA journal_mode = WAL; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);", nil, nil, nil)
        sqlite3_close(handle)
    }

    private func sampleExport(statuses: [MemorizationStatus] = [.mastered], formatVersion: Int = 1) -> MemorizationExport {
        var records: [AyahMemorizationRecord] = []
        for (i, status) in statuses.enumerated() {
            var record = AyahMemorizationRecord.blank(AyahKey(surah: 1, ayah: i + 1), now: clock)
            record.status = status
            records.append(record)
        }
        return MemorizationExport(formatVersion: formatVersion, exportedAt: clock, deviceID: "dev", records: records,
                                  batches: [], events: [], goals: [], meta: [:])
    }

    /// Writes a real backup set (through `BackupService`) and returns its snapshot.
    private func makeBackup(export: MemorizationExport? = nil) async throws -> SnapshotInfo {
        let snapshot = export ?? sampleExport()
        let sources = BackupService.Sources(
            memorizationExport: { snapshot }, memorizationFileURL: databaseURL("memorization"),
            readingFileURL: databaseURL("reading"), mutshabehatFileURL: databaseURL("mutshabehat"),
            qiraatArchive: { Data("qiraat-archive".utf8) }, deviceID: "dev", appVersion: "test")
        let service = BackupService(folder: BackupFolder(provider: { [root] in root }), sources: sources,
                                    now: { [unowned self] in self.clock }, calendar: calendar,
                                    defaults: UserDefaults(suiteName: "restore-test-\(UUID().uuidString)")!)
        _ = try await service.runBackup(reason: .manual)
        return try XCTUnwrap(service.listSnapshots().first)
    }

    private func makeService(qiraat: Bool = true) -> RestoreService {
        let log = recorder
        let targets = RestoreService.Targets(
            memorizationCurrentExport: { [unowned self] in self.sampleExport(statuses: [.needsMushaf, .needsMushaf]) },
            memorizationMerge: { log.log("memorization.merge:\($0.records.count)") },
            memorizationReplace: { log.log("memorization.replace:\($0.records.count)") },
            memorizationFileURL: databaseURL("memorization"), readingFileURL: databaseURL("reading"),
            mutshabehatFileURL: databaseURL("mutshabehat"),
            readingImport: { _ in
                if log.failReadingImport { throw NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "reading failed"]) }
                log.log("reading.import")
            },
            mutshabehatImport: { _ in log.log("mutshabehat.import") },
            qiraatInstall: qiraat ? { _ in log.log("qiraat.install") } : nil)
        return RestoreService(backupsRoot: root.appendingPathComponent("Backups"), targets: targets, safetyDirectory: safety,
                              now: { [unowned self] in self.clock }, calendar: calendar)
    }

    private func replaceFile(in snapshot: SnapshotInfo, _ name: String, with data: Data) throws {
        try data.write(to: snapshot.url.appendingPathComponent(name))
    }

    private func assertNothingChanged(file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(recorder.events.isEmpty, "\(recorder.events)", file: file, line: line)
    }

    // MARK: - Preview

    func testPreviewCountsRecordsAndVerifies() async throws {
        let info = try await makeBackup(export: sampleExport(statuses: [.mastered, .needsMushaf, .notMemorized]))
        let preview = try makeService().preview(info)
        XCTAssertEqual(preview.ayahRecords, 3)
        XCTAssertEqual(preview.stores, Set(BackupStore.allCases))
    }

    // MARK: - Restore behaviour

    func testRestoreMergeIsDefaultModeAndRestoresChosenStores() async throws {
        let info = try await makeBackup(export: sampleExport(statuses: [.mastered, .mastered, .mastered]))
        let report = try makeService().restore(info, stores: [.memorization, .reading], memorizationMode: .merge)
        XCTAssertEqual(report.restored, [.memorization, .reading])
        XCTAssertTrue(report.failed.isEmpty)
        XCTAssertEqual(recorder.events, ["memorization.merge:3", "reading.import"])
    }

    func testRestoreReplaceUsesReplace() async throws {
        let info = try await makeBackup()
        _ = try makeService().restore(info, stores: [.memorization], memorizationMode: .replace)
        XCTAssertEqual(recorder.events, ["memorization.replace:1"])
    }

    func testRestoreAllStoresIncludingQiraat() async throws {
        let info = try await makeBackup()
        let report = try makeService().restore(info, stores: Set(BackupStore.allCases), memorizationMode: .merge)
        XCTAssertEqual(report.restored, Set(BackupStore.allCases))
        XCTAssertEqual(Set(recorder.events), ["memorization.merge:1", "reading.import", "mutshabehat.import", "qiraat.install"])
    }

    func testRestoreMakesSafetyCopyAndKeepsLastThree() async throws {
        let info = try await makeBackup()
        let service = makeService()
        for _ in 0..<5 {
            clock = clock.addingTimeInterval(60)
            let report = try service.restore(info, stores: [.reading], memorizationMode: .merge)
            let copy = try XCTUnwrap(report.safetyCopy)
            XCTAssertTrue(FileManager.default.fileExists(atPath: copy.appendingPathComponent("reading.sqlite").path))
            XCTAssertTrue(FileManager.default.fileExists(atPath: copy.appendingPathComponent("memorization.json").path))
        }
        let kept = try FileManager.default.contentsOfDirectory(atPath: safety.path)
        XCTAssertEqual(kept.count, 3)
    }

    func testRestoreFailureRollsBackThatStoreOnly() async throws {
        let info = try await makeBackup()
        recorder.failReadingImport = true
        let report = try makeService().restore(info, stores: [.memorization, .reading, .mutshabehat], memorizationMode: .merge)
        XCTAssertEqual(report.restored, [.memorization, .mutshabehat])
        XCTAssertEqual(report.failed[.reading], "reading failed")
        XCTAssertEqual(report.failed.count, 1)
    }

    // MARK: - Refusals (review focus 4): data must be untouched

    func testCorruptBackupIsRefused() async throws {
        let info = try await makeBackup()
        try replaceFile(in: info, "reading.sqlite", with: Data("not sqlite".utf8))
        XCTAssertThrowsError(try makeService().restore(info, stores: [.reading], memorizationMode: .merge))
        assertNothingChanged()
    }

    func testTruncatedJSONIsRefused() async throws {
        let info = try await makeBackup()
        let json = try Data(contentsOf: info.url.appendingPathComponent("memorization.json"))
        try replaceFile(in: info, "memorization.json", with: json.prefix(json.count / 2))
        XCTAssertThrowsError(try makeService().preview(info))
        XCTAssertThrowsError(try makeService().restore(info, stores: [.memorization], memorizationMode: .merge))
        assertNothingChanged()
    }

    func testHashMismatchIsRefused() async throws {
        let info = try await makeBackup()
        var bytes = try Data(contentsOf: info.url.appendingPathComponent("mutshabehat.sqlite"))
        bytes[bytes.count - 1] ^= 0xFF
        try replaceFile(in: info, "mutshabehat.sqlite", with: bytes)
        XCTAssertThrowsError(try makeService().restore(info, stores: [.mutshabehat], memorizationMode: .merge)) { error in
            guard case RestoreError.hashMismatch = error else { return XCTFail("\(error)") }
        }
        assertNothingChanged()
    }

    func testNewerFormatIsRefusedWithMessage() async throws {
        let info = try await makeBackup()
        var manifest = info.manifest
        manifest.formatVersion = 99
        try replaceFile(in: info, "manifest.json", with: BackupCoding.encoder().encode(manifest))
        let newer = SnapshotInfo(name: info.name, url: info.url, createdAt: info.createdAt, manifest: manifest)
        XCTAssertThrowsError(try makeService().restore(newer, stores: [.memorization], memorizationMode: .merge)) { error in
            XCTAssertTrue(error.localizedDescription.contains("99"), error.localizedDescription)
        }
        assertNothingChanged()
    }

    func testPlaceholderFileIsNotRestored() async throws {
        let info = try await makeBackup()
        // iCloud shows an evicted file as ".name.icloud" and no file under its real name.
        try FileManager.default.removeItem(at: info.url.appendingPathComponent("reading.sqlite"))
        try Data().write(to: info.url.appendingPathComponent(".reading.sqlite.icloud"))
        XCTAssertThrowsError(try makeService().restore(info, stores: [.reading], memorizationMode: .merge)) { error in
            guard case RestoreError.notDownloaded = error else { return XCTFail("\(error)") }
        }
        assertNothingChanged()
    }

    func testMissingQiraatArchiveReportsUnavailableAndRestoreOfOtherStoresStillWorks() async throws {
        let info = try await makeBackup()
        try FileManager.default.removeItem(at: root.appendingPathComponent("Backups/shared/qiraat.qiraatdata"))
        let service = makeService()
        XCTAssertFalse(try service.preview(info).stores.contains(.qiraat))
        let report = try service.restore(info, stores: [.reading], memorizationMode: .merge)
        XCTAssertEqual(report.restored, [.reading])
    }

    // MARK: - JSON transfer

    func testJSONExportImportRoundTrip() throws {
        let service = makeService()
        let exported = try service.exportJSON()
        XCTAssertEqual(try MemorizationExport.decode(exported).records.count, 2)
        try service.importJSON(exported, mode: .merge)
        XCTAssertEqual(recorder.events, ["memorization.merge:2"])
        try service.importJSON(exported, mode: .replace)
        XCTAssertEqual(recorder.events.last, "memorization.replace:2")
    }

    func testJSONImportRefusesGarbageAndNewerFormats() throws {
        let service = makeService()
        XCTAssertThrowsError(try service.importJSON(Data("nope".utf8), mode: .merge))
        let newer = try sampleExport(formatVersion: 7).encode()
        XCTAssertThrowsError(try service.importJSON(newer, mode: .merge))
        assertNothingChanged()
    }
}
