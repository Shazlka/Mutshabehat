import Foundation
import SQLite3

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

public struct SQLiteError: Error, Equatable, Sendable, CustomStringConvertible {
    public let code: Int32
    public let message: String

    public init(code: Int32, message: String) {
        self.code = code
        self.message = message
    }

    public var description: String {
        "SQLite error \(code): \(message)"
    }
}

public final class SQLiteDatabase: @unchecked Sendable {
    fileprivate let lock = NSRecursiveLock()
    fileprivate var handle: OpaquePointer?

    public init(path: String) throws {
        var opened: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        let result = sqlite3_open_v2(path, &opened, flags, nil)
        guard result == SQLITE_OK, let opened else {
            let message = opened.map { String(cString: sqlite3_errmsg($0)) }
                ?? "Unable to allocate a SQLite connection"
            if let opened {
                sqlite3_close_v2(opened)
            }
            throw SQLiteError(code: result, message: message)
        }

        handle = opened
        do {
            try exec("PRAGMA foreign_keys = ON")
            try exec("PRAGMA journal_mode = WAL")
        } catch {
            sqlite3_close_v2(opened)
            handle = nil
            throw error
        }
    }

    deinit {
        lock.lock()
        defer { lock.unlock() }
        if let handle {
            let result = sqlite3_close_v2(handle)
            assert(result == SQLITE_OK, "sqlite3_close_v2 failed with code \(result)")
        }
    }

    public func close() throws {
        try withLock {
            guard let handle else { return }
            let result = sqlite3_close_v2(handle)
            guard result == SQLITE_OK else { throw makeError(code: result) }
            self.handle = nil
        }
    }

    public func exec(_ sql: String) throws {
        try withLock {
            let connection = try requireHandle()
            var errorMessage: UnsafeMutablePointer<CChar>?
            let result = sqlite3_exec(connection, sql, nil, nil, &errorMessage)
            guard result == SQLITE_OK else {
                let message = errorMessage.map { String(cString: $0) }
                    ?? String(cString: sqlite3_errmsg(connection))
                if let errorMessage {
                    sqlite3_free(errorMessage)
                }
                throw SQLiteError(code: result, message: message)
            }
        }
    }

    public func prepare(_ sql: String) throws -> SQLiteStatement {
        try withLock {
            let connection = try requireHandle()
            var statement: OpaquePointer?
            let result = sqlite3_prepare_v2(connection, sql, -1, &statement, nil)
            guard result == SQLITE_OK, let statement else {
                throw makeError(code: result)
            }
            return SQLiteStatement(database: self, handle: statement)
        }
    }

    public func transaction<T>(_ body: () throws -> T) throws -> T {
        try withLock {
            try exec("BEGIN IMMEDIATE")
            do {
                let value = try body()
                try exec("COMMIT")
                return value
            } catch {
                do {
                    try exec("ROLLBACK")
                } catch let rollbackError {
                    throw rollbackError
                }
                throw error
            }
        }
    }

    fileprivate func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }

    fileprivate func requireHandle() throws -> OpaquePointer {
        guard let handle else {
            throw SQLiteError(code: SQLITE_MISUSE, message: "SQLite connection is closed")
        }
        return handle
    }

    fileprivate func makeError(code: Int32) -> SQLiteError {
        let message = handle.map { String(cString: sqlite3_errmsg($0)) }
            ?? "SQLite connection is closed"
        return SQLiteError(code: code, message: message)
    }
}

public final class SQLiteStatement: @unchecked Sendable {
    private let database: SQLiteDatabase
    private var handle: OpaquePointer?
    private var surfacedStepError: Int32?

    fileprivate init(database: SQLiteDatabase, handle: OpaquePointer) {
        self.database = database
        self.handle = handle
    }

    deinit {
        database.withLock {
            if let handle {
                let result = sqlite3_finalize(handle)
                assert(
                    result == SQLITE_OK || result == surfacedStepError,
                    "sqlite3_finalize failed with an unsurfaced code \(result)"
                )
            }
        }
    }

    public func bind(_ value: String?, at index: Int32) throws {
        try database.withLock {
            let handle = try requireHandle()
            let result = value.map {
                sqlite3_bind_text(handle, index, $0, -1, sqliteTransient)
            } ?? sqlite3_bind_null(handle, index)
            try check(result)
        }
    }

    public func bind(_ value: Int, at index: Int32) throws {
        try bind(Int64(value), at: index)
    }

    public func bind(_ value: Int64, at index: Int32) throws {
        try database.withLock {
            try check(sqlite3_bind_int64(try requireHandle(), index, value))
        }
    }

    public func bind(_ value: Bool, at index: Int32) throws {
        try bind(value ? 1 : 0, at: index)
    }

    public func bind(_ value: Double, at index: Int32) throws {
        try database.withLock {
            try check(sqlite3_bind_double(try requireHandle(), index, value))
        }
    }

    public func bind(_ value: Data?, at index: Int32) throws {
        try database.withLock {
            let handle = try requireHandle()
            guard let value else {
                try check(sqlite3_bind_null(handle, index))
                return
            }
            if value.isEmpty {
                try check(sqlite3_bind_zeroblob(handle, index, 0))
                return
            }
            let result = value.withUnsafeBytes { bytes in
                sqlite3_bind_blob(handle, index, bytes.baseAddress, Int32(bytes.count), sqliteTransient)
            }
            try check(result)
        }
    }

    public func bindNull(at index: Int32) throws {
        try database.withLock {
            try check(sqlite3_bind_null(try requireHandle(), index))
        }
    }

    @discardableResult
    public func step() throws -> Bool {
        try database.withLock {
            let result = sqlite3_step(try requireHandle())
            switch result {
            case SQLITE_ROW:
                return true
            case SQLITE_DONE:
                return false
            default:
                surfacedStepError = result
                throw database.makeError(code: result)
            }
        }
    }

    public func reset() throws {
        try database.withLock {
            let handle = try requireHandle()
            try check(sqlite3_reset(handle))
            try check(sqlite3_clear_bindings(handle))
        }
    }

    public func isNull(at column: Int32) -> Bool {
        database.withLock {
            guard let handle else { return true }
            return sqlite3_column_type(handle, column) == SQLITE_NULL
        }
    }

    public func string(at column: Int32) -> String? {
        database.withLock {
            guard let handle,
                  sqlite3_column_type(handle, column) != SQLITE_NULL,
                  let text = sqlite3_column_text(handle, column) else {
                return nil
            }
            return String(cString: text)
        }
    }

    public func int64(at column: Int32) -> Int64 {
        database.withLock {
            guard let handle else { return 0 }
            return sqlite3_column_int64(handle, column)
        }
    }

    public func int(at column: Int32) -> Int {
        Int(int64(at: column))
    }

    public func double(at column: Int32) -> Double {
        database.withLock {
            guard let handle else { return 0 }
            return sqlite3_column_double(handle, column)
        }
    }

    public func bool(at column: Int32) -> Bool {
        int64(at: column) != 0
    }

    public func data(at column: Int32) -> Data? {
        database.withLock {
            guard let handle, sqlite3_column_type(handle, column) != SQLITE_NULL else {
                return nil
            }
            let count = Int(sqlite3_column_bytes(handle, column))
            guard count > 0 else { return Data() }
            guard let bytes = sqlite3_column_blob(handle, column) else { return nil }
            return Data(bytes: bytes, count: count)
        }
    }

    private func requireHandle() throws -> OpaquePointer {
        guard let handle else {
            throw SQLiteError(code: SQLITE_MISUSE, message: "SQLite statement is finalized")
        }
        return handle
    }

    private func check(_ result: Int32) throws {
        guard result == SQLITE_OK else { throw database.makeError(code: result) }
    }
}
