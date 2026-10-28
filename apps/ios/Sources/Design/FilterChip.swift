import SwiftUI

/// The capsule used for one-of-many filters (surah progress, durations, search variants): filled when
/// selected, a quiet fill otherwise. The visible capsule stays compact; the tap area is 44 pt tall.
struct FilterChip<Label: View>: View {
    let isSelected: Bool
    var unselectedFill: Color = Color(uiColor: .tertiarySystemFill)
    /// The fill while selected; the app's progress green unless a chip stands for a colour of its own.
    var selectedFill: Color = .progressFill
    let action: () -> Void
    @ViewBuilder let label: Label

    var body: some View {
        Button(action: action) {
            label
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(isSelected ? selectedFill : unselectedFill, in: Capsule())
                .foregroundStyle(isSelected ? selectedLabel : Color.primary)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(FilterChipButtonStyle())
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    /// White on the app's own fills; black on a light reader colour, where white would not read.
    private var selectedLabel: Color {
        Self.resolvedSelectedLabel(for: selectedFill)
    }

    private nonisolated static func resolvedSelectedLabel(for fill: Color) -> Color {
        let uiFill = UIColor(fill)
        return Color(uiColor: UIColor { traitCollection in
            UIColor.chipLabel(on: uiFill.resolvedColor(with: traitCollection))
        })
    }
}

private struct FilterChipButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.72 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}
