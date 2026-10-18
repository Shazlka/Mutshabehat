import Foundation
import CoreGraphics

/// Word-level context derived in a single per-page pass from verified Qiraat records.
public struct WordContext: Sendable, Hashable {
    public let wordId: String
    public let surah: Int
    public let ayah: Int
    public let token: Int
    public let position: Int
    public let marks: WordMarks?
    public let variants: [QiraatVariant]
    public let rulings: [QiraatRuling]
    /// Multi-word linked word IDs when a verified span is declared in the source data.
    public let linkedWordIDs: [String]

    public init(
        wordId: String,
        surah: Int,
        ayah: Int,
        token: Int,
        position: Int,
        marks: WordMarks?,
        variants: [QiraatVariant],
        rulings: [QiraatRuling],
        linkedWordIDs: [String] = []
    ) {
        self.wordId = wordId
        self.surah = surah
        self.ayah = ayah
        self.token = token
        self.position = position
        self.marks = marks
        self.variants = variants
        self.rulings = rulings
        self.linkedWordIDs = linkedWordIDs
    }
}

/// Resolved context for an entire page, built in a single batch pass.
public struct PageWordContext: Sendable {
    public let pageNumber: Int
    public let filter: QiraatFilter
    public let words: [String: WordContext]
    public let marksByWordID: [String: WordMarks]
    public let source: LoadSource
    public let durationMs: Double
    public let queryCount: Int

    public enum LoadSource: String, Sendable {
        case cache
        case db
    }

    public init(
        pageNumber: Int,
        filter: QiraatFilter,
        words: [String: WordContext],
        marksByWordID: [String: WordMarks],
        source: LoadSource,
        durationMs: Double,
        queryCount: Int
    ) {
        self.pageNumber = pageNumber
        self.filter = filter
        self.words = words
        self.marksByWordID = marksByWordID
        self.source = source
        self.durationMs = durationMs
        self.queryCount = queryCount
    }
}

/// A bounded in-memory cache and batch index for word-level Qiraat context.
public final class WordContextIndex: @unchecked Sendable {
    public static let shared = WordContextIndex()

    public struct Key: Hashable, Sendable {
        public let storeID: ObjectIdentifier
        public let page: Int
        public let filter: QiraatFilter
        public let revision: Int

        public init(store: QiraatStore, page: Int, filter: QiraatFilter, revision: Int) {
            self.storeID = ObjectIdentifier(store)
            self.page = page
            self.filter = filter
            self.revision = revision
        }
    }

    private let lock = NSLock()
    private let capacity: Int
    private var cache: [Key: PageWordContext] = [:]
    private var order: [Key] = []
    private var inFlight: [Key: Task<PageWordContext, Never>] = [:]
    private var revision: Int = 0
    /// Bumped by `invalidate(page:)`. A page's key revision is `revision + pageRevisions[page]`, which only ever
    /// grows, so a context computed before either kind of invalidation can never be cached afterwards.
    private var pageRevisions: [Int: Int] = [:]

    public init(capacity: Int = 24) {
        self.capacity = capacity
    }

    /// Fast synchronous lookup for an already computed page context.
    public func cachedContext(store: QiraatStore, page: Int, filter: QiraatFilter) -> PageWordContext? {
        lock.withLock {
            let key = Key(store: store, page: page, filter: filter, revision: revision(for: page))
            guard let found = cache[key] else { return nil }
            touch(key)
            return PageWordContext(
                pageNumber: found.pageNumber,
                filter: found.filter,
                words: found.words,
                marksByWordID: found.marksByWordID,
                source: .cache,
                durationMs: 0.0,
                queryCount: 0
            )
        }
    }

    /// Synchronously computes or returns the cached page context in a single pass.
    public func resolveSync(
        page: Int,
        filter: QiraatFilter,
        qiraatStore: QiraatStore,
        pageWords: [MushafWord],
        queryCount: Int = 0
    ) -> PageWordContext {
        let key = lock.withLock { Key(store: qiraatStore, page: page, filter: filter, revision: revision(for: page)) }
        if let cached = cachedContext(store: qiraatStore, page: page, filter: filter) {
            #if DEBUG
            print("[WordContextIndex] Page \(page) loaded from cache in 0.00ms (0 queries)")
            #endif
            return cached
        }

        let result = computeBatch(
            page: page,
            filter: filter,
            qiraatStore: qiraatStore,
            pageWords: pageWords,
            queryCount: queryCount
        )

        lock.withLock {
            if !pageWords.isEmpty, key.revision == revision(for: page) {
                cache[key] = result
                touch(key)
                while order.count > capacity {
                    let oldest = order.removeFirst()
                    cache[oldest] = nil
                }
            }
        }

        #if DEBUG
        print("[WordContextIndex] Page \(page) loaded from \(result.source.rawValue) in \(String(format: "%.2f", result.durationMs))ms (\(result.queryCount) queries)")
        #endif

        return result
    }

    /// Loads or computes the page word context in a single pass off the main thread.
    public func context(
        page: Int,
        filter: QiraatFilter,
        qiraatStore: QiraatStore,
        pageWords: [MushafWord],
        queryCount: Int = 0
    ) async -> PageWordContext {
        let (key, existingTask) = lock.withLock { () -> (Key, Task<PageWordContext, Never>?) in
            let key = Key(store: qiraatStore, page: page, filter: filter, revision: revision(for: page))
            if cache[key] != nil {
                touch(key)
                return (key, nil)
            }
            if let running = inFlight[key] {
                return (key, running)
            }
            return (key, nil)
        }

        if let cached = cachedContext(store: qiraatStore, page: page, filter: filter) {
            #if DEBUG
            print("[WordContextIndex] Page \(page) loaded from cache in 0.00ms (0 queries)")
            #endif
            return cached
        }

        if let existingTask {
            return await existingTask.value
        }

        let task = Task.detached(priority: .userInitiated) { [weak self] () -> PageWordContext in
            guard let self else {
                return PageWordContext(pageNumber: page, filter: filter, words: [:], marksByWordID: [:], source: .db, durationMs: 0, queryCount: 0)
            }
            return self.computeBatch(
                page: page,
                filter: filter,
                qiraatStore: qiraatStore,
                pageWords: pageWords,
                queryCount: queryCount
            )
        }

        lock.withLock {
            inFlight[key] = task
        }

        let result = await task.value

        lock.withLock {
            inFlight[key] = nil
            if !pageWords.isEmpty, key.revision == revision(for: page) {
                cache[key] = result
                touch(key)
                while order.count > capacity {
                    let oldest = order.removeFirst()
                    cache[oldest] = nil
                }
            }
        }

        #if DEBUG
        print("[WordContextIndex] Page \(page) loaded from \(result.source.rawValue) in \(String(format: "%.2f", result.durationMs))ms (\(result.queryCount) queries)")
        #endif

        return result
    }

    /// The single-pass per-page batch algorithm.
    private func computeBatch(
        page: Int,
        filter: QiraatFilter,
        qiraatStore: QiraatStore,
        pageWords: [MushafWord],
        queryCount: Int
    ) -> PageWordContext {
        let startTime = CFAbsoluteTimeGetCurrent()
        guard let marks = qiraatStore.marks(page: page),
              let pageData = qiraatStore.page(page) else {
            let duration = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
            return PageWordContext(
                pageNumber: page,
                filter: filter,
                words: [:],
                marksByWordID: [:],
                source: .db,
                durationMs: duration,
                queryCount: queryCount
            )
        }

        // Build multi-word links for this page when declared by verified spans
        var links: [String: [String]] = [:]
        for ruling in pageData.rulings where ruling.wordAnchored {
            let isMultiToken = ruling.endToken > ruling.startToken
            let isCrossAyah = (ruling.endAyah ?? ruling.ayah) > ruling.ayah
            if isMultiToken || isCrossAyah {
                let matchingWords = pageWords.filter { word in
                    word.charType == .word && ruling.touches(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah, token: word.indexInAyah)
                }
                let ids = matchingWords.map(\.id)
                for word in matchingWords {
                    var existing = links[word.id] ?? []
                    for otherId in ids where otherId != word.id && !existing.contains(otherId) {
                        existing.append(otherId)
                    }
                    links[word.id] = existing
                }
            }
        }

        for variant in pageData.variants where variant.endToken > variant.startToken {
            let matchingWords = pageWords.filter { word in
                word.charType == .word && word.ayahKey.surah == variant.surah && word.ayahKey.ayah == variant.ayah
                    && word.indexInAyah >= variant.startToken && word.indexInAyah <= variant.endToken
            }
            let ids = matchingWords.map(\.id)
            for word in matchingWords {
                var existing = links[word.id] ?? []
                for otherId in ids where otherId != word.id && !existing.contains(otherId) {
                    existing.append(otherId)
                }
                links[word.id] = existing
            }
        }

        var contexts: [String: WordContext] = [:]
        var marksByWordID: [String: WordMarks] = [:]

        for word in pageWords where word.charType == .word {
            let s = word.ayahKey.surah
            let a = word.ayahKey.ayah
            let t = word.indexInAyah

            let mark = marks.wordMarks(for: word, filter: filter)
            if let mark {
                marksByWordID[word.id] = mark
            }

            let variants = marks.variants(surah: s, ayah: a, token: t).filter { marks.matches($0, filter) }
            let rulings = marks.rulingMarker(surah: s, ayah: a, token: t, filter: filter)?.rulings ?? []
            let wordLinks = links[word.id] ?? []

            contexts[word.id] = WordContext(
                wordId: word.id,
                surah: s,
                ayah: a,
                token: t,
                position: word.indexInLine,
                marks: mark,
                variants: variants,
                rulings: rulings,
                linkedWordIDs: wordLinks
            )
        }

        let duration = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
        return PageWordContext(
            pageNumber: page,
            filter: filter,
            words: contexts,
            marksByWordID: marksByWordID,
            source: .db,
            durationMs: duration,
            queryCount: queryCount
        )
    }

    /// Prefetches neighbour pages off the main thread.
    public func prefetch(
        pages: [Int],
        filter: QiraatFilter,
        qiraatStore: QiraatStore,
        wordsMap: [Int: [MushafWord]]
    ) {
        for p in pages where (1...mushafPageCount).contains(p) {
            let key = lock.withLock { Key(store: qiraatStore, page: p, filter: filter, revision: revision(for: p)) }
            let isCached = lock.withLock { cache[key] != nil || inFlight[key] != nil }
            guard !isCached else { continue }
            let words = wordsMap[p] ?? []
            Task.detached(priority: .background) { [weak self] in
                _ = await self?.context(
                    page: p,
                    filter: filter,
                    qiraatStore: qiraatStore,
                    pageWords: words,
                    queryCount: 0
                )
            }
        }
    }

    /// Cancels in-flight requests that are far from the visible page during rapid swiping.
    public func cancelObsolete(around currentPage: Int, maxDistance: Int = 2) {
        lock.withLock {
            for (key, task) in inFlight {
                if abs(key.page - currentPage) > maxDistance {
                    task.cancel()
                    inFlight[key] = nil
                }
            }
        }
    }

    /// Call with `lock` held.
    private func revision(for page: Int) -> Int { revision &+ (pageRevisions[page] ?? 0) }

    /// Drops the cached contexts of one page (every filter) and forgets work in flight for it, because that page's
    /// Qiraat data changed. Other pages keep their contexts, so a background sync of all 604 pages does not
    /// throw away what the neighbouring pages already computed.
    public func invalidate(page: Int) {
        lock.withLock {
            pageRevisions[page, default: 0] += 1
            for key in Array(inFlight.keys) where key.page == page {
                inFlight[key]?.cancel()
                inFlight[key] = nil
            }
            for key in Array(cache.keys) where key.page == page { cache[key] = nil }
            order.removeAll { $0.page == page }
        }
    }

    /// Invalidates the cache and cancels in-flight tasks upon filter or data sync changes.
    public func invalidate() {
        lock.withLock {
            revision += 1
            for task in inFlight.values {
                task.cancel()
            }
            inFlight.removeAll()
            cache.removeAll()
            order.removeAll()
        }
    }

    private func touch(_ key: Key) {
        order.removeAll { $0 == key }
        order.append(key)
    }
}
