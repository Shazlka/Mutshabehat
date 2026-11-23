import Foundation
import Testing
@testable import MushafCore

/// All text below is synthetic. Real references come from `Generated/QiraatReferences/references.json`.
private let spanKey = "1:4:1-1:مَلِكِ"

/// A variant read by every narrator of Q01-Q04 and Q06, as a word that Q05 and Q07 read the Hafs way.
private let word = QiraatVariant(
    id: "v-a", surah: 1, ayah: 4, startToken: 1, endToken: 1, hafsText: "مَـٰلِكِ", variantText: "مَلِكِ",
    verificationStatus: "REVIEWED",
    readingIds: ["Q01-R01", "Q01-R02", "Q02-R01", "Q02-R02", "Q03-R01", "Q03-R02", "Q04-R01", "Q04-R02", "Q06-R01", "Q06-R02", "Q08-R01", "Q08-R02"])

private func reference(_ work: QiraatMatn = .shatibiyyah, id: String? = "v-a", key: String = spanKey, verse: Int? = 1,
                       side: QiraatReference.Side = .complement,
                       readings: [String] = ["Q05-R01", "Q05-R02", "Q07-R01", "Q07-R02"]) -> QiraatReference {
    QiraatReference(variantId: id, variantKey: key, work: work, verse: verse, lines: ["بيت تجريبي"], side: side,
                    readingIds: readings, status: .extracted)
}

private func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("refs-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

private func storeFile(_ text: String) throws -> QiraatReferenceStore {
    let directory = try temporaryDirectory()
    try Data(text.utf8).write(to: directory.appendingPathComponent(QiraatReferenceStore.fileName))
    return QiraatReferenceStore(directory: directory)
}

@Suite struct QiraatReferenceTests {
    // MARK: Scope and consistency

    @Test func scopesFollowTheWork() {
        let shatibiyyah = QiraatMatn.shatibiyyah.scope(in: testCatalog)
        let durrah = QiraatMatn.durrah.scope(in: testCatalog)
        let tayyibah = QiraatMatn.tayyibah.scope(in: testCatalog)
        #expect(shatibiyyah.count == 14 && durrah.count == 6 && tayyibah.count == 20)
        #expect(shatibiyyah.isDisjoint(with: durrah))
        #expect(durrah.contains("Q10-R02") && !durrah.contains("Q07-R01"))
        #expect(shatibiyyah.union(durrah) == tayyibah)
    }

    @Test func aComplementReferenceMatchesTheRestOfTheScope() {
        let store = QiraatReferenceStore(entries: [reference()])
        #expect(store.consistency(reference(), variant: word, catalog: testCatalog) == .consistent)
    }

    @Test func theWrongSideIsAMismatchAndNamesBothSets() {
        let wrong = reference(side: .variant)
        let result = QiraatReferenceStore.empty.consistency(wrong, variant: word, catalog: testCatalog)
        guard case let .mismatch(expected, named) = result else { Issue.record("expected a mismatch"); return }
        #expect(named == ["Q05-R01", "Q05-R02", "Q07-R01", "Q07-R02"])
        #expect(expected.count == 10 && expected.contains("Q01-R01"))
    }

    @Test func aVariantSideReferenceMatchesTheVariantsOwnReaders() {
        let readers = ["Q01-R01", "Q01-R02", "Q02-R01", "Q02-R02", "Q03-R01", "Q03-R02", "Q04-R01", "Q04-R02", "Q06-R01", "Q06-R02"]
        let ref = reference(side: .variant, readings: readers)
        #expect(QiraatReferenceStore.empty.consistency(ref, variant: word, catalog: testCatalog) == .consistent)
    }

    @Test func aReaderIdStandsForBothOfHisNarrators() {
        let ref = reference(readings: ["Q05", "Q07"])
        #expect(QiraatReferenceStore.empty.consistency(ref, variant: word, catalog: testCatalog) == .consistent)
    }

    @Test func eachWorkOnlyComparesInsideItsOwnScope() {
        // The Durrah speaks about Q08-Q10 only: the variant's Q08 narrators are the ones it should name.
        let durrah = reference(.durrah, side: .variant, readings: ["Q08-R01", "Q08-R02"])
        #expect(QiraatReferenceStore.empty.consistency(durrah, variant: word, catalog: testCatalog) == .consistent)
        // Naming a Shatibiyyah reader in a Durrah entry is cut away, leaving nothing to compare.
        let outside = reference(.durrah, readings: ["Q01-R01"])
        #expect(QiraatReferenceStore.empty.consistency(outside, variant: word, catalog: testCatalog) == .unknown)
        // The Tayyibah covers all ten.
        let all = reference(.tayyibah, side: .variant, readings: word.readingIds)
        #expect(QiraatReferenceStore.empty.consistency(all, variant: word, catalog: testCatalog) == .consistent)
    }

    @Test func theDurrahNamesOnlyThoseWhoLeaveTheirAsl() {
        // «فإن خالفوا أذكر وإلا فأهملا»: a Durrah verse can name some of its three readers and say nothing of the
        // rest. Naming Q08 alone on the Hafs side, while the word's data also has Q09 and Q10 there, is not a mismatch.
        let partial = reference(.durrah, side: .complement, readings: ["Q09"])
        #expect(QiraatReferenceStore.empty.consistency(partial, variant: word, catalog: testCatalog) == .consistent)
        // A reader the Durrah puts on the wrong side still is.
        let wrong = reference(.durrah, side: .complement, readings: ["Q08"])
        guard case .mismatch = QiraatReferenceStore.empty.consistency(wrong, variant: word, catalog: testCatalog) else {
            Issue.record("a Durrah reader on the wrong side must be a mismatch"); return
        }
        // The Shatibiyyah and the Tayyibah still have to name the whole side.
        let shatibiyyahPartial = reference(readings: ["Q05"])
        guard case .mismatch = QiraatReferenceStore.empty.consistency(shatibiyyahPartial, variant: word, catalog: testCatalog) else {
            Issue.record("a Shatibiyyah verse naming part of a side is a mismatch"); return
        }
    }

    @Test func noNamedReaderMeansUnknown() {
        let none = reference(readings: [])
        #expect(QiraatReferenceStore.empty.consistency(none, variant: word, catalog: testCatalog) == .unknown)
    }

    // MARK: Lookup

    @Test func findsByIdAndFallsBackToTheKeyWhenTheIdChanged() {
        let store = QiraatReferenceStore(entries: [reference(id: "v-a"), reference(.durrah, id: "v-old", verse: 7)])
        #expect(store.references(for: word).map(\.work) == [.shatibiyyah, .durrah])
        let renamed = QiraatVariant(id: "v-new", surah: 1, ayah: 4, startToken: 1, endToken: 1, hafsText: "مَـٰلِكِ",
                                    variantText: "مَلِكِ", verificationStatus: "REVIEWED", readingIds: word.readingIds)
        #expect(store.references(for: renamed).count == 2)
    }

    @Test func aKeyWrittenInADecomposedFormStillMatches() {
        // The same text with its marks in decomposed (NFD) order: the file is not required to be NFC.
        let decomposed = spanKey.decomposedStringWithCanonicalMapping
        let store = QiraatReferenceStore(entries: [reference(id: nil, key: decomposed)])
        #expect(store.references(for: word).count == 1)
    }

    @Test func neverMatchesAnotherVariantTextAtTheSameSpan() {
        let store = QiraatReferenceStore(entries: [reference()])
        let other = QiraatVariant(id: "v-b", surah: 1, ayah: 4, startToken: 1, endToken: 1, hafsText: "مَـٰلِكِ",
                                  variantText: "مَلْكِ", verificationStatus: "REVIEWED", readingIds: ["Q05-R01"])
        #expect(store.references(for: other).isEmpty)
    }

    @Test func aPerformanceOnlyVariantMatchesByIdOnly() {
        let key = "1:4:1-1:مَـٰلِكِ"
        let performance = QiraatVariant(id: "v-p1", surah: 1, ayah: 4, startToken: 1, endToken: 1, hafsText: "مَـٰلِكِ",
                                        variantText: "مَـٰلِكِ", performanceNote: "إشمام", verificationStatus: "REVIEWED",
                                        readingIds: ["Q05-R01"])
        let sibling = QiraatVariant(id: "v-p2", surah: 1, ayah: 4, startToken: 1, endToken: 1, hafsText: "مَـٰلِكِ",
                                    variantText: "مَـٰلِكِ", performanceNote: "إمالة", verificationStatus: "REVIEWED",
                                    readingIds: ["Q07-R01"])
        let store = QiraatReferenceStore(entries: [reference(id: "v-p1", key: key)])
        #expect(store.references(for: performance).count == 1)
        #expect(store.references(for: sibling).isEmpty)
    }

    @Test func ordersByWorkThenVerseAndKeepsDuplicates() {
        let store = QiraatReferenceStore(entries: [
            reference(.tayyibah, verse: 3), reference(.shatibiyyah, verse: 9), reference(.shatibiyyah, verse: 2),
            reference(.durrah, verse: 5), reference(.shatibiyyah, verse: nil),
        ])
        let found = store.references(for: word)
        #expect(found.map(\.work) == [.shatibiyyah, .shatibiyyah, .shatibiyyah, .durrah, .tayyibah])
        #expect(found.prefix(3).map(\.verse) == [2, 9, nil])
    }

    // MARK: File

    @Test func readsAFileAndSkipsOnlyTheBrokenEntry() throws {
        let store = try storeFile("""
        {"schemaVersion":1,"entries":[
          {"variantId":"v-a","variantKey":"\(spanKey)","work":"shatibiyyah","verse":1,"lines":["بيت تجريبي"],
           "side":"complement","readingIds":["Q05-R01"],"status":"extracted"},
          {"variantId":"v-a","variantKey":"\(spanKey)","work":"unknown-work","lines":[],"side":"variant","readingIds":[],"status":"extracted"}
        ]}
        """)
        #expect(store.count == 1)
        #expect(store.references(for: word).first?.printedPage == nil)
    }

    @Test func aMissingEmptyBrokenOrNewerFileGivesAnEmptyStore() throws {
        #expect(QiraatReferenceStore(directory: try temporaryDirectory()).isEmpty)
        #expect(try storeFile("").isEmpty)
        #expect(try storeFile("not json at all").isEmpty)
        #expect(try storeFile(#"{"schemaVersion":2,"entries":[]}"#).isEmpty)
        #expect(try storeFile(#"{"entries":[]}"#).isEmpty)
        #expect(QiraatReferenceStore.empty.references(for: word).isEmpty)
    }
}
