import Foundation
import SQLite3
import Testing
@testable import MushafCore

@Suite struct BackupCoreTests {
    // MARK: - Hash and manifest

    @Test func sha256KnownVector() {
        #expect(BackupHash.sha256Hex(Data("abc".utf8))
                == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    @Test func sha256OfFileMatchesData() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("hash-\(UUID().uuidString).bin")
        defer { try? FileManager.default.removeItem(at: url) }
        try Data("abc".utf8).write(to: url)
        #expect(try BackupHash.sha256Hex(ofFileAt: url) == BackupHash.sha256Hex(Data("abc".utf8)))
    }

    @Test func manifestRoundTrip() throws {
        let manifest = BackupManifest(
            formatVersion: 1, createdAt: Date(epochMilliseconds: 1_790_000_000_123), deviceID: "dev",
            appVersion: "1.0 (1)",
            files: [BackupFileEntry(name: "memorization.json", sha256: "aa", size: 10, rowCount: 5),
                    BackupFileEntry(name: "reading.sqlite", sha256: "bb", size: 20, rowCount: nil)])
        let data = try BackupCoding.encoder().encode(manifest)
        #expect(try BackupCoding.decoder().decode(BackupManifest.self, from: data) == manifest)
    }

    @Test func datesRoundTripExactlyAtMillisecondPrecision() throws {
        for milliseconds: Int64 in [1_790_000_000_123, 1_790_000_000_999, 1_790_000_001_000, 1_790_000_000_001, 0, 1_000] {
            let date = Date(epochMilliseconds: milliseconds)
            let text = BackupCoding.string(from: date)
            #expect(BackupCoding.date(from: text) == date)
            #expect(BackupCoding.date(from: text)?.epochMilliseconds == milliseconds)
        }
        #expect(BackupCoding.string(from: Date(epochMilliseconds: 1_790_000_000_123)).hasSuffix(".123Z"))
        #expect(BackupCoding.string(from: Date(epochMilliseconds: 1_790_000_001_000)).hasSuffix(".000Z"))
    }

    @Test func normalizingMicrosecondDatesIsIdempotentAndMatchesStoredForm() {
        let precise = Date(timeIntervalSince1970: 1_790_000_000.1234567)
        let normalized = precise.normalizedToMilliseconds
        #expect(normalized.epochMilliseconds == 1_790_000_000_123)
        #expect(normalized.normalizedToMilliseconds == normalized)
        #expect(normalized == Date(epochMilliseconds: 1_790_000_000_123))
        #expect(BackupCoding.date(from: BackupCoding.string(from: normalized)) == normalized)
    }

    // MARK: - Retention

    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private func date(_ day: Int, hour: Int = 10) -> Date {
        var parts = DateComponents()
        parts.timeZone = TimeZone(identifier: "UTC")
        parts.year = 2026; parts.month = 10; parts.day = day; parts.hour = hour
        return utc.date(from: parts)!
    }

    @Test func retentionKeepsOnePerDayFor14Days() {
        // Daily sets for Oct 1…20, plus an older duplicate on Oct 20.
        var existing = (1...20).map { date($0) }
        let olderDuplicate = date(20, hour: 8)
        existing.append(olderDuplicate)
        let toDelete = RetentionPlanner.datesToDelete(existing: existing, now: date(20, hour: 12), keepDays: 14, calendar: utc)
        // Days kept: Oct 7…20. Deleted: Oct 1…6 and the older duplicate.
        let expected = Set((1...6).map { date($0) } + [olderDuplicate])
        #expect(Set(toDelete) == expected)
        #expect(toDelete.count == 7)
    }

    @Test func retentionNeverDeletesLatestOfToday() {
        let latest = date(20, hour: 11)
        let toDelete = RetentionPlanner.datesToDelete(
            existing: [date(20, hour: 9), latest, date(20, hour: 10)], now: date(20, hour: 12), keepDays: 14, calendar: utc)
        #expect(!toDelete.contains(latest))
        #expect(toDelete.count == 2)
    }

    @Test func retentionOnEmptyListIsEmpty() {
        #expect(RetentionPlanner.datesToDelete(existing: [], now: date(20), keepDays: 14, calendar: utc).isEmpty)
    }

    // MARK: - SQLite snapshot

    private func makeDatabase(at url: URL, rows: Int) throws -> OpaquePointer {
        var handle: OpaquePointer?
        guard sqlite3_open(url.path, &handle) == SQLITE_OK, let handle else { throw SQLiteSnapshotError.openFailed("test") }
        sqlite3_exec(handle, "PRAGMA journal_mode = WAL; CREATE TABLE t (x INTEGER, pad TEXT);", nil, nil, nil)
        sqlite3_exec(handle, "BEGIN;", nil, nil, nil)
        for i in 0..<rows {
            sqlite3_exec(handle, "INSERT INTO t VALUES (\(i), '\(String(repeating: "x", count: 200))');", nil, nil, nil)
        }
        sqlite3_exec(handle, "COMMIT;", nil, nil, nil)
        return handle
    }

    private func rowCount(at url: URL) -> Int? {
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let handle else { return nil }
        defer { sqlite3_close(handle) }
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "SELECT COUNT(*) FROM t", -1, &stmt, nil) == SQLITE_OK, let stmt else { return nil }
        defer { sqlite3_finalize(stmt) }
        return sqlite3_step(stmt) == SQLITE_ROW ? Int(sqlite3_column_int64(stmt, 0)) : nil
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("snap-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    @Test func snapshotCopiesWhileSourceIsOpenInWAL() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appendingPathComponent("source.sqlite")
        let destination = directory.appendingPathComponent("copy.sqlite")
        let writer = try makeDatabase(at: source, rows: 300)   // stays open: committed rows may still be in the WAL
        defer { sqlite3_close(writer) }

        try SQLiteSnapshot.copy(from: source, to: destination)

        #expect(SQLiteSnapshot.integrityCheck(at: destination))
        #expect(rowCount(at: destination) == 300)
    }

    @Test func snapshotOverwritesAnExistingDestination() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appendingPathComponent("source.sqlite")
        let destination = directory.appendingPathComponent("copy.sqlite")
        let first = try makeDatabase(at: source, rows: 5)
        try SQLiteSnapshot.copy(from: source, to: destination)
        sqlite3_exec(first, "INSERT INTO t VALUES (99, 'y');", nil, nil, nil)
        sqlite3_close(first)
        try SQLiteSnapshot.copy(from: source, to: destination)
        #expect(rowCount(at: destination) == 6)
    }

    @Test func copyLeavesOnlyTheDestinationFile() throws {
        let sourceDirectory = try temporaryDirectory()
        let destinationDirectory = try temporaryDirectory()
        defer {
            try? FileManager.default.removeItem(at: sourceDirectory)
            try? FileManager.default.removeItem(at: destinationDirectory)
        }
        let source = sourceDirectory.appendingPathComponent("source.sqlite")
        let destination = destinationDirectory.appendingPathComponent("copy.sqlite")
        let writer = try makeDatabase(at: source, rows: 50)   // stays open in WAL mode
        defer { sqlite3_close(writer) }

        try SQLiteSnapshot.copy(from: source, to: destination)

        let names = try FileManager.default.contentsOfDirectory(atPath: destinationDirectory.path)
        #expect(names == ["copy.sqlite"])
    }

    @Test func snapshotOfMissingSourceThrows() {
        let missing = FileManager.default.temporaryDirectory.appendingPathComponent("none-\(UUID().uuidString).sqlite")
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent("dest-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: destination) }
        #expect(throws: SQLiteSnapshotError.self) { try SQLiteSnapshot.copy(from: missing, to: destination) }
    }

    @Test func integrityCheckFailsOnTruncatedFile() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appendingPathComponent("source.sqlite")
        let copy = directory.appendingPathComponent("copy.sqlite")
        let writer = try makeDatabase(at: source, rows: 2000)
        sqlite3_exec(writer, "PRAGMA wal_checkpoint(TRUNCATE);", nil, nil, nil)
        sqlite3_close(writer)
        try SQLiteSnapshot.copy(from: source, to: copy)
        #expect(SQLiteSnapshot.integrityCheck(at: copy))

        let data = try Data(contentsOf: copy)
        try data.prefix(data.count / 2 + 7).write(to: copy)   // truncated mid-page
        #expect(!SQLiteSnapshot.integrityCheck(at: copy))
    }

    @Test func integrityCheckFailsOnMissingFile() {
        let missing = FileManager.default.temporaryDirectory.appendingPathComponent("none-\(UUID().uuidString).sqlite")
        #expect(!SQLiteSnapshot.integrityCheck(at: missing))
    }

    // MARK: - Memorization export

    private func sampleExport(formatVersion: Int = MemorizationExport.currentFormatVersion) -> MemorizationExport {
        let now = Date(epochMilliseconds: 1_790_000_000_500)
        var record = AyahMemorizationRecord.blank(AyahKey(surah: 1, ayah: 1), now: now)
        record.status = .mastered
        return MemorizationExport(formatVersion: formatVersion, exportedAt: now, deviceID: "dev", records: [record],
                                  batches: [], events: [], goals: [], meta: ["device_id": "dev"])
    }

    @Test func exportRoundTrips() throws {
        let export = sampleExport()
        #expect(try MemorizationExport.decode(try export.encode()) == export)
    }

    @Test func exportDecodeRejectsNewerFormat() throws {
        let data = try sampleExport(formatVersion: 99).encode()
        #expect(throws: MemorizationExportError.newerFormat(99)) { try MemorizationExport.decode(data) }
    }

    @Test func exportDecodeRejectsTruncatedJSON() throws {
        let data = try sampleExport().encode()
        #expect(throws: MemorizationExportError.corrupt) { try MemorizationExport.decode(data.prefix(data.count / 2)) }
    }

    @Test func exportDecodeRejectsGarbage() {
        #expect(throws: MemorizationExportError.corrupt) { try MemorizationExport.decode(Data("not json".utf8)) }
        #expect(throws: MemorizationExportError.corrupt) { try MemorizationExport.decode(Data()) }
    }

    @Test func goalDefinitionRoundTripsEveryKind() throws {
        let kinds: [GoalKind] = [.ayatPerDay(10), .pageEquivalentsPerWeek(2.5), .completeSurah(36), .completeJuz(30),
                                 .completeQuranBy(Date(timeIntervalSince1970: 1_800_000_000))]
        for kind in kinds {
            let goal = GoalDefinition(id: UUID(), kind: kind, createdAt: Date(timeIntervalSince1970: 1_790_000_000))
            let data = try BackupCoding.encoder().encode(goal)
            #expect(try BackupCoding.decoder().decode(GoalDefinition.self, from: data) == goal)
        }
    }
}
