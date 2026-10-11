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
            if let activeRef {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(spacing: 4) {
                        position(for: activeRef)
                        HStack {
                            previousButton(from: activeRef)
                            Spacer(minLength: 8)
                            nextButton(from: activeRef)
                        }
                    }
                } else {
                    HStack(spacing: 8) {
                        previousButton(from: activeRef)
                        Spacer(minLength: 0)
                        position(for: activeRef)
                        Spacer(minLength: 0)
                        nextButton(from: activeRef)
                    }
                }
            }
        }
        .font(.subheadline)
        .foregroundStyle(Color(uiColor: .mushafInk))
        .padding(.horizontal, 8)
        .background(Color(uiColor: .mushafPaper))
        .environment(\.layoutDirection, .rightToLeft)
        .onAppear(perform: recoverMissingSelection)
        .onChange(of: orderedRefs) { _, _ in recoverMissingSelection() }
        .onChange(of: currentRef.id) { _, _ in recoverMissingSelection() }
    }

    private var activeRef: MarkedWordRef? { orderedRefs.nearest(to: currentRef) }

    private func position(for ref: MarkedWordRef) -> some View {
        let index = orderedRefs.firstIndex { $0.id == ref.id }
        return Text("\(ArabicDigits.string(index.map { $0 + 1 } ?? 1)) من \(ArabicDigits.string(orderedRefs.count))")
            .monospacedDigit()
            .accessibilityIdentifier("qiraat-sheet-position")
    }

    private func previousButton(from ref: MarkedWordRef) -> some View {
        navigationButton("السابق", symbol: "chevron.backward",
                         ref: orderedRefs.previous(before: ref), identifier: "qiraat-sheet-prev")
    }

    private func nextButton(from ref: MarkedWordRef) -> some View {
        navigationButton("التالي", symbol: "chevron.forward",
                         ref: orderedRefs.next(after: ref), identifier: "qiraat-sheet-next")
    }

    private func recoverMissingSelection() {
        guard !orderedRefs.contains(where: { $0.id == currentRef.id }), let activeRef else { return }
        onSelect(activeRef)
    }

    private func navigationButton(_ title: LocalizedStringKey, symbol: String, ref: MarkedWordRef?,
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
        .accessibilityLabel(Text(title))
        .accessibilityIdentifier(identifier)
    }
}
