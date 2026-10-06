import MushafCore
import SwiftUI

/// The page's memorization state in the reader's top banner: its shape, a short word, and a hairline bar of
/// the ayah mix. Colour repeats what the shape and word already say.
struct PageStatusMark: View {
    let page: Int
    let progress: MemorizationPageProgress
    var showsPageNumber = false
    let language: AppLanguage

    var body: some View {
        let status = progress.state
        let color = MemorizationTheme.color(status)
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Text(verbatim: MemorizationTheme.shape(status)).font(.caption.weight(.bold))
                Text(verbatim: MemorizationTheme.shortLabel(status, language: language))
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                if showsPageNumber {
                    Text(verbatim: MemorizationTheme.number(page, language: language))
                        .font(.caption2.monospacedDigit())
                        .opacity(0.8)
                }
            }
            MemorizationMixBar(fractions: progress.mix.fractions)
                .frame(width: 54)
        }
        .foregroundStyle(color)
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Capsule().fill(color.opacity(0.12)))
        .overlay(Capsule().strokeBorder(color.opacity(0.45), lineWidth: 0.5))
        .environment(\.layoutDirection, language.layoutDirection)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(MemorizationTheme.pageSummary(page: page, progress: progress, language: language))
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("memo-banner-mark-\(page)")
    }
}
