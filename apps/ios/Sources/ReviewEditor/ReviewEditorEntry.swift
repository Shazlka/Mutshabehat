#if DEBUG
import MushafCore
import SwiftUI

/// The developer review editor: opened from Settings → المطور, in DEBUG builds only. It runs against the web
/// app's review API (`-review-stub` swaps in an in-memory fake for UI tests).
struct ReviewEditorEntry: View {
    let library: MushafLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var store: ReviewStore
    @State private var path: [Int] = []

    init(library: MushafLibrary) {
        self.library = library
        _store = State(initialValue: Self.makeStore(library: library))
    }

    static var usesStub: Bool { ProcessInfo.processInfo.arguments.contains("-review-stub") }

    @MainActor
    static func makeStore(library: MushafLibrary) -> ReviewStore {
        let transport: any ReviewTransport
        if usesStub, let url = Bundle.main.url(forResource: "mushaf", withExtension: "sqlite"),
           let database = try? MushafDatabase(url: url) {
            transport = StubReviewServer(database: database).transport()
        } else {
            transport = URLSessionReviewTransport()
        }
        let api = ReviewAPI(baseURL: QiraatLiveSync.baseURL, transport: transport, deviceId: DeviceID.current())
        return ReviewStore(api: api, mushafPage: { library.page($0) }, liveRefresh: { page in
            Task { @MainActor in _ = await QiraatLiveSync.shared.refresh(page: page, store: library.qiraat, force: true) }
        })
    }

    var body: some View {
        NavigationStack(path: $path) {
            ReviewHomeView(store: store, library: library, openPage: { path.append($0) }, close: { dismiss() })
                .navigationDestination(for: Int.self) { page in
                    ReviewPageScreen(store: store, library: library, initialPage: page)
                }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }
}
#endif
