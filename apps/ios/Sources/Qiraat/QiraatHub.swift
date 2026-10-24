import MushafCore
import SwiftUI

/// Where the Qiraat menu can send the reader when its destination sheets are integrated.
enum QiraatHubRoute: String, Identifiable {
    case legend, pageSummary, search, usulIndex

    var id: String { rawValue }
}

extension ReaderView {
    /// The screen for one route opened from the Qiraat menu in the reader's top bar.
    @ViewBuilder
    func qiraatDestination(_ route: QiraatHubRoute) -> some View {
        switch route {
        case .legend:
            if let store = library.qiraat {
                QiraatLegendSheet(catalog: store.catalog, store: store)
            }
        case .pageSummary:
            if let store = library.qiraat {
                NavigationStack {
                    QiraatPageSummaryView(
                        pages: qiraatVisiblePages,
                        library: library,
                        store: store,
                        filter: activeQiraatFilter,
                        onSelect: { item in
                            openQiraatHubWord(page: item.page, surah: item.surah,
                                              ayah: item.ayah, token: item.token)
                        }
                    )
                }
            }
        case .search:
            if let store = library.qiraat {
                QiraatSearchView(
                    store: store,
                    databaseURL: library.database.url,
                    surahNames: library.surahNames,
                    onOpen: openQiraatHubWord
                )
            }
        case .usulIndex:
            if library.qiraat != nil {
                UsulIndexLoaderView(
                    library: library,
                    onOpen: { page, _, _, _ in openQiraatHubPage(page) },
                    onClose: closeQiraatHubRoute
                )
            }
        }
    }
}

/// The content of the Qiraat menu in the top bar: the layer switch, then the reader / narrator filter.
struct QiraatHubContent: View {
    @Bindable var qiraat: QiraatPreferences
    let catalog: QiraatCatalog?
    let openRoute: (QiraatHubRoute) -> Void

    var body: some View {
        Toggle("إظهار علامات القراءات", isOn: $qiraat.enabled)
            .accessibilityIdentifier("qiraat-hub-toggle")
        if let catalog {
            QiraatFilterMenu(catalog: catalog, filter: $qiraat.filter)
            .disabled(!qiraat.enabled)
        }
        Button { openRoute(.legend) } label: {
            Label("مفتاح الألوان", systemImage: "paintpalette")
        }
        .accessibilityIdentifier("qiraat-hub-legend")
        if catalog != nil {
            Button { openRoute(.pageSummary) } label: {
                Label("خلافات الصفحة", systemImage: "list.bullet.rectangle")
            }
            .accessibilityIdentifier("qiraat-hub-page-summary")
            Button { openRoute(.search) } label: {
                Label("البحث في القراءات", systemImage: "magnifyingglass")
            }
            .accessibilityIdentifier("qiraat-hub-search")
            if !qiraat.hidesUsul {
                Button { openRoute(.usulIndex) } label: {
                    Label("أصول القراءات", systemImage: "books.vertical")
                }
                .accessibilityIdentifier("qiraat-hub-usul-index")
            }
        }
    }
}
