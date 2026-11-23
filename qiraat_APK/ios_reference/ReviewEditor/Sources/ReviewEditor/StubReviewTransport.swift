#if DEBUG
import Foundation
import MushafCore

/// A scriptable review server for tests and for the `-review-stub` launch argument (no network, no data
/// from the real database). The handler receives each request and answers with a status and a JSON body.
final class StubReviewTransport: ReviewTransport, @unchecked Sendable {
    typealias Handler = @Sendable (URLRequest) -> (status: Int, body: String)

    private let lock = NSLock()
    private let handler: Handler
    private var recorded: [URLRequest] = []

    init(handler: @escaping Handler) { self.handler = handler }

    var requests: [URLRequest] { lock.withLock { recorded } }

    /// The JSON body of the n-th recorded request.
    func body(_ index: Int) -> [String: Any]? {
        guard let data = requests[index].httpBody else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        lock.withLock { recorded.append(request) }
        let reply = handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: nil)!
        return (Data(reply.body.utf8), response)
    }
}
#endif
