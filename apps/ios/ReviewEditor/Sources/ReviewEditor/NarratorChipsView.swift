#if DEBUG
import MushafCore
import SwiftUI
import UIKit

/// Wraps its children onto as many lines as needed (a row of chips that may be long).
struct ReviewFlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal.width ?? .infinity, subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(bounds.width, subviews)
        let rtl = subviews.layoutDirection == .rightToLeft
        for (index, frame) in result.frames.enumerated() {
            let x = rtl ? bounds.maxX - frame.maxX : bounds.minX + frame.minX
            subviews[index].place(at: CGPoint(x: x, y: bounds.minY + frame.minY), proposal: ProposedViewSize(frame.size))
        }
    }

    private func arrange(_ width: CGFloat, _ subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        var frames: [CGRect] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxX = max(maxX, x - spacing)
        }
        return (CGSize(width: maxX, height: y + rowHeight), frames)
    }
}

/// Reader-coloured name chips: both narrators of a reader collapse into the reader's name.
struct NarratorChipsView: View {
    let items: [NarratorDisplayItem]

    var body: some View {
        ReviewFlowLayout(spacing: 6) {
            ForEach(items) { item in
                let color = Color(uiColor: .reviewColor(hex: item.color))
                Text(item.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(color)
                    .padding(.horizontal, 9).padding(.vertical, 3)
                    .background(color.opacity(0.14), in: Capsule())
                    .overlay(Capsule().stroke(color.opacity(0.35), lineWidth: 0.5))
            }
        }
    }
}

extension UIColor {
    /// A "#RRGGBB" colour from the Qiraat data; mid grey when the text is not one.
    static func reviewColor(hex: String) -> UIColor {
        guard let c = QiraatColor(hex: hex) else { return .systemGray }
        return UIColor(red: c.red, green: c.green, blue: c.blue, alpha: 1)
    }
}
#endif
