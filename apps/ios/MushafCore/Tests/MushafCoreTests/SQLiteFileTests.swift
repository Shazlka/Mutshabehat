import Foundation
import SQLite3
import Testing
@testable import MushafCore

@Suite struct SQLiteFileTests {
    // MARK: - Helpers

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sqlitefile-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func open(_ url: URL) throws -> OpaquePointer {
        var handle: OpaquePointer?
        guard sqlite3_open(url.path, &handle) == SQLITE_OK, let handle else { throw SQLiteFileError.unreadable }
        return handle
    }

    private func exec(_ db: OpaquePointer, _ sql: String) {
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    private func scalarText(_ db: OpaquePointer, _ sql: String) -> String? {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { return nil }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW, let text = sqlite3_column_text(statement, 0) else { return nil }
        return String(cString: text)
    }

    /// A real SQLite file (rollback-journal mode) with one table per name.
    @discardableResult
    private func makeDatabase(at url: URL, tables: [String]) throws -> URL {
        let db = try open(url)
        defer { sqlite3_close(db) }
        for table in tables { exec(db, "CREATE TABLE \(table) (x INTEGER);") }
        return url
    }

    private func failure(_ body: () throws -> Void) -> SQLiteFileError? {
        do { try body(); return nil } catch let error as SQLiteFileError { return error } catch { return nil }
    }

    private func message(_ error: SQLiteFileError?) -> String {
        if case let .replaceFailed(text)? = error { return text }
        return ""
    }

    private struct Boom: Error, LocalizedError { var errorDescription: String? { "boom" } }

    // MARK: - validate

    @Test func validateAcceptsFileWithRequiredTables() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = try makeDatabase(at: directory.appendingPathComponent("a.sqlite"), tables: ["a", "b", "c"])
        try SQLiteFile.validate(at: file, requiredTables: ["a", "b"])
    }

    @Test func validateReportsMissingTablesSorted() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = try makeDatabase(at: directory.appendingPathComponent("a.sqlite"), tables: ["a"])
        let error = failure { try SQLiteFile.validate(at: file, requiredTables: ["c", "b", "a"]) }
        #expect(error == .missingTables(["b", "c"]))
    }

    @Test func validateRejectsZeroByteTruncatedAndGarbage() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let inputs: [(String, Data)] = [
            ("zero.sqlite", Data()),
            ("header-only.sqlite", Data("SQLite format 3\0".utf8)),
            ("garbage.sqlite", Data(repeating: 0x41, count: 4096)),
        ]
        for (name, bytes) in inputs {
            let url = directory.appendingPathComponent(name)
            try bytes.write(to: url)
            #expect(failure { try SQLiteFile.validate(at: url, requiredTables: []) } == .unreadable, "\(name)")
        }
    }

    @Test func validateAcceptsBundledMutshabehatSeed() throws {
        // Same route as a real import: the bytes are staged to a fresh file first.
        let bytes = try Data(contentsOf: generatedDirectory.appendingPathComponent("mutshabehat.sqlite"))
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let staged = directory.appendingPathComponent("seed.sqlite")
        try bytes.write(to: staged)
        try SQLiteFile.validate(at: staged, requiredTables: ["groups", "verses", "parts", "automated_groups"])
    }

    // MARK: - checkpoint and configuration

    @Test func checkpointTruncateEmptiesTheWAL() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("w.sqlite")
        let db = try open(url)
        defer { sqlite3_close(db) }
        exec(db, "PRAGMA journal_mode = WAL; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);")

        try SQLiteFile.checkpointTruncate(db)

        let size = (try? FileManager.default.attributesOfItem(atPath: url.path + "-wal")[.size] as? Int) ?? 0
        #expect(size == 0)
    }

    @Test func enableWALAndForeignKeysConfiguresAFreshDatabase() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let db = try open(directory.appendingPathComponent("f.sqlite"))
        defer { sqlite3_close(db) }

        try SQLiteFile.enableWALAndForeignKeys(db)

        #expect(scalarText(db, "PRAGMA journal_mode") == "wal")
        #expect(scalarText(db, "PRAGMA foreign_keys") == "1")
    }

    @Test func checkpointTruncateThrowsWhenAReaderBlocksIt() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("busy.sqlite")
        let writer = try open(url)
        defer { sqlite3_close(writer) }
        exec(writer, "PRAGMA journal_mode = WAL; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);")
        let reader = try open(url)
        defer { sqlite3_close(reader) }
        sqlite3_busy_timeout(writer, 0)
        sqlite3_busy_timeout(reader, 0)

        // The reader pins an older snapshot of the WAL: BEGIN, then a SELECT that is actually stepped.
        exec(reader, "BEGIN;")
        var select: OpaquePointer?
        #expect(sqlite3_prepare_v2(reader, "SELECT count(*) FROM t", -1, &select, nil) == SQLITE_OK)
        #expect(sqlite3_step(select) == SQLITE_ROW)
        sqlite3_finalize(select)

        exec(writer, "INSERT INTO t VALUES (2);")

        let error = failure { try SQLiteFile.checkpointTruncate(writer) }
        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
        // Nothing was broken: the writer still reads both rows and the reader can finish.
        #expect(scalarText(writer, "SELECT count(*) FROM t") == "2")
        #expect(sqlite3_exec(reader, "COMMIT;", nil, nil, nil) == SQLITE_OK)
    }

    // MARK: - sidecars

    @Test func removeSidecarsThrowsWhenTheyCannotBeDeleted() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let target = directory.appendingPathComponent("x")
        try Data([1]).write(to: URL(fileURLWithPath: target.path + "-wal"))
        try Data([1]).write(to: URL(fileURLWithPath: target.path + "-shm"))
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: directory.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: directory.path) }

        let error = failure { try SQLiteFile.removeSidecars(of: target) }
        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
    }

    // MARK: - replaceContents

    private struct Fixture {
        let directory: URL
        let target: URL
        let original: Data
        let replacement: Data
    }

    private func fixture() throws -> Fixture {
        let directory = try temporaryDirectory()
        let target = try makeDatabase(at: directory.appendingPathComponent("target.sqlite"), tables: ["old"])
        let other = try makeDatabase(at: directory.appendingPathComponent("other.sqlite"), tables: ["new"])
        return Fixture(directory: directory, target: target,
                       original: try Data(contentsOf: target), replacement: try Data(contentsOf: other))
    }

    @Test func replaceContentsRunsStepsInOrder() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        var log: [String] = []

        try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                       checkpoint: { log.append("checkpoint") }, close: { log.append("close") },
                                       reopen: { log.append("reopen") })

        #expect(log == ["checkpoint", "close", "reopen"])
        #expect(try SQLiteFile.tableNames(at: f.target) == ["new"])
    }

    @Test func replaceContentsRejectsInvalidDataWithoutClosing() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        var log: [String] = []

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: Data(repeating: 0x41, count: 4096), requiredTables: ["new"],
                                           checkpoint: { log.append("checkpoint") }, close: { log.append("close") },
                                           reopen: { log.append("reopen") })
        }

        #expect(error == .unreadable)
        #expect(log.isEmpty)
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsAbortsWhenCheckpointFails() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        var log: [String] = []

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: { throw Boom() }, close: { log.append("close") },
                                           reopen: { log.append("reopen") })
        }

        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
        #expect(log.isEmpty)
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsAbortsWhenCloseFails() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        var log: [String] = []

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: { log.append("checkpoint") }, close: { throw Boom() },
                                           reopen: { log.append("reopen") })
        }

        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
        #expect(log == ["checkpoint"])   // reopen never ran: the connection was never closed
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsStopsBeforeWritingWhenSidecarCannotBeRemoved() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        try Data([1]).write(to: URL(fileURLWithPath: f.target.path + "-wal"))
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: f.directory.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: f.directory.path) }
        var log: [String] = []

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: { log.append("checkpoint") }, close: { log.append("close") },
                                           reopen: { log.append("reopen") })
        }

        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
        #expect(log == ["checkpoint", "close", "reopen"])   // the connection was closed, so it is reopened exactly once
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsReportsReopenFailureAfterSidecarFailure() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        try Data([1]).write(to: URL(fileURLWithPath: f.target.path + "-wal"))
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: f.directory.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: f.directory.path) }
        var reopens = 0

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: {}, close: {}, reopen: { reopens += 1; throw Boom() })
        }

        #expect(message(error).contains("sidecar"))
        #expect(message(error).contains("reopen failed"))
        #expect(reopens == 1)
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsAbortsWhenTheRollbackBytesCannotBeRead() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        // The "target" is a directory, so reading its bytes fails after validation of the new data succeeded.
        let target = directory.appendingPathComponent("target.sqlite")
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
        let other = try makeDatabase(at: directory.appendingPathComponent("other.sqlite"), tables: ["new"])
        var log: [String] = []

        let error = failure {
            try SQLiteFile.replaceContents(of: target, with: try Data(contentsOf: other), requiredTables: ["new"],
                                           checkpoint: { log.append("checkpoint") }, close: { log.append("close") },
                                           reopen: { log.append("reopen") })
        }

        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
        #expect(log == ["checkpoint"])   // neither close nor reopen ran
    }

    @Test func replaceContentsRestoresPreviousBytesWhenReopenFails() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        var closes = 0
        var reopens = 0

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: {}, close: { closes += 1 },
                                           reopen: { reopens += 1; if reopens == 1 { throw Boom() } })
        }

        guard case .replaceFailed? = error else {
            Issue.record("expected .replaceFailed, got \(String(describing: error))")
            return
        }
        #expect(!message(error).contains("recovery failed"))
        #expect(closes == 2)    // once for the swap, once before the restore
        #expect(reopens == 2)
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsReportsRecoveryFailure() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: {}, close: {}, reopen: { throw Boom() })
        }

        #expect(message(error).contains("boom"))
        #expect(message(error).contains("recovery failed"))
        #expect(try Data(contentsOf: f.target) == f.original)
    }

    @Test func replaceContentsAcceptsAWALModeCandidateStagedWithoutSidecars() throws {
        // What the web sync produces: a database built with `journal_mode = WAL` and then closed; only the main
        // file's bytes travel. A read-only open of such a file fails, so the staged copy is validated read-write.
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        let walFile = f.directory.appendingPathComponent("wal.sqlite")
        let db = try open(walFile)
        exec(db, "PRAGMA journal_mode = WAL; CREATE TABLE new (x INTEGER); INSERT INTO new VALUES (1);")
        sqlite3_close(db)
        let bytes = try Data(contentsOf: walFile)
        #expect(bytes[18] == 2 && bytes[19] == 2, "the candidate must carry the WAL format flags")

        try SQLiteFile.replaceContents(of: f.target, with: bytes, requiredTables: ["new"],
                                       checkpoint: {}, close: {}, reopen: {})

        // Read back read-write: the replaced file still has the WAL flags and no sidecars.
        let replaced = try open(f.target)
        defer { sqlite3_close(replaced) }
        #expect(scalarText(replaced, "SELECT group_concat(name) FROM sqlite_master WHERE type = 'table'") == "new")
    }

    @Test func replaceContentsDoesNotReopenWhenRecoveryCannotCleanUp() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: f.directory.path) }
        var reopens = 0

        let error = failure {
            try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                           checkpoint: {}, close: {}, reopen: {
                reopens += 1
                // The failed reopen leaves a WAL behind and the directory turns read-only: recovery can neither
                // delete the WAL nor restore the old bytes, so it must not open a database on top of them.
                try Data([1]).write(to: URL(fileURLWithPath: f.target.path + "-wal"))
                try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: f.directory.path)
                throw Boom()
            })
        }

        #expect(reopens == 1)
        #expect(message(error).contains("recovery failed"))
        #expect(message(error).contains("not reopened"))
    }

    @Test func checkpointTruncateWaitsForABriefReader() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("brief.sqlite")
        let writer = try open(url)
        defer { sqlite3_close(writer) }
        exec(writer, "PRAGMA journal_mode = WAL; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1);")
        let reader = try open(url)
        exec(reader, "BEGIN;")
        var select: OpaquePointer?
        #expect(sqlite3_prepare_v2(reader, "SELECT count(*) FROM t", -1, &select, nil) == SQLITE_OK)
        #expect(sqlite3_step(select) == SQLITE_ROW)
        sqlite3_finalize(select)
        exec(writer, "INSERT INTO t VALUES (2);")
        // The reader lets go after 0.3 s, on another thread.
        nonisolated(unsafe) let readerHandle = reader
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.3) {
            sqlite3_exec(readerHandle, "COMMIT;", nil, nil, nil)
            sqlite3_close(readerHandle)
        }

        try SQLiteFile.checkpointTruncate(writer, busyTimeoutMs: 3000)
    }

    @Test func replaceContentsRemovesStaleSidecars() throws {
        let f = try fixture()
        defer { try? FileManager.default.removeItem(at: f.directory) }
        try Data([1]).write(to: URL(fileURLWithPath: f.target.path + "-wal"))
        try Data([1]).write(to: URL(fileURLWithPath: f.target.path + "-shm"))

        try SQLiteFile.replaceContents(of: f.target, with: f.replacement, requiredTables: ["new"],
                                       checkpoint: {}, close: {}, reopen: {})

        #expect(!FileManager.default.fileExists(atPath: f.target.path + "-wal"))
        #expect(!FileManager.default.fileExists(atPath: f.target.path + "-shm"))
    }
}
