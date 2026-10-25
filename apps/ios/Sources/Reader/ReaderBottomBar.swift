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

    private static let slots = 6

    /// A debug switch (`-force-lens-slot N`) to see the lens at rest in a screenshot.
    private static let forcedLensSlot: Int? = {
#if DEBUG
        let args = CommandLine.arguments
        return args.firstIndex(of: "-force-lens-slot").flatMap { args.indices.contains($0 + 1) ? Int(args[$0 + 1]) : nil }
#else
        nil
#endif
    }()
    /// The slot, counted from the left of the screen, under the finger; nil while nothing touches the bar.
    @State private var touchedSlot: Int?
    /// The slot touched last, for the UI test that cannot read the lens while a finger is down.
    @State private var lastTouchedSlot: Int?
    /// True once the fade-in has finished, so assistive technology and UI tests never meet a half-visible bar.
    @State private var isSettled = false

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
            FooterGlass(slots: Self.slots, touchedSlot: touchedSlot ?? Self.forcedLensSlot,
                        paper: Color(uiColor: appearance.paper(for: traits)))
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }

        // The lens only follows the finger; the buttons and menus underneath still get the tap.
        .background { BarTouchTracker(slots: Self.slots, isActive: chromeVisible) { slot in
            touchedSlot = slot
            if let slot { lastTouchedSlot = slot }
        } }
#if DEBUG
        // A one-point probe for the UI tests, in a corner where it covers no button.
        .overlay(alignment: .topLeading) {
            Color.clear.frame(width: 1, height: 1)
                .accessibilityElement()
                .accessibilityIdentifier("footer-bar")
                .accessibilityValue(Text(verbatim: "slot:\(touchedSlot.map(String.init) ?? "none") last:\(lastTouchedSlot.map(String.init) ?? "none")"))
        }
#endif
        .padding(.horizontal, 12)
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
        // Items are fixed targets; the large content viewer shows them beyond that.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}

/// The capsule behind the items, and the lens that glides under the touched one.
///
/// On iOS 26 and later both are Liquid Glass in one container: the bar is regular glass and the lens interactive
/// glass with a light tint, behind the icons so they stay sharp, as the selected tab's lens in the system tab bar.
/// Before that the bar is a translucent material with a hairline and the lens a soft fill; with Reduce Transparency
/// the bar is a solid page-coloured pill.
private struct FooterGlass: View {
    let slots: Int
    let touchedSlot: Int?
    let paper: Color
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    /// A debug switch to see the pre-iOS 26 look on a simulator that has only a newer runtime.
    static let forcesFallback: Bool = {
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
            let lensSize = CGSize(width: max(cell - 4, 0), height: max(geo.size.height - 8, 0))
            Group {
                if #available(iOS 26, *), !Self.forcesFallback {
                    GlassEffectContainer {
                        ZStack(alignment: .leading) {
                            Color.clear.glassEffect(.regular, in: Capsule())
                            if let slot = touchedSlot {
                                Capsule()
                                    .fill(.primary.opacity(0.10))
                                    .frame(width: lensSize.width, height: lensSize.height)
                                    .glassEffect(.regular.tint(.primary.opacity(0.10)).interactive(), in: Capsule())
                                    .offset(x: CGFloat(slot) * cell + 2)
                                    .transition(.scale(scale: 0.85).combined(with: .opacity))
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
                                .offset(x: CGFloat(slot) * cell + 2)
                                .transition(.scale(scale: 0.85).combined(with: .opacity))
                        }
                    }
                }
            }
            .animation(glide, value: touchedSlot)
        }
    }
}

/// The bar's fixed geometry, shared with the page layout so the paper ends above the bar.
enum ReaderFooterMetrics {
    static let barHeight: CGFloat = 60
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

private enum BarMetrics {
    static let height = ReaderFooterMetrics.barHeight
}

/// An icon over its name, filling its share of the bar.
private struct BarCell: View {
    let systemImage: String
    let label: LocalizedStringKey

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: systemImage)
                .font(.system(size: 25, weight: .medium))
                .frame(height: 28)
            Text(label)
                .font(.system(size: 12, weight: .semibold))
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

/// Reports which of the bar's equal slots, counted from the left of the screen, a finger touching the bar is over,
/// as it lands and as it slides, and nil when it lifts. A recogniser on the window sees the touch beside the
/// buttons and menus without taking it from them, which a SwiftUI gesture on the bar does not.
private struct BarTouchTracker: UIViewRepresentable {
    let slots: Int
    let isActive: Bool
    let onSlot: (Int?) -> Void

    func makeUIView(context: Context) -> TrackerView { TrackerView() }

    func updateUIView(_ view: TrackerView, context: Context) {
        view.slots = slots
        view.isActive = isActive
        view.onSlot = onSlot
    }

    final class TrackerView: UIView, UIGestureRecognizerDelegate {
        var slots = 1
        var isActive = true
        var onSlot: (Int?) -> Void = { _ in }
        private weak var attachedWindow: UIWindow?
        private var isTouching = false
        private lazy var hover = UIHoverGestureRecognizer(target: self, action: #selector(hovered(_:)))
        private lazy var recognizer: UILongPressGestureRecognizer = {
            let r = UILongPressGestureRecognizer(target: self, action: #selector(touched(_:)))
            r.minimumPressDuration = 0
            r.allowableMovement = .greatestFiniteMagnitude
            r.cancelsTouchesInView = false
            r.delaysTouchesBegan = false
            r.delaysTouchesEnded = false
            r.delegate = self
            return r
        }()

        override init(frame: CGRect) {
            super.init(frame: frame)
            isUserInteractionEnabled = false
            backgroundColor = .clear
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            attachedWindow?.removeGestureRecognizer(recognizer)
            attachedWindow?.removeGestureRecognizer(hover)
            attachedWindow = window
            hover.delegate = self
            window?.addGestureRecognizer(recognizer)
            window?.addGestureRecognizer(hover)
        }

        override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard isActive, let window else { return false }
            let point = gestureRecognizer.location(in: window)
            guard bounds.contains(convert(point, from: window)) else { return false }
            // A menu opened from the bar is drawn in this window, over the bar. Touches on it are the menu's: a
            // state change here would rebuild the open menu and drop the tap on its item.
            var content: UIView = self
            while let parent = content.superview, parent !== window { content = parent }
            guard let hit = window.hitTest(point, with: nil) else { return false }
            return hit.isDescendant(of: content)
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        private func slot(at recognizer: UIGestureRecognizer) -> Int? {
            guard let window, bounds.width > 0 else { return nil }
            let point = convert(recognizer.location(in: window), from: window)
            guard bounds.insetBy(dx: 0, dy: -8).contains(point) else { return nil }
            return min(max(Int(point.x / (bounds.width / CGFloat(slots))), 0), slots - 1)
        }

        @objc private func touched(_ recognizer: UILongPressGestureRecognizer) {
            switch recognizer.state {
            case .began, .changed:
                isTouching = true
                guard let window, bounds.width > 0 else { return }
                let x = convert(recognizer.location(in: window), from: window).x
                onSlot(min(max(Int(x / (bounds.width / CGFloat(slots))), 0), slots - 1))
            default:
                isTouching = false
                onSlot(nil)
            }
        }

        /// A pointer over the bar (iPad, Mac) raises the lens as a finger does, before anything is chosen.
        @objc private func hovered(_ recognizer: UIHoverGestureRecognizer) {
            guard !isTouching else { return }
            switch recognizer.state {
            case .began, .changed: onSlot(slot(at: recognizer))
            default: onSlot(nil)
            }
        }
    }
}
