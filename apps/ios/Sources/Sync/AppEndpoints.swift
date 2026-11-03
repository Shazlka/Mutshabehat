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

#if DEBUG
    nonisolated static let groupsExport = webApp.appendingPathComponent("api/groups/export")
        .appending(queryItems: [URLQueryItem(name: "format", value: "json")])
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
