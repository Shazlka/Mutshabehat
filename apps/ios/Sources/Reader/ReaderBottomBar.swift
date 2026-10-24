import MushafCore
import SwiftUI

/// Every menu of the reader, in one floating capsule under the paper: index, search, bookmarks, the Qiraat menu,
/// more and settings. It shows and hides with a tap on the page and never covers the paper; the page number is in
/// the header. The page and the header do not move for it.
///
/// On iOS 26 and later the capsule is Liquid Glass. Before that it is a translucent material with a hairline, and a
/// solid page-coloured pill when Reduce Transparency is on.
struct ReaderBottomBar: View {
    let chromeVisible: Bool
    let appearance: MushafAppearance
    let traits: UITraitCollection
    let openIndex: () -> Void
    let openSearch: () -> Void
    let openBookmarks: () -> Void
    let openMutshabehat: () -> Void
    let openMemorization: () -> Void
    let openSettings: () -> Void
    /// The Qiraat layer's state and catalog.
    var qiraat: QiraatPreferences
    var qiraatCatalog: QiraatCatalog?
    var openQiraatRoute: (QiraatHubRoute) -> Void = { _ in }

    var body: some View {
        HStack(spacing: 0) {
            BarIconButton(systemImage: "list.bullet", label: "الفهرس", identifier: "open-index", action: openIndex)
            BarIconButton(systemImage: "magnifyingglass", label: "بحث", identifier: "search-button", action: openSearch)
            BarIconButton(systemImage: "bookmark.fill", label: "الفواصل", identifier: "bookmarks-button", action: openBookmarks)
            BarIconMenu(systemImage: qiraat.enabled ? "character.book.closed.fill" : "character.book.closed",
                        label: "القراءات", identifier: "qiraat-button",
                        value: qiraat.enabled ? "مفعّلة" : "متوقفة") {
                QiraatHubContent(qiraat: qiraat, catalog: qiraatCatalog, openRoute: openQiraatRoute)
            }
            BarIconMenu(systemImage: "ellipsis.circle", label: "المزيد", identifier: "more-button") {
                Button(action: openMutshabehat) { Label("المتشابهات", systemImage: "square.stack.3d.up.fill") }
                    .accessibilityIdentifier("mutshabehat-button")
                Button(action: openMemorization) { Label("الحفظ", systemImage: "book.closed.fill") }
                    .accessibilityIdentifier("memorization-button")
            }
            BarIconButton(systemImage: "gearshape.fill", label: "الإعدادات", identifier: "settings-button", action: openSettings)
        }
        .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
        .padding(.horizontal, 8)
        .frame(height: BarMetrics.iconSize)
        .modifier(FooterGlass(paper: Color(uiColor: appearance.paper(for: traits))))
        .padding(.bottom, 6)
        .opacity(chromeVisible ? 1 : 0)
        .allowsHitTesting(chromeVisible)
        .accessibilityHidden(!chromeVisible)
        .animation(.easeInOut(duration: 0.2), value: chromeVisible)
        // Icons are fixed 44 pt targets; the large content viewer shows them beyond that.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}

/// The capsule behind the icons.
private struct FooterGlass: ViewModifier {
    let paper: Color
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    /// A debug switch to see the pre-iOS 26 look on a simulator that has only a newer runtime.
    private static let forcesFallback: Bool = {
#if DEBUG
        CommandLine.arguments.contains("-force-glass-fallback")
#else
        false
#endif
    }()

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26, *), !Self.forcesFallback {
            // The system adapts the glass itself to Reduce Transparency and to the page's light or dark scheme.
            GlassEffectContainer {
                content.glassEffect(.regular, in: Capsule())
            }
        } else if reduceTransparency {
            content
                .background(paper, in: Capsule())
                .overlay(Capsule().strokeBorder(.primary.opacity(0.18), lineWidth: 0.5))
        } else {
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(.primary.opacity(0.12), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        }
    }
}

/// The bar's fixed geometry.
private enum BarMetrics {
    static let iconSize: CGFloat = 44
}

private struct BarIconButton: View {
    let systemImage: String
    let label: LocalizedStringKey
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.body.weight(.medium))
                .frame(width: BarMetrics.iconSize, height: BarMetrics.iconSize)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(label)
        .accessibilityShowsLargeContentViewer {
            Label(label, systemImage: systemImage)
        }
        .accessibilityIdentifier(identifier)
    }
}

/// A bar icon that opens a menu; same size, label and large-content viewer as `BarIconButton`.
private struct BarIconMenu<Content: View>: View {
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
                .frame(width: BarMetrics.iconSize, height: BarMetrics.iconSize)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(label)
        .accessibilityValue(value ?? "")
        .accessibilityShowsLargeContentViewer {
            Label(label, systemImage: systemImage)
        }
        .accessibilityIdentifier(identifier)
    }
}
