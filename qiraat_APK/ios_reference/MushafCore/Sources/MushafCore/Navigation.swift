import Foundation

/// Two-page spreads (iPad landscape): the odd page sits on the RIGHT, its even partner on the left.
/// 604 is even, so every spread is complete: (1,2), (3,4) … (603,604).
public enum Spread {
    public static func rightPage(of page: Int) -> Int { page % 2 == 1 ? page : page - 1 }
    public static func leftPage(of page: Int) -> Int { rightPage(of: page) + 1 }
    /// Whether a container of this size shows spreads — the web reader's rule,
    /// `(min-width: 1024px) and (orientation: landscape)`.
    public static func isSpread(width: Double, height: Double) -> Bool { width >= 1024 && width > height }
}

/// Clamps any page number a user, a deep link or stored state can produce.
public func clampPage(_ page: Int) -> Int { min(max(page, 1), mushafPageCount) }

/// The page to reopen on launch. Same key as the web reader so the meaning is shared.
public struct ReadingPosition {
    public static let key = "mushaf1441:last-page:v1"
    private let defaults: UserDefaults
    public init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    /// 1 when nothing (or garbage) is stored; otherwise the stored page, clamped to 1…604.
    public var page: Int {
        get {
            let stored = defaults.integer(forKey: Self.key)
            return stored == 0 ? 1 : clampPage(stored)
        }
        nonmutating set { defaults.set(clampPage(newValue), forKey: Self.key) }
    }
}
