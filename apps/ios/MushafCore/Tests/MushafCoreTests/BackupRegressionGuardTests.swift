import Foundation
import SQLite3
import Testing
@testable import MushafCore

@Suite struct BackupRegressionGuardTests {
    @Test func aStoreThatLostMoreThanHalfItsRowsIsARegression() {
        #expect(BackupRegressionGuard.regressed(previous: ["reading.sqlite": 40], current: ["reading.sqlite": 3]))
        #expect(BackupRegressionGuard.regressed(previous: ["a.sqlite": 100, "b.sqlite": 50], current: ["a.sqlite": 100, "b.sqlite": 0]))
    }

    @Test func ordinaryChangesAndSmallStoresAreNot() {
        #expect(!BackupRegressionGuard.regressed(previous: ["reading.sqlite": 40], current: ["reading.sqlite": 25]))
        #expect(!BackupRegressionGuard.regressed(previous: ["reading.sqlite": 9], current: ["reading.sqlite": 0]),
                "under ten rows cannot tell a wipe from deleting")
        #expect(!BackupRegressionGuard.regressed(previous: [:], current: ["reading.sqlite": 0]))
        #expect(!BackupRegressionGuard.regressed(previous: ["gone.sqlite": 80], current: [:]),
                "a store missing from the new set is not judged here")
    }

    @Test func countsTheRowsOfEveryOwnTable() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let url = dir.appendingPathComponent("c.sqlite")
        var db: OpaquePointer?
        #expect(sqlite3_open(url.path, &db) == SQLITE_OK)
        let sql = "CREATE TABLE a(x); CREATE TABLE \"b c\"(y); INSERT INTO a VALUES (1),(2),(3); INSERT INTO \"b c\" VALUES (9);"
        #expect(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK)
        sqlite3_close(db)

        #expect(SQLiteFile.totalRowCount(ofStagedCopyAt: url) == 4)
        #expect(SQLiteFile.totalRowCount(ofStagedCopyAt: dir.appendingPathComponent("missing.sqlite")) == nil)
    }
}
