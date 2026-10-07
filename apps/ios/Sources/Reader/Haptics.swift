import UIKit

/// The reader's haptic feedback. Generators are kept and prepared so a tick lands with the touch instead of
/// after the Taptic Engine spins up. UIKit generators must be driven from the main actor.
@MainActor
enum Haptics {
    private static let selection = UISelectionFeedbackGenerator()
    private static let impact = UIImpactFeedbackGenerator(style: .medium)

    /// Call when a scrolling gesture begins so the first tick is immediate.
    static func prepareScrolling() { selection.prepare() }

    /// One soft tick, as the index list passes a row.
    static func scrollTick() {
        selection.selectionChanged()
        selection.prepare()
    }

    /// A firm tap: a Qiraat-marked word was pressed and its details are opening.
    static func wordPress() {
        impact.impactOccurred()
        impact.prepare()
    }
}
