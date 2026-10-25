import SwiftUI

/// What a row of a footer menu can do to the menu it sits in.
struct BarMenuActions {
    /// Closes the menu, then runs `action` once it has gone, so a full-screen cover or a sheet it opens is never
    /// refused for a popover still on its way out.
    let perform: (@escaping () -> Void) -> Void
}

/// The size of a footer menu: wider and taller than the system menu, whose width and rows cannot be changed.
enum BarMenuMetrics {
    static let width: CGFloat = 330
    static let rowHeight: CGFloat = 58
    static let textSize: CGFloat = 20
    static let iconSize: CGFloat = 23
}

/// One row of a footer menu: the name, and at the other end its symbol, or a check while it is switched on.
struct BarMenuRow: View {
    let title: LocalizedStringKey
    var systemImage: String?
    /// nil for a plain row; true/false for a switch, drawn as a check when on.
    var isOn: Bool?
    let action: () -> Void

    init(_ title: LocalizedStringKey, systemImage: String? = nil, isOn: Bool? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isOn = isOn
        self.action = action
    }

    @Environment(FooterMenuModel.self) private var model: FooterMenuModel?
    @Environment(\.isEnabled) private var isEnabled
    @State private var id = UUID()

    var body: some View {
        HStack(spacing: 14) {
            Text(title)
                .font(.system(size: BarMenuMetrics.textSize, weight: .medium))
                .multilineTextAlignment(.leading)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            Spacer(minLength: 12)
            Group {
                if let isOn {
                    Image(systemName: "checkmark").opacity(isOn ? 1 : 0)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
            }
            .font(.system(size: BarMenuMetrics.iconSize, weight: .regular))
            .frame(width: 34)
        }
        .padding(.horizontal, 22)
        .frame(minHeight: BarMenuMetrics.rowHeight)
        .foregroundStyle(isEnabled ? Color.primary : Color.secondary.opacity(0.6))
        .contentShape(Rectangle())
        // The footer's touch tracker finds the row by its frame and runs it when the finger lifts over it, whether the
        // finger came down here or slid up from the bar; the row itself has no gesture, so nothing runs twice.
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { register(frame: $0) }
        .onChange(of: isEnabled) { register(frame: model?.rows[id]?.frame ?? .zero) }
        .onDisappear { model?.unregister(id) }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityAddTraits(isOn == true ? .isSelected : [])
        .accessibilityAction { if isEnabled { action() } }
    }

    private func register(frame: CGRect) {
        model?.register(id, frame: frame, isEnabled: isEnabled, action: action)
    }
}

/// The rows of a footer menu with a hairline between each.
struct BarMenuList<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        Group(subviews: content) { subviews in
            VStack(spacing: 0) {
                ForEach(Array(subviews.enumerated()), id: \.element.id) { index, row in
                    row
                    if index < subviews.count - 1 { Divider().padding(.horizontal, 22) }
                }
            }
        }
        .padding(.vertical, 6)
        .frame(width: BarMenuMetrics.width)
    }
}

/// A footer menu, drawn as Liquid Glass above the item that opened it. It is part of the reader's own view tree, not a
/// popover window, so the glass sees the page behind it, as the footer capsule does: a popover is a window of its own
/// and its glass would have nothing to show. Before iOS 26 the surface is the system's regular material.
struct BarGlassMenu<Content: View>: View {
    /// Where the item that opened the menu is, across the bar.
    let anchorX: CGFloat
    /// The bar's width and height, and the clear space between the bar and the menu.
    let barSize: CGSize
    let gap: CGFloat
    let close: () -> Void
    @ViewBuilder let content: () -> Content
    @Environment(\.layoutDirection) private var direction
    @Environment(FooterMenuModel.self) private var model: FooterMenuModel?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // A tap anywhere above the bar closes the menu and does nothing more, as outside a popover. The bar itself
            // stays free, so a finger that slides along it can move the menu from one item to the next.
            Color.clear
                .frame(width: 4000, height: 4000)
                .contentShape(Rectangle())
                .onTapGesture(perform: close)
                .offset(y: -barSize.height)
                .accessibilityHidden(true)
            ScrollView {
                BarMenuList(content: content)
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(width: BarMenuMetrics.width)
            .frame(maxHeight: 520)
            .fixedSize(horizontal: false, vertical: true)
            .background { BarMenuSurface(lens: lensFrame) }
            .offset(x: originShift, y: -(barSize.height + gap))
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { model?.panelFrame = $0 }
            .onDisappear { model?.panelFrame = .zero }
            .transition(.scale(scale: 0.88, anchor: UnitPoint(x: anchorUnit, y: 1)).combined(with: .opacity))
            .accessibilityAddTraits(.isModal)
        }
        .frame(width: barSize.width, height: barSize.height, alignment: .bottomLeading)
    }

    /// The row under the finger, in the menu's own space.
    private var lensFrame: CGRect? {
        guard let model else { return nil }
        return model.hoveredFrame.map { $0.offsetBy(dx: -model.panelFrame.minX, dy: -model.panelFrame.minY) }
    }

    /// The menu is centred on its item, kept 8 pt inside the screen's sides.
    private var leading: CGFloat {
        min(max(anchorX - BarMenuMetrics.width / 2, 8), barSize.width - BarMenuMetrics.width - 8)
    }

    /// `leading` is measured from the screen's left. The stack's leading edge is its right in a right-to-left layout,
    /// where an offset also runs the other way.
    private var originShift: CGFloat {
        direction == .rightToLeft ? (barSize.width - BarMenuMetrics.width) - leading : leading
    }

    private var anchorUnit: CGFloat { min(max((anchorX - leading) / BarMenuMetrics.width, 0), 1) }
}

/// The menu's surface, behind its rows: Liquid Glass on iOS 26 and later, with a second, tinted piece of glass that is
/// the lens under the row the finger is over, in one container so the two blend as the lens moves. Before iOS 26 the
/// surface is the system's regular material and the lens a soft fill.
private struct BarMenuSurface: View {
    /// The lens's frame in the menu's space; nil while no row is under the finger.
    let lens: CGRect?
    private let shape = RoundedRectangle(cornerRadius: 30, style: .continuous)
    private let lensShape = RoundedRectangle(cornerRadius: 22, style: .continuous)

    var body: some View {
        if #available(iOS 26, *) {
            GlassEffectContainer {
                ZStack(alignment: .top) {
                    Color.clear.glassEffect(.regular, in: shape)
                    if let lens {
                        Color.clear
                            .frame(width: BarMenuMetrics.width - 16, height: lens.height)
                            .glassEffect(.regular.tint(.primary.opacity(0.14)), in: lensShape)
                            .offset(y: lens.minY)
                            .transition(.scale(scale: 0.9).combined(with: .opacity))
                    }
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.74), value: lens)
        } else {
            ZStack(alignment: .top) {
                shape.fill(.regularMaterial)
                    .overlay(shape.strokeBorder(.primary.opacity(0.12), lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.18), radius: 14, y: 4)
                if let lens {
                    lensShape.fill(.primary.opacity(0.10))
                        .frame(width: BarMenuMetrics.width - 16, height: lens.height)
                        .offset(y: lens.minY)
                        .transition(.opacity)
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.74), value: lens)
        }
    }
}
