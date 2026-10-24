import MushafCore
import SwiftUI

struct ReaderTopBar: View {
    let chromeVisible: Bool
    let surahTitle: String
    let detailsText: String
    /// Juz and hizb for the reading header; nil hides them.
    let section: ReaderSection?
    let appearance: MushafAppearance
    let traits: UITraitCollection
    let openIndex: () -> Void
    let openSearch: () -> Void
    let openBookmarks: () -> Void
    let openMutshabehat: () -> Void
    let openMemorization: () -> Void
    /// The Qiraat layer's state and catalog. The entry stays in the fixed five-icon group.
    var qiraat: QiraatPreferences
    var qiraatCatalog: QiraatCatalog?
    var openQiraatFilter: () -> Void = {}
    var openQiraatRoute: (QiraatHubRoute) -> Void = { _ in }
    /// Page-status marks for the banner (one page, or both pages of a spread), left to right; empty hides them.
    var memorizationMarks: [(page: Int, progress: MemorizationPageProgress)] = []
    var memorizationLanguage: AppLanguage = .arabic
    var openMemorizationPage: (Int) -> Void = { _ in }
    let openSettings: () -> Void
    let onTapHeader: () -> Void

    var body: some View {
        ZStack {
            // Reading mode header: Surah name on right, Hizb & Juz on left, the page's memorization mark between
            // them in a place of its own, so neither text ever runs under it.
            HStack(alignment: .center, spacing: 8) {
                Text(surahTitle)
                    .font(Font(MushafLibrary.mushafFont(size: 20)))
                    .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
                    .lineLimit(1)
                    .layoutPriority(1)
                    .accessibilityIdentifier("reading-surah-title")

                Spacer(minLength: 0)
                if !chromeVisible {
                    HStack(spacing: 8) {
                        memorizationMarkRow(compact: false)
                        qiraatFilterChip
                    }
                }
                Spacer(minLength: 0)

                if let section {
                    HStack(spacing: 6) {
                        Text(section.juzText)
                        RubDisc(quarter: section.rubInHizb)
                        Text(section.hizbText)
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
                    .lineLimit(1)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(section.accessibilityText)
                    .accessibilityAddTraits(.isStaticText)
                    .accessibilityIdentifier("reading-section-text")
                }
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

                // Compact, between the title and the icons: the title shrinks to make room instead of sliding under it.
                if chromeVisible { memorizationMarkRow(compact: true) }

                HStack(spacing: 0) {
                    TopBarIconButton(systemImage: "magnifyingglass", label: "بحث", identifier: "search-button", action: openSearch)
                    TopBarIconButton(systemImage: "bookmark.fill", label: "الفواصل", identifier: "bookmarks-button", action: openBookmarks)
                    TopBarIconMenu(systemImage: qiraat.enabled ? "character.book.closed.fill" : "character.book.closed",
                                   label: "القراءات", identifier: "qiraat-button",
                                   value: qiraat.enabled ? "مفعّلة" : "متوقفة") {
                        QiraatHubContent(qiraat: qiraat, catalog: qiraatCatalog,
                                         openRoute: openQiraatRoute)
                    }
                    TopBarIconMenu(systemImage: "ellipsis.circle", label: "المزيد", identifier: "more-button") {
                        Button(action: openMutshabehat) { Label("المتشابهات", systemImage: "square.stack.3d.up.fill") }
                            .accessibilityIdentifier("mutshabehat-button")
                        Button(action: openMemorization) { Label("الحفظ", systemImage: "book.closed.fill") }
                            .accessibilityIdentifier("memorization-button")
                    }
                    TopBarIconButton(systemImage: "gearshape.fill", label: "الإعدادات", identifier: "settings-button", action: openSettings)
                }
            }
            .padding(.horizontal, TopBarMetrics.edgePadding)
            .frame(height: 52)
            .background(Color(uiColor: appearance.paper(for: traits)))
            .opacity(chromeVisible ? 1 : 0)
            .allowsHitTesting(chromeVisible)
        }
        .animation(.easeInOut(duration: 0.2), value: chromeVisible)
        // The bar is a fixed 52 pt slot over the page: text grows with the user's size up to a point,
        // and the icons show the large content viewer beyond it.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    /// The current reader or narrator while the Qiraat layer is narrowed to one; a tap opens the picker.
    @ViewBuilder
    private var qiraatFilterChip: some View {
        if qiraat.enabled, let name = qiraatCatalog?.filterShortName(qiraat.filter),
           let full = qiraatCatalog?.filterName(qiraat.filter) {
            FilterChip(isSelected: true, action: openQiraatFilter) {
                Text(name).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: 130)
            .fixedSize()
            .accessibilityLabel(Text("القراءات العشر") + Text(verbatim: ": ") + Text(full))
            .accessibilityHint("لتغيير القارئ أو الراوي")
            .accessibilityIdentifier("qiraat-filter-chip")
        }
    }

    /// Page-status marks (one page, or both pages of a spread), left to right; nothing when they are hidden.
    @ViewBuilder
    private func memorizationMarkRow(compact: Bool) -> some View {
        if !memorizationMarks.isEmpty {
            HStack(spacing: 6) {
                ForEach(memorizationMarks, id: \.page) { mark in
                    Button { openMemorizationPage(mark.page) } label: {
                        PageStatusMark(page: mark.page, progress: mark.progress,
                                       showsPageNumber: memorizationMarks.count > 1, compact: compact,
                                       language: memorizationLanguage)
                    }
                    .buttonStyle(.plain)
                }
            }
            .fixedSize()
            .environment(\.layoutDirection, .leftToRight)
        }
    }
}

/// The bar's fixed geometry.
private enum TopBarMetrics {
    static let edgePadding: CGFloat = 8
    static let iconSize: CGFloat = 44
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

/// A top-bar icon that opens a menu; same size, label and large-content viewer as `TopBarIconButton`.
private struct TopBarIconMenu<Content: View>: View {
    let systemImage: String
    let label: LocalizedStringKey
    let identifier: String
    var value: LocalizedStringKey?
    @ViewBuilder let content: Content

    var body: some View {
        Menu {
            content
        } label: {
            Image(systemName: systemImage)
                .font(.body.weight(.medium))
                .frame(width: TopBarMetrics.iconSize, height: TopBarMetrics.iconSize)
                .contentShape(Rectangle())
        }
        .foregroundStyle(.primary)
        .accessibilityLabel(label)
        .accessibilityValue(value ?? "")
        .accessibilityShowsLargeContentViewer {
            Label(label, systemImage: systemImage)
        }
        .accessibilityIdentifier(identifier)
    }
}

/// What the reading header says about where the page sits: its juz and hizb, and which quarter of the hizb it is in.
struct ReaderSection: Equatable {
    let juzText: String
    let hizbText: String
    /// 1…4.
    let rubInHizb: Int
    let accessibilityText: String
}

/// A small circle filled like a pie by quarter of the hizb: a quarter at the first, half at the second, three
/// quarters at the third and full at the fourth; the next hizb starts again at a quarter.
struct RubDisc: View {
    let quarter: Int
    var diameter: CGFloat = 13

    var body: some View {
        ZStack {
            Circle().stroke(lineWidth: 1.3)
            RubPie(fraction: Double(min(max(quarter, 0), 4)) / 4)
        }
        .frame(width: diameter, height: diameter)
        .accessibilityHidden(true)
    }
}

/// A pie slice from twelve o'clock, clockwise.
struct RubPie: Shape {
    let fraction: Double

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard fraction > 0 else { return path }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        path.move(to: center)
        path.addArc(center: center, radius: min(rect.width, rect.height) / 2,
                    startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * min(fraction, 1)), clockwise: false)
        path.closeSubpath()
        return path
    }
}
