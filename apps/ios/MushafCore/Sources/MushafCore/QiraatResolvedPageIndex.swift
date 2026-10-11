import Foundation

/// Re-buckets Qiraat records by the page that contains their first Mushaf word.
/// Snapshot filenames are transport buckets; the Mushaf database is authoritative for navigation.
public struct QiraatResolvedPageIndex: Sendable {
    public let missingSnapshotPages: [Int]
    private let pages: [Int: QiraatPageData]

    public init(store: QiraatStore, wordPages: [MushafWordCoordinate: Int]) {
        var variants: [Int: [QiraatVariant]] = [:]
        var rulings: [Int: [QiraatRuling]] = [:]
        var rules: [Int: [QiraatPageRule]] = [:]
        var missing: [Int] = []

        for snapshotPage in 1...mushafPageCount {
            guard let data = store.page(snapshotPage) else {
                missing.append(snapshotPage)
                continue
            }
            for variant in data.variants {
                let coordinate = MushafWordCoordinate(
                    surah: variant.surah,
                    ayah: variant.ayah,
                    token: variant.startToken
                )
                guard let page = wordPages[coordinate] else { continue }
                variants[page, default: []].append(variant)
            }
            for ruling in data.rulings {
                let coordinate = MushafWordCoordinate(
                    surah: ruling.surah,
                    ayah: ruling.ayah,
                    token: ruling.startToken
                )
                guard let page = wordPages[coordinate] else { continue }
                rulings[page, default: []].append(ruling)
            }
            rules[snapshotPage, default: []].append(contentsOf: data.rules)
        }

        var resolved: [Int: QiraatPageData] = [:]
        for page in 1...mushafPageCount {
            let pageVariants = variants[page] ?? []
            let pageRulings = rulings[page] ?? []
            let pageRules = rules[page] ?? []
            if !pageVariants.isEmpty || !pageRulings.isEmpty || !pageRules.isEmpty {
                resolved[page] = QiraatPageData(
                    pageNumber: page,
                    variants: pageVariants,
                    rulings: pageRulings,
                    rules: pageRules
                )
            }
        }
        pages = resolved
        missingSnapshotPages = missing
    }

    public func page(_ number: Int) -> QiraatPageData? { pages[number] }
}

/// Shares the expensive 604-file scan and database coordinate index between summary presentations.
/// `revision` lets live-page updates create a fresh snapshot without blocking the main actor.
public actor QiraatResolvedPageCache {
    public static let shared = QiraatResolvedPageCache()

    private struct Key: Hashable {
        let store: ObjectIdentifier
        let databasePath: String
        let revision: Int
    }

    private var cached: [Key: QiraatResolvedPageIndex] = [:]
    private var inFlight: [Key: Task<QiraatResolvedPageIndex?, Never>] = [:]

    public init() {}

    public func index(
        store: QiraatStore,
        databaseURL: URL,
        revision: Int = 0
    ) async -> QiraatResolvedPageIndex? {
        let key = Key(
            store: ObjectIdentifier(store),
            databasePath: databaseURL.standardizedFileURL.path,
            revision: revision
        )
        if let index = cached[key] { return index }
        if let task = inFlight[key] { return await task.value }

        let task = Task.detached(priority: .userInitiated) { () -> QiraatResolvedPageIndex? in
            guard let database = try? MushafDatabase(url: databaseURL),
                  let wordPages = try? database.wordPageIndex() else { return nil }
            return QiraatResolvedPageIndex(store: store, wordPages: wordPages)
        }
        inFlight[key] = task
        let index = await task.value
        inFlight[key] = nil
        if let index {
            cached = cached.filter {
                $0.key.store != key.store || $0.key.databasePath != key.databasePath || $0.key == key
            }
            cached[key] = index
        }
        return index
    }
}
