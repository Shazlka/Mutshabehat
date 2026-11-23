import Foundation
import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

final class MemorizationDatabaseTests: XCTestCase {
    private var tempDirectoryURL: URL!
    private var dbURL: URL!

    override func setUp() {
        super.setUp()
        tempDirectoryURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: tempDirectoryURL, withIntermediateDirectories: true)
        dbURL = tempDirectoryURL.appendingPathComponent("test_memorization.sqlite")
    }

    override func tearDown() {
        if let url = tempDirectoryURL {
            try? FileManager.default.removeItem(at: url)
        }
        super.tearDown()
    }

    func testFreshDatabaseHasSchemaVersionOne() {
        let db = MemorizationDatabase(url: dbURL)
        XCTAssertEqual(db.schemaVersion, 1)
    }

    func testEmptyDatabaseLoadsNoRecords() {
        let db = MemorizationDatabase(url: dbURL)
        let records = db.loadRecords()
        XCTAssertTrue(records.isEmpty)
    }

    func testReopeningKeepsRows() {
        let db1 = MemorizationDatabase(url: dbURL)
        let record = AyahMemorizationRecord(
            surah: 2,
            ayah: 255,
            status: .mastered,
            reviewStrength: .strong,
            isCurrentlyLearning: true,
            firstMemorizedAt: Date(epochMilliseconds: 1_700_000_000_000),
            lastStatusChangedAt: Date(epochMilliseconds: 1_700_000_100_000),
            lastReviewedAt: Date(epochMilliseconds: 1_700_000_200_000),
            nextReviewAt: Date(epochMilliseconds: 1_700_000_300_000),
            reviewCount: 5,
            successfulReviewCount: 4,
            consecutiveSuccessfulReviews: 3,
            errorCount: 1,
            updatedAt: Date(epochMilliseconds: 1_700_000_400_000)
        )
        db1.upsertRecordForTesting(record)

        let db2 = MemorizationDatabase(url: dbURL)
        let records = db2.loadRecords()
        XCTAssertEqual(records.count, 1)
        let key = AyahKey(surah: 2, ayah: 255)
        XCTAssertEqual(records[key], record)
    }

    func testStatusOutsideRangeIsRejectedByCheck() {
        let db = MemorizationDatabase(url: dbURL)
        XCTAssertEqual(db.schemaVersion, 1)

        var rawDB: OpaquePointer?
        let openRC = sqlite3_open(db.fileURL.path, &rawDB)
        XCTAssertEqual(openRC, SQLITE_OK)
        defer { sqlite3_close(rawDB) }

        let sql = """
        INSERT INTO memorization_ayahs (
            surah, ayah, status, review_strength, is_learning,
            review_count, successful_review_count, consecutive_successful_reviews, error_count,
            updated_at
        ) VALUES (1, 1, 9, 1, 0, 0, 0, 0, 0, 1700000000000);
        """
        let execRC = sqlite3_exec(rawDB, sql, nil, nil, nil)
        XCTAssertNotEqual(execRC, SQLITE_OK, "Inserting status 9 directly must fail CHECK constraint")
    }

    func testDeviceIDIsStableAcrossReopen() {
        let db1 = MemorizationDatabase(url: dbURL)
        let deviceID1 = db1.deviceID
        XCTAssertFalse(deviceID1.isEmpty)

        let db2 = MemorizationDatabase(url: dbURL)
        let deviceID2 = db2.deviceID
        XCTAssertEqual(deviceID1, deviceID2)
    }

    func testOlderFileIsMigrated() {
        let migration1Only = MemorizationMigrations.all.filter { $0.version == 1 }
        let db1 = MemorizationDatabase(url: dbURL, migrations: migration1Only)
        XCTAssertEqual(db1.schemaVersion, 1)

        let record = AyahMemorizationRecord(
            surah: 1,
            ayah: 1,
            status: .mastered,
            reviewStrength: .strong,
            isCurrentlyLearning: false,
            updatedAt: Date(epochMilliseconds: 1_700_000_000_000)
        )
        db1.upsertRecordForTesting(record)

        let v2 = MemorizationMigration(version: 2) { db in
            let rc = sqlite3_exec(db, "ALTER TABLE memorization_ayahs ADD COLUMN note TEXT;", nil, nil, nil)
            guard rc == SQLITE_OK else {
                throw NSError(domain: "TestMigration", code: Int(rc))
            }
        }

        let db2 = MemorizationDatabase(url: dbURL, migrations: MemorizationMigrations.all + [v2])
        XCTAssertEqual(db2.schemaVersion, 2)
        let loaded = db2.loadRecords()
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded[record.key], record)
    }

    func testFailedMigrationRollsBackAndKeepsVersion() {
        let db1 = MemorizationDatabase(url: dbURL)
        XCTAssertEqual(db1.schemaVersion, 1)

        let record = AyahMemorizationRecord(
            surah: 1,
            ayah: 1,
            status: .mastered,
            reviewStrength: .strong,
            isCurrentlyLearning: false,
            updatedAt: Date(epochMilliseconds: 1_700_000_000_000)
        )
        db1.upsertRecordForTesting(record)

        struct MigrationFailError: Error {}
        let failingMigration = MemorizationMigration(version: 2) { db in
            _ = sqlite3_exec(db, "ALTER TABLE memorization_ayahs ADD COLUMN note TEXT;", nil, nil, nil)
            throw MigrationFailError()
        }

        let db2 = MemorizationDatabase(url: dbURL, migrations: MemorizationMigrations.all + [failingMigration])
        XCTAssertEqual(db2.schemaVersion, 1)

        let loaded = db2.loadRecords()
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded[record.key], record)
    }

    func testMetaGetAndSet() {
        let db = MemorizationDatabase(url: dbURL)
        XCTAssertNil(db.meta("test_key"))
        db.setMeta("test_key", "test_val")
        XCTAssertEqual(db.meta("test_key"), "test_val")
        db.setMeta("test_key", "updated_val")
        XCTAssertEqual(db.meta("test_key"), "updated_val")
    }

    func testFreshDatabaseWithNoMigrationsHasSchemaVersionZero() {
        let db = MemorizationDatabase(url: dbURL, migrations: [])
        XCTAssertEqual(db.schemaVersion, 0)
    }

    func testReopeningKeepsRecordWithNilDates() {
        let db1 = MemorizationDatabase(url: dbURL)
        let record = AyahMemorizationRecord(
            surah: 114,
            ayah: 6,
            status: .notMemorized,
            reviewStrength: .notReviewed,
            isCurrentlyLearning: false,
            updatedAt: Date(epochMilliseconds: 1_700_000_000_000)
        )
        db1.upsertRecordForTesting(record)

        let db2 = MemorizationDatabase(url: dbURL)
        let records = db2.loadRecords()
        XCTAssertEqual(records[AyahKey(surah: 114, ayah: 6)], record)
    }
}
