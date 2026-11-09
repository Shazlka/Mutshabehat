import Foundation
import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

final class ReadingMemorizationFixesTests: XCTestCase {
    private var directory: URL!

    override func setUp() {
        super.setUp()
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("rm-fixes-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        super.tearDown()
    }

    private func exec(_ url: URL, _ sql: String, file: StaticString = #filePath, line: UInt = #line) {
        var raw: OpaquePointer?
        XCTAssertEqual(sqlite3_open(url.path, &raw), SQLITE_OK, file: file, line: line)
        defer { sqlite3_close(raw) }
        XCTAssertEqual(sqlite3_exec(raw, sql, nil, nil, nil), SQLITE_OK, String(cString: sqlite3_errmsg(raw)), file: file, line: line)
    }

    private func rowCount(_ url: URL, _ table: String) -> Int {
        var raw: OpaquePointer?
        guard sqlite3_open(url.path, &raw) == SQLITE_OK else { return -1 }
        defer { sqlite3_close(raw) }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(raw, "SELECT COUNT(*) FROM \(table)", -1, &statement, nil) == SQLITE_OK,
              sqlite3_step(statement) == SQLITE_ROW else { return -1 }
        return Int(sqlite3_column_int64(statement, 0))
    }

    private func insertBatch(_ url: URL, kind: String, createdAt: Int) {
        exec(url, """
            INSERT INTO memorization_batches (id, created_at, kind, label, scope_json, ayah_count, device_id, counts_for_streak, gain_ayahs)
            VALUES ('\(UUID().uuidString)', \(createdAt), '\(kind)', 'x', '{}', 0, 'd', 0, 0);
            """)
    }

    // MARK: Memorization

    func testUnknownBatchKindDoesNotHideLaterBatches() {
        let url = directory.appendingPathComponent("m.sqlite")
        let db = MemorizationDatabase(url: url)
        insertBatch(url, kind: "future-kind", createdAt: 1_000)
        insertBatch(url, kind: "update", createdAt: 2_000)

        let batches = db.batches(limit: 10, offset: 0)
        XCTAssertEqual(batches.count, 1)
        XCTAssertEqual(batches.first?.kind, .update)
    }

    func testReplaceAllRefusesWhenTheDatabaseHoldsUnreadableRows() throws {
        let url = directory.appendingPathComponent("m.sqlite")
        let db = MemorizationDatabase(url: url)
        insertBatch(url, kind: "future-kind", createdAt: 1_000)
        insertBatch(url, kind: "update", createdAt: 2_000)

        let (export, skipped) = db.exportAllReportingSkippedRows(now: Date())
        XCTAssertEqual(skipped, 1)
        XCTAssertEqual(export.batches.count, 1)

        XCTAssertThrowsError(try db.replaceAll(with: export))
        XCTAssertThrowsError(try db.merge(export, now: Date()))
        XCTAssertEqual(rowCount(url, "memorization_batches"), 2, "nothing may be deleted")
    }

    func testReplaceAllStillWorksOnAFullyReadableDatabase() throws {
        let url = directory.appendingPathComponent("m.sqlite")
        let db = MemorizationDatabase(url: url)
        insertBatch(url, kind: "update", createdAt: 2_000)
        let (export, skipped) = db.exportAllReportingSkippedRows(now: Date())
        XCTAssertEqual(skipped, 0)
        XCTAssertNoThrow(try db.replaceAll(with: export))
        XCTAssertEqual(rowCount(url, "memorization_batches"), 1)
    }

    func testFailedMigrationIsExposedAndBlocksWrites() {
        struct Boom: Error {}
        let failing = MemorizationMigration(version: 1) { _ in throw Boom() }
        let db = MemorizationDatabase(url: directory.appendingPathComponent("bad.sqlite"), migrations: [failing])
        XCTAssertNotNil(db.failedMigration)
        let goal = GoalDefinition(id: UUID(), kind: .completeSurah(2), createdAt: Date())
        XCTAssertThrowsError(try db.saveGoal(goal))
        XCTAssertThrowsError(try db.replaceAll(with: MemorizationExport(
            exportedAt: Date(), deviceID: "d", records: [], batches: [], events: [], goals: [], meta: [:])))
    }

    func testHealthyDatabaseHasNoFailedMigration() {
        XCTAssertNil(MemorizationDatabase(url: directory.appendingPathComponent("ok.sqlite")).failedMigration)
    }

    // MARK: Reading

    func testRecordReadingStoresReadAyahsAndActivityTogether() {
        let db = QuranReadingDatabase(url: directory.appendingPathComponent("r.sqlite"))
        let khatma = db.getOrCreateActiveKhatma()
        let count = db.recordReading(khatmaId: khatma.id, items: [(1, 1, 1), (1, 2, 1)], pagesCount: 1, seconds: 30,
                                     activityAyahs: { $0 })
        XCTAssertEqual(count, 2)
        XCTAssertEqual(db.readAyahsCount(khatmaId: khatma.id), 2)
        XCTAssertEqual(db.allReadingDays().first?.ayahsRead, 2)
    }

    func testFailingActivityStepRollsBackTheReadAyahs() {
        let url = directory.appendingPathComponent("r.sqlite")
        let db = QuranReadingDatabase(url: url)
        let khatma = db.getOrCreateActiveKhatma()
        exec(url, "DROP TABLE reading_activity_events;")

        let count = db.recordReading(khatmaId: khatma.id, items: [(1, 1, 1), (1, 2, 1)], pagesCount: 1, seconds: 30,
                                     activityAyahs: { $0 })
        XCTAssertNil(count)
        XCTAssertEqual(db.readAyahsCount(khatmaId: khatma.id), 0, "the read ayahs must be rolled back with the activity")
        XCTAssertTrue(db.allReadingDays().isEmpty)
    }

    func testUnknownKhatmaFailsInsteadOfAdvancingCredit() {
        let db = QuranReadingDatabase(url: directory.appendingPathComponent("r.sqlite"))
        XCTAssertNil(db.recordReading(khatmaId: "no-such-khatma", items: [(1, 1, 1)], pagesCount: 0, seconds: 1,
                                      activityAyahs: { $0 }))
        XCTAssertEqual(db.recordReadAyahs(khatmaId: "no-such-khatma", items: [(1, 1, 1)]), 0)
    }

    func testBookmarkConflictReturnsTheStoredRowsID() {
        let db = QuranReadingDatabase(url: directory.appendingPathComponent("r.sqlite"))
        let first = db.addBookmark(type: .ayah, surah: 18, ayah: 1, page: 293, note: "a")
        let second = db.addBookmark(type: .ayah, surah: 18, ayah: 1, page: 293, note: "b")
        XCTAssertNotNil(first)
        XCTAssertEqual(second?.id, first?.id)
        XCTAssertEqual(db.allBookmarks().first?.id, first?.id)
        XCTAssertEqual(db.allBookmarks().count, 1)
    }

    func testBookmarkSearchAcceptsArabicIndicDigits() {
        let db = QuranReadingDatabase(url: directory.appendingPathComponent("r.sqlite"))
        db.addBookmark(type: .ayah, surah: 18, ayah: 1, page: 293)
        db.addBookmark(type: .ayah, surah: 2, ayah: 1, page: 2)
        XCTAssertEqual(db.allBookmarks(query: "١٨").count, 1)
        XCTAssertEqual(db.allBookmarks(query: "۲۹۳").count, 1)
        XCTAssertEqual(db.allBookmarks(query: "18").count, 1)
    }

    func testDayKeyStaysPosixGregorianASCII() {
        let formatter = QuranReadingDatabase.dayFormatter
        XCTAssertEqual(formatter.locale.identifier, "en_US_POSIX")
        XCTAssertEqual(formatter.calendar.identifier, .gregorian)
        let key = formatter.string(from: Date(timeIntervalSince1970: 1_700_000_000))
        XCTAssertNotNil(key.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression))
    }
}
