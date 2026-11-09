import MushafCore
import SwiftUI

/// The footer bar's six actions as the right side rail of iPad landscape, top to bottom, each an icon over its name
/// and at least 44 pt tall. القراءات and المزيد open their menus as popovers beside the rail. Same identifiers as the
/// footer bar, so the reader works the same in every layout.
struct ReaderActionRail: View {
    let appearance: MushafAppearance
    let traits: UITraitCollection
    let openIndex: () -> Void
    let openSearch: () -> Void
    let openBookmarks: () -> Void
    let openMutshabehat: () -> Void
    let openMemorization: () -> Void
    var openMutoon: () -> Void = {}
    let openSettings: () -> Void
    var qiraat: QiraatPreferences
    var qiraatCatalog: QiraatCatalog?
    var openQiraatRoute: (QiraatHubRoute) -> Void = { _ in }

    private enum Menu { case qiraat, more }
    @State private var openMenu: Menu?
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast
    @Namespace private var glassNamespace

    private var opaque: Bool { ChromeContrast.prefersOpaque(reduceTransparency: reduceTransparency, contrast: contrast) }

    var body: some View {
        glassGroup {
            railItems
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
        // Fixed targets in a fixed-width rail; the large content viewer shows the names beyond this size.
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    /// One glass container so the six buttons blend and respond as a group; the flat rail when opaque.
    @ViewBuilder
    private func glassGroup<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        if !opaque {
            GlassEffectContainer(spacing: 6) { content() }
        } else {
            content()
        }
    }

    private var railItems: some View {
        VStack(spacing: 6) {
            item("الفهرس", "list.bullet", id: "open-index", action: openIndex)
            item("بحث", "magnifyingglass", id: "search-button", action: openSearch)
            item("الفواصل", "bookmark.fill", id: "bookmarks-button", action: openBookmarks)
            item("القراءات", qiraat.enabled ? "character.book.closed.fill" : "character.book.closed",
                 id: "qiraat-button", value: qiraat.enabled ? appLocalized("مفعّلة") : appLocalized("متوقفة")) {
                openMenu = .qiraat
            }
            .popover(isPresented: menuBinding(.qiraat), arrowEdge: menuArrowEdge) {
                menuList {
                    QiraatHubContent(qiraat: qiraat, catalog: qiraatCatalog, menu: actions, openRoute: openQiraatRoute)
                }
            }
            item("المزيد", "ellipsis.circle", id: "more-button") { openMenu = .more }
                .popover(isPresented: menuBinding(.more), arrowEdge: menuArrowEdge) {
                    menuList {
                        BarMenuRow("المتشابهات", systemImage: "square.stack.3d.up.fill") { actions.perform(openMutshabehat) }
                            .accessibilityIdentifier("mutshabehat-button")
                        BarMenuRow("الحفظ", systemImage: "book.closed.fill") { actions.perform(openMemorization) }
                            .accessibilityIdentifier("memorization-button")
                        BarMenuRow("المتون", systemImage: "books.vertical.fill") { actions.perform(openMutoon) }
                            .accessibilityIdentifier("mutoon-button")
                    }
                }
            item("الإعدادات", "gearshape.fill", id: "settings-button", action: openSettings)
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(Color(uiColor: appearance.ink(for: traits)))
        // Fixed targets in a fixed-width rail; the large content viewer shows the names beyond this size.
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    /// The rail is on the right of the screen, so a menu opens to its left with the arrow on the menu's right edge.
    private var menuArrowEdge: Edge { direction == .rightToLeft ? .leading : .trailing }

    private func item(_ title: String.LocalizationValue, _ systemImage: String, id: String, value: String? = nil,
                      action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.title3)
                    .frame(height: 26)
                Text(appLocalized(title))
                    .font(.caption2.weight(.medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .contentShape(Rectangle())
            .modifier(RailGlass(id: id, namespace: glassNamespace, enabled: !opaque, outlined: opaque))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(appLocalized(title))
        .accessibilityValue(value.map { Text($0) } ?? Text(verbatim: ""))
        .accessibilityIdentifier(id)
        .accessibilityShowsLargeContentViewer {
            Image(systemName: systemImage)
            Text(appLocalized(title))
        }
    }

    private func menuBinding(_ menu: Menu) -> Binding<Bool> {
        Binding(get: { openMenu == menu }, set: { if !$0 { openMenu = nil } })
    }

    private func menuList<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        BarMenuList { content() }
            .padding(.vertical, 4)
            .presentationCompactAdaptation(.popover)
            .environment(\.layoutDirection, direction)
    }

    /// A row closes the popover first, then does its work once it has gone, so a sheet it opens is never refused.
    private var actions: BarMenuActions {
        BarMenuActions { action in
            openMenu = nil
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(350))
                action()
            }
        }
    }
}


/// The rail button's surface: interactive Liquid Glass, nothing (the flat rail) when the
/// user asks for less transparency.
private struct RailGlass: ViewModifier {
    let id: String
    let namespace: Namespace.ID
    let enabled: Bool
    /// Reduce Transparency or Increase Contrast: the flat button gets a hairline edge.
    let outlined: Bool

    func body(content: Content) -> some View {
        if enabled {
            content
                .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 16))
                .glassEffectID(id, in: namespace)
        } else {
            if outlined {
                content
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color(uiColor: .separator), lineWidth: ChromeContrast.separatorWidth))
            } else {
                content
            }
        }
    }
}
