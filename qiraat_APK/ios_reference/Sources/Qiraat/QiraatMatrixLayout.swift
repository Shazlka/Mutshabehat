import SwiftUI

/// The split-matrix body of a Qiraat card: the Quranic word on the leading (right, in RTL) 38%, a hairline
/// divider, and the readers on the other 62%. At accessibility text sizes the two stack instead, so neither
/// column is squeezed to a few characters.
struct QiraatMatrixRow<Word: View, Readers: View>: View {
    private let word: Word
    private let readers: Readers

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.layoutDirection) private var layoutDirection

    init(@ViewBuilder word: () -> Word, @ViewBuilder readers: () -> Readers) {
        self.word = word()
        self.readers = readers()
    }

    var body: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 10) {
                word
                readers
            }
        } else {
            QiraatSplitLayout(wordFraction: 0.38, isRTL: layoutDirection == .rightToLeft) {
                word
                Rectangle().fill(Color.primary.opacity(0.08)).frame(width: 1)
                readers
            }
        }
    }
}

/// Lays out [word, divider, readers] in fixed proportions. A `Layout` places in absolute coordinates, so the
/// right-to-left flip is applied here, not by SwiftUI.
struct QiraatSplitLayout: Layout {
    var wordFraction: CGFloat
    var isRTL: Bool
    var spacing: CGFloat = 12

    private func widths(total: CGFloat) -> (word: CGFloat, readers: CGFloat) {
        let available = max(total - 2 * spacing - 1, 0)
        let word = available * wordFraction
        return (word, available - word)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard subviews.count == 3 else { return .zero }
        let total = proposal.width ?? 320
        let (wordWidth, readersWidth) = widths(total: total)
        let height = max(
            subviews[0].sizeThatFits(ProposedViewSize(width: wordWidth, height: nil)).height,
            subviews[2].sizeThatFits(ProposedViewSize(width: readersWidth, height: nil)).height)
        return CGSize(width: total, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 3 else { return }
        let (wordWidth, readersWidth) = widths(total: bounds.width)
        let wordX = isRTL ? bounds.maxX - wordWidth : bounds.minX
        let readersX = isRTL ? bounds.minX : bounds.maxX - readersWidth
        let dividerX = isRTL ? bounds.maxX - wordWidth - spacing - 1 : bounds.minX + wordWidth + spacing
        subviews[0].place(at: CGPoint(x: wordX, y: bounds.midY), anchor: .leading,
                          proposal: ProposedViewSize(width: wordWidth, height: nil))
        subviews[1].place(at: CGPoint(x: dividerX, y: bounds.minY), anchor: .topLeading,
                          proposal: ProposedViewSize(width: 1, height: bounds.height))
        subviews[2].place(at: CGPoint(x: readersX, y: bounds.midY), anchor: .leading,
                          proposal: ProposedViewSize(width: readersWidth, height: nil))
    }
}
