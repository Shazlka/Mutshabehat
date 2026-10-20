import Foundation
import SQLite3

/// Binds Swift values to SQLite statements safely.
///
/// `sqlite3_bind_text(..., (s as NSString).utf8String, -1, nil)` passes SQLITE_STATIC: SQLite then keeps a pointer
/// into a temporary NSString buffer that Swift may free before `sqlite3_step`. `SQLITE_TRANSIENT` makes SQLite copy
/// the bytes at bind time, so the statement never reads freed memory.
public enum SQLiteBind {
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    @discardableResult
    public static func text(_ statement: OpaquePointer?, _ index: Int32, _ value: String) -> Int32 {
        sqlite3_bind_text(statement, index, value, -1, transient)
    }

    /// Binds NULL for `nil`.
    @discardableResult
    public static func text(_ statement: OpaquePointer?, _ index: Int32, _ value: String?) -> Int32 {
        guard let value else { return sqlite3_bind_null(statement, index) }
        return text(statement, index, value)
    }
}
