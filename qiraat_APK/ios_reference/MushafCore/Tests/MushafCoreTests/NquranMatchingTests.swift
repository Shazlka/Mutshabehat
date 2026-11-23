#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct NquranMatchingTests {
    private struct Golden: Decodable {
        struct Label: Decodable { let kind: String; let readerId: String?; let narratorId: String?; let label: String? }
        let samples: [[JSONValue]]
        let labels: [String: Label]
        let groups: [String: String]
        let allNarratorIds: [String]
    }

    private func library() -> ReferenceLibrary { ReferenceLibrary(directory: ReviewGolden.referenceDirectory) }

    @Test func goldenParityOverSample() throws {
        let golden: Golden = try ReviewGolden.load("nquran")
        let library = library()
        var pageCache: [Int: [ReviewGolden.FixtureWord]] = [:]
        var mismatches: [String] = []
        for sample in golden.samples {
            guard case .number(let pageN) = sample[0], case .number(let surahN) = sample[1],
                  case .number(let ayahN) = sample[2], case .number(let wordN) = sample[3],
                  case .array(let expectedJSON) = sample[4] else { Issue.record("bad sample"); return }
            let (page, surah, ayah, word) = (Int(pageN), Int(surahN), Int(ayahN), Int(wordN))
            let words = try pageCache[page] ?? { let w = try ReviewGolden.pageWords(page); pageCache[page] = w; return w }()
            let text = try #require(words.first { $0.surah == surah && $0.ayah == ayah && $0.word == word }).text
            let entry = NquranMatching.entry(in: try library.nquran(surah: surah), ayah: ayah)
            let got = entry.map {
                NquranMatching.matchingIndices(differences: $0.differences, wordText: text,
                                               context: ReviewGolden.context(words, surah: surah, ayah: ayah, word: word))
            } ?? []
            let expected = expectedJSON.compactMap { v -> Int? in if case .number(let n) = v { Int(n) } else { nil } }
            if got != expected { mismatches.append("\(surah):\(ayah):\(word) expected \(expected) got \(got)") }
        }
        #expect(mismatches.isEmpty, "\(mismatches.count) mismatches, first: \(mismatches.first ?? "")")
        #expect(golden.samples.count > 10_000)
    }

    @Test func readerLabelResolutionMatchesWeb() throws {
        let golden: Golden = try ReviewGolden.load("nquran")
        #expect(golden.labels.count > 20)
        for (label, expected) in golden.labels {
            let got = NquranMatching.resolveReaderLabel(label)
            switch expected.kind {
            case "reader": #expect(got == .reader(expected.readerId ?? ""), "label \(label)")
            case "narrator": #expect(got == .narrator(expected.narratorId ?? ""), "label \(label)")
            case "remainder": #expect(got == .remainder, "label \(label)")
            case "all": #expect(got == .all, "label \(label)")
            default: #expect(got == .unresolved(label), "label \(label)")
            }
        }
    }

    @Test func differenceGroupResolutionMatchesWeb() throws {
        let golden: Golden = try ReviewGolden.load("nquran")
        let library = library()
        var mismatches = 0
        for surah in 1...114 {
            for entry in try library.nquran(surah: surah) {
                for (index, difference) in entry.differences.enumerated() {
                    let got = NquranMatching.resolveDifferenceGroups(difference)
                        .map { "\($0.narratorIds.joined(separator: ","))~\($0.unresolvedLabels.joined(separator: ","))" }
                        .joined(separator: "|")
                    if got != golden.groups["\(surah):\(entry.ayah):\(index)"] { mismatches += 1 }
                }
            }
        }
        #expect(mismatches == 0)
    }

    @Test func canonicalReadersMatchWeb() throws {
        struct Canon: Decodable {
            struct N: Decodable { let id: String; let nameAr: String; let nameShort: String }
            struct R: Decodable { let id: String; let nameAr: String; let nameShort: String; let color: String; let narrators: [N] }
        }
        struct G: Decodable { let canonical: [Canon.R]; let hafsId: String; let allNarratorIds: [String] }
        let golden: G = try ReviewGolden.load("nquran")
        #expect(CanonicalReaders.all.map(\.id) == golden.canonical.map(\.id))
        for (mine, web) in zip(CanonicalReaders.all, golden.canonical) {
            #expect(mine.nameAr == web.nameAr && mine.nameShort == web.nameShort && mine.color == web.color)
            #expect(mine.narrators.map(\.id) == web.narrators.map(\.id))
            #expect(mine.narrators.map(\.nameAr) == web.narrators.map(\.nameAr))
            #expect(mine.narrators.map(\.nameShort) == web.narrators.map(\.nameShort))
        }
        #expect(CanonicalReaders.hafsId == golden.hafsId)
        #expect(CanonicalReaders.allNarratorIds == golden.allNarratorIds)
    }

    private func word(_ i: Int, _ text: String) -> AyahWord { AyahWord(word: i, text: text) }

    @Test func meemJamSitsOnFirstWordOnly() {
        let difference = NquranDifference(
            location: "نساءكم وفي",
            groups: [NquranReaderGroup(readers: ["ابن كثير"], reading: "صلة ميم الجمع بواو")])
        let words = [word(1, "نِسَآءَكُمْ"), word(2, "وَفِى")]
        let first = NquranMatching.matchingIndices(differences: [difference], wordText: "نِسَآءَكُمْ",
                                                   context: NquranAyahContext(wordIndex: 1, ayahWords: words))
        let second = NquranMatching.matchingIndices(differences: [difference], wordText: "وَفِى",
                                                    context: NquranAyahContext(wordIndex: 2, ayahWords: words))
        #expect(first == [0])
        #expect(second.isEmpty)
    }

    @Test func shortLocationDoesNotMatchInsideLongerWord() {
        let difference = NquranDifference(location: "ال", groups: [NquranReaderGroup(readers: ["نافع"], reading: "x")])
        let words = [word(1, "ٱلْبَحْرَ")]
        let hits = NquranMatching.matchingIndices(differences: [difference], wordText: "ٱلْبَحْرَ",
                                                  context: NquranAyahContext(wordIndex: 1, ayahWords: words))
        #expect(hits.isEmpty)
        // Without the ayah it falls back to whole-token equality, which also rejects it.
        #expect(NquranMatching.matchingIndices(differences: [difference], wordText: "ٱلْبَحْرَ", context: nil).isEmpty)
    }

    @Test func remainderIsComplementOfExplicitGroups() {
        let difference = NquranDifference(location: "x", groups: [
            NquranReaderGroup(readers: ["ورش عن نافع"], reading: "a"),
            NquranReaderGroup(readers: ["باقي الرواة"], reading: "b"),
        ])
        let resolved = NquranMatching.resolveDifferenceGroups(difference)
        #expect(resolved[0].narratorIds == ["Q01-R02"])
        #expect(resolved[1].narratorIds.count == 19)
        #expect(!resolved[1].narratorIds.contains("Q01-R02"))
    }

    @Test func normalizeFoldsAlefWaslaAndDaggerAlef() {
        #expect(Arabic.normalize("ٱلرَّحْمَـٰنِ") == Arabic.normalize("الرحمان"))
        #expect(Arabic.normalize("ٱلْبَحْرَ") == "البحر")
        #expect(Arabic.normalize("  شَىْءٍ ") == "شيء")
    }
}
#endif
