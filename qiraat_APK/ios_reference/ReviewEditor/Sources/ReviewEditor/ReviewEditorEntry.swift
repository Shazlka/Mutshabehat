#if DEBUG
import MushafCore
import SwiftUI

/// The developer review editor: opened from Settings → المطور, in DEBUG builds only. It runs against the web
/// app's review API (`-review-stub` swaps in an in-memory fake for UI tests).
public struct ReviewEditorEntry: View {
    let host: ReviewHost
    @Environment(\.dismiss) private var dismiss
    @State private var store: ReviewStore
    @State private var path: [Int] = []

    public init(host: ReviewHost) {
        self.host = host
        _store = State(initialValue: Self.makeStore(host: host))
    }

    public static var usesStub: Bool { ProcessInfo.processInfo.arguments.contains("-review-stub") }

    @MainActor
    static func makeStore(host: ReviewHost) -> ReviewStore {
        let transport: any ReviewTransport
        if usesStub {
            // Never fall back to the live API when a test asked for the stub: those tests approve and create faces.
            guard let url = Bundle.main.url(forResource: "mushaf", withExtension: "sqlite"),
                  let database = try? MushafDatabase(url: url) else {
                fatalError("-review-stub needs the bundled mushaf.sqlite; refusing to use the live review API")
            }
            transport = StubReviewServer(database: database).transport()
        } else {
            transport = URLSessionReviewTransport()
        }
        let api = ReviewAPI(baseURL: host.baseURL, path: ReviewEndpoint.path, transport: transport,
                           deviceId: host.deviceId)
        let store = ReviewStore(api: api, mushafPage: { host.page($0) }, liveRefresh: { host.refreshLivePage($0) })
        store.palette = host.palette
        return store
    }

    public var body: some View {
        NavigationStack(path: $path) {
            ReviewHomeView(store: store, library: host, openPage: { path.append($0) }, close: { dismiss() })
                .navigationDestination(for: Int.self) { page in
                    ReviewPageScreen(store: store, library: host, initialPage: page)
                }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }
}
#endif
