import Testing
@testable import MushafCore

@Suite struct QiraatWordOrderTests {
    // Synthetic marker fixtures use real database positions and text; they are not scholarly data.
    private func variant(for word: MushafWord, id: String? = nil, readings: [String] = []) -> QiraatVariant {
        QiraatVariant(id: id ?? "test-\(word.id)", surah: word.ayahKey.surah, ayah: word.ayahKey.ayah,
                      startToken: word.indexInAyah, endToken: word.indexInAyah,
                      hafsText: word.textUthmani, variantText: word.textUthmani,
                      verificationStatus: "REVIEWED", readingIds: readings)
    }

    private func marks(_ variants: [QiraatVariant], rulings: [QiraatRuling] = []) -> QiraatMarks {
        QiraatMarks(catalog: testCatalog,
                    page: QiraatPageData(pageNumber: 1, variants: variants, rulings: rulings, rules: []))
    }

    @Test(arguments: [[1], [2], [2, 1], [209, 208]])
    func ordersRealWordsAcrossLinesAndPages(pages: [Int]) throws {
        let db = try openDatabase()
        let words = try pages.sorted().flatMap { try db.page($0).lines.flatMap(\.words) }
        let expected = words.filter { $0.charType == .word }
        let result = QiraatWordOrder.markedWords(pages: pages, words: words.reversed(),
                                               marks: marks(expected.map { variant(for: $0) }), filter: .all)
        #expect(result.map(\.word) == expected)
        #expect(Set(result.map { $0.word.line }).count > 1)
        let lineBoundary = try #require(result.indices.dropFirst().first {
            result[$0 - 1].word.page == result[$0].word.page
                && result[$0 - 1].word.line != result[$0].word.line
        })
        #expect(result.next(after: result[lineBoundary - 1]) == result[lineBoundary])
        #expect(result.previous(before: result[lineBoundary]) == result[lineBoundary - 1])
        if pages.count > 1 {
            let boundary = try #require(result.firstIndex { $0.word.page == pages.max() })
            #expect(boundary > 0)
            #expect(result[boundary - 1].word.page == pages.min())
            #expect(result.next(after: result[boundary - 1]) == result[boundary])
            #expect(result.previous(before: result[boundary]) == result[boundary - 1])
        }
    }

    @Test(arguments: [QiraatFilter.all, .reader("Q01"), .reading("Q01-R02"), .reading("missing")])
    func matchesPageViewPredicateForRealPageOne(filter: QiraatFilter) throws {
        let words = try openDatabase().page(1).lines.flatMap(\.words)
        let pageMarks = QiraatMarks(catalog: testCatalog, page: pageOne)
        let expected = words.filter { pageMarks.wordMarks(for: $0, filter: filter) != nil }
        let result = QiraatWordOrder.markedWords(pages: [1], words: words.reversed(),
                                               marks: pageMarks, filter: filter)
        #expect(result.map(\.word) == expected)
    }

    @Test func includesRulingOnlyWordsAndExcludesPageRulesAndFurniture() throws {
        let words = try openDatabase().page(2).lines.flatMap(\.words)
        let textWords = words.filter { $0.charType == .word }
        let narrator = try #require(testCatalog.narrators.first)
        let rulingWord = textWords[1], pageRuleWord = textWords[2]
        func ruling(for word: MushafWord, anchored: Bool) -> QiraatRuling {
            QiraatRuling(id: "test-\(word.id)", category: "TEST", categoryAr: "TEST",
                         color: testCatalog.performanceColor, wordAnchored: anchored,
                         surah: word.ayahKey.surah, ayah: word.ayahKey.ayah,
                         startToken: word.indexInAyah, endToken: word.indexInAyah,
                         baseText: word.textUthmani, verificationStatus: "REVIEWED", hasAlternate: false,
                         attribution: [], readings: [.init(readingId: narrator.id, action: "test", isDefault: true)])
        }
        let furniture = try #require(words.first { $0.charType != .word })
        let pageMarks = marks([variant(for: textWords[0], readings: [narrator.id]), variant(for: furniture)],
                              rulings: [ruling(for: rulingWord, anchored: true), ruling(for: pageRuleWord, anchored: false)])
        for filter in [QiraatFilter.all, .reader(narrator.readerId), .reading(narrator.id)] {
            let result = QiraatWordOrder.markedWords(pages: [2], words: words, marks: pageMarks, filter: filter)
            #expect(result.map(\.word) == Array(textWords.prefix(2)))
        }
        #expect(QiraatWordOrder.markedWords(pages: [2], words: words, marks: pageMarks,
                                            filter: .reading("missing")).isEmpty)
    }

    @Test func limitsPagesAndDeduplicatesWords() throws {
        let db = try openDatabase()
        let words = try [1, 2].flatMap { try db.page($0).lines.flatMap(\.words) }
        let pageMarks = marks(words.map { variant(for: $0) })
        let result = QiraatWordOrder.markedWords(pages: [2, 2], words: words + words,
                                               marks: pageMarks, filter: .all)
        #expect(result.map(\.word) == words.filter { $0.page == 2 && $0.charType == .word })
        #expect(QiraatWordOrder.markedWords(pages: [], words: words, marks: pageMarks, filter: .all).isEmpty)
    }

    @Test func navigationSkipsUnmarkedAndFilteredWordsAcrossSpread() throws {
        let db = try openDatabase()
        let right = try db.page(208).lines.flatMap(\.words).filter { $0.charType == .word }
        let left = try db.page(209).lines.flatMap(\.words).filter { $0.charType == .word }
        let narrator = try #require(testCatalog.narrators.first)
        let before = try #require(right.dropLast().last)
        let excluded = try #require(right.last)
        let after = try #require(left.dropFirst().first)
        let pageMarks = marks([variant(for: before, readings: [narrator.id]),
                               variant(for: excluded), variant(for: after, readings: [narrator.id])])
        let refs = QiraatWordOrder.markedWords(pages: [209, 208], words: left + right,
                                             marks: pageMarks, filter: .reading(narrator.id))
        #expect(refs.map(\.word) == [before, after])
        #expect(refs.next(after: MarkedWordRef(word: before)) == MarkedWordRef(word: after))
        #expect(refs.previous(before: MarkedWordRef(word: after)) == MarkedWordRef(word: before))
    }

    @Test func includesEveryWordInVariantSpan() throws {
        let words = try openDatabase().page(2).lines.flatMap(\.words)
        let textWords = words.filter { $0.charType == .word }
        let ayahWords = Dictionary(grouping: textWords, by: \.ayahKey)
        let first = try #require(textWords.first { (ayahWords[$0.ayahKey]?.count ?? 0) >= 3 })
        let span = Array(textWords.filter { $0.ayahKey == first.ayahKey }.prefix(3))
        let last = try #require(span.last)
        #expect(span.count == 3)
        // Synthetic test fixture: the text is copied from real tokens, without claiming a reading.
        let text = span.map(\.textUthmani).joined(separator: " ")
        let variant = QiraatVariant(id: "test-span", surah: first.ayahKey.surah, ayah: first.ayahKey.ayah,
                                    startToken: first.indexInAyah, endToken: last.indexInAyah,
                                    hafsText: text, variantText: text, verificationStatus: "REVIEWED", readingIds: [])
        let refs = QiraatWordOrder.markedWords(pages: [2], words: words.reversed(),
                                             marks: marks([variant]), filter: .all)
        #expect(refs.map(\.word) == span)
    }

    @Test func navigationStopsAtEndsAndRejectsMissingSelection() throws {
        let words = try openDatabase().page(1).lines.flatMap(\.words).filter { $0.charType == .word }
        let refs = words.prefix(3).map(MarkedWordRef.init)
        #expect(refs.previous(before: refs[0]) == nil)
        #expect(refs.next(after: refs[2]) == nil)
        #expect(refs.next(after: refs[0]) == refs[1])
        #expect(refs.previous(before: refs[2]) == refs[1])
        let missing = MarkedWordRef(word: words[3])
        #expect(refs.next(after: missing) == nil)
        #expect(refs.previous(before: missing) == nil)
        #expect([MarkedWordRef]().next(after: refs[0]) == nil)
        #expect([MarkedWordRef]().previous(before: refs[0]) == nil)
        #expect([refs[0]].next(after: refs[0]) == nil)
        #expect([refs[0]].previous(before: refs[0]) == nil)
    }

    @Test func wajhNumbersFollowAppearanceWithoutSortingIDs() throws {
        let word = try #require(openDatabase().page(1).lines.flatMap(\.words).first { $0.charType == .word })
        let variants = ["z", "a", "m"].map { variant(for: word, id: $0) }
        #expect(variantWajhNumbers(variants) == ["z": 1, "a": 2, "m": 3])
        #expect(variantWajhNumbers(Array(variants.reversed())) == ["m": 1, "a": 2, "z": 3])
    }

    @Test func wajhNumbersAreAbsentForZeroOrOneFaceAndIgnoreDuplicateIDs() throws {
        let word = try #require(openDatabase().page(1).lines.flatMap(\.words).first { $0.charType == .word })
        let a = variant(for: word, id: "a"), b = variant(for: word, id: "b")
        #expect(variantWajhNumbers([]).isEmpty)
        #expect(variantWajhNumbers([a]).isEmpty)
        #expect(variantWajhNumbers([a, a]).isEmpty)
        #expect(variantWajhNumbers([a, a, b]) == ["a": 1, "b": 2])
    }
}
