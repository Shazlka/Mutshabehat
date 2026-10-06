import MushafCore
import SwiftUI

/// 604-cell grid showing memorization progress across every page of the Mushaf.
/// A page's state is the status of its weakest ayah (weakest link).
struct PageGridView: View {
    let store: MemorizationStore
    let language: AppLanguage
    let openPage: (Int) -> Void
    let longPressPage: (Int) -> Void

    private let columns = [GridItem(.adaptive(minimum: 52), spacing: 8)]

    var body: some View {
        let pages = store.snapshot.pages
        ScrollView {
            VStack(spacing: 14) {
                legend
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(pages, id: \.page) { progress in
                        cell(progress)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .accessibilityIdentifier("memo-page-grid")
        .navigationTitle(language == .arabic ? "الصفحات" : "Pages")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Legend

    private var legend: some View {
        VStack(alignment: .leading, spacing: 10) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(MemorizationStatus.allCases, id: \.self) { status in
                    HStack(spacing: 6) {
                        Text(verbatim: MemorizationTheme.shape(status))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(MemorizationTheme.color(status))
                            .frame(width: 24, alignment: .leading)
                        Text(verbatim: MemorizationTheme.label(status, language: language))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                }
            }
            Text(verbatim: language == .arabic
                 ? "حالة الصفحة هي حالة أضعف آية فيها"
                 : "A page's state is its weakest ayah")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.secondary.opacity(0.1))
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memo-page-legend")
    }

    // MARK: - Cell

    private func cell(_ progress: MemorizationPageProgress) -> some View {
        let stateColor = MemorizationTheme.color(progress.state)
        return VStack(spacing: 3) {
            Text(verbatim: MemorizationTheme.number(progress.page, language: language))
                .font(.caption2.weight(.medium).monospacedDigit())
                .foregroundStyle(.primary)
            Text(verbatim: MemorizationTheme.shape(progress.state))
                .font(.caption.weight(.bold))
                .foregroundStyle(stateColor)
            MemorizationMixBar(fractions: progress.mix.fractions, height: 2)
                .padding(.horizontal, 4)
        }
        .frame(minHeight: 52)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(stateColor.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(stateColor.opacity(0.35), lineWidth: 0.5)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            openPage(progress.page)
        }
        .onLongPressGesture {
            longPressPage(progress.page)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(MemorizationTheme.pageSummary(page: progress.page, progress: progress, language: language))
        .accessibilityIdentifier("memo-page-cell-\(progress.page)")
        .accessibilityAddTraits(.isButton)
    }
}
