import UIKit

/// The reader's haptic feedback. Generators are kept and prepared so a tick lands with the touch instead of
/// after the Taptic Engine spins up. UIKit generators must be driven from the main actor.
@MainActor
enum Haptics {
    private static let impact = UIImpactFeedbackGenerator(style: .medium)

    /// A firm tap: a Qiraat-marked word was pressed and its details are opening.
    static func wordPress() {
        impact.impactOccurred()
        impact.prepare()
    }
}
