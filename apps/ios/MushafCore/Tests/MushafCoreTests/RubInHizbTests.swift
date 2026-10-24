import Testing
@testable import MushafCore

@Suite struct RubInHizbTests {
    private func metadata(rubInJuz: Int) -> PageMetadata {
        PageMetadata(page: 1, firstAyah: AyahKey(surah: 1, ayah: 1), lastAyah: AyahKey(surah: 1, ayah: 7),
                     surahNames: [], juz: 1, hizb: 1, rubInJuz: rubInJuz)
    }

    /// The quarters of a hizb fill 25, 50, 75 and 100 per cent, and the fifth quarter of a juz starts the next hizb over.
    @Test func theEightQuartersOfAJuzCountOneToFourTwice() {
        #expect((1...8).map { metadata(rubInJuz: $0).rubInHizb } == [1, 2, 3, 4, 1, 2, 3, 4])
    }

    @Test func aMissingOrOutOfRangeQuarterNeverLeavesTheRange() {
        #expect(metadata(rubInJuz: 0).rubInHizb == 1)
        #expect((1...4).contains(metadata(rubInJuz: 9).rubInHizb))
    }

    /// Real pages: 1 is the first quarter, 21 the last of hizb 2, 22 the first of hizb 3, 76 the second of hizb 8.
    @Test func realPagesFollowTheirQuarter() throws {
        let db = try openDatabase()
        #expect(try db.page(1).metadata.rubInHizb == 1)
        #expect(try db.page(21).metadata.rubInHizb == 4)
        #expect(try db.page(22).metadata.rubInHizb == 1)
        #expect(try db.page(76).metadata.rubInHizb == 2)
    }
}
