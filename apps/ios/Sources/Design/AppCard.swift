import SwiftUI

/// The one card surface of the app's chrome (statistics, memorization): a 16 pt continuous rounded rectangle on
/// the grouped secondary background. A `secondary.opacity(0.1)` fill has no fixed colour (it takes whatever sits
/// behind it), so it vanishes on some backgrounds; this one is a real system colour, plus a hairline border when
/// the user asks for increased contrast.
private struct AppCardModifier: ViewModifier {
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        content
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: shape)
            .overlay {
                if contrast == .increased {
                    shape.strokeBorder(Color(uiColor: .separator), lineWidth: 0.5)
                }
            }
    }
}

extension View {
    /// Draws this view on the app's card surface. Apply after the padding that should sit inside the card.
    func appCard() -> some View {
        modifier(AppCardModifier())
    }
}
