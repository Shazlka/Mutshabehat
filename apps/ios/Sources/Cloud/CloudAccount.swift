import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit

enum CloudError: LocalizedError {
    case unavailable, signIn, invalidData, changed, connection

    var errorDescription: String? {
        switch self {
        case .unavailable: "خدمة المزامنة غير مهيأة في هذا الإصدار."
        case .signIn: "تعذر تسجيل الدخول. حاول مرة أخرى."
        case .invalidData: "تعذر قراءة بيانات التقدم."
        case .changed: "تغيّرت البيانات أثناء المزامنة. أعد المحاولة."
        case .connection: "تعذر الاتصال بالمزامنة. تقدّمك محفوظ على الجهاز."
        }
    }
}

struct CloudConfiguration {
    let origin: URL
    let issuer: URL
    let clientID: String

    static var current: Self? {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let origin = info["QiraatCloudOrigin"] as? String, let origin = URL(string: origin), origin.scheme == "https",
              let issuer = info["QiraatCloudIssuer"] as? String, let issuer = URL(string: issuer), issuer.scheme == "https",
              let id = info["QiraatCloudClientID"] as? String, !id.isEmpty else { return nil }
        return Self(origin: origin, issuer: issuer, clientID: id)
    }

    var redirect: String { origin.appending(path: "auth/mobile-callback").absoluteString }
}

@MainActor
@Observable
final class CloudAccount {
    private struct Tokens: Codable {
        let access_token: String
        let refresh_token: String?
        let expires_in: Int
    }

    private struct Session: Codable {
        let accountID: String
        let accessToken: String
        let refreshToken: String?
        let expiry: Date
        let issuer: URL
        var email: String? = nil
        var name: String? = nil
    }

    private struct Remote: Codable {
        let revision: Int
        let snapshot: ProgressSnapshot?
        var unchanged: Bool? = nil
    }

    private struct Baseline: Codable {
        let revision: Int
        let fingerprint: String
    }

    enum Resolution { case device, cloud }

    /// Seconds between foreground syncs. An unchanged check is one tiny request, so changes made on another
    /// device show up within this window and local changes upload within it.
    nonisolated static let liveSyncInterval = 5

    let configuration = CloudConfiguration.current
    /// In-memory only: no cookies or credentials from sign-in ever reach disk.
    var authSession = URLSession(configuration: .ephemeral)
    private var session: Session?
    private var browser: ASWebAuthenticationSession?
    private let anchor = CloudBrowserAnchor()
    var accountID: String? { session?.accountID }
    var email: String? { session?.email }
    /// The name to show for the account: its name, else the part of the email before the @, else a short id.
    var displayName: String? {
        guard let session else { return nil }
        if let name = session.name, !name.isEmpty { return name }
        if let email = session.email, let local = email.split(separator: "@").first { return String(local) }
        return "مستخدم Qiraat #\(session.accountID.prefix(6))"
    }
    private(set) var preparing = false
    private(set) var busy = false
    private(set) var lastSync: Date?
    private(set) var conflicts: [ProgressDataset: Int] = [:]
    var error: String?

    init() {
#if DEBUG
        if ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" { return }
#endif
        if let bytes = Self.keychainData(), let saved = try? JSONDecoder().decode(Session.self, from: bytes),
           saved.issuer == configuration?.issuer {
            session = saved
            preparing = needsSetup
        }
    }

    var directory: URL? {
        guard let session else { return nil }
        let key = SHA256.hash(data: Data("\(session.issuer.absoluteString)|\(session.accountID)".utf8))
            .map { String(format: "%02x", $0) }.joined()
        return URL.applicationSupportDirectory.appending(path: "CloudAccounts/\(key)", directoryHint: .isDirectory)
    }

    private var setupMarker: URL? { directory?.appending(path: "setup-completed") }

    private var needsSetup: Bool {
        setupMarker.map { !FileManager.default.fileExists(atPath: $0.path) } ?? false
    }

    func finishSetup() {
        guard !busy, let setupMarker else { return }
        do {
            try Data().write(to: setupMarker, options: .atomic)
            preparing = false
        } catch {
            self.error = CloudError.invalidData.errorDescription
        }
    }

    /// Signs in or registers with email and password entirely inside the app. No browser is opened.
    func signIn(email: String, password: String, create: Bool) async {
        guard !busy, session == nil, let config = configuration else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let (verifier, challenge, state) = try Self.pkce()
            let client = CloudAuthClient(configuration: config, session: authSession)
            let code = try await client.authorize(email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                                  password: password, create: create, challenge: challenge, state: state)
            let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
            try await completeSignIn(config, code: code, verifier: verifier, email: address,
                                     name: create ? address.split(separator: "@").first.map(String.init) : nil)
        } catch is CancellationError {
        } catch let failure as CloudAuthError {
            self.error = failure.errorDescription
        } catch {
            self.error = CloudError.signIn.errorDescription
        }
    }

    /// Google sign-in still needs the provider's own page, so it is the only path that opens a browser.
    func signInWithBrowser() async {
        guard !busy, let config = configuration else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let (verifier, challenge, state) = try Self.pkce()
            let callback = try await openBrowser(config.authorizeURL(challenge: challenge, state: state))
            let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false)
            guard parts?.host == "cloud", parts?.path == "/callback",
                  parts?.queryItems?.first(where: { $0.name == "state" })?.value == state,
                  let code = parts?.queryItems?.first(where: { $0.name == "code" })?.value else { throw CloudError.signIn }
            try await completeSignIn(config, code: code, verifier: verifier)
        } catch let authError as ASWebAuthenticationSessionError where authError.code == .canceledLogin {
        } catch {
            self.error = CloudError.signIn.errorDescription
        }
    }

    private func completeSignIn(_ config: CloudConfiguration, code: String, verifier: String,
                                email: String? = nil, name: String? = nil) async throws {
        let tokens = try await token(config, parameters: [
            "grant_type": "authorization_code", "code": code, "code_verifier": verifier, "redirect_uri": config.redirect,
        ])
        struct Identity: Decodable { let id: String }
        let data = try await request(config.origin.appending(path: "v1/account"), accessToken: tokens.access_token)
        let identity = try JSONDecoder().decode(Identity.self, from: data)
        try saveSession(tokens, config: config, accountID: identity.id, email: email, name: name)
        preparing = needsSetup
    }

    private static func pkce() throws -> (verifier: String, challenge: String, state: String) {
        let verifier = try random()
        return (verifier, base64URL(Data(SHA256.hash(data: Data(verifier.utf8)))), try random())
    }

    func signOut() {
        guard !busy else { return }
        let status = SecItemDelete(Self.keychainQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            error = CloudError.signIn.errorDescription
            return
        }
        revoke(session)
        session = nil
        preparing = false
        error = nil
        lastSync = nil
        conflicts = [:]
    }

    func sync(library: MushafLibrary, resolution: Resolution? = nil, dataset: ProgressDataset? = nil,
              importGuest: Bool = false) async {
        guard !busy, session != nil, let config = configuration, let directory else { return }
        busy = true
        error = nil
        defer { busy = false }
        for item in dataset.map({ [$0] }) ?? ProgressDataset.allCases {
            do {
                let token = try await accessToken(config)
                let endpoint = config.origin.appending(path: "v1/progress/\(item.rawValue)")
                let local = try snapshot(item, library: library)
                let hash = try ProgressDataset.fingerprint(local)
                let file = directory.appending(path: "\(item.rawValue)-baseline.json")
                let base = (try? Data(contentsOf: file)).flatMap { try? JSONDecoder().decode(Baseline.self, from: $0) }
                let lookup = importGuest ? endpoint : endpoint.appending(queryItems: [
                    URLQueryItem(name: "known", value: String(base?.revision ?? 0)),
                ])
                let bytes = try await request(lookup, accessToken: token)
                let remote = try JSONDecoder().decode(Remote.self, from: bytes)
                let hasLocalChanges = base.map { $0.fingerprint != hash } ?? item.hasProgress(local)
                if remote.unchanged == true, !hasLocalChanges {
                    conflicts[item] = nil
                    lastSync = Date()
                    continue
                }
                var revision = remote.revision
                var appliedHash = hash
                let resolution = conflicts[item] == remote.revision ? resolution : nil
                if importGuest {
                    guard remote.snapshot == nil, !hasLocalChanges else { throw CloudError.changed }
                    let guest: ProgressSnapshot
                    switch item {
                    case .khatma: guest = try QuranReadingDatabase.shared.cloudSnapshot()
                    case .memorization: guest = try MemorizationDatabase().cloudSnapshot()
                    }
                    guard item.hasProgress(guest) else { continue }
                    guard try snapshot(item, library: library) == local else { throw CloudError.changed }
                    appliedHash = try ProgressDataset.fingerprint(snapshot(item, library: library, replacing: guest))
                    revision = try await upload(guest, revision: revision, endpoint: endpoint, token: token)
                } else if let incoming = remote.snapshot, incoming == local {
                    // A previous request may have succeeded before the device received the response.
                } else if let incoming = remote.snapshot, resolution == .cloud || !hasLocalChanges {
                    guard try snapshot(item, library: library) == local else { throw CloudError.changed }
                    appliedHash = try ProgressDataset.fingerprint(snapshot(item, library: library, replacing: incoming))
                } else if remote.revision == 0 || resolution == .device || base?.revision == remote.revision {
                    if !hasLocalChanges && remote.revision == 0 { continue }
                    revision = try await upload(local, revision: revision, endpoint: endpoint, token: token)
                } else {
                    conflicts[item] = remote.revision
                    continue
                }
                let baseline = Baseline(revision: revision, fingerprint: appliedHash)
                try JSONEncoder().encode(baseline).write(to: file, options: .atomic)
                conflicts[item] = nil
                lastSync = Date()
            } catch is CancellationError {
                return
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func snapshot(_ dataset: ProgressDataset, library: MushafLibrary,
                          replacing value: ProgressSnapshot? = nil) throws -> ProgressSnapshot {
        switch dataset {
        case .khatma:
            let result = try library.readingDatabase.cloudSnapshot(replacing: value)
            if value != nil {
                library.readingTracker.reloadFromDatabase()
                NotificationCenter.default.post(name: .readingDatabaseDidUpdate, object: nil)
            }
            return result
        case .memorization:
            guard let store = library.memorizationStore else { throw CloudError.invalidData }
            let result = try store.database.cloudSnapshot(replacing: value)
            if value != nil { store.reloadFromDatabase() }
            return result
        }
    }

    private func upload(_ snapshot: ProgressSnapshot, revision: Int, endpoint: URL, token: String) async throws -> Int {
        let update = try JSONEncoder().encode(Remote(revision: revision, snapshot: snapshot))
        let data = try await request(endpoint, accessToken: token, method: "PUT", body: update)
        return try JSONDecoder().decode(Remote.self, from: data).revision
    }

    /// Best effort: tells the server to forget the refresh token. Signing out never waits for or depends on it.
    private func revoke(_ session: Session?) {
        guard let config = configuration, let token = session?.refreshToken else { return }
        var form = URLComponents()
        form.queryItems = ["token": token, "token_type_hint": "refresh_token", "client_id": config.clientID]
            .map { URLQueryItem(name: $0.key, value: $0.value) }
        var request = URLRequest(url: config.issuer.appending(path: "oauth2/revoke"), timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = form.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
        let urlSession = authSession
        Task.detached { _ = try? await urlSession.data(for: request) }
    }

    private func accessToken(_ config: CloudConfiguration) async throws -> String {
        guard let session else { throw CloudError.signIn }
        if session.expiry.timeIntervalSinceNow > 60 { return session.accessToken }
        guard let refresh = session.refreshToken else { throw CloudError.signIn }
        let tokens = try await token(config, parameters: ["grant_type": "refresh_token", "refresh_token": refresh])
        try saveSession(tokens, config: config, accountID: session.accountID, fallbackRefresh: refresh)
        return tokens.access_token
    }

    private func token(_ config: CloudConfiguration, parameters: [String: String]) async throws -> Tokens {
        var form = URLComponents()
        form.queryItems = (parameters.merging(["client_id": config.clientID, "resource": config.origin.absoluteString]) { existing, _ in existing })
            .map { URLQueryItem(name: $0.key, value: $0.value) }
        let encoded = form.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        let data = try await request(config.issuer.appending(path: "oauth2/token"), method: "POST",
                                     body: encoded.map { Data($0.utf8) }, contentType: "application/x-www-form-urlencoded")
        return try JSONDecoder().decode(Tokens.self, from: data)
    }

    private func request(_ url: URL, accessToken: String? = nil, method: String = "GET", body: Data? = nil,
                         contentType: String = "application/json") async throws -> Data {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = method
        request.httpBody = body
        if body != nil { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        if let accessToken { request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: request)
        switch (response as? HTTPURLResponse)?.statusCode {
        case 200: return data
        case 401: throw CloudError.signIn
        case 409: throw CloudError.changed
        default: throw CloudError.connection
        }
    }

    private func openBrowser(_ url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let browser = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.shazlka.qiraat") { url, error in
                if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: error ?? CloudError.signIn) }
            }
            browser.presentationContextProvider = anchor
            browser.prefersEphemeralWebBrowserSession = true
            self.browser = browser
            if !browser.start() { continuation.resume(throwing: CloudError.signIn) }
        }
    }

    private func saveSession(_ tokens: Tokens, config: CloudConfiguration, accountID: String,
                             fallbackRefresh: String? = nil, email: String? = nil, name: String? = nil) throws {
        // A token refresh keeps the account details the person signed in with.
        let known = session?.accountID == accountID ? session : nil
        let saved = Session(accountID: accountID, accessToken: tokens.access_token,
                            refreshToken: tokens.refresh_token ?? fallbackRefresh,
                            expiry: Date().addingTimeInterval(TimeInterval(tokens.expires_in)), issuer: config.issuer,
                            email: email ?? known?.email, name: name ?? known?.name)
        let data = try JSONEncoder().encode(saved)
        let query = Self.keychainQuery
        let updated = SecItemUpdate(query as CFDictionary, [kSecValueData: data] as CFDictionary)
        if updated == errSecItemNotFound {
            var insertion = query
            insertion[kSecValueData] = data
            insertion[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(insertion as CFDictionary, nil) == errSecSuccess else { throw CloudError.signIn }
        } else if updated != errSecSuccess {
            throw CloudError.signIn
        }
        session = saved
    }

    private static var keychainQuery: [CFString: Any] {
        [kSecClass: kSecClassGenericPassword, kSecAttrService: "com.shazlka.qiraat.cloud", kSecAttrAccount: "session"]
    }

    private static func keychainData() -> Data? {
        var query = keychainQuery
        query[kSecReturnData] = true
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess else { return nil }
        return value as? Data
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    private static func random() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw CloudError.signIn }
        return base64URL(Data(bytes))
    }
}

@MainActor
private final class CloudBrowserAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }
}
