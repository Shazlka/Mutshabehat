import Foundation
import Testing
@testable import MushafCore

@Suite struct QiraatPageSummaryTests {
    @Test(arguments: [2, 20, 41, 62, 83, 104, 125, 146, 167, 188,
                      208, 249, 290, 331, 372, 413, 454, 495, 546, 604])
    func sampledPageCountsAndWordsMatchDrawnMarks(page: Int) throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let database = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
        let words = try database.page(page).lines.flatMap(\.words)
        let data = try #require(store.page(page))
        let marks = try #require(store.marks(page: page))
        let filters: [QiraatFilter] = [.all] + store.catalog.readers.map { .reader($0.id) }
            + store.catalog.narrators.map { .reading($0.id) }
        for filter in filters {
            let items = QiraatPageSummary.build(page: page, words: words, data: data,
                                               marks: marks, catalog: store.catalog, filter: filter)
            // Exactly the predicate used in MushafPageView.refreshQiraatMarks.
            let drawn = words.filter { marks.wordMarks(for: $0, filter: filter) != nil }
            #expect(items.count == drawn.count, "page \(page), filter \(filter)")
            #expect(items.map(\.word) == drawn)
            for item in items {
                #expect(item.variants.map(\.variant) == marks.selection(
                    surah: item.surah, ayah: item.ayah, token: item.token, filter: filter)?.variants)
                #expect(item.rulings.map(\.ruling) == marks.selection(
                    surah: item.surah, ayah: item.ayah, token: item.token, filter: filter)?.rulings)
                for variant in item.variants {
                    #expect(variant.readingText == (variant.variant.uthmaniText ?? variant.variant.variantText))
                }
            }
        }
    }

    @Test func everyPageCountEqualsDrawnMarks() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let database = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
        var total = 0
        for page in 1...604 {
            let words = try database.page(page).lines.flatMap(\.words)
            let data = try #require(store.page(page))
            let marks = try #require(store.marks(page: page))
            let items = QiraatPageSummary.build(page: page, words: words, data: data,
                                               marks: marks, catalog: store.catalog, filter: .all)
            let drawn = words.filter { marks.wordMarks(for: $0, filter: .all) != nil }
            #expect(items.count == drawn.count, "page \(page)")
            total += items.count
        }
        #expect(total > 0)
    }

    // Synthetic test fixtures: Latin labels intentionally do not represent Quran readings.
    private func word(_ token: Int, ayah: Int = 1, type: CharType = .word) -> MushafWord {
        MushafWord(id: "fixture-\(ayah)-\(token)-\(type)", page: 2, line: ayah, indexInLine: token,
                   ayahKey: AyahKey(surah: 2, ayah: ayah), indexInAyah: token,
                   charType: type, glyph: "fixture glyph", textUthmani: "fixture word")
    }

    private func variant(_ id: String, uthmani: String? = nil, readings: [String] = ["Q01-R01", "Q01-R02", "Q02-R01"]) -> QiraatVariant {
        QiraatVariant(id: id, surah: 2, ayah: 1, startToken: 1, endToken: 2,
                      hafsText: "fixture base", variantText: "fixture reading", uthmaniText: uthmani,
                      verificationStatus: "NEEDS_MANUAL_REVIEW", readingIds: readings)
    }

    private func ruling(id: String = "fixture ruling", anchored: Bool = true, category: String = "OTHER",
                        attribution: [QiraatRulingAttribution]? = nil,
                        readings: [QiraatRulingReading]? = nil) -> QiraatRuling {
        QiraatRuling(id: id, category: category, categoryAr: "fixture category",
                    color: testCatalog.readers[0].color, wordAnchored: anchored,
                    surah: 2, ayah: 1, startToken: 2, endToken: 1, endAyah: 2,
                    baseText: "fixture base", verificationStatus: "REVIEWED", hasAlternate: false,
                    attribution: attribution ?? [
                        QiraatRulingAttribution(authorityId: "Q01", action: "fixture action A"),
                        QiraatRulingAttribution(authorityId: "Q02-R01", action: "fixture action B")
                    ],
                    readings: readings ?? [
                        QiraatRulingReading(readingId: "Q01-R01", action: "fixture action A", isDefault: true),
                        QiraatRulingReading(readingId: "Q02-R01", action: "fixture action B", isDefault: true)
                    ])
    }

    private func build(_ words: [MushafWord], variants: [QiraatVariant] = [],
                       rulings: [QiraatRuling] = [], filter: QiraatFilter = .all) -> [QiraatPageSummaryItem] {
        let data = QiraatPageData(pageNumber: 2, variants: variants, rulings: rulings, rules: [])
        return QiraatPageSummary.build(page: 2, words: words, data: data,
                                      marks: QiraatMarks(catalog: testCatalog, page: data),
                                      catalog: testCatalog, filter: filter)
    }

    @Test func spansArePerWordInReadingOrderWithoutFurnitureOrDuplicates() {
        let items = build([word(1, ayah: 2), word(2), word(1), word(2), word(2, type: .end)],
                          variants: [variant("first"), variant("second")], rulings: [ruling()])
        #expect(items.map(\.word) == [word(1), word(2), word(1, ayah: 2)])
        #expect(items.map { $0.variants.count } == [2, 2, 0])
        #expect(items.map { $0.rulings.count } == [0, 1, 1])
        #expect(items[1].id == "qiraat-summary-2-1-2")
        #expect(items[1].page == 2)
    }

    @Test func readingTextAndAuthorityNamesComeFromData() throws {
        let item = try #require(build([word(1)], variants: [variant("preferred", uthmani: "fixture uthmani"),
                                                          variant("fallback")]).first)
        #expect(item.variants.map(\.readingText) == ["fixture uthmani", "fixture reading"])
        #expect(item.variants[0].authorities == rollupAuthorityPills(["Q01-R01", "Q01-R02", "Q02-R01"], catalog: testCatalog))
        #expect(item.word.glyph == word(1).glyph)
        #expect(item.word.textUthmani == word(1).textUthmani)
    }

    @Test func readerAndNarratorFiltersScopeVariantNames() throws {
        for (filter, ids) in [(QiraatFilter.reader("Q01"), ["Q01-R01", "Q01-R02"]),
                              (.reading("Q01-R02"), ["Q01-R02"])] {
            let item = try #require(build([word(1)], variants: [variant("fixture")], filter: filter).first)
            #expect(item.variants[0].authorities == rollupAuthorityPills(ids, catalog: testCatalog))
        }
        #expect(build([word(1)], variants: [variant("fixture")], filter: .reader("Q10")).isEmpty)
    }

    @Test func rulingGroupsPreserveActionsAndScopeAuthorities() throws {
        let all = try #require(build([word(2)], rulings: [ruling()]).first)
        #expect(all.rulings[0].categoryAr == "fixture category")
        #expect(all.rulings[0].actionGroups.map(\.action) == ["fixture action A", "fixture action B"])
        for filter in [QiraatFilter.reader("Q01"), .reading("Q01-R01")] {
            let scoped = try #require(build([word(2)], rulings: [ruling()], filter: filter).first)
            #expect(scoped.rulings[0].actionGroups.map(\.action) == ["fixture action A"])
            #expect(scoped.rulings[0].actionGroups[0].authorities == rollupAuthorityPills(["Q01"], catalog: testCatalog))
        }
    }

    @Test func readingsSupplyActionsWhenMatchingAttributionIsMissing() throws {
        let sourceReadings = [
            QiraatRulingReading(readingId: "Q01-R01", action: "fixture reading action", isDefault: true)
        ]
        let item = try #require(build(
            [word(2)],
            rulings: [ruling(attribution: [], readings: sourceReadings)],
            filter: .reading("Q01-R01")
        ).first)
        #expect(item.rulings[0].actionGroups.map(\.action) == ["fixture reading action"])
        #expect(item.rulings[0].actionGroups[0].entries.map(\.authorityId) == ["Q01-R01"])
    }

    @Test func rulingsWithoutDisplayableActionsDoNotCreateEmptyCards() {
        #expect(build([word(2)], rulings: [ruling(attribution: [], readings: [])]).isEmpty)
    }

    @Test func sameCategoryRulingsShareOneCategoryGroup() throws {
        let item = try #require(build([word(2)], rulings: [
            ruling(id: "first"),
            ruling(id: "second")
        ]).first)
        #expect(item.rulingGroups.count == 1)
        #expect(item.rulingGroups[0].rulings.map(\.id) == ["first", "second"])
    }

    @Test func misfiledBundledRulingsAppearOnTheirDatabaseResolvedPages() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let database = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
        let wordPages = try database.wordPageIndex()
        let index = QiraatResolvedPageIndex(store: store, wordPages: wordPages)

        // A ruling whose words are on another page than its snapshot file (none in today's snapshot, so this
        // also holds vacuously) must be absent from the file's page and present on its own page.
        var misplacedByTarget: [Int: Set<String>] = [:]
        for page in 1...mushafPageCount {
            let misplaced = (store.page(page)?.rulings ?? []).compactMap { ruling -> (String, Int)? in
                guard let resolved = wordPages[MushafWordCoordinate(
                    surah: ruling.surah, ayah: ruling.ayah, token: ruling.startToken)], resolved != page else { return nil }
                return (ruling.id, resolved)
            }
            let ids = Set(misplaced.map { $0.0 })
            let shown = Set((index.page(page)?.rulings ?? []).map { $0.id })
            #expect(shown.isDisjoint(with: ids))
            for (id, resolved) in misplaced { misplacedByTarget[resolved, default: []].insert(id) }
        }

        for (page, ids) in misplacedByTarget.sorted(by: { $0.key < $1.key }).prefix(5) {
            let data = try #require(index.page(page))
            let words = try database.page(page).lines.flatMap(\.words)
            let items = QiraatPageSummary.build(
                page: page,
                words: words,
                data: data,
                marks: QiraatMarks(catalog: store.catalog, page: data),
                catalog: store.catalog,
                filter: .all
            )
            #expect(ids.isSubset(of: Set(items.flatMap(\.rulings).map(\.id))))
        }
    }

    @Test func emptyAndUnanchoredPagesHaveNoItems() {
        #expect(build([word(1)]).isEmpty)
        #expect(build([word(2)], rulings: [ruling(anchored: false)]).isEmpty)
    }

    @Test func unresolvedVariantsRemainVisibleOnlyWhenMarksAllowThem() throws {
        let unknown = variant("unresolved", readings: ["fixture unknown authority"])
        let all = try #require(build([word(1)], variants: [unknown]).first)
        #expect(all.variants[0].authorities.first?.name == "fixture unknown authority")
        #expect(build([word(1)], variants: [unknown], filter: .reader("Q01")).isEmpty)
    }

    @Test func performanceOnlyReadingsKeepTheirSourceText() throws {
        let performance = QiraatVariant(id: "fixture performance", surah: 2, ayah: 1,
            startToken: 1, endToken: 1, hafsText: "fixture base", variantText: "fixture base",
            performanceNote: "fixture performance note", verificationStatus: "REVIEWED", readingIds: ["Q01-R01"])
        let item = try #require(build([word(1)], variants: [performance], filter: .reading("Q01-R01")).first)
        #expect(item.variants[0].readingText == performance.variantText)
        #expect(item.selection.variants == [performance])
    }
}
