import MushafCore
import SwiftUI

/// Every menu of the reader, in one capsule across the footer under the paper: index, search, bookmarks, the Qiraat
/// menu, more and settings, each an icon over its name. It shows and hides with a tap on the page and never covers
/// the paper; the page number is in the header.
///
/// The capsule is the system tab bar (`FooterTabBar`), so it looks and moves like the tab bar of any app: Liquid
/// Glass with the system's lens under the touched item on iOS 26 and later, the translucent bar before that. The two
/// items that open a menu open it the moment a finger lands on them: the finger can slide up onto a row, with a glass
/// lens under it and a tick for each row it crosses, and lift to choose it (`FooterMenuModel`).
struct ReaderBottomBar: View {
    let chromeVisible: Bool
    /// Hides the bar by itself after `autoHideDelay` seconds with nothing touched (the Settings option). `autoHideToken`
    /// is anything that counts as using the reader, such as the page; a change of it starts the wait again.
    var autoHides = false
    var autoHideToken = 0
    var onAutoHide: () -> Void = {}
    let appearance: MushafAppearance
    let traits: UITraitCollection
    /// The home-indicator inset of the screen; the bar floats above it.
    let safeBottom: CGFloat
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

    /// How far the system's capsule is inside the bar's sides, measured on iOS 26 and later.
    private static let capsuleInset: CGFloat = 21

    private enum Slot: Int {
        case index, search, bookmarks, qiraat, more, settings
    }

    private enum TouchOrigin { case bar, menu }

    private static let autoHideDelay: Duration = .seconds(10)

    private struct AutoHideKey: Hashable {
        var visible: Bool
        var enabled: Bool
        var menu: Int?
        var token: Int
        var activity: Int
    }

    /// Counts the touches on the bar, so that using it starts the wait for hiding again.
    @State private var activity = 0

    /// The item whose menu is open, if any.
    @State private var openMenu: Slot?
    @State private var menuModel = FooterMenuModel()
    /// Where the finger that is down came down.
    @State private var touchOrigin: TouchOrigin?
    /// The menu the finger that is down opened, so that its lift over the same item leaves it open instead of toggling.
    @State private var openedByTouch: Slot?
    /// Where the finger that is down is now; the system tab bar chooses the item under a lifted finger even when the
    /// finger has slid up off the bar, so a lift away from the bar is not a choice of its item.
    @State private var touchPoint: CGPoint?
    /// True once the fade-in has finished, so assistive technology and UI tests never meet a half-visible bar.
    @State private var isSettled = false
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        FooterTabBar(items: items,
                     ink: appearance.ink(for: traits),
                     colorScheme: appearance.colorScheme,
                     direction: direction,
                     onSelect: select)
            // The system draws the capsule at the top of a bar that is taller than it (room for the home indicator,
            // which the footer's own offset already clears), so the layout counts the capsule's height only.
            .frame(height: ReaderFooterMetrics.barHeight, alignment: .top)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { menuModel.barFrame = $0 }
            .overlay { GeometryReader { menuLayer(barSize: $0.size) } }
            .background { FooterTouchTracker(isActive: chromeVisible, model: menuModel, onTouch: touch) }
            .padding(.bottom, ReaderFooterMetrics.bottomOffset(safeBottom: safeBottom))
            .opacity(chromeVisible ? 1 : 0)
            .allowsHitTesting(chromeVisible)
            .accessibilityHidden(!isSettled)
            .task(id: chromeVisible) {
                if chromeVisible {
                    try? await Task.sleep(for: .milliseconds(260))
                    if !Task.isCancelled { isSettled = true }
                } else {
                    isSettled = false
                }
            }
            .animation(.easeInOut(duration: 0.2), value: chromeVisible)
            .task(id: AutoHideKey(visible: chromeVisible, enabled: autoHides, menu: openMenu?.rawValue,
                                  token: autoHideToken, activity: activity)) {
                guard autoHides, chromeVisible, openMenu == nil else { return }
                try? await Task.sleep(for: Self.autoHideDelay)
                if !Task.isCancelled { onAutoHide() }
            }
            // A menu opens and closes without overshoot; with Reduce Motion it only fades.
            .animation(reduceMotion ? .easeOut(duration: 0.15) : .stateChange, value: openMenu)
            .onChange(of: chromeVisible) { _, visible in if !visible { openMenu = nil } }
            // Items are fixed targets; the large content viewer shows them beyond that.
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .environment(menuModel)
    }

    private var items: [FooterTabBar.Item] {
        [
            .init(id: "open-index", title: appLocalized("الفهرس"), systemImage: "list.bullet"),
            .init(id: "search-button", title: appLocalized("بحث"), systemImage: "magnifyingglass"),
            .init(id: "bookmarks-button", title: appLocalized("الفواصل"), systemImage: "bookmark.fill"),
            .init(id: "qiraat-button", title: appLocalized("القراءات"),
                  systemImage: qiraat.enabled ? "character.book.closed.fill" : "character.book.closed",
                  value: qiraat.enabled ? appLocalized("مفعّلة") : appLocalized("متوقفة")),
            .init(id: "more-button", title: appLocalized("المزيد"), systemImage: "ellipsis.circle"),
            .init(id: "settings-button", title: appLocalized("الإعدادات"), systemImage: "gearshape.fill"),
        ]
    }

    private func select(_ index: Int) {
        if let touchPoint, !menuModel.barFrame.insetBy(dx: 0, dy: -8).contains(touchPoint) { return }
        switch Slot(rawValue: index) {
        case .index: openIndex()
        case .search: openSearch()
        case .bookmarks: openBookmarks()
        case .qiraat: toggleMenu(.qiraat)
        case .more: toggleMenu(.more)
        case .settings: openSettings()
        case nil: break
        }
    }

    /// A lift over a menu item opens the menu, unless that same finger opened it when it came down; a lift over the item
    /// of a menu that is already open closes it. Assistive technology, which sends no touch, comes here alone.
    private func toggleMenu(_ slot: Slot) {
        guard openedByTouch != slot else { return }
        openMenu = openMenu == slot ? nil : slot
    }

    private func touch(_ phase: FooterTouchTracker.Phase, at point: CGPoint) {
        touchPoint = point
        if phase == .began { activity += 1 }
        switch phase {
        case .began:
            menuModel.prepareHaptics()
            touchOrigin = menuModel.barFrame.contains(point) ? .bar : .menu
            if touchOrigin == .bar { barTouch(at: point) }
            menuModel.hover(at: point)
        case .moved:
            if touchOrigin == .bar { barTouch(at: point) }
            menuModel.hover(at: point)
        case .ended:
            menuModel.commit(at: point)
            finishTouch()
        case .cancelled:
            menuModel.hover(at: nil)
            finishTouch()
        }
    }

    /// A finger on the bar opens the menu of the item under it, and moves to the next item's menu as it slides along;
    /// over an item without a menu it closes the one that is open.
    private func barTouch(at point: CGPoint) {
        guard menuModel.barFrame.contains(point), let slot = slot(at: point) else { return }
        if slot == .qiraat || slot == .more {
            guard openMenu != slot else { return }
            openMenu = slot
            openedByTouch = slot
            menuModel.menuOpened()
        } else if openMenu != nil {
            openMenu = nil
        }
    }

    /// The tab bar's own selection of the item under a lifted finger comes with the lift, so what the touch opened is
    /// forgotten only a moment later.
    private func finishTouch() {
        touchOrigin = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(200))
            openedByTouch = nil
            touchPoint = nil
        }
    }

    /// The item under `point`, in window space: the items share the capsule equally, from the right in a right-to-left
    /// layout.
    private func slot(at point: CGPoint) -> Slot? {
        let bar = menuModel.barFrame
        let cell = (bar.width - 2 * Self.capsuleInset) / 6
        guard cell > 0 else { return nil }
        let fromStart = direction == .rightToLeft ? bar.maxX - point.x : point.x - bar.minX
        let index = Int(((fromStart - Self.capsuleInset) / cell).rounded(.down))
        return Slot(rawValue: min(max(index, 0), 5))
    }

    /// The open menu, as Liquid Glass above the item that opened it.
    @ViewBuilder private func menuLayer(barSize: CGSize) -> some View {
        switch openMenu {
        case .qiraat:
            BarGlassMenu(anchorX: anchorX(of: .qiraat, barWidth: barSize.width), barSize: barSize,
                         gap: ReaderFooterMetrics.gap, close: { openMenu = nil }) {
                QiraatHubContent(qiraat: qiraat, catalog: qiraatCatalog, menu: actions, openRoute: openQiraatRoute)
            }
        case .more:
            BarGlassMenu(anchorX: anchorX(of: .more, barWidth: barSize.width), barSize: barSize,
                         gap: ReaderFooterMetrics.gap, close: { openMenu = nil }) {
                BarMenuRow("المتشابهات", systemImage: "square.stack.3d.up.fill") { actions.perform(openMutshabehat) }
                    .accessibilityIdentifier("mutshabehat-button")
                BarMenuRow("الحفظ", systemImage: "book.closed.fill") { actions.perform(openMemorization) }
                    .accessibilityIdentifier("memorization-button")
            }
        default:
            EmptyView()
        }
    }

    /// The middle of an item across the bar, in the bar's own space: the items share the capsule equally, from the
    /// right in a right-to-left layout.
    private func anchorX(of slot: Slot, barWidth: CGFloat) -> CGFloat {
        let cell = (barWidth - 2 * Self.capsuleInset) / 6
        let fromStart = Self.capsuleInset + (CGFloat(slot.rawValue) + 0.5) * cell
        return direction == .rightToLeft ? barWidth - fromStart : fromStart
    }

    /// A row closes the menu first; what it opens (a cover, a sheet) then comes up on a clear screen.
    private var actions: BarMenuActions {
        BarMenuActions { action in
            openMenu = nil
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(200))
                action()
            }
        }
    }
}

/// The bar's fixed geometry, shared with the page layout so the paper ends above the bar.
enum ReaderFooterMetrics {
    static let barHeight: CGFloat = 62
    /// Clear space between the paper and the bar.
    static let gap: CGFloat = 6

    /// How far the bar's bottom edge is from the screen's bottom edge: just above the home indicator, so the rounded
    /// screen corners and the indicator never cut it.
    static func bottomOffset(safeBottom: CGFloat) -> CGFloat { max(safeBottom - 4, 10) }

    /// The slot under the paper that the bar needs on top of the home-indicator inset.
    static func footerHeight(safeBottom: CGFloat) -> CGFloat {
        max(34, barHeight + gap + bottomOffset(safeBottom: safeBottom) - safeBottom)
    }
}
