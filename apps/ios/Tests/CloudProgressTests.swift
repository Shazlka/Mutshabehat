import Foundation
import XCTest
@testable import Mutshabehat

final class CloudProgressTests: XCTestCase {
    func testKhatmaSnapshotPreservesActivityAndAcceptsWholeSecondDates() throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let db = QuranReadingDatabase(url: directory.appending(path: "reading.sqlite"))
        let timestamp = "2026-11-24T02:00:00Z"
        var snapshot = try db.cloudSnapshot()
        snapshot["khatmas"] = [["android-khatma", "1", timestamp, nil, "active", "0.0"]]
        snapshot["khatma_read_ayahs"] = [["android-khatma", "1", "1", "1", timestamp]]
        _ = try db.cloudSnapshot(replacing: snapshot)

        let khatma = db.getOrCreateActiveKhatma()
        XCTAssertEqual(khatma.startedAt, ISO8601DateFormatter().date(from: timestamp))
        XCTAssertEqual(db.readAyahsCount(khatmaId: khatma.id), 1)
    }

    /// An older database has `last_read_at` before `seconds_read` in reading_days; the exchange must not depend on it.
    func testCaptureAndReplaceUseColumnNamesNotPositions() throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let db = QuranReadingDatabase(url: directory.appending(path: "reading.sqlite"))
        var snapshot = try db.cloudSnapshot()
        // Canonical order: date, ayahs, pages, seconds, last_read_at.
        snapshot["reading_days"] = [["2026-10-02", "518", "81", "30", "2026-10-02T11:35:39.192Z"]]
        _ = try db.cloudSnapshot(replacing: snapshot)
        XCTAssertEqual(try db.cloudSnapshot()["reading_days"], snapshot["reading_days"])
        XCTAssertEqual(ProgressDataset.columns["reading_days"], ["date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"])
        XCTAssertThrowsError(try db.cloudSnapshot(replacing: snapshot.merging(["reading_days": [["2026-10-02", "1"]]]) { $1 }),
                             "a row with the wrong number of values must be rejected")
    }

    func testInvalidImportPreservesProgressAndDeviceIdentity() throws {
        let file = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: file) }
        let db = MemorizationDatabase(url: file)
        let device = db.deviceID
        var existing = try db.cloudSnapshot()
        existing["memorization_goals"] = [["goal-1", "{}"]]
        XCTAssertEqual(try db.cloudSnapshot(replacing: existing), existing)

        var invalid = existing
        invalid["memorization_meta"] = [["device_id", "other-device"]]
        XCTAssertThrowsError(try db.cloudSnapshot(replacing: invalid))
        XCTAssertEqual(try db.cloudSnapshot(), existing)
        XCTAssertEqual(db.deviceID, device)
    }
}
