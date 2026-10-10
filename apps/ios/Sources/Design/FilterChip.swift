import SwiftUI

/// The capsule used for one-of-many filters (surah progress, durations, search variants): filled when
/// selected, a quiet fill otherwise. The visible capsule stays compact; the tap area is 44 pt tall.
struct FilterChip<Label: View>: View {
    let isSelected: Bool
    var unselectedFill: Color = Color(uiColor: .tertiarySystemFill)
    let action: () -> Void
    @ViewBuilder let label: Label

    var body: some View {
        Button(action: action) {
            label
                .font(.caption.bold())
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? Color.progressFill : unselectedFill, in: Capsule())
                .foregroundStyle(isSelected ? Color.white : Color.primary)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
