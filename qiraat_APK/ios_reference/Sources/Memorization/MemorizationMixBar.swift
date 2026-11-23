import MushafCore
import SwiftUI

/// A thin bar showing how a page's ayat split across the four statuses (by their share of the page),
/// ordered from mastered to not memorized.
struct MemorizationMixBar: View {
    let fractions: [MemorizationStatus: Double]
    var height: CGFloat = 2

    private static let order: [MemorizationStatus] = [.mastered, .memorizedWithErrors, .needsMushaf, .notMemorized]

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: 0) {
                ForEach(Self.order, id: \.self) { status in
                    let share = max(0, fractions[status] ?? 0)
                    Rectangle()
                        .fill(MemorizationTheme.color(status).opacity(status == .notMemorized ? 0.35 : 0.9))
                        .frame(width: proxy.size.width * share)
                }
            }
        }
        .frame(height: height)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }
}
