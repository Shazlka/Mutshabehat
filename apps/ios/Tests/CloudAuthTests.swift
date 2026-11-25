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

    private static func json(_ value: [String: Any]) -> Data { try! JSONSerialization.data(withJSONObject: value) }
    private func json(_ value: [String: Any]) -> Data { Self.json(value) }

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

    /// The server signs its query with `+` for spaces (URLSearchParams); it must be sent back as `+`, not `%2B`.
    func testSignedQueryTreatsPlusAsSpaceLikeURLSearchParams() {
        let url = URL(string: "https://auth.example.test/login?client_id=c&scope=openid+profile+email&plus=a%2Bb&sig=s%2Fg&ba_param=scope&ba_param=plus&other=x")
        let query = CloudAuthClient.signedQuery(from: url) ?? ""
        XCTAssertTrue(query.contains("scope=openid+profile+email"))
        XCTAssertTrue(query.contains("plus=a%2Bb"))
        XCTAssertFalse(query.contains("other="))
    }

    func testFormEncodingMatchesURLSearchParams() {
        XCTAssertEqual(CloudAuthClient.formEncode("a b+c=d&é~*"), "a+b%2Bc%3Dd%26%C3%A9%7E*")
    }

    func testRelativeAuthorizeRedirectResolvesAgainstIssuerHost() async throws {
        ScriptedServer.handler = { [self] request in
            switch (request.httpMethod, request.url?.absoluteString) {
            case ("GET", let url) where url?.contains("/db/auth/oauth2/authorize") == true:
                return (302, ["Location": "/db/auth/sign-in?sig=s&ba_param=x&x=1"], Data())
            case ("POST", "https://auth.example.test/db/auth/sign-in/email"):
                return (200, ["Set-Cookie": "session=ok; Path=/"], json(["token": "t"]))
            case ("POST", "https://auth.example.test/db/auth/oauth2/continue"):
                return (200, [:], json(["url": "/db/auth/consent?sig=c&ba_param=y&y=2"]))
            case ("POST", "https://auth.example.test/db/auth/oauth2/consent"):
                return (200, [:], json(["url": "https://sync.example.test/auth/mobile-callback?code=IOS1&state=S1"]))
            default:
                return (404, [:], Data())
            }
        }
        let code = try await client().authorize(email: "u@example.com", password: "12345678", create: false, challenge: "c", state: "S1")
        XCTAssertEqual(code, "IOS1")
    }

    @MainActor
    func testConcurrentAccessTokenCallsCoalesceIntoSingleRefreshWithResource() async throws {
        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.protocolClasses = [ScriptedServer.self]
        let account = CloudAccount(configuration: configuration, persistKeychain: false)
        account.apiSession = URLSession(configuration: sessionConfig)
        account.seedSessionForTesting(
            accountID: "user-1",
            accessToken: "stale-access",
            refreshToken: "rt-1",
            expiry: Date().addingTimeInterval(-30)
        )

        ScriptedServer.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://auth.example.test/db/auth/oauth2/token")
            let raw = String(decoding: ScriptedServer.body(of: request), as: UTF8.self)
            let form = Self.parseForm(raw)
            XCTAssertEqual(form["grant_type"], "refresh_token")
            XCTAssertEqual(form["refresh_token"], "rt-1")
            XCTAssertEqual(form["client_id"], "client-1")
            XCTAssertEqual(form["resource"], "https://sync.example.test")
            Thread.sleep(forTimeInterval: 0.05)
            return (200, [:], Self.json(["access_token": "fresh-access", "refresh_token": "rt-2", "expires_in": 3600]))
        }

        let config = configuration
        async let first = account.accessToken(config)
        async let second = account.accessToken(config)
        async let third = account.accessToken(config)
        let tokens = try await [first, second, third]

        XCTAssertEqual(tokens, ["fresh-access", "fresh-access", "fresh-access"])
        XCTAssertEqual(ScriptedServer.requests.count, 1)
    }

    @MainActor
    func testInvalidGrantClearsExpiredSessionAndSurfacesMessage() async {
        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.protocolClasses = [ScriptedServer.self]
        let account = CloudAccount(configuration: configuration, persistKeychain: false)
        account.apiSession = URLSession(configuration: sessionConfig)
        account.seedSessionForTesting(
            accountID: "user-1",
            accessToken: "stale-access",
            refreshToken: "dead-rt",
            expiry: Date().addingTimeInterval(-30)
        )

        ScriptedServer.handler = { _ in
            (400, [:], Self.json(["error": "invalid_grant", "error_description": "session not found"]))
        }

        do {
            _ = try await account.accessToken(configuration)
            XCTFail("expected sessionExpired")
        } catch let error as CloudError {
            XCTAssertEqual(error, .sessionExpired)
        } catch {
            XCTFail("unexpected error: \(error)")
        }

        XCTAssertNil(account.accountID)
        XCTAssertEqual(account.error, CloudError.sessionExpired.errorDescription)
    }

    @MainActor
    func testTransientServerOutagePreservesSession() async {
        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.protocolClasses = [ScriptedServer.self]
        let account = CloudAccount(configuration: configuration, persistKeychain: false)
        account.apiSession = URLSession(configuration: sessionConfig)
        account.seedSessionForTesting(
            accountID: "user-1",
            accessToken: "stale-access",
            refreshToken: "good-rt",
            expiry: Date().addingTimeInterval(-30)
        )

        ScriptedServer.handler = { _ in (503, [:], Data()) }

        do {
            _ = try await account.accessToken(configuration)
            XCTFail("expected connection error")
        } catch let error as CloudError {
            XCTAssertEqual(error, .connection)
        } catch {
            XCTFail("unexpected error: \(error)")
        }

        XCTAssertEqual(account.accountID, "user-1")
    }

    @MainActor
    func testRequestWithRefreshRetriesOnceAfter401() async throws {
        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.protocolClasses = [ScriptedServer.self]
        let account = CloudAccount(configuration: configuration, persistKeychain: false)
        account.apiSession = URLSession(configuration: sessionConfig)
        account.seedSessionForTesting(
            accountID: "user-1",
            accessToken: "revoked-access",
            refreshToken: "rt-1",
            expiry: Date().addingTimeInterval(3600)
        )

        nonisolated(unsafe) var progressCount = 0
        ScriptedServer.handler = { request in
            if request.url?.path.hasSuffix("/oauth2/token") == true {
                return (200, [:], Self.json(["access_token": "new-access", "refresh_token": "rt-2", "expires_in": 3600]))
            }
            if request.url?.path == "/v1/progress/khatma" {
                progressCount += 1
                if progressCount == 1 {
                    XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer revoked-access")
                    return (401, [:], Data())
                }
                XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer new-access")
                return (200, [:], Self.json(["revision": 9, "unchanged": true]))
            }
            return (404, [:], Data())
        }

        let endpoint = origin.appending(path: "v1/progress/khatma")
        let (data, updatedToken) = try await account.requestWithRefresh(configuration, initialToken: "revoked-access", url: endpoint)
        XCTAssertEqual(progressCount, 2)
        XCTAssertEqual(updatedToken, "new-access")
        let decoded = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(decoded["revision"] as? Int, 9)
    }

    private static func parseForm(_ raw: String) -> [String: String] {
        Dictionary(uniqueKeysWithValues: raw.split(separator: "&").compactMap { pair -> (String, String)? in
            let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            guard let key = parts.first else { return nil }
            let decode: (Substring) -> String = {
                let spaced = $0.replacingOccurrences(of: "+", with: " ")
                return spaced.removingPercentEncoding ?? spaced
            }
            return (decode(key), parts.count > 1 ? decode(parts[1]) : "")
        })
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
