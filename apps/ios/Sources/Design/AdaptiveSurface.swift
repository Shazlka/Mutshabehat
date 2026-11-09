import SwiftUI

/// When a floating or bar surface must stop being translucent. Reduce Transparency and Increase Contrast both ask
/// for text that never sits on a blurred, varying backdrop, so the surface turns into an opaque fill with a hairline.
enum AdaptiveSurfacePolicy {
    static func usesOpaqueFill(reduceTransparency: Bool, increasedContrast: Bool) -> Bool {
        reduceTransparency || increasedContrast
    }
}

private struct AdaptiveSurfaceModifier<S: InsettableShape>: ViewModifier {
    let shape: S
    let glassAllowed: Bool
    let shadowed: Bool

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        if AdaptiveSurfacePolicy.usesOpaqueFill(reduceTransparency: reduceTransparency,
                                                increasedContrast: contrast == .increased) {
            content
                .background(Color(uiColor: .secondarySystemBackground), in: shape)
                .overlay(shape.strokeBorder(Color(uiColor: .separator), lineWidth: 0.5))
        } else if glassAllowed {
            content.glassEffect(.regular, in: shape)
        } else if shadowed {
            content
                .background(.thickMaterial, in: shape)
                .overlay(shape.strokeBorder(Color.primary.opacity(0.12), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        } else {
            content.background(.regularMaterial, in: shape)
        }
    }
}

extension View {
    /// A material (Liquid Glass when `glass` is true) normally; an opaque `secondarySystemBackground`
    /// fill with a 0.5 pt separator stroke when Reduce Transparency or Increase Contrast is on.
    /// `shadowed` adds the floating-pill hairline and shadow to the material used when `glass` is false.
    func adaptiveSurface<S: InsettableShape>(in shape: S, glass: Bool = true, shadowed: Bool = false) -> some View {
        modifier(AdaptiveSurfaceModifier(shape: shape, glassAllowed: glass, shadowed: shadowed))
    }
}

/// The backing of a full-width bar (no shape of its own): transparent (its controls are glass),
/// opaque with a hairline on top when transparency is reduced.
private struct AdaptiveBarBackground: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        if AdaptiveSurfacePolicy.usesOpaqueFill(reduceTransparency: reduceTransparency,
                                                increasedContrast: contrast == .increased) {
            content
                .background(Color(uiColor: .secondarySystemBackground))
                .overlay(alignment: .top) {
                    Rectangle().fill(Color(uiColor: .separator)).frame(height: 0.5)
                }
        } else {
            content
        }
    }
}

extension View {
    func adaptiveBarBackground() -> some View {
        modifier(AdaptiveBarBackground())
    }
}
