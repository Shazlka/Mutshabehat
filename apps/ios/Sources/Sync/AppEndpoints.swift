import Foundation

/// The one place that names the web app the iOS app reads from (Qiraat pages, the review API, the groups export).
enum AppEndpoints {
    nonisolated static let webApp = URL(string: "https://mutshabehat-v2.vercel.app")!
    nonisolated static let groupsExport = webApp.appendingPathComponent("api/groups/export")
        .appending(queryItems: [URLQueryItem(name: "format", value: "json")])
}
