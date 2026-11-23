import UIKit

/// The reader's haptic feedback. Generators are kept and prepared so a tick lands with the touch instead of
/// after the Taptic Engine spins up. UIKit generators must be driven from the main actor.
@MainActor
enum Haptics {
    private static let impact = UIImpactFeedbackGenerator(style: .medium)
    private static let selection = UISelectionFeedbackGenerator()

    /// Spins the Taptic Engine up before a touch that will tick (the footer menus).
    static func prepare() {
        selection.prepare()
        impact.prepare()
    }

    /// A firm tap: a Qiraat-marked word was pressed and its details are opening.
    static func wordPress() {
        impact.impactOccurred()
        impact.prepare()
    }

    /// A light tick: the finger moved onto another row of a menu.
    static func selectionChanged() {
        selection.selectionChanged()
        selection.prepare()
    }

    /// A menu coming up under the finger.
    static func menuOpened() {
        impact.impactOccurred(intensity: 0.7)
        impact.prepare()
    }

    /// A row of a menu was chosen.
    static func rowChosen() {
        impact.impactOccurred()
        impact.prepare()
    }
}
