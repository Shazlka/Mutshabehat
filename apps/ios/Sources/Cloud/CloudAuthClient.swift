import Foundation

/// Failures a person can act on while signing in or creating an account.
enum CloudAuthError: LocalizedError, Equatable {
    case invalidEmail, weakPassword, invalidCredentials, emailTaken, verificationRequired
    case rateLimited, connection, rejected

    var errorDescription: String? {
        switch self {
        case .invalidEmail: "اكتب بريدًا إلكترونيًا صحيحًا."
        case .weakPassword: "كلمة المرور يجب أن تكون ٨ أحرف على الأقل."
        case .invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        case .emailTaken: "هذا البريد مسجّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب."
        case .verificationRequired: "أرسلنا رسالة تأكيد إلى بريدك. افتحها ثم سجّل الدخول."
        case .rateLimited: "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."
        case .connection: "تعذر الاتصال. تأكد من الإنترنت وأعد المحاولة."
        case .rejected: "تعذر تسجيل الدخول. حاول مرة أخرى."
        }
    }
}

extension CloudConfiguration {
    func authorizeURL(challenge: String, state: String) -> URL {
        var url = URLComponents(url: issuer.appending(path: "oauth2/authorize"), resolvingAgainstBaseURL: false)!
        url.queryItems = [
            "client_id": clientID, "redirect_uri": redirect, "response_type": "code",
            "scope": "openid profile email offline_access", "resource": origin.absoluteString,
            "code_challenge": challenge, "code_challenge_method": "S256", "state": state,
        ].map { URLQueryItem(name: $0.key, value: $0.value) }
        return url.url!
    }
}

/// Signs a person in or registers them inside the app and returns an OAuth authorization code.
///
/// The person types credentials into a native form. This client talks to the same Better Auth endpoints the
/// hosted sign-in page uses (`/sign-in/email`, `/sign-up/email`, `/oauth2/continue`, `/oauth2/consent`), so no
/// browser is opened and the server needs no change. Cookies live in memory for this one exchange only; the
/// password is never stored. The caller exchanges the returned code for tokens with its own PKCE verifier.
struct CloudAuthClient {
    let configuration: CloudConfiguration
    var session = URLSession(configuration: .ephemeral)

    static let minimumPasswordLength = 8

    static func validate(email: String, password: String) throws {
        let parts = email.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, parts[1].contains("."), !parts[1].hasPrefix("."),
              !parts[1].hasSuffix("."), !email.contains(" ") else { throw CloudAuthError.invalidEmail }
        guard password.count >= minimumPasswordLength else { throw CloudAuthError.weakPassword }
    }

    func authorize(email: String, password: String, create: Bool, challenge: String, state: String) async throws -> String {
        try Self.validate(email: email, password: password)
        var jar: [String: String] = [:]

        // 1. Start the flow without a session. The server answers with the signed query its login page would get.
        var start = URLRequest(url: configuration.authorizeURL(challenge: challenge, state: state))
        start.httpShouldHandleCookies = false
        let started = try await send(start, jar: &jar)
        // Depending on request headers the server answers with a 302 Location or a 200 `{redirect, url}` body.
        let location = (300..<400).contains(started.status) ? started.header("Location")
            : started.status == 200 ? Self.redirect(in: started.data, relativeTo: configuration.origin)?.absoluteString : nil
        guard let location, let signed = Self.signedQuery(from: URL(string: location, relativeTo: configuration.origin)) else {
            throw CloudAuthError.rejected
        }

        // 2. Create the account or sign in; the response sets the session cookie.
        let name = String(email.split(separator: "@")[0])
        let credentials: [String: Any] = create
            ? ["email": email, "password": password, "name": name]
            : ["email": email, "password": password]
        let auth = try await post(create ? "sign-up/email" : "sign-in/email", credentials, jar: &jar)
        if create, (try? JSONSerialization.jsonObject(with: auth.data) as? [String: Any])?["token"] as? String == nil {
            throw CloudAuthError.verificationRequired
        }

        // 3. Resume the authorization with that session, accepting consent for our own first-party app.
        var next = try await post("oauth2/continue", ["selected": true, "oauth_query": signed], jar: &jar)
        for _ in 0..<4 {
            guard let target = Self.redirect(in: next.data, relativeTo: configuration.origin) else { throw CloudAuthError.rejected }
            if target.absoluteString.hasPrefix(configuration.redirect) { return try Self.code(in: target, state: state) }
            guard target.path.hasSuffix("/consent"), let query = Self.signedQuery(from: target) else { throw CloudAuthError.rejected }
            next = try await post("oauth2/consent", ["accept": true, "oauth_query": query], jar: &jar)
        }
        throw CloudAuthError.rejected
    }

    // MARK: Transport

    private struct Reply {
        let status: Int
        let data: Data
        let headers: [AnyHashable: Any]
        func header(_ name: String) -> String? {
            headers.first { ($0.key as? String)?.caseInsensitiveCompare(name) == .orderedSame }?.value as? String
        }
    }

    private func post(_ path: String, _ body: [String: Any], jar: inout [String: String]) async throws -> Reply {
        var request = URLRequest(url: configuration.issuer.appending(path: path), cachePolicy: .reloadIgnoringLocalCacheData,
                                 timeoutInterval: 30)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        // The auth server checks that state-changing requests come from a trusted origin: our Function's.
        request.setValue(configuration.origin.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
                         forHTTPHeaderField: "Origin")
        let reply = try await send(request, jar: &jar)
        guard reply.status == 200 else { throw Self.failure(status: reply.status, data: reply.data) }
        return reply
    }

    private func send(_ request: URLRequest, jar: inout [String: String]) async throws -> Reply {
        var request = request
        request.httpShouldHandleCookies = false
        if !jar.isEmpty { request.setValue(jar.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: "; "), forHTTPHeaderField: "Cookie") }
        do {
            let (data, response) = try await session.data(for: request, delegate: NoRedirect())
            guard let http = response as? HTTPURLResponse else { throw CloudAuthError.connection }
            let fields = http.allHeaderFields.reduce(into: [String: String]()) { result, pair in
                if let key = pair.key as? String, let value = pair.value as? String { result[key] = value }
            }
            for cookie in HTTPCookie.cookies(withResponseHeaderFields: fields, for: request.url!) {
                if cookie.value.isEmpty { jar[cookie.name] = nil } else { jar[cookie.name] = cookie.value }
            }
            return Reply(status: http.statusCode, data: data, headers: http.allHeaderFields)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as CloudAuthError {
            throw error
        } catch {
            throw CloudAuthError.connection
        }
    }

    private static func failure(status: Int, data: Data) -> CloudAuthError {
        if status == 429 { return .rateLimited }
        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        switch (body?["code"] as? String)?.uppercased() {
        case "INVALID_EMAIL_OR_PASSWORD", "INVALID_PASSWORD", "USER_NOT_FOUND": return .invalidCredentials
        case "USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return .emailTaken
        case "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG": return .weakPassword
        case "INVALID_EMAIL": return .invalidEmail
        case "EMAIL_NOT_VERIFIED": return .verificationRequired
        default: return status == 401 ? .invalidCredentials : .rejected
        }
    }

    private final class NoRedirect: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest) async -> URLRequest? { nil }
    }

    // MARK: Parsing

    /// The part of the login redirect's query the server signed (`sig`, the names listed in `ba_param`, and `ba_param`).
    static func signedQuery(from url: URL?) -> String? {
        guard let items = url.flatMap({ URLComponents(url: $0, resolvingAgainstBaseURL: true) })?.queryItems,
              items.contains(where: { $0.name == "sig" }) else { return nil }
        let signedNames = Set(items.filter { $0.name == "ba_param" }.compactMap(\.value))
        guard !signedNames.isEmpty else { return nil }
        return items.filter { $0.name == "sig" || $0.name == "ba_param" || signedNames.contains($0.name) }
            .map { "\(formEncode($0.name))=\(formEncode($0.value ?? ""))" }.joined(separator: "&")
    }

    /// `application/x-www-form-urlencoded` encoding, matching JavaScript's `URLSearchParams`.
    static func formEncode(_ value: String) -> String {
        var result = ""
        for byte in value.utf8 {
            switch byte {
            case UInt8(ascii: "a")...UInt8(ascii: "z"), UInt8(ascii: "A")...UInt8(ascii: "Z"), UInt8(ascii: "0")...UInt8(ascii: "9"),
                 UInt8(ascii: "*"), UInt8(ascii: "-"), UInt8(ascii: "."), UInt8(ascii: "_"):
                result.append(Character(UnicodeScalar(byte)))
            case UInt8(ascii: " "): result.append("+")
            default: result += String(format: "%%%02X", byte)
            }
        }
        return result
    }

    private static func redirect(in data: Data, relativeTo base: URL) -> URL? {
        guard let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let value = body["url"] as? String else { return nil }
        return URL(string: value, relativeTo: base)?.absoluteURL
    }

    private static func code(in url: URL, state: String) throws -> String {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: true)?.queryItems ?? []
        guard items.first(where: { $0.name == "error" }) == nil,
              items.first(where: { $0.name == "state" })?.value == state,
              let code = items.first(where: { $0.name == "code" })?.value, !code.isEmpty else { throw CloudAuthError.rejected }
        return code
    }
}
