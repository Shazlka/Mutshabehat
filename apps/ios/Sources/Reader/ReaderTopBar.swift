import MushafCore
import SwiftUI

struct ReaderTopBar: View {
    let chromeVisible: Bool
    let surahTitle: String
    let detailsText: String
    let sectionText: String
    let appearance: MushafAppearance
    let traits: UITraitCollection
    let openIndex: () -> Void
    let openSearch: () -> Void
    let openBookmarks: () -> Void
    let openMutshabehat: () -> Void
    let openMemorization: () -> Void
    /// Page-status marks for the banner (one page, or both pages of a spread), left to right; empty hides them.
    var memorizationMarks: [(page: Int, progress: MemorizationPageProgress)] = []
    var memorizationLanguage: AppLanguage = .arabic
    var openMemorizationPage: (Int) -> Void = { _ in }
    let openSettings: () -> Void
    let onTapHeader: () -> Void

    var body: some View {
        ZStack {
            // Reading mode header: Surah name on right, Hizb & Juz on left
            HStack(alignment: .center) {
                Text(surahTitle)
                    .font(Font(MushafLibrary.mushafFont(size: 20)))
                    .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
                    .lineLimit(1)
                    .accessibilityIdentifier("reading-surah-title")

                Spacer()

                Text(sectionText)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
                    .lineLimit(1)
                    .accessibilityIdentifier("reading-section-text")
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .contentShape(Rectangle())
            .onTapGesture { onTapHeader() }
            .opacity(chromeVisible ? 0 : 1)

            // Navigation chrome top bar: covers the reading header in the exact same top slot
            HStack(spacing: 6) {
                Button(action: openIndex) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(surahTitle)
                            .font(Font(MushafLibrary.mushafFont(size: 18)))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .accessibilityIdentifier("surah-title")
                        Text(detailsText)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .accessibilityIdentifier("page-number")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(uiColor: .secondarySystemFill)))
                }
                .buttonStyle(.plain)
                .layoutPriority(1)
                .accessibilityIdentifier("open-index")
                .accessibilityLabel("\(surahTitle)، \(detailsText)")

                HStack(spacing: 0) {
                    TopBarIconButton(systemImage: "magnifyingglass", label: "بحث", identifier: "search-button", action: openSearch)
                    TopBarIconButton(systemImage: "bookmark.fill", label: "الفواصل", identifier: "bookmarks-button", action: openBookmarks)
                    TopBarIconButton(systemImage: "square.stack.3d.up.fill", label: "المتشابهات", identifier: "mutshabehat-button", action: openMutshabehat)
                    TopBarIconButton(systemImage: "book.closed.fill", label: "الحفظ", identifier: "memorization-button", action: openMemorization)
                    TopBarIconButton(systemImage: "gearshape.fill", label: "الإعدادات", identifier: "settings-button", action: openSettings)
                }
            }
            .padding(.horizontal, TopBarMetrics.edgePadding)
            .frame(height: 52)
            .background(.regularMaterial)
            .opacity(chromeVisible ? 1 : 0)
            .allowsHitTesting(chromeVisible)
        }
        .animation(.easeInOut(duration: 0.2), value: chromeVisible)
        // The bar is a fixed 52 pt slot over the page: text grows with the user's size up to a point,
        // and the icons show the large content viewer beyond it.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .overlay {
            // Outside the header/controls cross-fade. With the header showing it sits in the free middle of the
            // banner; with the controls showing it shrinks to its compact form and sits just past the icon
            // group, measured from the icons' fixed widths, so it never covers a control.
            if !memorizationMarks.isEmpty {
                HStack(spacing: 6) {
                    ForEach(memorizationMarks, id: \.page) { mark in
                        Button { openMemorizationPage(mark.page) } label: {
                            PageStatusMark(page: mark.page, progress: mark.progress,
                                           showsPageNumber: memorizationMarks.count > 1, compact: chromeVisible,
                                           language: memorizationLanguage)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.leading, chromeVisible ? TopBarMetrics.iconGroupWidth + TopBarMetrics.edgePadding + 6 : 0)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: chromeVisible ? .leading : .center)
                .environment(\.layoutDirection, .leftToRight)
            }
        }
    }
}

/// The bar's fixed geometry, shared by the icons and the memorization mark that sits beside them.
private enum TopBarMetrics {
    static let edgePadding: CGFloat = 8
    static let iconSize: CGFloat = 44
    static let iconCount: CGFloat = 5
    static var iconGroupWidth: CGFloat { iconSize * iconCount }
}

private struct TopBarIconButton: View {
    let systemImage: String
    let label: LocalizedStringKey
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.body.weight(.medium))
                .frame(width: TopBarMetrics.iconSize, height: TopBarMetrics.iconSize)
        }
        .foregroundStyle(.primary)
        .accessibilityLabel(label)
        .accessibilityShowsLargeContentViewer {
            Label(label, systemImage: systemImage)
        }
        .accessibilityIdentifier(identifier)
    }
}
