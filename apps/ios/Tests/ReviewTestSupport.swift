#if DEBUG
import MushafCore
import XCTest
@testable import Mutshabehat
#if DEBUG
@testable import ReviewEditor
#endif

/// A stateful fake of the review server for the store tests: it keeps the rows, answers page reads from
/// them and applies status, update, narrators, delete and create writes (each bumps the row's version).
final class ReviewTestServer: @unchecked Sendable {
    struct Spec: Sendable {
        var id: String
        var start: Int
        var end: Int
        var status: String = "unreviewed"
        var version = "v1"
        var kind = "usul"
        var narrators = ["Q06-R01"]
        var rulingText: String?
        var deleted = false
    }

    private let lock = NSLock()
    private var specs: [Spec]
    private var counter = 1
    var historyTransactions: [HistoryTransaction] = []
    var historyStatus = 200
    var undoError: ReviewErrorCode?
    private var undoneTransactions: Set<Int> = []
    /// Optional scripted replies for suggestion, copy and occurrence requests.
    var bulkResponses: [String: String] = [:]
    var bulkStatus = 200
    var patchStatus = 200
    var postStatus = 200
    /// Bodies of every create received.
    private(set) var created: [[String: Any]] = []
    /// `action` of every write, in order.
    private(set) var actions: [String] = []

    init(_ specs: [Spec]) { self.specs = specs }

    private func narratorJSON(_ ids: [String]) -> String {
        ids.map { #"{"id":"\#($0)","nameAr":"\#(CanonicalReaders.narratorName($0) ?? $0)","wajhOrder":1}"# }.joined(separator: ",")
    }

    private func rowJSON(_ r: Spec) -> String {
        """
        {"entryId":"\(r.id)","locationId":"l-\(r.id)","version":"\(r.version)","kind":"\(r.kind)","categoryCode":"USUL_TAHQIQ","categoryNameAr":"تحقيق",
         "surah":2,"ayah":49,"startWord":\(r.start),"endAyah":49,"endWord":\(r.end),"startKey":"002:049:00\(r.start)","endKey":"002:049:00\(r.end)",
         "page":8,"hafsText":"w\(r.start)","readingText":"w\(r.start)","rulingText":\(r.rulingText.map { "\"\($0)\"" } ?? "null"),
         "reviewStatus":"\(r.status)","deleted":\(r.deleted),"narrators":[\(narratorJSON(r.narrators))],"flags":[]}
        """
    }

    func page() -> String {
        let words = (1...6).map {
            #"{"key":"002:049:00\#($0)","surah":2,"ayah":49,"word":\#($0),"line":1,"text":"w\#($0)"}"#
        }.joined(separator: ",")
        let rows = lock.withLock { specs.map(rowJSON).joined(separator: ",") }
        return """
        {"page":8,"words":[\(words)],"rows":[\(rows)],
         "stats":{"total":0,"unreviewed":0,"reviewed":0,"flagged":0,"deleted":0},
         "narrators":[{"id":"Q06-R01","code":"HAM-KHL","nameAr":"خلف","parentId":"Q06","type":"narrator","color":null}],
         "categories":[{"code":"USUL_TAHQIQ","nameAr":"تحقيق"},{"code":"USUL_NAQL","nameAr":"النقل"}],"variantTypes":["vowel"]}
        """
    }

    func handle(_ request: URLRequest) -> (status: Int, body: String) {
        let body = (try? JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any]) ?? [:]
        if request.httpMethod == "PATCH" || request.httpMethod == "POST" {
            lock.withLock { actions.append(body["action"] as? String ?? "") }
        }
        if request.httpMethod == "PATCH" {
            if patchStatus != 200 { return (patchStatus, #"{"error":"unavailable"}"#) }
            return lock.withLock {
                guard let index = specs.firstIndex(where: { $0.id == body["entryId"] as? String }) else { return (404, #"{"error":"not_found"}"#) }
                switch body["action"] as? String {
                case "status": specs[index].status = body["status"] as? String ?? specs[index].status
                case "narrators": specs[index].narrators = ((body["narrators"] as? [[String: Any]]) ?? []).compactMap { $0["id"] as? String }
                case "update":
                    if let text = (body["fields"] as? [String: Any])?["rulingText"] as? String { specs[index].rulingText = text }
                case "delete": specs[index].deleted = true
                case "restore": specs[index].deleted = false
                default: break
                }
                counter += 1
                specs[index].version = "v\(counter)"
                return (200, rowJSON(specs[index]))
            }
        }
        if request.httpMethod == "POST" {
            if let action = body["action"] as? String,
               ["suggest", "findSameWord", "copyEntry", "findOccurrences", "bulkApply"].contains(action) {
                if bulkStatus != 200 { return (bulkStatus, #"{"error":"unavailable"}"#) }
                if let reply = bulkResponses[action] { return (200, reply) }
                return (200, "[]")
            }
            if body["action"] as? String == "undo" {
                if let undoError { return (409, "{\"error\":\"\(undoError.rawValue)\"}") }
                return lock.withLock {
                    if let txid = body["txid"] as? Int { undoneTransactions.insert(txid) }
                    return (200, #"{"undone":1}"#)
                }
            }
            guard (body["action"] as? String) == "create", let entry = body["entry"] as? [String: Any] else { return (200, "[]") }
            if postStatus != 200 { return (postStatus, #"{"error":"unavailable"}"#) }
            return lock.withLock {
                created.append(entry)
                counter += 1
                let start = entry["startWord"] as? Int ?? 1
                let end = entry["endWord"] as? Int ?? start
                let ids = ((entry["narrators"] as? [[String: Any]]) ?? []).compactMap { $0["id"] as? String }
                let spec = Spec(id: "r-new-\(counter)", start: start, end: end, version: "v\(counter)",
                                kind: entry["kind"] as? String ?? "usul", narrators: ids)
                specs.append(spec)
                return (200, rowJSON(spec))
            }
        }
        if request.url?.query?.contains("history=1") == true {
            if historyStatus != 200 { return (historyStatus, #"{"error":"unavailable"}"#) }
            return lock.withLock {
                let data = (try? JSONEncoder().encode(historyTransactions)) ?? Data("[]".utf8)
                var objects = (try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
                for index in objects.indices {
                    if let txid = objects[index]["txid"] as? Int, undoneTransactions.contains(txid) { objects[index]["undone"] = true }
                }
                let result = (try? JSONSerialization.data(withJSONObject: objects)) ?? Data("[]".utf8)
                return (200, String(decoding: result, as: UTF8.self))
            }
        }
        if request.url?.query?.contains("overview") == true {
            return (200, #"{"isEditor":true,"pages":[{"page":8,"total":3,"flagged":0,"reviewed":1,"unreviewed":2},{"page":9,"total":3,"flagged":1,"reviewed":1,"unreviewed":1}]}"#)
        }
        return (200, page())
    }

    @MainActor
    static func makeStore(_ specs: [Spec], patchStatus: Int = 200, postStatus: Int = 200,
                          refresh: @escaping (Int) -> Void = { _ in }) throws -> (ReviewStore, StubReviewTransport, ReviewTestServer) {
        let server = ReviewTestServer(specs)
        server.patchStatus = patchStatus
        server.postStatus = postStatus
        let transport = StubReviewTransport { server.handle($0) }
        let library = try MushafLibrary()
        let api = ReviewAPI(baseURL: URL(string: "https://example.test")!, path: "api/mushaf-1441/qiraat-review", transport: transport, deviceId: "dev")
        let store = ReviewStore(api: api, mushafPage: { library.page($0) }, liveRefresh: refresh)
        return (store, transport, server)
    }
}
#endif
