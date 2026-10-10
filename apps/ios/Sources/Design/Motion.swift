import SwiftUI
import UIKit

extension Animation {
    /// A change that moves or resizes something: 220 ms, ease-out (quart), no bounce.
    static let stateChange = Animation.timingCurve(0.25, 1, 0.5, 1, duration: 0.22)
}

/// `withAnimation`, except that with Reduce Motion on, changes that move things happen at once.
/// Colour and opacity changes can keep using `withAnimation`: Reduce Motion is about movement.
func withMotion<Result>(_ animation: Animation = .stateChange, _ body: () throws -> Result) rethrows -> Result {
    try withAnimation(UIAccessibility.isReduceMotionEnabled ? nil : animation, body)
}
