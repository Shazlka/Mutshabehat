#if DEBUG
import Foundation
import Testing
@testable import MushafCore

@Suite struct ReferenceDataTests {
    private var library: ReferenceLibrary {
        ReferenceLibrary(directory: generatedDirectory.appendingPathComponent("Review/reference"))
    }

    @Test func loadsEverySurahOfNquran() throws {
        var ayat = 0
        for surah in 1...114 {
            let entries = try library.nquran(surah: surah)
            #expect(entries.allSatisfy { $0.surahNumber == surah })
            ayat += entries.count
        }
        #expect(ayat == 6236)
    }

    @Test func nquranEntryKeepsLocationsAndGroups() throws {
        let entries = try library.nquran(surah: 2)
        let withDifferences = try #require(entries.first { !$0.differences.isEmpty })
        let difference = try #require(withDifferences.differences.first)
        #expect(!difference.location.isEmpty)
        #expect(!(difference.groups.first?.readers.isEmpty ?? true))
        #expect(!withDifferences.sourceUrl.isEmpty)
    }

    @Test func shamilCoversSurah2() throws {
        #expect(library.hasShamil(surah: 2))
        let entries = try #require(try library.shamil(surah: 2))
        #expect(entries.count == 1026)
        let first = try #require(entries.first)
        #expect(first.scope == .thisWord || first.scope == .allQuran)
        #expect(!first.words.isEmpty)
    }

    @Test func shamilMissingSurahReturnsNil() throws {
        #expect(!library.hasShamil(surah: 3))
        #expect(try library.shamil(surah: 3) == nil)
    }

    @Test func nquranOutsideRangeIsEmptyNotAnError() throws {
        #expect(try library.nquran(surah: 0).isEmpty)
        #expect(try library.nquran(surah: 115).isEmpty)
    }

    @Test func secondLoadComesFromCache() throws {
        let a = try library.nquran(surah: 2)
        let b = try library.nquran(surah: 2)
        #expect(a == b)
    }
}
#endif
