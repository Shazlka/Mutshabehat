import MushafCore
import SwiftUI

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
        case .filter:
            EmptyView()
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
