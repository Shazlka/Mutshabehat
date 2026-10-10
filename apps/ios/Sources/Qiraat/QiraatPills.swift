import MushafCore
import SwiftUI

/// Reader and narrator pills, one per authority, in that authority's own colour.
struct QiraatPills: View {
    let pills: [AuthorityPill]

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(pills) { pill in
                let color = Color(qiraatHex: pill.color)
                HStack(spacing: 5) {
                    Circle().fill(color).frame(width: 6, height: 6)
                    Text(verbatim: pill.name).font(.caption.bold())
                }
                .foregroundStyle(color)
                .padding(.horizontal, 9).padding(.vertical, 4)
                .background(Capsule().fill(color.opacity(0.08)))
                .overlay(Capsule().stroke(color.opacity(0.35)))
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// A small capsule label: a ruling category, a variant kind, a wajh number.
struct QiraatBadge: View {
    let text: String
    let foreground: Color
    let background: Color

    var body: some View {
        Text(verbatim: text).font(.caption2.bold()).foregroundStyle(foreground)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(background))
    }
}

/// Shown on a variant or ruling whose verification status is NEEDS_MANUAL_REVIEW.
struct QiraatNeedsReviewBadge: View {
    var body: some View {
        QiraatBadge(text: "تحتاج مراجعة يدوية", foreground: Color(qiraatHex: "#8a2f10"), background: Color(qiraatHex: "#f7d2c4"))
    }
}
