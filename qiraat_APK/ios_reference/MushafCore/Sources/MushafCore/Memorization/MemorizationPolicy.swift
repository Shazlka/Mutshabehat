import Foundation

/// The only place memorization numbers live. No view or service carries its own formula or threshold.
public struct MemorizationPolicy: Sendable {
    /// Share of an ayah counted towards weighted "learning progress", per status.
    public var statusWeights: [MemorizationStatus: Double]
    /// Days until the next review after 1, 2, 3 … consecutive successful reviews (the last entry repeats).
    public var intervalLadderDays: [Int]
    public var forgotIntervalDays: Int
    public var mistakesIntervalDays: Int
    /// A whole surah, or more ayat than this, asks for confirmation before it is applied.
    public var confirmationAyahThreshold: Int
    /// Strict-percentage milestones that are celebrated once.
    public var milestonePercents: [Int]

    public static let standard = MemorizationPolicy(
        statusWeights: [.mastered: 1.0, .memorizedWithErrors: 0.75, .needsMushaf: 0.4, .notMemorized: 0.0],
        intervalLadderDays: [1, 3, 7, 14, 30, 60],
        forgotIntervalDays: 1,
        mistakesIntervalDays: 2,
        confirmationAyahThreshold: 30,
        milestonePercents: [25, 50, 75, 100]
    )

    public func weight(_ status: MemorizationStatus) -> Double {
        statusWeights[status] ?? 0
    }
}
