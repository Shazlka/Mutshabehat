import SwiftUI
import UIKit

/// What the footer's menus know about the finger: where their rows are, which one the finger is over, and the haptics
/// that go with moving across them. A finger can go down on a footer item, slide up onto a row and lift to choose it,
/// as in a system menu, or go down on a row of a menu that is already open.
@MainActor @Observable
final class FooterMenuModel {
    struct Row {
        var frame: CGRect
        var isEnabled: Bool
        var action: () -> Void
    }

    /// The frame, in window space, of the row under the finger; the glass lens follows it.
    private(set) var hoveredFrame: CGRect?

    @ObservationIgnored private(set) var rows: [UUID: Row] = [:]
    @ObservationIgnored private var hoveredID: UUID?
    /// The footer bar and the open menu, in window space; the menu's is `.zero` while none is open.
    @ObservationIgnored var barFrame: CGRect = .zero
    @ObservationIgnored var panelFrame: CGRect = .zero
    @ObservationIgnored private let selection = UISelectionFeedbackGenerator()
    @ObservationIgnored private let impact = UIImpactFeedbackGenerator(style: .medium)

    func register(_ id: UUID, frame: CGRect, isEnabled: Bool, action: @escaping () -> Void) {
        rows[id] = Row(frame: frame, isEnabled: isEnabled, action: action)
    }

    func unregister(_ id: UUID) {
        rows[id] = nil
        if hoveredID == id { setHovered(nil) }
    }

    func prepareHaptics() {
        selection.prepare()
        impact.prepare()
    }

    /// A menu coming up under the finger.
    func menuOpened() { impact.impactOccurred(intensity: 0.7) }

    /// Moves the lens to the row under `point`, with a tick each time it changes row; nil takes it away.
    func hover(at point: CGPoint?) {
        setHovered(point.flatMap(row(at:)))
    }

    /// Lifts the finger at `point`: runs the row under it, if there is one, and takes the lens away.
    @discardableResult
    func commit(at point: CGPoint) -> Bool {
        defer { setHovered(nil) }
        guard let id = row(at: point), let row = rows[id] else { return false }
        impact.impactOccurred()
        row.action()
        return true
    }

    private func row(at point: CGPoint) -> UUID? {
        guard panelFrame.minX...panelFrame.maxX ~= point.x else { return nil }
        return rows.first { $0.value.isEnabled && $0.value.frame.minY...$0.value.frame.maxY ~= point.y }?.key
    }

    private func setHovered(_ id: UUID?) {
        guard id != hoveredID else { return }
        hoveredID = id
        hoveredFrame = id.flatMap { rows[$0]?.frame }
        if id != nil {
            selection.selectionChanged()
            selection.prepare()
        }
    }
}

/// Reports a finger that goes down on the footer bar or on its open menu, as it slides and when it lifts. A recogniser
/// on the window sees the touch beside the bar's buttons and the menu's rows without taking it from them.
struct FooterTouchTracker: UIViewRepresentable {
    enum Phase { case began, moved, ended, cancelled }

    let isActive: Bool
    let model: FooterMenuModel
    let onTouch: (Phase, CGPoint) -> Void

    func makeUIView(context: Context) -> TrackerView { TrackerView() }

    func updateUIView(_ view: TrackerView, context: Context) {
        view.isActive = isActive
        view.model = model
        view.onTouch = onTouch
    }

    final class TrackerView: UIView, UIGestureRecognizerDelegate {
        var isActive = true
        var model: FooterMenuModel?
        var onTouch: (Phase, CGPoint) -> Void = { _, _ in }
        private weak var attachedWindow: UIWindow?
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
            attachedWindow = window
            window?.addGestureRecognizer(recognizer)
        }

        override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard isActive, let window, let model else { return false }
            let point = gestureRecognizer.location(in: window)
            return model.barFrame.contains(point) || model.panelFrame.contains(point)
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        @objc private func touched(_ recognizer: UILongPressGestureRecognizer) {
            guard let window else { return }
            let point = recognizer.location(in: window)
            switch recognizer.state {
            case .began: onTouch(.began, point)
            case .changed: onTouch(.moved, point)
            case .ended: onTouch(.ended, point)
            default: onTouch(.cancelled, point)
            }
        }
    }
}
