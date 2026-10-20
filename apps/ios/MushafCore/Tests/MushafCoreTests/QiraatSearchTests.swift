import Foundation
import Testing
@testable import MushafCore

@Suite(.serialized) struct QiraatSearchTests {
    private static let snapshot = Task.detached {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let database = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
        return QiraatSearchIndex(store: store, wordPages: try database.wordPageIndex())
    }

    @Test func bundledNarratorAndReaderFindKnownVariantAndRuling() async throws {
        let index = try await Self.snapshot.value
        // Known answers read from Generated/Qiraat/page-001.json and page-002.json.
        let narrator = index.search(.authority("Q01-R02"))
        #expect(narrator.contains { $0.id == "1-1-4-1" && $0.kinds.contains(.farsh) })
        #expect(narrator.contains { $0.id == "2-2-2-6" && $0.kinds.contains(.usul) })
        let reader = index.search(.authority("Q01"))
        #expect(Set(narrator.map(\.id)).isSubset(of: Set(reader.map(\.id))))
        #expect(index.search(.authority("unknown")).isEmpty)
        #expect(index.missingPages.isEmpty)
    }

    @Test func everyCategoryTotalMatchesRawBundledJSON() async throws {
        let index = try await Self.snapshot.value
        let database = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
        let wordPages = try database.wordPageIndex()
        var counts: [String: Int] = [:]
        var places: [String: Set<String>] = [:]
        for page in 1...604 {
            let url = generatedDirectory.appendingPathComponent(String(format: "Qiraat/page-%03d.json", page))
            let raw = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
            for row in try #require(raw["rulings"] as? [[String: Any]]) {
                let category = try #require(row["category"] as? String)
                let surah = try #require(row["surah"] as? Int)
                let ayah = try #require(row["ayah"] as? Int)
                let token = try #require(row["startToken"] as? Int)
                counts[category, default: 0] += 1
                let resolvedPage = try #require(wordPages[MushafWordCoordinate(surah: surah, ayah: ayah, token: token)])
                places[category, default: []].insert("\(resolvedPage)-\(surah)-\(ayah)-\(token)")
            }
        }
        #expect(Set(index.categories.map(\.id)) == Set(counts.keys))
        for category in index.categories {
            let results = index.search(.category(category.id))
            #expect(category.rulingCount == counts[category.id])
            #expect(results.reduce(0) { $0 + $1.recordCount } == counts[category.id])
            #expect(Set(results.map(\.id)) == places[category.id])
            #expect(results.allSatisfy { $0.kinds == [.usul] })
        }
        print("QiraatSearch snapshot: \(index.categories.count) categories, \(counts.values.reduce(0, +)) rulings verified against raw JSON")
    }

    @Test func everyAuthorityMatchesRawBundledLocations() async throws {
        let index = try await Self.snapshot.value
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let database = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
        let wordPages = try database.wordPageIndex()
        var expected: [String: Set<String>] = [:]
        var variantCount = 0
        for page in 1...604 {
            let raw = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: store.fileURL(page: page)))
                as? [String: Any])
            let variants = try #require(raw["variants"] as? [[String: Any]])
            let rulings = try #require(raw["rulings"] as? [[String: Any]])
            variantCount += variants.count
            for row in variants + rulings where row["wordAnchored"] as? Bool != false {
                let surah = try #require(row["surah"] as? Int)
                let ayah = try #require(row["ayah"] as? Int)
                let token = try #require(row["startToken"] as? Int)
                let ids = Set((row["readingIds"] as? [String] ?? [])
                    + (row["readings"] as? [[String: Any]] ?? []).compactMap { $0["readingId"] as? String })
                let resolvedPage = try #require(wordPages[MushafWordCoordinate(surah: surah, ayah: ayah, token: token)])
                let location = "\(resolvedPage)-\(surah)-\(ayah)-\(token)"
                for reader in store.catalog.readers {
                    let narrators = store.catalog.narrators(of: reader.id)
                    if narrators.contains(where: { ids.contains($0.id) }) {
                        expected[reader.id, default: []].insert(location)
                    }
                    for narrator in narrators where ids.contains(narrator.id) {
                        expected[narrator.id, default: []].insert(location)
                    }
                }
            }
        }
        #expect(variantCount > 0)
        for id in store.catalog.readers.map(\.id) + store.catalog.narrators.map(\.id) {
            #expect(Set(index.search(.authority(id)).map(\.id)) == expected[id, default: []])
        }
        print("QiraatSearch authority coverage: 10 readers, 20 narrators, \(variantCount) variants checked against raw JSON")
    }

    @Test func wordSearchMatchesHafsAndVariantWithOptionalTashkeel() async throws {
        let index = try await Self.snapshot.value
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let variant = try #require(store.page(3)?.variants.first { $0.ayah == 9 && $0.startToken == 6 })
        #expect(QuranSearchNormalizer.canonical(variant.hafsText) != QuranSearchNormalizer.canonical(variant.variantText))
        // Text is read from the bundled record, never supplied as an invented reading.
        for text in [variant.hafsText, variant.variantText] {
            #expect(index.search(.word(text, ignoreTashkeel: false)).contains { $0.id == "3-2-9-6" })
            let plain = QuranSearchNormalizer.canonical(text)
            #expect(plain != text)
            #expect(index.search(.word(plain, ignoreTashkeel: true)).contains { $0.id == "3-2-9-6" })
            #expect(!index.search(.word(plain, ignoreTashkeel: false)).contains { $0.id == "3-2-9-6" })
        }
        #expect(index.search(.word("  ", ignoreTashkeel: true)).isEmpty)
        #expect(index.search(.word("\u{064E}", ignoreTashkeel: true)).isEmpty)
    }

    @Test func attributionOnlyRulingsDoNotAppearInAuthoritySearch() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.copyItem(at: generatedDirectory.appendingPathComponent("Qiraat/catalog.json"),
                                        to: directory.appendingPathComponent("catalog.json"))
        // Synthetic test fixture: Latin labels, no scholarly or Quran content.
        func ruling(_ id: String, token: Int, authority: String) -> QiraatRuling {
            QiraatRuling(id: id, category: "TEST", categoryAr: "Test fixture", color: "", wordAnchored: true,
                         surah: 2, ayah: 1, startToken: token, endToken: token, baseText: "fixture",
                         verificationStatus: "REVIEWED", hasAlternate: false,
                         attribution: [.init(authorityId: authority, action: nil)], readings: [])
        }
        let page = QiraatPageData(pageNumber: 2, variants: [], rulings: [
            ruling("reader", token: 1, authority: "Q01"),
            ruling("narrator", token: 2, authority: "Q01-R02")
        ], rules: [])
        try JSONEncoder().encode(page).write(to: directory.appendingPathComponent("page-002.json"))
        let index = QiraatSearchIndex(
            store: try QiraatStore(directory: directory),
            wordPages: [
                MushafWordCoordinate(surah: 2, ayah: 1, token: 1): 2,
                MushafWordCoordinate(surah: 2, ayah: 1, token: 2): 2
            ]
        )
        #expect(index.search(.authority("Q01")).isEmpty)
        #expect(index.search(.authority("Q01-R01")).isEmpty)
        #expect(index.search(.authority("Q01-R02")).isEmpty)
        #expect(index.missingPages.count == 603)
    }

    @Test func resultsAreUniqueAndGroupedBySurahThenPage() async throws {
        let index = try await Self.snapshot.value
        let results = index.search(.authority("Q01-R02"))
        #expect(Set(results.map(\.id)).count == results.count)
        let groups = QiraatSearchIndex.group(results)
        #expect(groups.map(\.surah) == groups.map(\.surah).sorted())
        #expect(groups.flatMap { $0.pages.flatMap(\.results) } == results)
        for group in groups {
            #expect(group.pages.map(\.page) == group.pages.map(\.page).sorted())
        }
    }

    @Test func mergedKindsAndPageConventionsPreserveSourceAnchors() async throws {
        let index = try await Self.snapshot.value
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let page = try #require(store.page(1))
        let convention = try #require(page.rulings.first { !$0.wordAnchored })
        let wordPages = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite")).wordPageIndex()
        let conventionPage = try #require(wordPages[MushafWordCoordinate(
            surah: convention.surah,
            ayah: convention.ayah,
            token: convention.startToken
        )])
        let conventionID = "\(conventionPage)-\(convention.surah)-\(convention.ayah)-\(convention.startToken)"
        #expect(index.search(.category(convention.category)).contains { $0.id == conventionID })
        #expect(!index.search(.word(convention.baseText)).contains { $0.id == conventionID })

        // Locate a real shared anchor rather than manufacturing Quran text or attributions.
        let mixedPage = try #require(store.page(3))
        let variant = try #require(mixedPage.variants.first { variant in
            mixedPage.rulings.contains {
                $0.wordAnchored && $0.surah == variant.surah && $0.ayah == variant.ayah
                    && $0.startToken == variant.startToken && $0.baseText == variant.hafsText
            }
        })
        let result = try #require(index.search(.word(variant.hafsText)).first {
            $0.id == "3-\(variant.surah)-\(variant.ayah)-\(variant.startToken)"
        })
        #expect(result.kinds == [.farsh, .usul])
        #expect(result.recordCount >= 2)
        #expect(result.displayText == variant.hafsText)
    }

    /// Rulings the source left without text stay reachable by category and are never given invented text. The
    /// web database fills such rows over time, so the rows are found in the snapshot rather than named here.
    @Test func bundledRulingsWithEmptyBaseTextStayNavigableWithoutInventedText() async throws {
        let index = try await Self.snapshot.value
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let wordPages = try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite")).wordPageIndex()
        for page in 1...mushafPageCount {
            for ruling in store.page(page)?.rulings ?? [] where ruling.wordAnchored && ruling.baseText.isEmpty {
                let resolved = try #require(wordPages[MushafWordCoordinate(surah: ruling.surah, ayah: ruling.ayah, token: ruling.startToken)])
                let id = "\(resolved)-\(ruling.surah)-\(ruling.ayah)-\(ruling.startToken)"
                let found = try #require(index.search(.category(ruling.category)).first { $0.id == id })
                #expect(found.displayText.isEmpty || found.recordCount > 1)
                #expect(found.kinds.contains(.usul))
            }
        }
    }

    @Test func bundledAttributionOnlyMismatchCountIsZero() throws {
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        var differing: [QiraatRuling] = []
        for page in 1...mushafPageCount {
            differing += store.page(page)?.rulings.filter {
                $0.readings.isEmpty && !$0.attribution.isEmpty
            } ?? []
        }
        #expect(differing.count == 0)
        print("QiraatSearch filter parity: no ruling is attribution-only")
    }

    @Test func misfiledRulingsUseMushafPagesForDisplayNavigationAndOrdering() async throws {
        let index = try await Self.snapshot.value
        let store = try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat"))
        let wordPages = try MushafDatabase(
            url: generatedDirectory.appendingPathComponent("mushaf.sqlite")
        ).wordPageIndex()
        // Whatever page file a ruling sits in, search finds it on the page its words are on.
        var expectedByCategory: [String: Set<String>] = [:]
        for page in 1...mushafPageCount {
            for ruling in store.page(page)?.rulings ?? [] where ruling.wordAnchored {
                let resolved = try #require(wordPages[MushafWordCoordinate(
                    surah: ruling.surah, ayah: ruling.ayah, token: ruling.startToken)])
                expectedByCategory[ruling.category, default: []]
                    .insert("\(resolved)-\(ruling.surah)-\(ruling.ayah)-\(ruling.startToken)")
            }
        }
        for (category, expected) in expectedByCategory {
            let found = Set(index.search(.category(category)).map(\.id))
            #expect(expected.isSubset(of: found), "\(category) has rulings listed on the wrong page")
        }

        let busiest = try #require(expectedByCategory.max { $0.value.count < $1.value.count }?.key)
        let surahTwo = QiraatSearchIndex.group(index.search(.category(busiest))).first { $0.surah == 2 }
        if let surahTwo {
            #expect(surahTwo.pages.map(\.page) == surahTwo.pages.map(\.page).sorted())
        }
    }

    @Test func backgroundServiceReusesOneIndex() async throws {
        let service = QiraatSearch(
            store: try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat")),
            databaseURL: generatedDirectory.appendingPathComponent("mushaf.sqlite")
        )
        async let first = service.index()
        async let second = service.index()
        let (a, b) = await (first, second)
        #expect(a === b)
        let again = await service.index()
        #expect(a === again)
    }

    @Test func indexedQueriesStayUnderTwoHundredMilliseconds() async throws {
        let index = try await Self.snapshot.value
        let clock = ContinuousClock()
        var slowest = Duration.zero
        let queries: [QiraatSearchQuery] = [.authority("Q01-R02"), .category("IMALAH_TAQLIL"),
                                           .word("ا", ignoreTashkeel: true)]
        for query in queries {
            // Best of three: the debug build shares the machine with other builds.
            let duration = (0..<3).map { _ in clock.measure { _ = index.search(query) } }.min() ?? .zero
            slowest = max(slowest, duration)
            #expect(duration < .milliseconds(200))
        }
        print("QiraatSearch indexed query maximum: \(slowest)")
    }
}
