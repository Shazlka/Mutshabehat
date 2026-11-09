import Foundation
import SQLite3
import XCTest
@testable import Mutshabehat

final class DataLayerFixesTests: XCTestCase {
    private var testDB: QuranReadingDatabase!
    private var tempDirectoryURL: URL!

    override func setUp() {
        super.setUp()
        tempDirectoryURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: tempDirectoryURL, withIntermediateDirectories: true)
        testDB = QuranReadingDatabase(url: tempDirectoryURL.appendingPathComponent("test_reading.sqlite"))
    }

    override func tearDown() {
        testDB = nil
        if let url = tempDirectoryURL { try? FileManager.default.removeItem(at: url) }
        super.tearDown()
    }

    func testDayKeyFormatterIsPosixGregorianAscii() {
        let formatter = QuranReadingDatabase.dayFormatter
        XCTAssertEqual(formatter.locale.identifier, "en_US_POSIX")
        XCTAssertEqual(formatter.calendar.identifier, .gregorian)
        let key = formatter.string(from: Date(timeIntervalSince1970: 1_700_000_000))
        XCTAssertNotNil(key.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression))
        XCTAssertTrue(key.allSatisfy { $0.isASCII })
    }

    func testStreakSurvivesALastRecordedDayAheadOfToday() {
        let today = Date()
        guard let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: today) else {
            return XCTFail("Date calculation failed")
        }
        testDB.recordDailyReadingActivity(ayahsCount: 5, pagesCount: 1, on: tomorrow)

        let streaks = testDB.calculateStreaks(asOf: today)
        XCTAssertGreaterThan(streaks.currentStreak, 0)
    }

    func testNullTextColumnReadsAsEmptyString() {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(":memory:", &handle), SQLITE_OK)
        defer { sqlite3_close(handle) }
        var statement: OpaquePointer?
        XCTAssertEqual(sqlite3_prepare_v2(handle, "SELECT NULL, 'x';", -1, &statement, nil), SQLITE_OK)
        defer { sqlite3_finalize(statement) }
        XCTAssertEqual(sqlite3_step(statement), SQLITE_ROW)
        XCTAssertEqual(sqliteColumnText(statement, 0), "")
        XCTAssertEqual(sqliteColumnText(statement, 1), "x")
    }
}
