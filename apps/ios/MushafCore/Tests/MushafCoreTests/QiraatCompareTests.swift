import Foundation
import Testing
@testable import MushafCore

// Test fixtures: real pages of the bundled snapshot (apps/ios/Generated/Qiraat, written by
// scripts/fetch_qiraat.py from the web API). Words are looked up by position; every expected text
// below is compared against the snapshot's own fields, never typed in.

private let qiraatDirectory = generatedDirectory.appendingPathComponent("Qiraat")

private func snapshotCatalog() throws -> QiraatCatalog {
    try JSONDecoder().decode(QiraatCatalog.self, from: Data(contentsOf: qiraatDirectory.appendingPathComponent("catalog.json")))
}

private func snapshotPage(_ number: Int) throws -> QiraatPageData {
    let url = qiraatDirectory.appendingPathComponent(String(format: "page-%03d.json", number))
    return try JSONDecoder().decode(QiraatPageData.self, from: Data(contentsOf: url))
}

/// Test fixture: a word with only the fields the compare rules read (position; no Mushaf text).
private func testWord(page: Int, _ surah: Int, _ ayah: Int, _ token: Int) -> MushafWord {
    MushafWord(id: "test-\(surah)-\(ayah)-\(token)", page: page, line: 1, indexInLine: token,
               ayahKey: AyahKey(surah: surah, ayah: ayah), indexInAyah: token, charType: .word,
               glyph: "", textUthmani: "")
}

/// The unfiltered selection of a real word, exactly as the reader computes it.
private func realSelection(page: Int, _ surah: Int, _ ayah: Int, _ token: Int,
                           catalog: QiraatCatalog) throws -> (QiraatSelection, MushafWord, QiraatPageData) {
    let data = try snapshotPage(page)
    let marks = QiraatMarks(catalog: catalog, page: data)
    let selection = try #require(marks.selection(surah: surah, ayah: ayah, token: token, filter: .all))
    return (selection, testWord(page: page, surah, ayah, token), data)
}

private func locus(_ selection: QiraatSelection, start: Int? = nil, end: Int? = nil) throws -> QiraatComparisonLocus {
    try #require(QiraatCompare.loci(selection: selection).first {
        (start == nil || $0.startToken == start) && (end == nil || $0.endToken == end)
    })
}

@Suite struct QiraatCompareTests {
    // MARK: The first place shown

    /// 1:4 مَـٰلِكِ: the word's own variant (ملك) must open first, not the إدغام كبير span that starts at 1:3:2.
    @Test func comparisonOpensOnTheTappedWordsOwnVariantNotAnEarlierSpan() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 1, 1, 4, 1, catalog: catalog)
        let loci = QiraatCompare.loci(selection: selection)
        #expect(loci.count > 1)
        #expect(loci.first?.selection.variants.isEmpty == true, "position order puts the idgham span first")

        let chosen = try #require(QiraatCompare.defaultLocus(in: loci, word: word))
        #expect(!chosen.selection.variants.isEmpty)
        #expect(chosen.surah == 1 && chosen.ayah == 4 && chosen.startToken == 1 && chosen.endToken == 1)

        // The pair then names a reader of the variant, not only the idgham narrator.
        let pair = try #require(QiraatCompare.defaultPair(selection: chosen.selection, catalog: catalog))
        #expect(pair.0 == QiraatCompare.hafsReadingId)
        #expect(chosen.selection.variants.flatMap(\.readingIds).contains(pair.1))
        let (_, other, same) = QiraatCompare.compare(pair.0, pair.1, locus: chosen, word: word, catalog: catalog)
        #expect(!same)
        #expect(!other.voices.isEmpty)
    }

    @Test func withNoVariantAnywhereTheWordsOwnPlaceThenTheFirstIsChosen() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 1, 1, 3, 2, catalog: catalog)
        let onlyRulings = QiraatSelection(variants: [], rulings: selection.rulings)
        let loci = QiraatCompare.loci(selection: onlyRulings)
        let chosen = try #require(QiraatCompare.defaultLocus(in: loci, word: word))
        #expect(chosen.id == (loci.first { $0.surah == 1 && $0.ayah == 3 && $0.startToken == 2 && $0.endToken == 2 } ?? loci[0]).id)
        #expect(QiraatCompare.defaultLocus(in: [], word: word) == nil)
    }

    // MARK: One وجه — 1:4 (page 1)

    @Test func oneWajhHafsAgainstAReaderWhoseNarratorsAgree() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 1, 1, 4, 1, catalog: catalog)
        let variant = try #require(selection.variants.first)
        let locus = try locus(selection, start: variant.startToken, end: variant.endToken)

        let (hafs, nafi, same) = QiraatCompare.compare(QiraatCompare.hafsReadingId, "Q01", locus: locus,
                                                       word: word, catalog: catalog)
        #expect(!same)
        #expect(hafs.voices.count == 1)
        #expect(hafs.voices[0].name == "الراوي حفص")
        #expect(hafs.voices[0].content.wajhs == [.init(text: variant.hafsText, note: nil, source: .base(sameAsHafs: true))])

        // قالون and ورش read alike here, so نافع stands for both.
        #expect(nafi.voices.count == 1)
        let voice = nafi.voices[0]
        #expect(voice.kind == .reader)
        #expect(voice.name == "الإمام نافع")
        #expect(voice.color == catalog.reader("Q01")?.color)
        #expect(voice.narratorIds == ["Q01-R01", "Q01-R02"])
        #expect(voice.content.wajhs == [.init(text: try #require(variant.uthmaniText), note: nil, source: .variant)])
    }

    @Test func twoReadersWithNoRecordedDifferenceReadAlikeAsHafs() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 1, 1, 4, 1, catalog: catalog)
        let (asim, yaqub, same) = QiraatCompare.compare("Q05", "Q09", locus: try locus(selection),
                                                        word: word, catalog: catalog)
        #expect(same)
        #expect(asim.voices.map(\.name) == ["الإمام عاصم"])
        #expect(yaqub.voices.map(\.name) == ["الإمام يعقوب"])
        #expect(yaqub.voices[0].content.wajhs.map(\.source) == [.base(sameAsHafs: true)])
    }

    // MARK: Two وجه — 2:55 token 8 (page 8)

    @Test func twoWajhsOfAnUsulRulingAreAllListedInOrder() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, data) = try realSelection(page: 8, 2, 55, 8, catalog: catalog)
        let ruling = try #require(data.rulings.first { $0.id == "r-SUSI-002-55-8-0052-IMALAH_TAQLIL" })
        let recorded = ruling.attribution.filter { $0.authorityId == "Q03-R02" }
        #expect(recorded.count == 2)
        let locus = try locus(selection, start: ruling.startToken, end: ruling.endToken)

        let susi = QiraatCompare.reading(of: "Q03-R02", locus: locus, word: word, catalog: catalog)
        let usul = try #require(susi.voices.first?.content.usul.first { $0.sourceRulingIds.contains(ruling.id) })
        guard case .entries(let entries) = usul.status else { Issue.record("expected entries"); return }
        #expect(entries.map(\.action) == recorded.map { $0.action ?? "" })
        #expect(entries.map(\.wajhOrder) == [1, 2])
        #expect(entries.map(\.wajhNote) == recorded.map(\.wajhNote))
    }

    @Test func aReaderWhoseNarratorsDifferShowsBothNarrators() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 8, 2, 55, 8, catalog: catalog)
        let locus = try #require(QiraatCompare.loci(selection: selection).first {
            QiraatCompare.reading(of: "Q03", locus: $0, word: word, catalog: catalog).voices.count == 2
        })
        // الدوري عن أبي عمرو has one وجه in this ruling, السوسي two.
        let abuAmr = QiraatCompare.reading(of: "Q03", locus: locus, word: word, catalog: catalog)
        #expect(abuAmr.voices.map(\.authorityId) == ["Q03-R01", "Q03-R02"])
        #expect(abuAmr.voices.map(\.name) == ["الراوي الدوري عن أبي عمرو", "الراوي السوسي"])
        #expect(abuAmr.voices.allSatisfy { $0.kind == .narrator })

        let hamza = QiraatCompare.reading(of: "Q06", locus: locus, word: word, catalog: catalog)
        #expect(hamza.voices.map(\.authorityId) == ["Q06"])
    }

    @Test func aRulingThatDoesNotNameTheReadingLeavesItOnTheBase() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 8, 2, 55, 8, catalog: catalog)
        let locus = try locus(selection)
        // قالون is named by neither ruling on this word; neither is حفص.
        let qalun = QiraatCompare.reading(of: "Q01-R01", locus: locus, word: word, catalog: catalog)
        let usul = try #require(qalun.voices.first?.content.usul)
        #expect(usul.count == QiraatCompare.usulGroups(selection: locus.selection).count)
        #expect(usul.allSatisfy { $0.status == .base(sameAsHafs: true) })
    }

    // MARK: Three وجه — 76:15 token 8 (page 579)

    @Test func threeTextWajhsAreAllListedAndAReaderWhoseNarratorsShareThemStaysOne() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 579, 76, 15, 8, catalog: catalog)
        let named = selection.variants.filter { $0.readingIds.contains("Q06-R01") }
        #expect(named.count == 3)
        let locus = try locus(selection, start: named[0].startToken, end: named[0].endToken)

        let hamza = QiraatCompare.reading(of: "Q06", locus: locus, word: word, catalog: catalog)
        #expect(hamza.voices.count == 1)
        let wajhs = hamza.voices[0].content.wajhs
        #expect(wajhs.count == 3)
        #expect(wajhs.map(\.text) == named.map { $0.uthmaniText ?? $0.variantText })
        #expect(wajhs.map(\.note) == named.map(\.performanceNote))
        #expect(wajhs.allSatisfy { $0.source == .variant })
    }

    @Test func noRecordedVariantWhileHafsHasOneIsNotCalledLikeHafs() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 579, 76, 15, 8, catalog: catalog)
        #expect(selection.variants.contains { $0.readingIds.contains(QiraatCompare.hafsReadingId) })
        #expect(!selection.variants.contains { $0.readingIds.contains { $0.hasPrefix("Q10") } })
        let locus = try locus(selection)

        let khalaf = QiraatCompare.reading(of: "Q10", locus: locus, word: word, catalog: catalog)
        #expect(khalaf.voices.map(\.name) == ["الإمام خلف العاشر"])
        #expect(khalaf.voices[0].content.wajhs.map(\.source) == [.base(sameAsHafs: false)])
        #expect(khalaf.voices[0].content.wajhs[0].text == selection.variants[0].hafsText)
    }

    // MARK: Duplicate records — 31:18 token 2 (page 412)

    @Test func theSameReadingRecordedTwiceIsOneWajh() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 412, 31, 18, 2, catalog: catalog)
        let records = selection.variants.filter { $0.readingIds.contains("Q03-R02") }
        #expect(records.count == 3)
        let duplicateRecords = try #require(Dictionary(grouping: records) { "\($0.startToken)-\($0.endToken)" }
            .values.first { group in
                let distinct = Set(group.map { ($0.uthmaniText ?? $0.variantText) + "|" + ($0.performanceNote ?? "") })
                return distinct.count < group.count
            })
        let distinct = Set(duplicateRecords.map { ($0.uthmaniText ?? $0.variantText) + "|" + ($0.performanceNote ?? "") })
        let selected = try locus(selection, start: duplicateRecords[0].startToken, end: duplicateRecords[0].endToken)
        let susi = QiraatCompare.reading(of: "Q03-R02", locus: selected, word: word, catalog: catalog)
        #expect(susi.voices[0].content.wajhs.count == distinct.count)
        #expect(distinct.count < duplicateRecords.count)
    }

    // MARK: Exact loci and aggregated أصول

    @Test func overlappingVariantSpansAreComparedAsSeparateLoci() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 72, 3, 169, 2, catalog: catalog)
        let wide = try locus(selection, start: 1, end: 2)
        let narrow = try locus(selection, start: 2, end: 2)

        #expect(QiraatCompare.loci(selection: selection).count >= 2)
        #expect(wide.selection.variants.allSatisfy { $0.startToken == 1 && $0.endToken == 2 })
        #expect(narrow.selection.variants.allSatisfy { $0.startToken == 2 && $0.endToken == 2 })

        let wideSusi = QiraatCompare.reading(of: "Q03-R02", locus: wide, word: word, catalog: catalog)
        let narrowSusi = QiraatCompare.reading(of: "Q03-R02", locus: narrow, word: word, catalog: catalog)
        #expect(wideSusi.voices[0].content.wajhs.count == 1)
        #expect(narrowSusi.voices[0].content.wajhs.count == 1)
        #expect(wideSusi.voices[0].content.wajhs[0].text == wide.selection.variants[0].uthmaniText)
        #expect(narrowSusi.voices[0].content.wajhs[0].text == narrow.selection.variants[0].uthmaniText)
    }

    @Test func bothColumnsUseTheSelectedExactSpan() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 72, 3, 169, 2, catalog: catalog)
        let wide = try locus(selection, start: 1, end: 2)
        let narrow = try locus(selection, start: 2, end: 2)
        let (hafs, susi, _) = QiraatCompare.compare(QiraatCompare.hafsReadingId, "Q03-R02",
                                                    locus: narrow, word: word, catalog: catalog)

        let narrowBase = try #require(narrow.selection.variants.first?.hafsText)
        #expect(hafs.voices[0].content.wajhs.map(\.text) == [narrowBase])
        #expect(susi.voices[0].content.wajhs.map(\.text) == [try #require(narrow.selection.variants.first?.uthmaniText)])
        #expect(narrowBase != wide.selection.variants.first?.hafsText)
    }

    @Test func narratorRowsAtOneUsulLocusBecomeOneComparisonGroup() throws {
        let catalog = try snapshotCatalog()
        let (selection, word, _) = try realSelection(page: 20, 2, 133, 3, catalog: catalog)
        let singleWord = try locus(selection, start: 3, end: 3)
        let group = try #require(QiraatCompare.usulGroups(selection: singleWord.selection).first {
            $0.category == "HAMZATAN_KALIMATAYN"
        })

        #expect(group.rulings.count == 9)
        let qalun = QiraatCompare.reading(of: "Q01-R01", locus: singleWord, word: word, catalog: catalog)
        let hamza = QiraatCompare.reading(of: "Q06-R01", locus: singleWord, word: word, catalog: catalog)
        let qalunUsul = try #require(qalun.voices[0].content.usul.first { $0.groupId == group.id })
        let hamzaUsul = try #require(hamza.voices[0].content.usul.first { $0.groupId == group.id })
        guard case .entries(let entries) = qalunUsul.status else { Issue.record("expected recorded entry"); return }
        #expect(entries.count == 1)
        #expect(qalunUsul.sourceRulingIds.count == 9)
        #expect(hamzaUsul.status == .base(sameAsHafs: true))
    }

    @Test func unavailablePageDoesNotFallBackToAFilteredSelection() throws {
        let catalog = try snapshotCatalog()
        let word = testWord(page: 1, 1, 4, 1)
        #expect(QiraatCompare.unfilteredSelection(for: word, marks: nil) == nil)

        let marks = QiraatMarks(catalog: catalog, page: try snapshotPage(1))
        #expect(QiraatCompare.unfilteredSelection(for: word, marks: marks)
                == marks.selection(surah: 1, ayah: 4, token: 1, filter: .all))
    }

    // MARK: Selection logic (test fixtures built in code)

    /// Test fixture: one variant for ورش only, one أصول ruling naming the reader id «Q06».
    private func syntheticSelection() -> QiraatSelection {
        let variant = QiraatVariant(id: "test-v", surah: 2, ayah: 10, startToken: 3, endToken: 3,
                                    hafsText: "test-hafs", variantText: "test-variant",
                                    verificationStatus: "REVIEWED", readingIds: ["Q01-R02"])
        let ruling = QiraatRuling(id: "test-r", category: "TEST", categoryAr: "test-category", color: "#000000",
                                  wordAnchored: true, surah: 2, ayah: 10, startToken: 3, endToken: 3, baseText: "",
                                  verificationStatus: "REVIEWED", hasAlternate: false,
                                  attribution: [QiraatRulingAttribution(authorityId: "Q06", action: "test-action",
                                                                        condition: "test-condition")],
                                  readings: [])
        return QiraatSelection(variants: [variant], rulings: [ruling])
    }

    @Test func aReaderSplitsIntoNarratorsOnlyWhenTheyDiffer() {
        let selection = syntheticSelection()
        let word = testWord(page: 3, 2, 10, 3)
        let locus = QiraatCompare.loci(selection: selection)[0]
        let nafi = QiraatCompare.reading(of: "Q01", locus: locus, word: word, catalog: testCatalog)
        #expect(nafi.voices.map(\.authorityId) == ["Q01-R01", "Q01-R02"])
        #expect(nafi.voices[0].content.wajhs == [.init(text: "test-hafs", note: nil, source: .base(sameAsHafs: true))])
        #expect(nafi.voices[1].content.wajhs == [.init(text: "test-variant", note: nil, source: .variant)])

        let ibnKathir = QiraatCompare.reading(of: "Q02", locus: locus, word: word, catalog: testCatalog)
        #expect(ibnKathir.voices.map(\.authorityId) == ["Q02"])
    }

    @Test func aRulingNamingAReaderAppliesToBothNarrators() {
        let selection = syntheticSelection()
        let word = testWord(page: 3, 2, 10, 3)
        let locus = QiraatCompare.loci(selection: selection)[0]
        let khallad = QiraatCompare.reading(of: "Q06-R02", locus: locus, word: word, catalog: testCatalog)
        #expect(khallad.voices[0].content.usul.map(\.status)
                == [.entries([.init(action: "test-action", condition: "test-condition", wajhOrder: nil, wajhNote: nil)])])
        let hamza = QiraatCompare.reading(of: "Q06", locus: locus, word: word, catalog: testCatalog)
        #expect(hamza.voices.map(\.authorityId) == ["Q06"])
    }

    @Test func aNarratorComparedWithHisOwnReaderIsSameWhenTheyAgree() {
        let selection = syntheticSelection()
        let word = testWord(page: 3, 2, 10, 3)
        let locus = QiraatCompare.loci(selection: selection)[0]
        #expect(QiraatCompare.compare("Q06", "Q06-R01", locus: locus, word: word, catalog: testCatalog).isSame)
        #expect(!QiraatCompare.compare("Q01", "Q01-R02", locus: locus, word: word, catalog: testCatalog).isSame)
    }

    @Test func anUnknownIdHasNoVoicesAndIsNeverTheSame() {
        let selection = syntheticSelection()
        let word = testWord(page: 3, 2, 10, 3)
        let locus = QiraatCompare.loci(selection: selection)[0]
        let (unknown, _, same) = QiraatCompare.compare("Q99", "Q99", locus: locus, word: word, catalog: testCatalog)
        #expect(unknown.voices.isEmpty)
        #expect(!same)
    }

    @Test func theDefaultPairIsHafsAndTheFirstOtherNamedNarrator() throws {
        #expect(QiraatCompare.defaultPair(selection: syntheticSelection(), catalog: testCatalog)! == ("Q05-R02", "Q01-R02"))
        let readerOnly = QiraatSelection(variants: [], rulings: syntheticSelection().rulings)
        #expect(QiraatCompare.defaultPair(selection: readerOnly, catalog: testCatalog)! == ("Q05-R02", "Q06"))
        let catalog = try snapshotCatalog()
        let (selection, _, _) = try realSelection(page: 1, 1, 4, 1, catalog: catalog)
        #expect(QiraatCompare.defaultPair(selection: selection, catalog: catalog)! == ("Q05-R02", "Q01-R01"))
        #expect(QiraatCompare.defaultPair(selection: QiraatSelection(variants: [], rulings: []), catalog: catalog) == nil)
    }
}
