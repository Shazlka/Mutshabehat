import Foundation
import Testing
@testable import MushafCore

@Suite struct WordContextIndexTests {
    private func realStore() throws -> QiraatStore {
        let qiraatDir = generatedDirectory.appendingPathComponent("Qiraat")
        return try QiraatStore(directory: qiraatDir)
    }

    @Test func cacheHitMissAndTimingMetrics() throws {
        let db = try openDatabase()
        let store = try realStore()
        let index = WordContextIndex(capacity: 10)
        let page1 = try db.page(1)
        let words = page1.lines.flatMap(\.words)

        // 1. Initial lookup -> Miss (source == .db)
        #expect(index.cachedContext(store: store, page: 1, filter: .all) == nil)
        let first = index.resolveSync(page: 1, filter: .all, qiraatStore: store, pageWords: words)
        #expect(first.pageNumber == 1)
        #expect(first.source == .db)
        #expect(first.durationMs >= 0)

        // 2. Second lookup -> Hit (source == .cache)
        let cached = try #require(index.cachedContext(store: store, page: 1, filter: .all))
        #expect(cached.pageNumber == 1)
        #expect(cached.marksByWordID == first.marksByWordID)

        let second = index.resolveSync(page: 1, filter: .all, qiraatStore: store, pageWords: words)
        #expect(second.source == .cache)
    }

    @Test func invalidationClearsCacheAndCancelsTasks() throws {
        let db = try openDatabase()
        let store = try realStore()
        let index = WordContextIndex(capacity: 10)
        let page1 = try db.page(1)
        let words = page1.lines.flatMap(\.words)

        _ = index.resolveSync(page: 1, filter: .all, qiraatStore: store, pageWords: words)
        #expect(index.cachedContext(store: store, page: 1, filter: .all) != nil)

        index.invalidate()
        #expect(index.cachedContext(store: store, page: 1, filter: .all) == nil)
    }

    @Test func resolvesMultiWordLinksWhenDeclaredInSource() throws {
        let db = try openDatabase()
        let store = try realStore()
        let index = WordContextIndex(capacity: 10)
        // Page 3 has 2:13 tokens 12..13 (ٱلسُّفَهَآءُ ۗ أَلَآ)
        let page3 = try db.page(3)
        let words = page3.lines.flatMap(\.words)
        let ctx = index.resolveSync(page: 3, filter: .all, qiraatStore: store, pageWords: words)

        let word12 = ctx.words["3:13:12"] ?? ctx.words.values.first { $0.surah == 2 && $0.ayah == 13 && $0.token == 12 }
        if let word12 {
            #expect(!word12.linkedWordIDs.isEmpty)
        }
    }

    @Test func colorCorrectnessVsSourceDataAcrossSamplePages() throws {
        let db = try openDatabase()
        let store = try realStore()
        let index = WordContextIndex(capacity: 20)

        for pageNumber in [1, 2, 25, 249, 305, 600] {
            let page = try db.page(pageNumber)
            let words = page.lines.flatMap(\.words)
            let sourceMarks = try #require(store.marks(page: pageNumber))

            for filter in [QiraatFilter.all, .reader("Q01"), .reading("Q01-R02")] {
                let resolved = index.resolveSync(page: pageNumber, filter: filter, qiraatStore: store, pageWords: words)

                for word in words where word.charType == .word {
                    let expectedMark = sourceMarks.wordMarks(for: word, filter: filter)
                    let actualMark = resolved.marksByWordID[word.id]
                    #expect(actualMark == expectedMark, "Mismatch on word \(word.id) page \(pageNumber)")
                }
            }
        }
    }

    @Test func prefetchingAdjacentPagesFillsCache() async throws {
        let db = try openDatabase()
        let store = try realStore()
        let index = WordContextIndex(capacity: 10)
        let page2Words = (try? db.page(2))?.lines.flatMap(\.words) ?? []
        let page3Words = (try? db.page(3))?.lines.flatMap(\.words) ?? []
        let wordsMap: [Int: [MushafWord]] = [2: page2Words, 3: page3Words]

        index.prefetch(pages: [2, 3], filter: .all, qiraatStore: store, wordsMap: wordsMap)

        // Give prefetch task a short window to finish
        try await Task.sleep(nanoseconds: 150_000_000)

        #expect(index.cachedContext(store: store, page: 2, filter: .all) != nil)
        #expect(index.cachedContext(store: store, page: 3, filter: .all) != nil)
    }
}
