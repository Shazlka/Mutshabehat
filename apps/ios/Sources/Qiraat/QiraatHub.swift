import MushafCore
import SwiftUI

/// Where the Qiraat menu can send the reader when its destination sheets are integrated.
enum QiraatHubRoute: String, Identifiable {
    case legend, pageSummary, search, usulIndex

    var id: String { rawValue }
}

extension ReaderView {
    /// The screen for one hub route. No menu entry opens a route yet, so this is not reached.
    @ViewBuilder
    func qiraatDestination(_ route: QiraatHubRoute) -> some View {
        switch route {
        case .legend, .pageSummary, .search, .usulIndex:
            EmptyView()
        }
    }
}

/// The content of the Qiraat menu in the top bar: the layer switch, then the reader / narrator filter.
struct QiraatHubContent: View {
    @Bindable var qiraat: QiraatPreferences
    let catalog: QiraatCatalog?

    var body: some View {
        Toggle("إظهار علامات القراءات", isOn: $qiraat.enabled)
            .accessibilityIdentifier("qiraat-hub-toggle")
        if let catalog {
            Section("القارئ أو الراوي") {
                QiraatFilterItems(catalog: catalog, filter: $qiraat.filter)
            }
            .disabled(!qiraat.enabled)
        }
    }
}
