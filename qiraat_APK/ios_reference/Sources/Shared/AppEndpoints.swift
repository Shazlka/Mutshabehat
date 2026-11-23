import Foundation

/// The one place that names the web app the iOS app reads from (Qiraat pages, the review API, the groups export).
enum AppEndpoints {
    nonisolated static let webApp = URL(string: "https://mutshabehat-v2.vercel.app")!

    nonisolated static func publicQiraatPage(_ page: Int) -> URL {
        webApp.appendingPathComponent("api/public/v1/qiraat")
            .appending(queryItems: [URLQueryItem(name: "page", value: String(page))])
    }

    nonisolated static let publicQiraatVersions = webApp.appendingPathComponent("api/public/v1/qiraat/versions")

    nonisolated static func publicMutoon(since sequence: Int? = nil) -> URL {
        let url = webApp.appendingPathComponent("api/public/v1/mutoon")
        guard let sequence else { return url }
        return url.appending(queryItems: [URLQueryItem(name: "since", value: String(sequence))])
    }

    /// The Qiraat page the live sync reads for `route`.
    nonisolated static func liveQiraatPage(_ page: Int, route: LiveSyncRoute) -> URL {
#if DEBUG
        if route == .reviewRoutes {
            return webApp.appendingPathComponent("api/mushaf-1441/qiraat")
                .appending(queryItems: [URLQueryItem(name: "page", value: String(page))])
        }
#endif
        return publicQiraatPage(page)
    }

    /// The متون snapshot (or, with `since`, the changes feed) the live sync reads for `route`.
    nonisolated static func liveMutoon(since sequence: Int? = nil, route: LiveSyncRoute) -> URL {
#if DEBUG
        if route == .reviewRoutes {
            let url = webApp.appendingPathComponent("api/mushaf-1441/mutoon")
            guard let sequence else { return url }
            return url.appending(queryItems: [URLQueryItem(name: "since", value: String(sequence))])
        }
#endif
        return publicMutoon(since: sequence)
    }

#if DEBUG
    nonisolated static let groupsExport = webApp.appendingPathComponent("api/groups/export")
        .appending(queryItems: [URLQueryItem(name: "format", value: "json")])
#endif
}

/// Which web routes the live sync reads.
///
/// Owner decision 2026-11-03: while the Qiraat review is still going on, development builds (`make device`) read the
/// review routes `/api/mushaf-1441/*`, which are never cached, so an edit in the web review tab reaches the iPhone at
/// once. The App Store build always reads the cookie-less public API. **Last step before publishing:** set the DEBUG
/// value to `.publicAPI` too, so the device build is tested on exactly what the store build uses.
enum LiveSyncRoute: Equatable, Sendable {
    case reviewRoutes
    case publicAPI

#if DEBUG
    nonisolated static let current: LiveSyncRoute = .reviewRoutes
#else
    nonisolated static let current: LiveSyncRoute = .publicAPI
#endif
}

/// Release live sync never shares cookies, caches, credentials, or connection state with the developer review editor.
enum PublicLiveSyncSession {
    nonisolated static func configuration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        return configuration
    }

    nonisolated static let shared = URLSession(configuration: configuration())
}
