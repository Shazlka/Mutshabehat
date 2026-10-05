import Foundation
import Testing
@testable import MushafCore

/// Records every request and answers from a queue; no network.
final class StubTransport: ReviewTransport, @unchecked Sendable {
    struct Reply { var status: Int; var body: String; var error: Error? }
    private let lock = NSLock()
    private var replies: [Reply]
    private(set) var requests: [URLRequest] = []

    init(_ replies: [Reply]) { self.replies = replies }
    convenience init(status: Int = 200, body: String) { self.init([Reply(status: status, body: body, error: nil)]) }
    convenience init(error: Error) { self.init([Reply(status: 0, body: "", error: error)]) }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let reply: Reply = lock.withLock {
            requests.append(request)
            return replies.count > 1 ? replies.removeFirst() : replies[0]
        }
        if let error = reply.error { throw error }
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: nil)!
        return (Data(reply.body.utf8), response)
    }

    func body(_ index: Int = 0) throws -> [String: Any] {
        let data = try #require(requests[index].httpBody)
        return try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}

private let rowBody = """
{"entryId":"r-1","locationId":"l-1","version":"v2","kind":"usul","surah":2,"ayah":49,"startWord":1,
 "reviewStatus":"reviewed","narrators":[],"flags":[]}
"""

@Suite struct ReviewAPITests {
    private let base = URL(string: "https://example.test")!
    private func api(_ transport: StubTransport) -> ReviewAPI {
        ReviewAPI(baseURL: base, transport: transport, deviceId: "dev-1")
    }
    private func row() throws -> ReviewRow {
        try JSONDecoder().decode(ReviewRow.self, from: Data(rowBody.utf8).replacingVersion("v1"))
    }

    @Test func pageRequestIsGetWithQuery() async throws {
        let page = #"{"page":8,"words":[],"rows":[],"stats":{},"narrators":[],"categories":[],"variantTypes":[]}"#
        let t = StubTransport(body: page)
        let result = await api(t).page(8)
        #expect(try result.get().page == 8)
        let request = t.requests[0]
        #expect(request.httpMethod == "GET")
        #expect(request.url?.absoluteString == "https://example.test/api/mushaf-1441/qiraat-review?page=8")
        #expect(request.timeoutInterval == 30)
        _ = await api(t).page(9, includeDeleted: true)
        #expect(t.requests[1].url?.absoluteString.contains("includeDeleted=1") == true)
    }

    @Test func overviewAndHistoryUseTheirQueries() async throws {
        let t = StubTransport([
            .init(status: 200, body: #"{"isEditor":true,"pages":[]}"#, error: nil),
            .init(status: 200, body: "[]", error: nil),
        ])
        _ = await api(t).overview()
        _ = await api(t).history(page: 8)
        #expect(t.requests[0].url?.query == "overview=1")
        #expect(t.requests[1].url?.query?.contains("history=1") == true)
        #expect(t.requests[1].url?.query?.contains("page=8") == true)
    }

    @Test func statusPatchBodyMatchesWeb() async throws {
        let t = StubTransport(body: rowBody)
        let result = await api(t).setStatus(try row(), .reviewed, note: nil)
        #expect(try result.get().entryId == "r-1")
        #expect(t.requests[0].httpMethod == "PATCH")
        let body = try t.body()
        #expect(body["action"] as? String == "status")
        #expect(body["entryId"] as? String == "r-1")
        #expect(body["version"] as? String == "v1")
        #expect(body["deviceId"] as? String == "dev-1")
        #expect(body["status"] as? String == "reviewed")
        #expect(body["note"] is NSNull)
        #expect(t.requests[0].value(forHTTPHeaderField: "Content-Type") == "application/json")
    }

    @Test func updateSendsOnlySetFieldsInsideFields() async throws {
        let t = StubTransport(body: rowBody)
        var fields = EntryFields()
        fields.readingText = .set("وَإِذْ")
        fields.hamzahDetail = .set(nil)
        _ = await api(t).update(try row(), fields)
        let body = try t.body()
        #expect(body["action"] as? String == "update")
        let sent = try #require(body["fields"] as? [String: Any])
        #expect(Set(sent.keys) == ["readingText", "hamzahDetail"])
        #expect(sent["hamzahDetail"] is NSNull)
    }

    @Test func narratorsDeleteRestoreBodies() async throws {
        let t = StubTransport(body: rowBody)
        _ = await api(t).setNarrators(try row(), [NarratorInput(id: "Q01-R01", action: "قرأ", wajhOrder: 1)])
        _ = await api(t).delete(try row(), note: "x")
        _ = await api(t).restore(try row())
        #expect(try t.body(0)["action"] as? String == "narrators")
        #expect((try t.body(0)["narrators"] as? [[String: Any]])?.first?["id"] as? String == "Q01-R01")
        #expect(try t.body(1)["action"] as? String == "delete")
        #expect(try t.body(1)["note"] as? String == "x")
        #expect(try t.body(2)["action"] as? String == "restore")
    }

    @Test func createPostBodyWrapsEntry() async throws {
        let t = StubTransport(body: rowBody)
        let entry = CreateEntryInput(surah: 2, ayah: 49, startWord: 1, kind: .usul, categoryCode: "USUL_TAHQIQ",
                                     narrators: [NarratorInput(id: "Q06-R01")])
        _ = await api(t).create(entry)
        #expect(t.requests[0].httpMethod == "POST")
        let body = try t.body()
        #expect(body["action"] as? String == "create")
        #expect(body["deviceId"] as? String == "dev-1")
        let sent = try #require(body["entry"] as? [String: Any])
        #expect(sent["categoryCode"] as? String == "USUL_TAHQIQ")
        #expect(sent["kind"] as? String == "usul")
    }

    @Test func bulkAndLookupBodies() async throws {
        let t = StubTransport([
            .init(status: 200, body: #"{"deleted":[]}"#, error: nil),
            .init(status: 200, body: "[]", error: nil),
            .init(status: 200, body: "[]", error: nil),
            .init(status: 200, body: rowBody, error: nil),
            .init(status: 200, body: "[]", error: nil),
            .init(status: 200, body: #"{"sourceEntryId":"r-1","added":[],"skipped":[],"errors":[]}"#, error: nil),
            .init(status: 200, body: #"{"undone":2}"#, error: nil),
        ])
        let a = api(t)
        _ = await a.bulkDelete([(entryId: "r-1", expectedVersion: "v1")], note: nil)
        _ = await a.findSameWord(surah: 2, ayah: 49, word: 1, excludeLocusId: "l-1")
        _ = await a.suggestions(surah: 2, ayah: 49, word: 1)
        _ = await a.copyEntry(sourceEntryId: "r-1", surah: 2, ayah: 50, startWord: 3)
        _ = await a.findOccurrences(entryId: "r-1")
        _ = await a.bulkApply(sourceEntryId: "r-1", targets: [(surah: 2, ayah: 50, word: 3)])
        let undone = await a.undo(txid: 7)
        #expect(try undone.get() == 2)
        #expect(try t.body(0)["action"] as? String == "bulkDelete")
        let items = try #require(try t.body(0)["items"] as? [[String: Any]])
        #expect(items.first?["expectedVersion"] as? String == "v1")
        #expect(try t.body(1)["excludeLocusId"] as? String == "l-1")
        #expect(try t.body(2)["action"] as? String == "suggest")
        #expect(try t.body(3)["action"] as? String == "copyEntry")
        #expect(try t.body(3)["startWord"] as? Int == 3)
        #expect(try t.body(4)["entryId"] as? String == "r-1")
        let targets = try #require(try t.body(5)["targets"] as? [[String: Any]])
        #expect(targets.first?["word"] as? Int == 3)
        #expect(try t.body(6)["txid"] as? Int == 7)
    }

    @Test func serverErrorMapsToCode() async throws {
        let conflict = await api(StubTransport(status: 409, body: #"{"error":"VERSION_CONFLICT"}"#)).page(1)
        guard case .failure(let e1) = conflict else { Issue.record("expected failure"); return }
        #expect(e1.code == .versionConflict)
        #expect(e1.status == 409)
        #expect(!e1.messageAr.isEmpty)

        let d8 = await api(StubTransport(status: 422, body: #"{"error":"RULE_D8","messageAr":"نص الخادم"}"#)).page(1)
        guard case .failure(let e2) = d8 else { Issue.record("expected failure"); return }
        #expect(e2.code == .ruleD8)
        #expect(e2.messageAr == "نص الخادم")

        for (raw, code) in [("RULE_NARRATOR_TWICE", ReviewErrorCode.ruleNarratorTwice), ("RULE_EMPTY_LOCATION", .ruleEmptyLocation),
                            ("RULE_WASL_WAQF", .ruleWaslWaqf), ("UNDO_CONFLICT", .undoConflict), ("UNDO_REFUSED", .undoRefused),
                            ("not_found", .notFound), ("bad_request", .badRequest), ("forbidden", .forbidden),
                            ("unauthorized", .unauthorized), ("something-else", .unavailable)] {
            let r = await api(StubTransport(status: 400, body: #"{"error":"\#(raw)"}"#)).page(1)
            guard case .failure(let e) = r else { Issue.record("expected failure for \(raw)"); continue }
            #expect(e.code == code)
            #expect(!e.messageAr.isEmpty)
        }
    }

    @Test func invalidJSONIsUnavailable() async throws {
        guard case .failure(let e) = await api(StubTransport(body: "<html>")).page(1) else {
            Issue.record("expected failure"); return
        }
        #expect(e.code == .unavailable)
        // A success whose JSON has the wrong shape is equally unusable.
        guard case .failure(let e2) = await api(StubTransport(body: #"{"nope":1}"#)).page(1) else {
            Issue.record("expected failure"); return
        }
        #expect(e2.code == .unavailable)
    }

    @Test func transportFailuresUseConnectionAndTimeoutMessages() async throws {
        guard case .failure(let offline) = await api(StubTransport(error: URLError(.notConnectedToInternet))).page(1),
              case .failure(let slow) = await api(StubTransport(error: URLError(.timedOut))).page(1) else {
            Issue.record("expected failures"); return
        }
        #expect(offline.code == .unavailable && offline.status == 0)
        #expect(offline.messageAr == "تعذّر الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة")
        #expect(slow.messageAr == "انتهت مهلة الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة")
    }

    @Test func deviceIdIsStableAcrossCalls() {
        let defaults = UserDefaults(suiteName: "review-device-\(UUID().uuidString)")!
        let first = DeviceID.current(defaults: defaults)
        #expect(!first.isEmpty)
        #expect(DeviceID.current(defaults: defaults) == first)
    }
}

private extension Data {
    func replacingVersion(_ v: String) -> Data {
        Data(String(decoding: self, as: UTF8.self).replacingOccurrences(of: #""version":"v2""#, with: #""version":"\#(v)""#).utf8)
    }
}
