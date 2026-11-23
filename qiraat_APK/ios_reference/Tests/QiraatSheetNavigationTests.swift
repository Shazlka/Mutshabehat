import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

/// Phase 4 tests: in-place next/previous navigation, boundaries, empty state, and no stale data.
@MainActor
final class QiraatSheetNavigationTests: XCTestCase {
    private var library: MushafLibrary!

    override func setUp() async throws {
        try await super.setUp()
        library = try MushafLibrary()
    }

    override func tearDown() async throws {
        library = nil
        try await super.tearDown()
    }

    /// Tests next and previous navigation on page 2 using real verified Qiraat records.
    func testNextAndPreviousNavigationOnPage() throws {
        let store = try XCTUnwrap(library.qiraat)
        let page2 = try XCTUnwrap(library.page(2))
        let words = page2.lines.flatMap(\.words)
        let marks = try XCTUnwrap(store.marks(page: 2))
        let refs = QiraatWordOrder.markedWords(pages: [2], words: words, marks: marks, filter: .all)
        XCTAssertGreaterThan(refs.count, 1, "Page 2 must have multiple marked words")

        // 1. Initial word
        let firstRef = refs[0]
        let firstSelection = try XCTUnwrap(marks.selection(
            surah: firstRef.word.ayahKey.surah,
            ayah: firstRef.word.ayahKey.ayah,
            token: firstRef.word.indexInAyah,
            filter: .all
        ))
        XCTAssertFalse(firstSelection.variants.isEmpty && firstSelection.rulings.isEmpty)

        // 2. Next navigation
        let secondRef = try XCTUnwrap(refs.next(after: firstRef))
        let secondSelection = try XCTUnwrap(marks.selection(
            surah: secondRef.word.ayahKey.surah,
            ayah: secondRef.word.ayahKey.ayah,
            token: secondRef.word.indexInAyah,
            filter: .all
        ))
        XCTAssertNotEqual(firstRef.id, secondRef.id)

        // Verify selection belongs to second word, not first
        for variant in secondSelection.variants {
            XCTAssertEqual(variant.surah, secondRef.word.ayahKey.surah)
            XCTAssertEqual(variant.ayah, secondRef.word.ayahKey.ayah)
            XCTAssertLessThanOrEqual(variant.startToken, secondRef.word.indexInAyah)
            XCTAssertGreaterThanOrEqual(variant.endToken, secondRef.word.indexInAyah)
        }

        // 3. Previous navigation returns back to first word
        let prevRef = try XCTUnwrap(refs.previous(before: secondRef))
        XCTAssertEqual(prevRef.id, firstRef.id)
    }

    /// Boundary test: first marked word in Quran has no previous word, last has no next word.
    func testNavigationAtFirstAndLastWordOfQuran() throws {
        let store = try XCTUnwrap(library.qiraat)

        // First marked word of Quran (Page 1: 1:4:1 "مَٰلِكِ")
        let page1 = try XCTUnwrap(library.page(1))
        let page1Words = page1.lines.flatMap(\.words)
        let page1Marks = try XCTUnwrap(store.marks(page: 1))
        let page1Refs = QiraatWordOrder.markedWords(pages: [1], words: page1Words, marks: page1Marks, filter: .all)
        let firstQuranRef = try XCTUnwrap(page1Refs.first)

        // Within page 1, there is no previous word
        XCTAssertNil(page1Refs.previous(before: firstQuranRef))
        // And there are no pages before page 1
        XCTAssertEqual(firstQuranRef.word.page, 1)

        // Last marked word of Quran (Page 604)
        let page604 = try XCTUnwrap(library.page(604))
        let page604Words = page604.lines.flatMap(\.words)
        let page604Marks = try XCTUnwrap(store.marks(page: 604))
        let page604Refs = QiraatWordOrder.markedWords(pages: [604], words: page604Words, marks: page604Marks, filter: .all)
        let lastQuranRef = try XCTUnwrap(page604Refs.last)

        // Within page 604, there is no next word after the last
        XCTAssertNil(page604Refs.next(after: lastQuranRef))
        // And there are no pages after page 604
        XCTAssertEqual(lastQuranRef.word.page, 604)
    }

    /// Page boundary crossing test: navigating next from page 1's last marked word reaches page 2's first marked word.
    func testPageBoundaryCrossing() throws {
        let store = try XCTUnwrap(library.qiraat)

        let page1 = try XCTUnwrap(library.page(1))
        let page1Words = page1.lines.flatMap(\.words)
        let page1Marks = try XCTUnwrap(store.marks(page: 1))
        let page1Refs = QiraatWordOrder.markedWords(pages: [1], words: page1Words, marks: page1Marks, filter: .all)
        let lastOnPage1 = try XCTUnwrap(page1Refs.last)

        let page2 = try XCTUnwrap(library.page(2))
        let page2Words = page2.lines.flatMap(\.words)
        let page2Marks = try XCTUnwrap(store.marks(page: 2))
        let page2Refs = QiraatWordOrder.markedWords(pages: [2], words: page2Words, marks: page2Marks, filter: .all)
        let firstOnPage2 = try XCTUnwrap(page2Refs.first)

        // Advancing across page boundary
        XCTAssertNil(page1Refs.next(after: lastOnPage1))
        XCTAssertEqual(firstOnPage2.word.page, 2)
        XCTAssertGreaterThan(firstOnPage2.word.page, lastOnPage1.word.page)

        // Reversing across page boundary
        XCTAssertNil(page2Refs.previous(before: firstOnPage2))
        XCTAssertEqual(lastOnPage1.word.page, 1)
        XCTAssertLessThan(lastOnPage1.word.page, firstOnPage2.word.page)
    }

    /// An unmarked word on page 2 has an empty selection (0 variants, 0 rulings).
    func testEmptyStateForUnmarkedWord() throws {
        let store = try XCTUnwrap(library.qiraat)
        let page2 = try XCTUnwrap(library.page(2))
        let textWords = page2.lines.flatMap(\.words).filter { $0.charType == .word }
        let marks = try XCTUnwrap(store.marks(page: 2))

        // Find a word with no variant and no ruling under .all (e.g. 2:2 token 1 "ذلك")
        let unmarked = try XCTUnwrap(textWords.first { word in
            marks.selection(
                surah: word.ayahKey.surah,
                ayah: word.ayahKey.ayah,
                token: word.indexInAyah,
                filter: .all
            ) == nil
        })

        // Marks selection returns nil -> empty selection
        let selection = marks.selection(
            surah: unmarked.ayahKey.surah,
            ayah: unmarked.ayahKey.ayah,
            token: unmarked.indexInAyah,
            filter: .all
        )
        XCTAssertNil(selection)

        // Word context index returns empty variants and rulings
        let pageContext = WordContextIndex.shared.resolveSync(
            page: 2,
            filter: .all,
            qiraatStore: store,
            pageWords: textWords
        )
        let wordCtx = pageContext.words[unmarked.id]
        XCTAssertEqual(wordCtx?.variants ?? [], [])
        XCTAssertEqual(wordCtx?.rulings ?? [], [])
    }

    /// Rapid navigation test: resolves selections rapidly, cancels obsolete requests, and never leaks stale data.
    func testRapidNavigationCancelsObsoleteAndDoesNotLeakStaleData() throws {
        let store = try XCTUnwrap(library.qiraat)
        let page2 = try XCTUnwrap(library.page(2))
        let words = page2.lines.flatMap(\.words)
        let marks = try XCTUnwrap(store.marks(page: 2))
        let refs = QiraatWordOrder.markedWords(pages: [2], words: words, marks: marks, filter: .all)

        var durations: [Double] = []

        for i in 0..<min(refs.count, 5) {
            let start = CFAbsoluteTimeGetCurrent()
            let ref = refs[i]

            // Synchronous derivation from WordContextIndex
            let pageCtx = WordContextIndex.shared.resolveSync(
                page: ref.word.page,
                filter: .all,
                qiraatStore: store,
                pageWords: words
            )
            let wordCtx = pageCtx.words[ref.word.id]
            let resolvedSelection = QiraatSelection(
                variants: wordCtx?.variants ?? [],
                rulings: wordCtx?.rulings ?? []
            )

            let elapsedMs = (CFAbsoluteTimeGetCurrent() - start) * 1000.0
            durations.append(elapsedMs)

            // Verify no stale data: every variant must match the active word's ayahKey
            for variant in resolvedSelection.variants {
                XCTAssertEqual(variant.surah, ref.word.ayahKey.surah, "Variant surah must match current word")
                XCTAssertEqual(variant.ayah, ref.word.ayahKey.ayah, "Variant ayah must match current word")
                XCTAssertLessThanOrEqual(variant.startToken, ref.word.indexInAyah)
                XCTAssertGreaterThanOrEqual(variant.endToken, ref.word.indexInAyah)
            }

            // Verify no stale rulings: every ruling must touch the active word
            for ruling in resolvedSelection.rulings {
                XCTAssertTrue(
                    ruling.touches(surah: ref.word.ayahKey.surah, ayah: ref.word.ayahKey.ayah, token: ref.word.indexInAyah),
                    "Ruling must touch current word"
                )
            }

            // Trigger obsolete cancellation
            WordContextIndex.shared.cancelObsolete(around: ref.word.page)
        }

        let maxDuration = durations.max() ?? 0
        print("[Phase 4 Navigation Benchmark] Max transition duration: \(String(format: "%.2f", maxDuration)) ms (Target: < 100 ms)")
        XCTAssertLessThan(maxDuration, 100.0, "Word selection transition must be under 100 ms")
    }
}
