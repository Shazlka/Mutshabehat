import Foundation

/// Memorization stores and exports every date as whole milliseconds. A `Date` built from an epoch-millisecond
/// integer is a pure function of that integer, so a value that went through the database, a backup file
/// or a merge compares equal to the in-memory one.
public extension Date {
    var epochMilliseconds: Int64 { Int64((timeIntervalSince1970 * 1000).rounded()) }

    init(epochMilliseconds: Int64) {
        self.init(timeIntervalSince1970: Double(epochMilliseconds) / 1000)
    }

    /// The same instant at millisecond precision. Pass the clock through this before building records.
    var normalizedToMilliseconds: Date { Date(epochMilliseconds: epochMilliseconds) }
}
