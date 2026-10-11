import Foundation
import Testing
@testable import MushafCore

@Suite(.serialized) struct QiraatSearchTests {
    private static let snapshot = Task.detached {
        QiraatSearchIndex(store: try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat")))
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
                places[category, default: []].insert("\(page)-\(surah)-\(ayah)-\(token)")
            }
        }
        #expect(index.categories.count == 23)
        #expect(counts["SILAT_HA"] == 487)
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
                    + (row["readings"] as? [[String: Any]] ?? []).compactMap { $0["readingId"] as? String }
                    + (row["attribution"] as? [[String: Any]] ?? []).compactMap { $0["authorityId"] as? String })
                let location = "\(page)-\(surah)-\(ayah)-\(token)"
                for reader in store.catalog.readers {
                    let narrators = store.catalog.narrators(of: reader.id)
                    if ids.contains(reader.id) || narrators.contains(where: { ids.contains($0.id) }) {
                        expected[reader.id, default: []].insert(location)
                    }
                    for narrator in narrators where ids.contains(reader.id) || ids.contains(narrator.id) {
                        expected[narrator.id, default: []].insert(location)
                    }
                }
            }
        }
        #expect(variantCount == 3_820)
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

    @Test func attributionOnlyReaderExpandsWithoutLeakingToSiblingNarrator() throws {
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
        let index = QiraatSearchIndex(store: try QiraatStore(directory: directory))
        #expect(index.search(.authority("Q01")).map(\.token) == [1, 2])
        #expect(index.search(.authority("Q01-R01")).map(\.token) == [1])
        #expect(index.search(.authority("Q01-R02")).map(\.token) == [1, 2])
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
        let conventionID = "1-\(convention.surah)-\(convention.ayah)-\(convention.startToken)"
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

    @Test func bundledRulingsWithEmptyBaseTextStayNavigableWithoutInventedText() async throws {
        let index = try await Self.snapshot.value
        // Real bundled data: page 6, 2:33 word 16 has two word-anchored rulings with empty baseText
        // (r-l-2-33-16-6c3ade USUL_NAQL, r-l-2-33-16-b8236e USUL_SAKT).
        let naql = try #require(index.search(.category("USUL_NAQL")).first { $0.id == "6-2-33-16" })
        let sakt = try #require(index.search(.category("USUL_SAKT")).first { $0.id == "6-2-33-16" })
        #expect(naql.displayText.isEmpty && sakt.displayText.isEmpty)
        #expect(naql.kinds == [.usul] && naql.recordCount == 1)
        #expect(!index.search(.word("ا")).contains { $0.id == "6-2-33-16" })
    }

    @Test func backgroundServiceReusesOneIndex() async throws {
        let service = QiraatSearch(store: try QiraatStore(directory: generatedDirectory.appendingPathComponent("Qiraat")))
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
