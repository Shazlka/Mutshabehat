import MushafCore
import SwiftUI

/// The owner rebuilds the sheet selection (including the page font) when a neighbour is chosen.
struct QiraatSheetNavigator: View {
    let orderedRefs: [MarkedWordRef]
    let currentRef: MarkedWordRef
    let onSelect: (MarkedWordRef) -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: 4) {
                    position
                    HStack {
                        previousButton
                        Spacer(minLength: 8)
                        nextButton
                    }
                }
            } else {
                HStack(spacing: 8) {
                    previousButton
                    Spacer(minLength: 0)
                    position
                    Spacer(minLength: 0)
                    nextButton
                }
            }
        }
        .font(.subheadline)
        .foregroundStyle(Color(uiColor: .mushafInk))
        .padding(.horizontal, 8)
        .background(Color(uiColor: .mushafPaper))
        .environment(\.layoutDirection, .rightToLeft)
    }

    private var position: some View {
        let index = orderedRefs.firstIndex { $0.id == currentRef.id }
        return Text(verbatim: "\(ArabicDigits.string(index.map { $0 + 1 } ?? 0)) من \(ArabicDigits.string(orderedRefs.count))")
            .monospacedDigit()
            .accessibilityIdentifier("qiraat-sheet-position")
    }

    private var previousButton: some View {
        navigationButton("السابق", symbol: "chevron.backward",
                         ref: orderedRefs.previous(before: currentRef), identifier: "qiraat-sheet-prev")
    }

    private var nextButton: some View {
        navigationButton("التالي", symbol: "chevron.forward",
                         ref: orderedRefs.next(after: currentRef), identifier: "qiraat-sheet-next")
    }

    private func navigationButton(_ title: String, symbol: String, ref: MarkedWordRef?,
                                  identifier: String) -> some View {
        Button {
            if let ref { withMotion { onSelect(ref) } }
        } label: {
            Label(title, systemImage: symbol)
                .labelStyle(.titleAndIcon)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(ref == nil ? 0.4 : 1)
        .disabled(ref == nil)
        .accessibilityLabel(title)
        .accessibilityIdentifier(identifier)
    }
}
