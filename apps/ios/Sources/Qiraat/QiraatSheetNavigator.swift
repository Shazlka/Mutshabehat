import MushafCore
import SwiftUI

/// The owner rebuilds the sheet selection (including the page font) when a neighbour is chosen.
struct QiraatSheetNavigator: View {
    let orderedRefs: [MarkedWordRef]
    let currentRef: MarkedWordRef
    var canNavigatePrevious: Bool? = nil
    var canNavigateNext: Bool? = nil
    var onSelectPrevious: (() -> Void)? = nil
    var onSelectNext: (() -> Void)? = nil
    let onSelect: ((MarkedWordRef) -> Void)?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(
        orderedRefs: [MarkedWordRef],
        currentRef: MarkedWordRef,
        canNavigatePrevious: Bool? = nil,
        canNavigateNext: Bool? = nil,
        onSelectPrevious: (() -> Void)? = nil,
        onSelectNext: (() -> Void)? = nil,
        onSelect: ((MarkedWordRef) -> Void)? = nil
    ) {
        self.orderedRefs = orderedRefs
        self.currentRef = currentRef
        self.canNavigatePrevious = canNavigatePrevious
        self.canNavigateNext = canNavigateNext
        self.onSelectPrevious = onSelectPrevious
        self.onSelectNext = onSelectNext
        self.onSelect = onSelect
    }

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

    private var activeRef: MarkedWordRef? {
        if orderedRefs.contains(where: { $0.id == currentRef.id }) {
            return currentRef
        }
        return orderedRefs.nearest(to: currentRef) ?? currentRef
    }

    private func position(for ref: MarkedWordRef) -> some View {
        let index = orderedRefs.firstIndex { $0.id == ref.id }
        let currentNum = index.map { ArabicDigits.string($0 + 1) } ?? "—"
        return Text("\(currentNum) من \(ArabicDigits.string(orderedRefs.count))")
            .monospacedDigit()
            .accessibilityIdentifier("qiraat-sheet-position")
    }

    private var hasPrevious: Bool {
        if let can = canNavigatePrevious { return can }
        return orderedRefs.previous(before: currentRef) != nil
    }

    private var hasNext: Bool {
        if let can = canNavigateNext { return can }
        return orderedRefs.next(after: currentRef) != nil
    }

    private func previousButton(from ref: MarkedWordRef) -> some View {
        Button {
            withMotion {
                if let onSelectPrevious {
                    onSelectPrevious()
                } else if let prev = orderedRefs.previous(before: ref) {
                    onSelect?(prev)
                }
            }
        } label: {
            Label("الكلمة السابقة", systemImage: "chevron.backward")
                .labelStyle(.titleAndIcon)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(hasPrevious ? 1 : 0.4)
        .disabled(!hasPrevious)
        .accessibilityLabel(Text("الكلمة السابقة"))
        .accessibilityIdentifier("qiraat-sheet-prev")
    }

    private func nextButton(from ref: MarkedWordRef) -> some View {
        Button {
            withMotion {
                if let onSelectNext {
                    onSelectNext()
                } else if let next = orderedRefs.next(after: ref) {
                    onSelect?(next)
                }
            }
        } label: {
            Label("الكلمة التالية", systemImage: "chevron.forward")
                .labelStyle(.titleAndIcon)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(hasNext ? 1 : 0.4)
        .disabled(!hasNext)
        .accessibilityLabel(Text("الكلمة التالية"))
        .accessibilityIdentifier("qiraat-sheet-next")
    }

    private func recoverMissingSelection() {
        guard !orderedRefs.isEmpty else { return }
        guard onSelectPrevious == nil && onSelectNext == nil else { return }
        guard !orderedRefs.contains(where: { $0.id == currentRef.id }), let activeRef else { return }
        onSelect?(activeRef)
    }
}
