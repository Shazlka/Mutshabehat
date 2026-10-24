import MushafCore
import SwiftUI

/// Every menu of the reader, in one capsule across the footer under the paper: index, search, bookmarks, the Qiraat
/// menu, more and settings, each an icon over its name like a tab bar. It shows and hides with a tap on the page and
/// never covers the paper; the page number is in the header. A finger on the bar raises a glass lens under the item
/// it touches that glides along as the finger slides, as in the system tab bar.
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

    private static let slots = 6
    @State private var barWidth: CGFloat = 0
    /// The slot, counted from the left of the screen, under the finger; nil while nothing touches the bar.
    @State private var touchedSlot: Int?

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
        .frame(height: BarMetrics.height)
        .background {
            FooterGlass(slots: Self.slots, touchedSlot: touchedSlot,
                        paper: Color(uiColor: appearance.paper(for: traits)))
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { barWidth = $0 }
        // The lens only follows the finger; the buttons and menus underneath still get the tap.
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { touch in
                    guard barWidth > 0 else { return }
                    let slot = min(max(Int(touch.location.x / (barWidth / CGFloat(Self.slots))), 0), Self.slots - 1)
                    if slot != touchedSlot { touchedSlot = slot }
                }
                .onEnded { _ in touchedSlot = nil }
        )
        .padding(.horizontal, 12)
        .padding(.bottom, BarMetrics.bottomPadding)
        .opacity(chromeVisible ? 1 : 0)
        .allowsHitTesting(chromeVisible)
        .accessibilityHidden(!chromeVisible)
        .animation(.easeInOut(duration: 0.2), value: chromeVisible)
        // Items are fixed targets; the large content viewer shows them beyond that.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}

/// The capsule behind the items, and the lens that glides under the touched one.
///
/// On iOS 26 and later both are Liquid Glass in one container, so the lens melts into the bar as the system's does.
/// Before that the bar is a translucent material with a hairline and the lens a soft fill, and with Reduce
/// Transparency the bar is a solid page-coloured pill.
private struct FooterGlass: View {
    let slots: Int
    let touchedSlot: Int?
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

    private let glide = Animation.spring(response: 0.38, dampingFraction: 0.7)

    var body: some View {
        GeometryReader { geo in
            let cell = geo.size.width / CGFloat(slots)
            let lensSize = CGSize(width: max(cell - 6, 0), height: max(geo.size.height - 8, 0))
            Group {
                if #available(iOS 26, *), !Self.forcesFallback {
                    GlassEffectContainer {
                        ZStack(alignment: .leading) {
                            Color.clear.glassEffect(.regular, in: Capsule())
                            if let slot = touchedSlot {
                                Color.clear
                                    .frame(width: lensSize.width, height: lensSize.height)
                                    .glassEffect(.regular.interactive(), in: Capsule())
                                    .offset(x: CGFloat(slot) * cell + 3)
                                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                            }
                        }
                    }
                } else {
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(reduceTransparency ? AnyShapeStyle(paper) : AnyShapeStyle(.ultraThinMaterial))
                            .overlay(Capsule().strokeBorder(.primary.opacity(reduceTransparency ? 0.18 : 0.12), lineWidth: 0.5))
                            .shadow(color: .black.opacity(reduceTransparency ? 0 : 0.12), radius: 8, y: 2)
                        if let slot = touchedSlot {
                            Capsule()
                                .fill(.primary.opacity(0.1))
                                .frame(width: lensSize.width, height: lensSize.height)
                                .offset(x: CGFloat(slot) * cell + 3)
                                .transition(.scale(scale: 0.8).combined(with: .opacity))
                        }
                    }
                }
            }
            .animation(glide, value: touchedSlot)
        }
    }
}

/// The bar's fixed geometry.
private enum BarMetrics {
    static let height: CGFloat = 56
    /// Below this the bar would meet the paper (see `PageController.footerHeight`).
    static let bottomPadding: CGFloat = 6
}

/// An icon over its name, filling its share of the bar.
private struct BarCell: View {
    let systemImage: String
    let label: LocalizedStringKey

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: systemImage)
                .font(.system(size: 21, weight: .medium))
                .frame(height: 24)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, minHeight: BarMetrics.height)
        .contentShape(Rectangle())
    }
}

private struct BarIconButton: View {
    let systemImage: String
    let label: LocalizedStringKey
    let identifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BarCell(systemImage: systemImage, label: label)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityShowsLargeContentViewer {
            Label(label, systemImage: systemImage)
        }
        .accessibilityIdentifier(identifier)
    }
}

/// A bar item that opens a menu; same look, label and large-content viewer as `BarIconButton`.
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
            BarCell(systemImage: systemImage, label: label)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(value ?? "")
        .accessibilityShowsLargeContentViewer {
            Label(label, systemImage: systemImage)
        }
        .accessibilityIdentifier(identifier)
    }
}
