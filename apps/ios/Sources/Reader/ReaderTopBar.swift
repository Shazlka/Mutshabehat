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
                    .font(.system(size: 15, weight: .medium))
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

                TopBarIconButton(systemImage: "magnifyingglass", label: "بحث", identifier: "search-button", action: openSearch)
                TopBarIconButton(systemImage: "bookmark.fill", label: "الفواصل", identifier: "bookmarks-button", action: openBookmarks)
                TopBarIconButton(systemImage: "square.stack.3d.up.fill", label: "المتشابهات", identifier: "mutshabehat-button", action: openMutshabehat)
                TopBarIconButton(systemImage: "gearshape.fill", label: "الإعدادات", identifier: "settings-button", action: openSettings)
            }
            .padding(.horizontal, 8)
            .frame(height: 52)
            .background(.regularMaterial)
            .opacity(chromeVisible ? 1 : 0)
            .allowsHitTesting(chromeVisible)
        }
        .animation(.easeInOut(duration: 0.2), value: chromeVisible)
    }
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
                .frame(minWidth: 38, minHeight: 40)
        }
        .foregroundStyle(.primary)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}
