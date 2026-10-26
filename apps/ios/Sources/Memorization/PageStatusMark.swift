import MushafCore
import SwiftUI

/// The page's memorization state in the reader's top banner: its shape, a short word, and a hairline bar of
/// the ayah mix. Colour repeats what the shape and word already say.
struct PageStatusMark: View {
    let page: Int
    let progress: MemorizationPageProgress
    var showsPageNumber = false
    /// How much the mark shows: everything; the shape over the short word (no ayah-mix bar) where the header is
    /// narrow; or the shape and bar alone where even that does not fit. VoiceOver reads the full summary in every form.
    enum Form { case full, labeled, minimal }
    var form: Form = .full
    let language: AppLanguage
    /// In the side rail the short word may take two lines.
    var wrapsWord = false

    var body: some View {
        let status = progress.state
        let color = MemorizationTheme.color(status)
        Group {
            switch form {
            case .labeled:
                VStack(spacing: 0) {
                    HStack(spacing: 4) {
                        Text(verbatim: MemorizationTheme.shape(status)).font(.subheadline.weight(.bold))
                        if showsPageNumber {
                            Text(verbatim: MemorizationTheme.number(page, language: language))
                                .font(.caption2.monospacedDigit())
                                .opacity(0.8)
                        }
                    }
                    Text(verbatim: MemorizationTheme.shortLabel(status, language: language))
                        .font(.caption2.weight(.semibold))
                        .lineLimit(wrapsWord ? 2 : 1)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: !wrapsWord, vertical: true)
                }
            case .minimal:
                VStack(spacing: 2) {
                    HStack(spacing: 4) {
                        Text(verbatim: MemorizationTheme.shape(status)).font(.subheadline.weight(.bold))
                        if showsPageNumber {
                            Text(verbatim: MemorizationTheme.number(page, language: language))
                                .font(.caption2.monospacedDigit())
                                .opacity(0.8)
                        }
                    }
                    MemorizationMixBar(fractions: progress.mix.fractions)
                        .frame(width: 36)
                }
            case .full:
                VStack(spacing: 2) {
                    HStack(spacing: 4) {
                        Text(verbatim: MemorizationTheme.shape(status)).font(.subheadline.weight(.bold))
                        Text(verbatim: MemorizationTheme.shortLabel(status, language: language))
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                        if showsPageNumber {
                            Text(verbatim: MemorizationTheme.number(page, language: language))
                                .font(.caption2.monospacedDigit())
                                .opacity(0.8)
                        }
                    }
                    MemorizationMixBar(fractions: progress.mix.fractions)
                        .frame(width: 64)
                }
            }
        }
        .foregroundStyle(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Capsule().fill(color.opacity(0.12)))
        .overlay(Capsule().strokeBorder(color.opacity(0.55), lineWidth: 1))
        // The capsule keeps its size; the button around it is at least 44 pt tall.
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .environment(\.layoutDirection, language.layoutDirection)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(MemorizationTheme.pageSummary(page: page, progress: progress, language: language))
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("memo-banner-mark-\(page)")
    }
}
