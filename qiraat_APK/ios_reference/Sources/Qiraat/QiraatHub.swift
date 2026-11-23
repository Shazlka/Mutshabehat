import MushafCore
import SwiftUI

/// Where the Qiraat menu can send the reader when its destination sheets are integrated.
enum QiraatHubRoute: String, Identifiable {
    case legend, pageSummary, search, usulIndex
    /// The reader / narrator picker; the reader shows it full screen itself, so no sheet is built for it.
    case filter

    var id: String { rawValue }
}

/// The content of the Qiraat menu in the footer bar: the layer switch, then the reader / narrator filter.
struct QiraatHubContent: View {
    @Bindable var qiraat: QiraatPreferences
    let catalog: QiraatCatalog?
    let menu: BarMenuActions
    let openRoute: (QiraatHubRoute) -> Void

    var body: some View {
        BarMenuRow("إظهار علامات القراءات", isOn: qiraat.enabled) {
            menu.perform { qiraat.enabled.toggle() }
        }
        .accessibilityIdentifier("qiraat-hub-toggle")
        if let catalog {
            BarMenuRow(catalog.filterName(qiraat.filter), systemImage: "line.3.horizontal.decrease.circle") {
                menu.perform { openRoute(.filter) }
            }
            .accessibilityIdentifier("qiraat-filter")
            .disabled(!qiraat.enabled)
        }
        BarMenuRow("مفتاح الألوان", systemImage: "paintpalette") {
            menu.perform { openRoute(.legend) }
        }
        .accessibilityIdentifier("qiraat-hub-legend")
        if catalog != nil {
            BarMenuRow("خلافات الصفحة", systemImage: "list.bullet.rectangle") {
                menu.perform { openRoute(.pageSummary) }
            }
            .accessibilityIdentifier("qiraat-hub-page-summary")
            BarMenuRow("البحث في القراءات", systemImage: "magnifyingglass") {
                menu.perform { openRoute(.search) }
            }
            .accessibilityIdentifier("qiraat-hub-search")
            if !qiraat.hidesUsul {
                BarMenuRow("أصول القراءات", systemImage: "books.vertical") {
                    menu.perform { openRoute(.usulIndex) }
                }
                .accessibilityIdentifier("qiraat-hub-usul-index")
            }
        }
    }
}
