import Foundation
import SQLite3
import XCTest
@testable import Mutshabehat

final class ReadingDatabaseTransferTests: XCTestCase {
    private var directory: URL!

    override func setUp() {
        super.setUp()
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("reading-transfer-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: directory)
        super.tearDown()
    }

    private func makeDatabase(_ name: String) -> QuranReadingDatabase {
        QuranReadingDatabase(url: directory.appendingPathComponent(name))
    }

    func testFileURLIsTheOpenedFile() {
        let db = makeDatabase("a.sqlite")
        XCTAssertEqual(db.fileURL.lastPathComponent, "a.sqlite")
        XCTAssertTrue(FileManager.default.fileExists(atPath: db.fileURL.path))
    }

    func testExportImportRoundTrip() throws {
        let source = makeDatabase("source.sqlite")
        source.addBookmark(type: .ayah, surah: 2, ayah: 255, page: 42, note: "Kursi")
        source.addBookmark(type: .page, surah: 18, ayah: 1, page: 293)
        let khatma = source.getOrCreateActiveKhatma()
        _ = source.recordReadAyahs(khatmaId: khatma.id, items: [(1, 1, 1), (1, 2, 1), (1, 3, 1)])
        let data = try source.exportDatabase()
        XCTAssertGreaterThan(data.count, 0)

        let target = makeDatabase("target.sqlite")
        target.addBookmark(type: .ayah, surah: 3, ayah: 1, page: 50)
        try target.importDatabase(data)

        XCTAssertEqual(Set(target.allBookmarks().map(\.page)), [42, 293])
        XCTAssertEqual(target.allBookmarks(type: .ayah).first?.note, "Kursi")
        XCTAssertEqual(target.lifetimeReadAyahsCount(), 3)
        // The database is usable after the swap.
        target.addBookmark(type: .ayah, surah: 4, ayah: 1, page: 77)
        XCTAssertEqual(target.allBookmarks().count, 3)
    }

    func testImportRejectsADifferentDatabase() throws {
        let target = makeDatabase("target.sqlite")
        target.addBookmark(type: .ayah, surah: 2, ayah: 1, page: 2)

        let other = directory.appendingPathComponent("other.sqlite")
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(other.path, &handle), SQLITE_OK)
        sqlite3_exec(handle, "CREATE TABLE groups (id TEXT);", nil, nil, nil)
        sqlite3_close(handle)

        XCTAssertThrowsError(try target.importDatabase(Data(contentsOf: other)))
        XCTAssertEqual(target.allBookmarks().count, 1, "current data must be untouched")
    }

    func testImportRejectsGarbageAndEmptyData() {
        let target = makeDatabase("target.sqlite")
        target.addBookmark(type: .ayah, surah: 2, ayah: 1, page: 2)
        XCTAssertThrowsError(try target.importDatabase(Data("not a database".utf8)))
        XCTAssertThrowsError(try target.importDatabase(Data()))
        XCTAssertEqual(target.allBookmarks().count, 1)
    }

    func testExportIsAValidSQLiteFileEvenWithPendingWAL() throws {
        let source = makeDatabase("source.sqlite")
        for i in 1...50 { source.addBookmark(type: .ayah, surah: 2, ayah: i, page: 2) }
        let data = try source.exportDatabase()
        let copy = directory.appendingPathComponent("copy.sqlite")
        try data.write(to: copy)
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open_v2(copy.path, &handle, SQLITE_OPEN_READONLY, nil), SQLITE_OK)
        var statement: OpaquePointer?
        sqlite3_prepare_v2(handle, "SELECT COUNT(*) FROM bookmarks", -1, &statement, nil)
        XCTAssertEqual(sqlite3_step(statement), SQLITE_ROW)
        XCTAssertEqual(sqlite3_column_int(statement, 0), 50)
        sqlite3_finalize(statement)
        sqlite3_close(handle)
    }

    func testMergeDatabasesUnifiesAyahsAndBookmarks() throws {
        let source = makeDatabase("source.sqlite")
        source.addBookmark(type: .ayah, surah: 2, ayah: 255, page: 42, note: "Kursi")
        let sourceKhatma = source.getOrCreateActiveKhatma()
        _ = source.recordReadAyahs(khatmaId: sourceKhatma.id, items: [(1, 1, 1), (1, 2, 1)])

        let target = makeDatabase("target.sqlite")
        target.addBookmark(type: .ayah, surah: 3, ayah: 1, page: 50, note: "Imran")
        let targetKhatma = target.getOrCreateActiveKhatma()
        _ = target.recordReadAyahs(khatmaId: targetKhatma.id, items: [(1, 3, 1), (1, 4, 1)])

        let sourceURL = directory.appendingPathComponent("source.sqlite")
        let stats = try target.mergeDatabase(from: sourceURL)

        XCTAssertEqual(target.readAyahsCount(khatmaId: targetKhatma.id), 4)
        XCTAssertEqual(target.allBookmarks().count, 2)
        XCTAssertEqual(Set(target.allBookmarks().map(\.page)), [42, 50])
    }

    func testMergeKhatmaCompletionAdvancesActiveKhatma() throws {
        let source = makeDatabase("source_khatma.sqlite")
        let srcKhatma1 = source.getOrCreateActiveKhatma()
        _ = source.recordReadAyahs(khatmaId: srcKhatma1.id, items: [(1, 1, 1), (1, 2, 1), (1, 3, 1)])
        _ = source.completeActiveKhatma(khatmaId: srcKhatma1.id)
        let srcKhatma2 = source.getOrCreateActiveKhatma()
        XCTAssertEqual(srcKhatma2.khatmaNumber, 2)

        let target = makeDatabase("target_khatma.sqlite")
        let tgtKhatma1 = target.getOrCreateActiveKhatma()
        _ = target.recordReadAyahs(khatmaId: tgtKhatma1.id, items: [(1, 4, 1)])
        XCTAssertEqual(target.completedKhatmasCount(), 0)

        let sourceURL = directory.appendingPathComponent("source_khatma.sqlite")
        _ = try target.mergeDatabase(from: sourceURL)

        XCTAssertEqual(target.completedKhatmasCount(), 1)
        let tgtActive = target.getOrCreateActiveKhatma()
        XCTAssertEqual(tgtActive.khatmaNumber, 2)
        XCTAssertEqual(target.readAyahsCount(khatmaId: tgtKhatma1.id), 4)
    }

    func testMergeReadingDaysTakesMaxActivity() throws {
        let source = makeDatabase("source_days.sqlite")
        let date = Date()
        source.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, seconds: 300, on: date)

        let target = makeDatabase("target_days.sqlite")
        target.recordDailyReadingActivity(ayahsCount: 5, pagesCount: 2, seconds: 500, on: date)

        let sourceURL = directory.appendingPathComponent("source_days.sqlite")
        _ = try target.mergeDatabase(from: sourceURL)

        let days = target.allReadingDays()
        XCTAssertEqual(days.count, 1)
        XCTAssertEqual(days[0].ayahsRead, 10)
        XCTAssertEqual(days[0].pagesRead, 2)
        XCTAssertEqual(days[0].secondsRead, 500)
    }

    func testMarkSurahCompletedAndUnmark() {
        let db = makeDatabase("surah_test.sqlite")
        let khatma = db.getOrCreateActiveKhatma()

        // Mark Surah 1 (Al-Fatihah, 7 ayahs) as completed
        let items = (1...7).map { (surah: 1, ayah: $0, page: 1) }
        let inserted = db.recordReadAyahs(khatmaId: khatma.id, items: items)
        XCTAssertEqual(inserted, 7)
        XCTAssertEqual(db.readAyahsCountForSurah(khatmaId: khatma.id, surah: 1), 7)
        XCTAssertEqual(db.completedSurahsCount(khatmaId: khatma.id, surahAyahCounts: [1: 7]), 1)

        // Unmark Surah 1
        db.removeReadAyahsForSurah(khatmaId: khatma.id, surah: 1)
        XCTAssertEqual(db.readAyahsCountForSurah(khatmaId: khatma.id, surah: 1), 0)
        XCTAssertEqual(db.completedSurahsCount(khatmaId: khatma.id, surahAyahCounts: [1: 7]), 0)
    }
}
