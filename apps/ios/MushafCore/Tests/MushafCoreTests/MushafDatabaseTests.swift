import Testing
@testable import MushafCore

@Suite struct MushafDatabaseTests {
    @Test func everyPageHasFifteenLineSlotsAndTheTokenTotalMatchesTheManifest() throws {
        let db = try openDatabase()
        var tokens = 0
        for n in 1...mushafPageCount {
            let page = try db.page(n)
            #expect(page.lines.count == 15, "page \(n)")
            #expect(page.lines.map(\.number) == Array(1...15))
            tokens += page.lines.reduce(0) { $0 + $1.words.count }
        }
        #expect(tokens == 83_665) // page-words-manifest.json totalTokens
    }

    @Test func wordsAreInReadingOrderWithinALine() throws {
        let line = try openDatabase().page(50).lines[2]
        #expect(line.words.map(\.indexInLine) == Array(1...line.words.count))
        #expect(line.words.first?.ayahKey == AyahKey(surah: 3, ayah: 1))
        #expect(line.words.first?.glyph == "\u{FC41}")
    }

    @Test func decorationsMatchTheWebReader() throws {
        let db = try openDatabase()
        #expect(try db.page(1).lines[0].decoration == LineDecoration(surahHeader: 1, basmala: false))
        #expect(try db.page(2).lines[0].decoration == LineDecoration(surahHeader: 2, basmala: false))
        #expect(try db.page(2).lines[1].decoration == LineDecoration(surahHeader: nil, basmala: true))
        // At-Tawbah has a header and no basmala.
        #expect(try db.page(187).lines[0].decoration == LineDecoration(surahHeader: 9, basmala: false))
        #expect(try db.page(187).lines[1].decoration == nil)
    }

    @Test func metadataAndSurahs() throws {
        let db = try openDatabase()
        let meta = try db.page(50).metadata
        #expect(meta.juz == 3 && meta.hizb == 5 && meta.rubInJuz == 4)
        #expect(meta.surahNames == ["آل عمران"])
        let surahs = try db.surahs()
        #expect(surahs.count == 114)
        #expect(surahs[1].name == "البقرة" && surahs[1].ayahCount == 286 && surahs[1].firstPage == 2)
    }

    @Test func juzStartPages() throws {
        let starts = try openDatabase().juzStartPages()
        #expect(starts.count == 30)
        #expect(starts[1] == 1 && starts[2] == 22 && starts[30] == 582)
    }

    @Test func pageOfAyah() throws {
        let db = try openDatabase()
        #expect(try db.page(of: AyahKey(surah: 3, ayah: 1)) == 50)
        #expect(try db.page(of: AyahKey(surah: 114, ayah: 6)) == 604)
        #expect(try db.page(of: AyahKey(surah: 2, ayah: 999)) == nil)
    }

    @Test(arguments: [0, 605, -1]) func outOfRangePagesThrow(_ n: Int) throws {
        #expect(throws: MushafDatabaseError.pageOutOfRange(n)) { try openDatabase().page(n) }
    }

    @Test func ayahKeyParsing() {
        #expect(AyahKey("2:255") == AyahKey(surah: 2, ayah: 255))
        #expect(AyahKey("115:1") == nil)
        #expect(AyahKey("2:0") == nil)
        #expect(AyahKey("hello") == nil)
    }
}
