import Foundation
import Testing
@testable import MushafCore

/// The hemistichs below are synthetic: made-up words that only carry the letters under test.
private let lines = ["وَقُلْ رَاوِيهِ وَسِرَاطٍ نَاصِرٌ", "وَحَقٌّ صُحْبَةٌ كَذَا جَلَا"]

private func mark(work: QiraatMatn = .shatibiyyah, line: Int = 0, _ start: Int, _ end: Int, _ text: String, _ symbol: String,
                  _ kind: MatnSymbolKind, _ ids: [String], status: MatnSymbolStatus = .verified) -> MatnSymbolAnnotation {
    MatnSymbolAnnotation(work: work, verse: 1, line: line, start: start, end: end, text: text, symbol: symbol, kind: kind,
                         readingIds: ids, note: "", source: "", status: status)
}

/// The character offset of `word` in `line` (a letter keeps its marks: one `Character`).
private func offset(of word: String, in line: String) -> Int {
    let characters = Array(line)
    let target = Array(word)
    return (0...(characters.count - target.count)).first { Array(characters[$0..<($0 + target.count)]) == target }!
}

@Suite struct MatnSymbolsTests {
    @Test func eachMatnHasItsOwnDictionaryFromItsIntroduction() {
        #expect(MatnSymbols.shatibiyyah.count == 21 + 6 + 8)
        #expect(MatnSymbols.durrah.count == 9)
        #expect(MatnSymbols.tayyibah.count == 27 + 17)
        for work in QiraatMatn.allCases {
            let keys = MatnSymbols.definitions(work).map(\.key)
            #expect(Set(keys).count == keys.count, "\(work) has one entry per symbol")
        }
    }

    @Test func theSameLetterNamesDifferentPeopleInEachMatn() {
        #expect(MatnSymbols.definition(.shatibiyyah, symbol: "أ")?.readingIds == ["Q01"])
        #expect(MatnSymbols.definition(.tayyibah, symbol: "أ")?.readingIds == ["Q01"])
        #expect(MatnSymbols.definition(.durrah, symbol: "أ")?.readingIds == ["Q08"])
        #expect(MatnSymbols.definition(.durrah, symbol: "ض")?.readingIds == ["Q10-R01"])
        #expect(MatnSymbols.definition(.shatibiyyah, symbol: "ض")?.readingIds == ["Q06-R01"])
        // ث is a group in الشاطبية (الكوفيون) and أبو جعفر in طيبة النشر.
        #expect(MatnSymbols.definition(.shatibiyyah, symbol: "ث")?.kind == .group)
        #expect(MatnSymbols.definition(.tayyibah, symbol: "ث")?.readingIds == ["Q08"])
        // A narrator's card names his reader, never a bare «الدوري».
        let duri = MatnSymbols.definition(.shatibiyyah, symbol: "ت")
        #expect(duri?.kind == .narrator && duri?.readerAr == "الكسائي")
        // كفى is a word symbol of طيبة النشر only; ك alone is ابن عامر in الشاطبية.
        #expect(MatnSymbols.definition(.tayyibah, symbol: "كَفَى")?.readingIds == ["Q05", "Q06", "Q07", "Q10"])
        #expect(MatnSymbols.definition(.shatibiyyah, symbol: "كفى") == nil)
        #expect(MatnSymbols.definition(.durrah, symbol: "ك") == nil)
        // طيبة النشر has no letter for خلف العاشر (البيت ٣٨).
        #expect(!MatnSymbols.tayyibah.contains { $0.readingIds == ["Q10"] })
    }

    @Test func noNameIsABareKhalafOrDuri() {
        for definition in QiraatMatn.allCases.flatMap(MatnSymbols.definitions) {
            let words = definition.namesAr.split(separator: " ").map(String.init)
            for (i, word) in words.enumerated() where ["خلف", "وخلف", "الدوري", "والدوري"].contains(word) {
                let next = i + 1 < words.count ? words[i + 1] : ""
                #expect(next == "عن" || next == "العاشر", "«\(definition.namesAr)» (\(definition.symbol), \(definition.work))")
            }
        }
        #expect(MatnSymbols.definition(.tayyibah, symbol: "روى")?.namesAr == "الكسائي وخلف العاشر")
        #expect(MatnSymbols.definition(.shatibiyyah, symbol: "ض")?.namesAr == "خلف عن حمزة")
    }

    @Test func aMarkIsShownOnlyOnTheTextItClaims() throws {
        let r = offset(of: "رَاوِيهِ", in: lines[0])
        let good = mark(r, r + 1, "رَ", "ر", .reader, ["Q07"])
        #expect(good.problem(in: lines) == nil)
        #expect(mark(r + 1, r + 2, "رَ", "ر", .reader, ["Q07"]).problem(in: lines) != nil, "wrong position")
        #expect(mark(r, r + 1, "رَ", "ر", .reader, ["Q07"], status: .extracted).problem(in: lines) != nil, "unverified")
        #expect(mark(r, r + 1, "رَ", "ر", .reader, ["Q05"]).problem(in: lines) != nil, "readers differ from the dictionary")
        #expect(mark(r, r + 1, "رَ", "ن", .reader, ["Q05"]).problem(in: lines) != nil, "not the symbol's letter")
        #expect(mark(work: .durrah, r, r + 1, "رَ", "ر", .reader, ["Q07"]).problem(in: lines) != nil, "ر is no symbol in الدرة")
        // A letter carries its marks: «حَقٌّ» is two characters (حَ، قٌّ), and the word symbol covers all of it.
        let h = offset(of: "حَقٌّ", in: lines[1])
        #expect(Array("حَقٌّ").count == 2)
        #expect(mark(line: 1, h, h + 2, "حَقٌّ", "حق", .group, ["Q02", "Q03"]).problem(in: lines) == nil)
        let s = offset(of: "صُحْبَةٌ", in: lines[1])
        #expect(mark(line: 1, s, s + Array("صُحْبَةٌ").count, "صُحْبَةٌ", "صحبة", .group, ["Q06", "Q07", "Q05-R01"]).problem(in: lines) == nil)
        #expect(mark(line: 1, s, s + 1, "صُ", "صحبة", .group, ["Q06", "Q07", "Q05-R01"]).problem(in: lines) != nil,
                "a word symbol is marked whole")
    }

    @Test func theLayerKeepsOnlyShowableMarksAndColoursNothingElse() throws {
        let r = offset(of: "رَاوِيهِ", in: lines[0])
        let n = offset(of: "نَاصِرٌ", in: lines[0])
        let j = offset(of: "جَلَا", in: lines[1])
        let work = MatnWork(work: .shatibiyyah, title: "", author: "", chapters: [
            MatnChapter(title: "", farsh: true, verses: [MatnVerse(number: 1, lines: lines)]),
        ])
        let library = MatnLibrary(works: [work], symbols: [
            mark(r, r + 1, "رَ", "ر", .reader, ["Q07"]),
            mark(n, n + 1, "نَ", "ن", .reader, ["Q05"]),
            mark(line: 1, j, j + 1, "جَ", "ج", .narrator, ["Q01-R02"], status: .extracted),
        ])
        let marks = library.symbols.marks(.shatibiyyah, verse: 1)
        #expect(marks.map(\.text) == ["رَ", "نَ"], "the unverified ج stays plain")
        // The ر of «وَسِرَاطٍ» and of «جَلَا»'s neighbours is not marked: only the claimed position is.
        #expect(marks.allSatisfy { $0.line == 0 } && marks.first?.start == r)
        #expect(library.symbols.marks(.durrah, verse: 1).isEmpty)
    }

    @Test func theLibraryReadsTheSymbolFileBesideTheMutoon() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("mutoon-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        let verse = #"{"number":1,"lines":["وَقُلْ رَاوِيهِ وَسِرَاطٍ نَاصِرٌ","وَحَقٌّ صُحْبَةٌ كَذَا جَلَا"]}"#
        try Data(#"{"schemaVersion":1,"works":[{"work":"shatibiyyah","title":"","author":"","chapters":[{"title":"","farsh":true,"verses":[\#(verse)]}]}]}"#.utf8)
            .write(to: url.appendingPathComponent(MatnLibrary.fileName))
        let r = offset(of: "رَاوِيهِ", in: lines[0])
        let marks = #"{"schemaVersion":1,"annotations":[{"work":"shatibiyyah","verse":1,"line":0,"start":\#(r),"end":\#(r + 1),"text":"رَ","symbol":"ر","kind":"reader","readingIds":["Q07"],"note":"","source":"","status":"verified"},{"work":"elsewhere"}]}"#
        try Data(marks.utf8).write(to: url.appendingPathComponent(MatnSymbolLayer.fileName))
        #expect(MatnLibrary(directory: url).symbols.count == 1)
        try FileManager.default.removeItem(at: url.appendingPathComponent(MatnSymbolLayer.fileName))
        #expect(MatnLibrary(directory: url).symbols.isEmpty)
    }
}
