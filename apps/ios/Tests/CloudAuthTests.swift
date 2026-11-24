import Foundation
import XCTest
@testable import Mutshabehat

/// Drives the in-app sign-in against a scripted server: no network, no browser.
final class CloudAuthTests: XCTestCase {
    private let origin = URL(string: "https://sync.example.test")!
    private let issuer = URL(string: "https://auth.example.test/db/auth")!
    private var configuration: CloudConfiguration { CloudConfiguration(origin: origin, issuer: issuer, clientID: "client-1") }

    override func setUp() {
        super.setUp()
        ScriptedServer.requests = []
        ScriptedServer.handler = { _ in (500, [:], Data()) }
    }

    private func client() -> CloudAuthClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ScriptedServer.self]
        return CloudAuthClient(configuration: configuration, session: URLSession(configuration: config))
    }

    private func json(_ value: [String: Any]) -> Data { try! JSONSerialization.data(withJSONObject: value) }

    private let loginRedirect = "https://sync.example.test/auth/sign-in?response_type=code&client_id=client-1&state=S1&utm=drop"
        + "&exp=9&ba_iat=8&ba_param=ba_iat&ba_param=ba_param&ba_param=client_id&ba_param=exp&ba_param=response_type"
        + "&ba_param=state&sig=abc%3D%3D"

    func testSignInRunsTheWholeFlowWithoutABrowser() async throws {
        ScriptedServer.handler = { [self] request in
            switch request.url!.path {
            case "/db/auth/oauth2/authorize": return (302, ["Location": loginRedirect], Data())
            case "/db/auth/sign-in/email": return (200, ["Set-Cookie": "session_token=tok123; Path=/; Secure; HttpOnly"], json(["token": "t"]))
            case "/db/auth/oauth2/continue":
                return (200, [:], json(["redirect": true, "url": "https://sync.example.test/auth/mobile-callback?code=CODE9&state=S1"]))
            default: return (404, [:], Data())
            }
        }
        let code = try await client().authorize(email: "a@b.co", password: "12345678", create: false, challenge: "ch", state: "S1")
        XCTAssertEqual(code, "CODE9")

        let paths = ScriptedServer.requests.map { $0.url!.path }
        XCTAssertEqual(paths, ["/db/auth/oauth2/authorize", "/db/auth/sign-in/email", "/db/auth/oauth2/continue"])
        let authorize = ScriptedServer.requests[0].url!.query!
        XCTAssertTrue(authorize.contains("code_challenge=ch") && authorize.contains("code_challenge_method=S256"))

        let signIn = ScriptedServer.requests[1]
        XCTAssertEqual(signIn.value(forHTTPHeaderField: "Origin"), "https://sync.example.test")
        XCTAssertNil(signIn.value(forHTTPHeaderField: "Cookie"))

        let resume = ScriptedServer.requests[2]
        XCTAssertEqual(resume.value(forHTTPHeaderField: "Cookie"), "session_token=tok123")
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: ScriptedServer.body(of: resume)) as? [String: Any])
        XCTAssertEqual(body["selected"] as? Bool, true)
        let query = try XCTUnwrap(body["oauth_query"] as? String)
        XCTAssertTrue(query.contains("sig=abc%3D%3D"))
        XCTAssertTrue(query.contains("client_id=client-1"))
        XCTAssertFalse(query.contains("utm"), "unsigned parameters must not be forwarded")
    }

    func testAuthorizeAnsweredWithJSONBodyInsteadOfRedirectStillWorks() async throws {
        ScriptedServer.handler = { [self] request in
            switch request.url!.path {
            case "/db/auth/oauth2/authorize": return (200, [:], json(["redirect": true, "url": loginRedirect]))
            case "/db/auth/sign-up/email": return (200, [:], json(["token": "t"]))
            default: return (200, [:], json(["redirect": true, "url": "https://sync.example.test/auth/mobile-callback?code=J1&state=S1"]))
            }
        }
        let code = try await client().authorize(email: "a@b.co", password: "12345678", create: true, challenge: "c", state: "S1")
        XCTAssertEqual(code, "J1")
    }

    func testSignUpWithoutATokenAsksToVerifyEmail() async {
        ScriptedServer.handler = { [self] request in
            request.url!.path.hasSuffix("authorize") ? (302, ["Location": loginRedirect], Data()) : (200, [:], json(["token": NSNull()]))
        }
        do {
            _ = try await client().authorize(email: "a@b.co", password: "12345678", create: true, challenge: "c", state: "S1")
            XCTFail("expected verification")
        } catch {
            XCTAssertEqual(error as? CloudAuthError, .verificationRequired)
        }
        XCTAssertEqual(ScriptedServer.requests.last?.url?.path, "/db/auth/sign-up/email")
    }

    func testConsentIsAcceptedWhenTheServerAsksForIt() async throws {
        ScriptedServer.handler = { [self] request in
            switch request.url!.path {
            case "/db/auth/oauth2/authorize": return (302, ["Location": loginRedirect], Data())
            case "/db/auth/sign-in/email": return (200, [:], json(["token": "t"]))
            case "/db/auth/oauth2/continue":
                return (200, [:], json(["redirect": true, "url": "/auth/consent?client_id=client-1&sig=zz&ba_param=client_id&ba_param=ba_param"]))
            case "/db/auth/oauth2/consent":
                return (200, [:], json(["redirect": true, "url": "https://sync.example.test/auth/mobile-callback?code=OK&state=S1"]))
            default: return (404, [:], Data())
            }
        }
        let code = try await client().authorize(email: "a@b.co", password: "12345678", create: false, challenge: "c", state: "S1")
        XCTAssertEqual(code, "OK")
        let consent = try XCTUnwrap(ScriptedServer.requests.last)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: ScriptedServer.body(of: consent)) as? [String: Any])
        XCTAssertEqual(body["accept"] as? Bool, true)
    }

    func testWrongPasswordIsReportedAndStopsTheFlow() async {
        ScriptedServer.handler = { [self] request in
            request.url!.path.hasSuffix("authorize")
                ? (302, ["Location": loginRedirect], Data())
                : (401, [:], json(["code": "INVALID_EMAIL_OR_PASSWORD", "message": "Invalid email or password"]))
        }
        do {
            _ = try await client().authorize(email: "a@b.co", password: "wrong-pass", create: false, challenge: "c", state: "S1")
            XCTFail("expected failure")
        } catch {
            XCTAssertEqual(error as? CloudAuthError, .invalidCredentials)
        }
        XCTAssertEqual(ScriptedServer.requests.count, 2, "no continue request after a failed sign-in")
    }

    func testExistingEmailAndRateLimitAreMapped() async {
        for (status, code, expected) in [(422, "USER_ALREADY_EXISTS", CloudAuthError.emailTaken),
                                         (429, "RATE_LIMIT", CloudAuthError.rateLimited)] {
            ScriptedServer.handler = { [self] request in
                request.url!.path.hasSuffix("authorize") ? (302, ["Location": loginRedirect], Data()) : (status, [:], json(["code": code]))
            }
            do {
                _ = try await client().authorize(email: "a@b.co", password: "12345678", create: true, challenge: "c", state: "S1")
                XCTFail("expected failure")
            } catch {
                XCTAssertEqual(error as? CloudAuthError, expected)
            }
        }
    }

    func testStateMismatchInTheFinalRedirectIsRejected() async {
        ScriptedServer.handler = { [self] request in
            switch request.url!.path {
            case "/db/auth/oauth2/authorize": return (302, ["Location": loginRedirect], Data())
            case "/db/auth/sign-in/email": return (200, [:], json(["token": "t"]))
            default: return (200, [:], json(["redirect": true, "url": "https://sync.example.test/auth/mobile-callback?code=X&state=OTHER"]))
            }
        }
        do {
            _ = try await client().authorize(email: "a@b.co", password: "12345678", create: false, challenge: "c", state: "S1")
            XCTFail("expected rejection")
        } catch {
            XCTAssertEqual(error as? CloudAuthError, .rejected)
        }
    }

    func testCredentialsAreValidatedBeforeAnyRequest() async {
        for (email, password, expected) in [("nope", "12345678", CloudAuthError.invalidEmail),
                                            ("a@b", "12345678", .invalidEmail),
                                            ("a@b.co", "short", .weakPassword)] {
            do {
                _ = try await client().authorize(email: email, password: password, create: false, challenge: "c", state: "s")
                XCTFail("expected validation failure")
            } catch {
                XCTAssertEqual(error as? CloudAuthError, expected)
            }
        }
        XCTAssertTrue(ScriptedServer.requests.isEmpty)
    }

    func testFormEncodingMatchesURLSearchParams() {
        XCTAssertEqual(CloudAuthClient.formEncode("a b+c=d&é~*"), "a+b%2Bc%3Dd%26%C3%A9%7E*")
    }
}

private final class ScriptedServer: URLProtocol {
    nonisolated(unsafe) static var handler: (URLRequest) -> (Int, [String: String], Data) = { _ in (500, [:], Data()) }
    nonisolated(unsafe) static var requests: [URLRequest] = []

    static func body(of request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        let (status, headers, data) = Self.handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
