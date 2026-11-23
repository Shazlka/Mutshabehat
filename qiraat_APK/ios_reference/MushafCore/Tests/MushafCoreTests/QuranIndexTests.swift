import Testing
@testable import MushafCore

@Suite struct QuranIndexTests {
    @Test func totalIs6236() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(index.totalAyahs == 6236)
    }

    @Test func fatihaHasSevenAyatOnPageOne() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(index.ayahCount(surah: 1) == 7)
        #expect(index.pages(ofSurah: 1) == 1...1)
    }

    @Test func ayatKursiIsOnPage42() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(index.page(of: AyahKey(surah: 2, ayah: 255)) == 42)
    }

    @Test func pageWeightsSumTo604() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(abs(index.ayahKeys.reduce(0) { $0 + index.weight(of: $1) } - 604) < 1e-6)
        #expect(abs(index.ayat(onPage: 50).reduce(0) { $0 + index.weight(of: $1) } - 1) < 1e-9)
    }

    @Test func everyAyahHasExactlyOnePage() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let keys = (1...604).flatMap { index.ayat(onPage: $0) }
        #expect(keys == index.ayahKeys)
        #expect(Set(keys).count == index.totalAyahs)
    }

    @Test func juzCoverAllPagesWithoutOverlap() throws {
        let index = try QuranIndex.load(from: openDatabase())
        var previousEnd = 0
        for juz in 1...30 {
            let pages = try #require(index.pages(ofJuz: juz))
            #expect(pages.lowerBound == previousEnd + 1)
            for page in pages { #expect(index.juz(ofPage: page) == juz) }
            previousEnd = pages.upperBound
        }
        #expect(previousEnd == 604)
    }

    @Test func lastJuzStartsAtNabaa() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(index.ayat(ofJuz: 30).first == AyahKey(surah: 78, ayah: 1))
    }

    @Test func spanCrossesSurahsInMushafOrder() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(index.ayat(from: AyahKey(surah: 2, ayah: 285), to: AyahKey(surah: 3, ayah: 2)) == [
            AyahKey(surah: 2, ayah: 285), AyahKey(surah: 2, ayah: 286),
            AyahKey(surah: 3, ayah: 1), AyahKey(surah: 3, ayah: 2)
        ])
    }

    @Test func spanIsOrderInsensitive() throws {
        let index = try QuranIndex.load(from: openDatabase())
        let first = AyahKey(surah: 2, ayah: 285)
        let last = AyahKey(surah: 3, ayah: 2)
        #expect(index.ayat(from: first, to: last) == index.ayat(from: last, to: first))
    }

    @Test func unknownKeyHasNoOrdinal() throws {
        let index = try QuranIndex.load(from: openDatabase())
        #expect(index.ordinal(of: AyahKey(surah: 1, ayah: 8)) == nil)
    }

    @Test func syntheticIndexWorks() {
        let a = AyahKey(surah: 1, ayah: 1)
        let b = AyahKey(surah: 1, ayah: 2)
        let c = AyahKey(surah: 2, ayah: 1)
        let unknown = AyahKey(surah: 1, ayah: 8)
        let index = QuranIndex(rows: [
            AyahLayoutRow(key: a, page: 1, wordCount: 3),
            AyahLayoutRow(key: b, page: 1, wordCount: 1),
            AyahLayoutRow(key: c, page: 604, wordCount: 0)
        ], pageJuz: [1: 1, 604: 30])
        #expect(index.ayahKeys == [a, b, c])
        #expect(index.totalAyahs == 3)
        #expect(index.ordinal(of: a) == 0)
        #expect(index.ordinal(of: b) == 1)
        #expect(index.ordinal(of: c) == 2)
        #expect(index.page(of: c) == 604)
        #expect(index.weight(of: a) == 0.75)
        #expect(index.weight(of: b) == 0.25)
        #expect(index.weight(of: c) == 0)
        #expect(index.weight(of: unknown) == 0)
        #expect(index.ayat(inPages: -10...1) == [a, b])
        #expect(index.ayat(inPages: 604...700) == [c])
        #expect(index.ayat(inPages: -10...700) == [a, b, c])
        #expect(index.ayat(inPages: 605...700).isEmpty)
        #expect(index.ayat(inPages: -10...0).isEmpty)
        #expect(index.ayat(ofSurah: 1) == [a, b])
        #expect(index.pages(ofSurah: 2) == 604...604)
        #expect(index.ayat(ofJuz: 30) == [c])
        #expect(index.pages(ofJuz: 30) == 604...604)
        #expect(index.juz(ofPage: 604) == 30)
        #expect(index.ayahCount(surah: 0) == 0)
        #expect(index.ayat(ofSurah: 0).isEmpty)
        #expect(index.pages(ofSurah: 0) == nil)
        #expect(index.ayat(onPage: 0).isEmpty)
        #expect(index.page(of: unknown) == nil)
        #expect(index.juz(ofPage: 0) == nil)
        #expect(index.pages(ofJuz: 0) == nil)
        #expect(index.ayat(ofJuz: 0).isEmpty)
        #expect(index.ayat(from: a, to: a) == [a])
        #expect(index.ayat(from: a, to: unknown).isEmpty)
        #expect(index.ayat(from: unknown, to: a).isEmpty)
    }
}
