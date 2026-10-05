import Foundation

/// Sends one request; the real implementation uses the shared `URLSession`, whose cookie jar keeps the
/// site's own sign-in cookie (the same way the Qiraat live sync reaches the web app).
public protocol ReviewTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionReviewTransport: ReviewTransport {
    public init() {}

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        var request = request
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Qiraat-iOS-Review", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (data, http)
    }
}

/// A random id per install, written into every edit so the web's edit log shows which device made it.
public enum DeviceID {
    public static let defaultsKey = "qiraat-review-device-id"

    public static func current(defaults: UserDefaults = .standard) -> String {
        if let existing = defaults.string(forKey: defaultsKey), !existing.isEmpty { return existing }
        let id = UUID().uuidString
        defaults.set(id, forKey: defaultsKey)
        return id
    }
}

/// Client of `/api/mushaf-1441/qiraat-review`. Every method mirrors one action of the web client
/// (`src/app/mushaf-1441/review/_lib/api.ts`) and sends exactly the JSON the route accepts, so the
/// server's validation, rules and edit log apply unchanged.
public final class ReviewAPI: Sendable {
    public static let path = "api/mushaf-1441/qiraat-review"
    public static let timeout: TimeInterval = 30

    private let baseURL: URL
    private let transport: any ReviewTransport
    private let deviceId: String

    public init(baseURL: URL, transport: any ReviewTransport, deviceId: String) {
        self.baseURL = baseURL
        self.transport = transport
        self.deviceId = deviceId
    }

    // MARK: Reads

    public func page(_ number: Int, includeDeleted: Bool = false) async -> Result<ReviewPage, ReviewError> {
        var query = [URLQueryItem(name: "page", value: String(number))]
        if includeDeleted { query.append(URLQueryItem(name: "includeDeleted", value: "1")) }
        return await get(query)
    }

    public func overview() async -> Result<ReviewOverview, ReviewError> {
        await get([URLQueryItem(name: "overview", value: "1")])
    }

    public func history(page: Int) async -> Result<[HistoryTransaction], ReviewError> {
        await get([URLQueryItem(name: "history", value: "1"), URLQueryItem(name: "page", value: String(page))])
    }

    // MARK: Entry writes (PATCH)

    public func setStatus(_ row: ReviewRow, _ status: ReviewStatus, note: String?) async -> Result<ReviewRow, ReviewError> {
        await patch("status", row, ["status": .string(status.rawValue), "note": note.map(JSONValue.string) ?? .null])
    }

    public func update(_ row: ReviewRow, _ fields: EntryFields) async -> Result<ReviewRow, ReviewError> {
        guard let encoded = try? JSONValue(encoding: fields) else { return .failure(.invalidResponse) }
        return await patch("update", row, ["fields": encoded])
    }

    public func setNarrators(_ row: ReviewRow, _ narrators: [NarratorInput]) async -> Result<ReviewRow, ReviewError> {
        guard let encoded = try? JSONValue(encoding: narrators) else { return .failure(.invalidResponse) }
        return await patch("narrators", row, ["narrators": encoded])
    }

    public func delete(_ row: ReviewRow, note: String?) async -> Result<ReviewRow, ReviewError> {
        await patch("delete", row, ["note": note.map(JSONValue.string) ?? .null])
    }

    public func restore(_ row: ReviewRow) async -> Result<ReviewRow, ReviewError> {
        await patch("restore", row, [:])
    }

    // MARK: Actions (POST)

    public func create(_ entry: CreateEntryInput) async -> Result<ReviewRow, ReviewError> {
        guard let encoded = try? JSONValue(encoding: entry) else { return .failure(.invalidResponse) }
        return await post(["action": .string("create"), "entry": encoded, "deviceId": .string(deviceId)])
    }

    public func bulkDelete(_ items: [(entryId: String, expectedVersion: String)], note: String?)
        async -> Result<[ReviewRow], ReviewError> {
        struct Reply: Decodable { let deleted: [ReviewRow] }
        let list = items.map { JSONValue.object(["entryId": .string($0.entryId), "expectedVersion": .string($0.expectedVersion)]) }
        let result: Result<Reply, ReviewError> = await post([
            "action": .string("bulkDelete"), "items": .array(list),
            "note": note.map(JSONValue.string) ?? .null, "deviceId": .string(deviceId),
        ])
        return result.map(\.deleted)
    }

    public func findSameWord(surah: Int, ayah: Int, word: Int, excludeLocusId: String?)
        async -> Result<[ReviewRow], ReviewError> {
        var body: [String: JSONValue] = ["action": .string("findSameWord"), "surah": .int(surah), "ayah": .int(ayah), "word": .int(word)]
        if let excludeLocusId { body["excludeLocusId"] = .string(excludeLocusId) }
        return await post(body)
    }

    public func suggestions(surah: Int, ayah: Int, word: Int) async -> Result<[ReviewSuggestion], ReviewError> {
        await post(["action": .string("suggest"), "surah": .int(surah), "ayah": .int(ayah), "word": .int(word)])
    }

    public func copyEntry(sourceEntryId: String, surah: Int, ayah: Int, startWord: Int,
                          endAyah: Int? = nil, endWord: Int? = nil) async -> Result<ReviewRow, ReviewError> {
        var body: [String: JSONValue] = [
            "action": .string("copyEntry"), "sourceEntryId": .string(sourceEntryId),
            "surah": .int(surah), "ayah": .int(ayah), "startWord": .int(startWord), "deviceId": .string(deviceId),
        ]
        if let endAyah { body["endAyah"] = .int(endAyah) }
        if let endWord { body["endWord"] = .int(endWord) }
        return await post(body)
    }

    public func findOccurrences(entryId: String) async -> Result<[OccurrenceCandidate], ReviewError> {
        await post(["action": .string("findOccurrences"), "entryId": .string(entryId)])
    }

    public func bulkApply(sourceEntryId: String, targets: [(surah: Int, ayah: Int, word: Int)])
        async -> Result<BulkApplyResult, ReviewError> {
        let list = targets.map { JSONValue.object(["surah": .int($0.surah), "ayah": .int($0.ayah), "word": .int($0.word)]) }
        return await post(["action": .string("bulkApply"), "sourceEntryId": .string(sourceEntryId),
                           "targets": .array(list), "deviceId": .string(deviceId)])
    }

    public func undo(txid: Int) async -> Result<Int, ReviewError> {
        struct Reply: Decodable { let undone: Int }
        let result: Result<Reply, ReviewError> = await post(
            ["action": .string("undo"), "txid": .int(txid), "deviceId": .string(deviceId)])
        return result.map(\.undone)
    }

    // MARK: Plumbing

    private func url(_ query: [URLQueryItem]) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(Self.path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        return components.url!
    }

    private func get<T: Decodable>(_ query: [URLQueryItem]) async -> Result<T, ReviewError> {
        var request = URLRequest(url: url(query), timeoutInterval: Self.timeout)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return await run(request)
    }

    private func patch<T: Decodable>(_ action: String, _ row: ReviewRow, _ extra: [String: JSONValue]) async -> Result<T, ReviewError> {
        var body: [String: JSONValue] = [
            "action": .string(action), "entryId": .string(row.entryId),
            "version": .string(row.version), "deviceId": .string(deviceId),
        ]
        body.merge(extra) { _, new in new }
        return await send(method: "PATCH", body: body)
    }

    private func post<T: Decodable>(_ body: [String: JSONValue]) async -> Result<T, ReviewError> {
        await send(method: "POST", body: body)
    }

    private func send<T: Decodable>(method: String, body: [String: JSONValue]) async -> Result<T, ReviewError> {
        var request = URLRequest(url: url([]), timeoutInterval: Self.timeout)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let data = try? JSONEncoder().encode(JSONValue.object(body)) else { return .failure(.invalidResponse) }
        request.httpBody = data
        return await run(request)
    }

    private func run<T: Decodable>(_ request: URLRequest) async -> Result<T, ReviewError> {
        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch let error as URLError where error.code == .timedOut {
            return .failure(.timedOut)
        } catch {
            return .failure(.offline)
        }
        guard (200..<300).contains(response.statusCode) else {
            return .failure(Self.error(status: response.statusCode, body: data))
        }
        guard let value = try? JSONDecoder().decode(T.self, from: data) else { return .failure(.invalidResponse) }
        return .success(value)
    }

    static func error(status: Int, body: Data) -> ReviewError {
        struct Payload: Decodable { let error: String?; let messageAr: String? }
        let payload = try? JSONDecoder().decode(Payload.self, from: body)
        let code = payload?.error.flatMap(ReviewErrorCode.init(rawValue:)) ?? .unavailable
        return ReviewError(code: code, status: status, messageAr: payload?.messageAr)
    }
}

extension JSONValue {
    static func int(_ value: Int) -> JSONValue { .number(Double(value)) }

    /// Any `Encodable` as a JSON value (used to nest request models inside a request body).
    init<T: Encodable>(encoding value: T) throws {
        self = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
    }
}
