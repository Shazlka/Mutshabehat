import Foundation
import XCTest
@testable import Mutshabehat

@MainActor
final class ReadingCloudSyncTests: XCTestCase {
    func testTwoOfflineDevicesConvergeAndKeepDeletions() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("reading-cloud-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let first = QuranReadingDatabase(url: root.appendingPathComponent("first.sqlite"))
        let second = QuranReadingDatabase(url: root.appendingPathComponent("second.sqlite"))
        let service = ICloudDatabaseSyncService()
        let firstKhatma = first.getOrCreateActiveKhatma()
        let secondKhatma = second.getOrCreateActiveKhatma()
        first.addBookmark(type: .ayah, surah: 1, ayah: 1, page: 1)
        _ = first.recordReadAyahs(khatmaId: firstKhatma.id, items: [(1, 1, 1)])
        _ = second.recordReadAyahs(khatmaId: secondKhatma.id, items: [(1, 2, 1)])

        _ = try service.syncReadingSnapshots(in: root, database: first, deviceID: "device-a")
        _ = try service.syncReadingSnapshots(in: root, database: second, deviceID: "device-b")
        _ = try service.syncReadingSnapshots(in: root, database: first, deviceID: "device-a")
        XCTAssertEqual(first.readAyahsCount(khatmaId: firstKhatma.id), 2)
        XCTAssertEqual(second.readAyahsCount(khatmaId: secondKhatma.id), 2)

        second.removeBookmark(type: .ayah, surah: 1, ayah: 1, page: 1)
        second.removeReadAyahsForSurah(khatmaId: secondKhatma.id, surah: 1)
        _ = try service.syncReadingSnapshots(in: root, database: second, deviceID: "device-b")
        _ = try service.syncReadingSnapshots(in: root, database: first, deviceID: "device-a")
        XCTAssertTrue(first.allBookmarks().isEmpty)
        XCTAssertEqual(first.readAyahsCount(khatmaId: firstKhatma.id), 0)
    }
}
