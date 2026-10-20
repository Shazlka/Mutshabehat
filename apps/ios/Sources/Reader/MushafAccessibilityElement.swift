import UIKit

/// A VoiceOver element whose double-tap runs `onActivate` instead of a tap at its centre (an ayah's
/// centre can fall on another ayah or a Qiraat word).
final class MushafAccessibilityElement: UIAccessibilityElement {
    var onActivate: (() -> Bool)?
    override func accessibilityActivate() -> Bool { onActivate?() ?? false }
}
