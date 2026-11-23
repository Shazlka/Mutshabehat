import Foundation

/// Decides whether an automatic backup would replace a good set with a much emptier one. A reinstall or a second
/// device on the same folder starts with empty stores and backs up at once; retention would then delete the real set.
/// Only a person asking for a backup may let a store shrink that far.
public enum BackupRegressionGuard {
    /// A store this size or smaller in the previous set is too small to tell a wipe from ordinary deleting.
    public static let minimumPreviousRows = 10

    /// True when any store present in both sets had at least `minimumPreviousRows` rows before and now has under
    /// half of them. Stores missing from either side, or without a count, are not judged.
    public static func regressed(previous: [String: Int], current: [String: Int]) -> Bool {
        for (name, before) in previous where before >= minimumPreviousRows {
            guard let now = current[name] else { continue }
            if now * 2 < before { return true }
        }
        return false
    }
}
