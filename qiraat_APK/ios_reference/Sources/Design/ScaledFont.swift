import SwiftUI

/// A system font at a display size (an icon, a large number) that still follows the user's text
/// size. Text styles (`.body`, `.caption`…) already scale; use this only for sizes no style covers.
private struct ScaledSystemFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight
    private let design: Font.Design

    init(size: CGFloat, weight: Font.Weight, design: Font.Design, relativeTo style: Font.TextStyle) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
        self.design = design
    }

    func body(content: Content) -> some View {
        content.font(.system(size: size, weight: weight, design: design))
    }
}

extension View {
    func scaledFont(size: CGFloat, weight: Font.Weight = .regular, design: Font.Design = .default,
                    relativeTo style: Font.TextStyle = .largeTitle) -> some View {
        modifier(ScaledSystemFont(size: size, weight: weight, design: design, relativeTo: style))
    }
}
