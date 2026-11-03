import Foundation
import os

/// An أصول باب as the data names it, for the reader's list of what to show.
public struct QiraatUsulCategory: Sendable, Hashable, Identifiable {
    public let code: String
    public let nameAr: String
    public let color: String
    public var id: String { code }

    public init(code: String, nameAr: String, color: String) {
        self.code = code; self.nameAr = nameAr; self.color = color
    }
}

/// Reads the bundled snapshot of the web app's Qiraat data (Generated/Qiraat: catalog.json and
/// page-001.json … page-604.json, written by scripts/fetch_qiraat.py) and keeps recent pages decoded.
/// A page that is missing or does not decode is nil: that page shows no Qiraat marks, nothing more.
///
/// The web app's database is the source of truth, so a page fetched live from it (`applyLivePage`) is
/// kept in an `overlayDirectory` next to the snapshot and wins over the snapshot page. The snapshot
/// itself is never written (the app bundle is read-only).
/// `@unchecked Sendable`: the catalog is immutable and the cache is only touched under `lock`.
public final class QiraatStore: @unchecked Sendable {
    public enum Failure: Error, Equatable { case missingCatalog, unreadableCatalog(String) }
    /// A live page that is not a valid Qiraat page of the requested number; nothing is replaced.
    public enum LiveFailure: Error, Equatable {
        case invalidPage
        /// A page that is far smaller than the one held: the web route answers from its bundled fixtures when its
        /// database is unreachable, and nothing in that answer says so. Pass `allowShrink` to accept it anyway.
        case suspiciousShrink
    }

    /// Pages with fewer records than this are never protected against shrinking.
    static let shrinkGuardMinimum = 10

    public let directory: URL
    public let overlayDirectory: URL?
    public let catalog: QiraatCatalog
    private let capacity: Int
    private let lock = NSLock()
    private var pages: [Int: QiraatPageData?] = [:]
    /// Least recently used first.
    private var order: [Int] = []
    private var usulHidden = false
    private var hiddenCategories: Set<String> = []
    private var installedCategories: [QiraatUsulCategory]?

    /// The reader's «فرش فقط» choice: while on, every page is served without its أصول rulings, so the marks, the
    /// word sheet, the page summary, the search and the key all show فرش alone. The rulings stay in the cache and on
    /// disk, so turning it off brings them back at once.
    public var hidesUsul: Bool {
        get { lock.withLock { usulHidden } }
        set {
            let changed = lock.withLock { () -> Bool in
                defer { usulHidden = newValue }
                return usulHidden != newValue
            }
            if changed { WordContextIndex.shared.invalidate() }
        }
    }

    /// The أصول categories (by `QiraatRuling.category` code) the reader switched off: their rulings are left out of every
    /// page, exactly as «فرش فقط» leaves out all of them, and come back the moment the code is removed.
    public var hiddenUsulCategories: Set<String> {
        get { lock.withLock { hiddenCategories } }
        set {
            let changed = lock.withLock { () -> Bool in
                defer { hiddenCategories = newValue }
                return hiddenCategories != newValue
            }
            if changed { WordContextIndex.shared.invalidate() }
        }
    }

    /// The categories that make the cached أصول index differ: «فرش فقط» or any switched-off باب.
    public var usulVisibilityKey: String {
        lock.withLock { (usulHidden ? "all" : "") + "|" + hiddenCategories.sorted().joined(separator: ",") }
    }

    /// Every word-anchored أصول category of the installed pages (the live overlay wins), whatever the reader hid,
    /// in first-seen order. Reads all 604 pages the first time, so call it off the main thread; the answer is kept
    /// until a live page or a backup import changes the data.
    public func usulCategories() -> [QiraatUsulCategory] {
        if let held = lock.withLock({ installedCategories }) { return held }
        var seen: Set<String> = []
        var found: [QiraatUsulCategory] = []
        for number in 1...mushafPageCount {
            guard let page = storedPage(number) else { continue }
            for ruling in page.rulings where ruling.wordAnchored && seen.insert(ruling.category).inserted {
                found.append(QiraatUsulCategory(code: ruling.category, nameAr: ruling.categoryAr, color: ruling.color))
            }
        }
        lock.withLock { installedCategories = found }
        return found
    }

    public init(directory: URL, overlayDirectory: URL? = nil, capacity: Int = 16) throws {
        self.directory = directory
        self.overlayDirectory = overlayDirectory
        self.capacity = capacity
        guard let data = try? Data(contentsOf: directory.appendingPathComponent("catalog.json")) else {
            throw Failure.missingCatalog
        }
        do {
            catalog = try JSONDecoder().decode(QiraatCatalog.self, from: data)
        } catch {
            throw Failure.unreadableCatalog(String(describing: error))
        }
    }

    public func fileURL(page: Int) -> URL {
        directory.appendingPathComponent(String(format: "page-%03d.json", page))
    }

    public func page(_ number: Int) -> QiraatPageData? {
        guard let held = storedPage(number) else { return nil }
        guard !held.rulings.isEmpty else { return held }
        let (all, hidden) = lock.withLock { (usulHidden, hiddenCategories) }
        if all { return QiraatPageData(pageNumber: held.pageNumber, variants: held.variants, rulings: [], rules: held.rules) }
        guard !hidden.isEmpty else { return held }
        let shown = held.rulings.filter { !hidden.contains($0.category) }
        guard shown.count != held.rulings.count else { return held }
        return QiraatPageData(pageNumber: held.pageNumber, variants: held.variants, rulings: shown, rules: held.rules)
    }

    /// The page as installed, whatever the reader chose to hide.
    private func storedPage(_ number: Int) -> QiraatPageData? {
        guard (1...mushafPageCount).contains(number) else { return nil }
        if let hit = lock.withLock({ () -> QiraatPageData?? in
            guard let cached = pages[number] else { return nil }
            touch(number)
            return .some(cached)
        }) { return hit }

        let decoded = decodePage(at: overlayFileURL(page: number), number: number)
            ?? decodePage(at: fileURL(page: number), number: number)
        lock.withLock {
            pages[number] = .some(decoded)
            touch(number)
            while order.count > capacity { pages[order.removeFirst()] = nil }
        }
        return decoded
    }

    private func overlayFileURL(page: Int) -> URL? {
        overlayDirectory?.appendingPathComponent(String(format: "page-%03d.json", page))
    }

    private func decodePage(at url: URL?, number: Int) -> QiraatPageData? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        let page = Self.decodePage(data, number: number)
        if page == nil {
            // A page file that is there but will not decode looks exactly like a page with no data. Leave a trace.
            Logger(subsystem: "com.shazlka.qiraat", category: "qiraat-store")
                .error("page \(number) at \(url.lastPathComponent, privacy: .public) does not decode; treated as having no data")
        }
        return page
    }

    private static func decodePage(_ data: Data, number: Int) -> QiraatPageData? {
        (try? JSONDecoder().decode(QiraatPageData.self, from: data)).flatMap { $0.pageNumber == number ? $0 : nil }
    }

    /// Installs a page fetched live from the web app. Returns whether it differs from what was shown
    /// (so callers redraw only then); throws `invalidPage` and changes nothing if the bytes are not a
    /// valid page `number`. The bytes are kept as received, so the next launch shows them too.
    @discardableResult
    public func applyLivePage(_ data: Data, number: Int, allowShrink: Bool = false) throws -> Bool {
        guard (1...mushafPageCount).contains(number), let overlayDirectory,
              let incoming = Self.decodePage(data, number: number) else { throw LiveFailure.invalidPage }
        let held = storedPage(number)
        if held == incoming { return false }
        if !allowShrink, let held {
            let before = held.variants.count + held.rulings.count
            let after = incoming.variants.count + incoming.rulings.count
            // More than a fifth of a sizeable page gone at once is a stale answer, not an editor's deletion.
            if before >= Self.shrinkGuardMinimum, after * 5 < before * 4 { throw LiveFailure.suspiciousShrink }
        }
        try FileManager.default.createDirectory(at: overlayDirectory, withIntermediateDirectories: true)
        try data.write(to: overlayDirectory.appendingPathComponent(String(format: "page-%03d.json", number)), options: .atomic)
        lock.withLock {
            pages[number] = .some(incoming)
            installedCategories = nil
            touch(number)
        }
        WordContextIndex.shared.invalidate(page: number)
        return true
    }

    /// Forgets every live page (an explicit backup import replaces the data they were laid over).
    public func clearOverlay() {
        if let overlayDirectory { try? FileManager.default.removeItem(at: overlayDirectory) }
        lock.withLock {
            pages.removeAll()
            order.removeAll()
            installedCategories = nil
        }
        WordContextIndex.shared.invalidate()
    }

    public func marks(page number: Int) -> QiraatMarks? {
        page(number).map { QiraatMarks(catalog: catalog, page: $0) }
    }

    /// Call with `lock` held.
    private func touch(_ number: Int) {
        order.removeAll { $0 == number }
        order.append(number)
    }
}
