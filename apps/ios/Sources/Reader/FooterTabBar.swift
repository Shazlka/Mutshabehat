import SwiftUI
import UIKit

/// The system tab bar, used as the reader's footer toolbar: on iOS 26 and later it is the same Liquid Glass capsule
/// as the tab bar of any app, with the system's lens that rises under a touch and glides with the finger, its
/// symbols and its large-content viewer. Before iOS 26 it is the system's translucent bar.
///
/// The items are actions, not pages, so nothing stays selected: the lens settles on the item that was pressed and
/// then lets go of it.
struct FooterTabBar: UIViewRepresentable {
    struct Item: Equatable {
        /// The accessibility identifier, which the UI tests find the item by.
        let id: String
        let title: String
        let systemImage: String
        var value: String?
    }

    let items: [Item]
    let ink: UIColor
    /// The reader's own light or dark theme, which the system bar's glass follows instead of the device's.
    let colorScheme: ColorScheme?
    let direction: LayoutDirection
    let onSelect: (Int) -> Void

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UITabBar {
        let bar = UITabBar()
        bar.delegate = context.coordinator
        bar.itemPositioning = .fill
        return bar
    }

    func updateUIView(_ bar: UITabBar, context: Context) {
        let coordinator = context.coordinator
        coordinator.onSelect = onSelect
        if coordinator.items != items {
            let sameItems = coordinator.items.map(\.id) == items.map(\.id)
            coordinator.items = items
            if sameItems, let tabItems = bar.items {
                // A symbol or value changed: update the items in place, so the system keeps its buttons.
                for (tabItem, item) in zip(tabItems, items) { configure(tabItem, with: item) }
            } else {
                bar.setItems(items.enumerated().map { index, item in
                    let tabItem = UITabBarItem(title: item.title, image: UIImage(systemName: item.systemImage), tag: index)
                    configure(tabItem, with: item)
                    return tabItem
                }, animated: false)
            }
        }
        bar.tintColor = ink
        bar.unselectedItemTintColor = ink
        bar.overrideUserInterfaceStyle = switch colorScheme {
        case .light: .light
        case .dark: .dark
        default: .unspecified
        }
        bar.semanticContentAttribute = direction == .rightToLeft ? .forceRightToLeft : .forceLeftToRight
    }

    private func configure(_ tabItem: UITabBarItem, with item: Item) {
        tabItem.title = item.title
        tabItem.image = UIImage(systemName: item.systemImage)
        tabItem.accessibilityIdentifier = item.id
        tabItem.accessibilityLabel = item.title
        tabItem.accessibilityValue = item.value
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView bar: UITabBar, context: Context) -> CGSize? {
        let width = proposal.width ?? bar.intrinsicContentSize.width
        return CGSize(width: width, height: bar.sizeThatFits(CGSize(width: width, height: 0)).height)
    }

    final class Coordinator: NSObject, UITabBarDelegate {
        var items: [Item] = []
        var onSelect: (Int) -> Void = { _ in }

        func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
            onSelect(item.tag)
            Task { @MainActor [weak tabBar] in
                try? await Task.sleep(for: .milliseconds(450))
                tabBar?.selectedItem = nil
            }
        }
    }
}
