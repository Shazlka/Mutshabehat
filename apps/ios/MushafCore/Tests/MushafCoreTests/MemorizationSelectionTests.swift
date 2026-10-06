import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationSelectionTests {
    private let index: QuranIndex
    private let names: [Int: String]

    init() throws {
        let database = try openDatabase()
        index = try QuranIndex.load(from: database)
        names = Dictionary(uniqueKeysWithValues: try database.surahs().map { ($0.number, $0.name) })
    }

    private func key(_ surah: Int, _ ayah: Int) -> AyahKey { AyahKey(surah: surah, ayah: ayah) }

    // MARK: - Resolving

    @Test func surahResolvesAllAyat() {
        #expect(MemorizationSelection.surah(36).resolve(in: index).count == 83)
        #expect(MemorizationSelection.surah(1).resolve(in: index).first == key(1, 1))
    }

    @Test func ayahRangeIsInclusive() {
        let keys = MemorizationSelection.ayahRange(surah: 2, from: 1, to: 20).resolve(in: index)
        #expect(keys.count == 20)
        #expect(keys.first == key(2, 1) && keys.last == key(2, 20))
    }

    @Test func reversedRangeIsOrderInsensitive() {
        // Review focus: from > to still means the same range.
        let forward = MemorizationSelection.ayahRange(surah: 2, from: 1, to: 20).resolve(in: index)
        let reversed = MemorizationSelection.ayahRange(surah: 2, from: 20, to: 1).resolve(in: index)
        #expect(forward == reversed)
    }

    @Test func rangeBeyondSurahIsClamped() {
        #expect(MemorizationSelection.ayahRange(surah: 1, from: 1, to: 99).resolve(in: index).count == 7)
        #expect(MemorizationSelection.ayahRange(surah: 1, from: 0, to: 3).resolve(in: index).count == 3)
        #expect(MemorizationSelection.ayahRange(surah: 1, from: 50, to: 60).resolve(in: index).isEmpty)
    }

    @Test func pageRangeResolvesAyatOnThosePages() {
        let keys = MemorizationSelection.pageRange(582...589).resolve(in: index)
        #expect(keys == index.ayat(inPages: 582...589))
        #expect(!keys.isEmpty)
        #expect(keys.allSatisfy { (582...589).contains(index.page(of: $0)!) })
    }

    @Test func juzThirtyResolvesItsAyat() {
        let keys = MemorizationSelection.juz(30).resolve(in: index)
        #expect(keys == index.ayat(ofJuz: 30))
        #expect(keys.first == key(78, 1))
    }

    @Test func explicitAyatAreSortedDeduplicatedAndFiltered() {
        let set: Set<AyahKey> = [key(2, 5), key(1, 3), key(1, 1), key(1, 99), key(200, 1)]
        #expect(MemorizationSelection.ayat(set).resolve(in: index) == [key(1, 1), key(1, 3), key(2, 5)])
    }

    @Test func spanAcrossSurahsAndReversed() {
        let forward = MemorizationSelection.span(from: key(2, 285), to: key(3, 2)).resolve(in: index)
        #expect(forward == [key(2, 285), key(2, 286), key(3, 1), key(3, 2)])
        #expect(MemorizationSelection.span(from: key(3, 2), to: key(2, 285)).resolve(in: index) == forward)
    }

    @Test func invalidSurahResolvesEmpty() {
        #expect(MemorizationSelection.surah(0).resolve(in: index).isEmpty)
        #expect(MemorizationSelection.surah(115).resolve(in: index).isEmpty)
        #expect(MemorizationSelection.juz(31).resolve(in: index).isEmpty)
    }

    @Test func wholeSurahDetection() {
        #expect(MemorizationSelection.surah(1).isWholeSurah(in: index))
        #expect(MemorizationSelection.ayahRange(surah: 1, from: 1, to: 7).isWholeSurah(in: index))
        #expect(!MemorizationSelection.ayahRange(surah: 1, from: 1, to: 6).isWholeSurah(in: index))
        #expect(!MemorizationSelection.span(from: key(1, 1), to: key(2, 1)).isWholeSurah(in: index))
        #expect(!MemorizationSelection.surah(0).isWholeSurah(in: index))
    }

    // MARK: - Parser

    private func parse(_ text: String) -> SelectionTarget? {
        SelectionParser.parse(text, surahNames: names, index: index)
    }

    @Test func parsesNameAndAyah() {
        #expect(parse("البقرة 255") == .ayah(key(2, 255)))
    }

    @Test func parsesArabicIndicDigits() {
        // Review focus: Arabic-Indic and Eastern Arabic digits are accepted.
        #expect(parse("البقرة ٢٥٥") == .ayah(key(2, 255)))
        #expect(parse("صفحة ٤٢") == .page(42))
        #expect(parse("الجزء ۳۰") == .juz(30))
    }

    @Test func parsesBareSurahName() {
        #expect(parse("يس") == .surahDetail(36))
        #expect(parse("سورة يس") == .surahDetail(36))
        #expect(parse("آل عمران") == .surahDetail(3))
        #expect(parse("آل عمران 10") == .ayah(key(3, 10)))
    }

    @Test func parsesPageAndJuz() {
        #expect(parse("صفحة 42") == .page(42))
        #expect(parse("ص 42") == .page(42))
        #expect(parse("الجزء 30") == .juz(30))
        #expect(parse("جزء 1") == .juz(1))
    }

    @Test func ignoresDiacriticsAlefVariantsAndTaMarbuta() {
        #expect(parse("ٱلبَقَرَة 255") == .ayah(key(2, 255)))
        #expect(parse("البقره 255") == .ayah(key(2, 255)))
        #expect(parse("الاخلاص") == .surahDetail(112))
        #expect(parse("  البقرة   255  ") == .ayah(key(2, 255)))
    }

    @Test func rejectsNonsense() {
        #expect(parse("xyz") == nil)
        #expect(parse("") == nil)
        #expect(parse("صفحة 700") == nil)
        #expect(parse("صفحة 0") == nil)
        #expect(parse("الجزء 31") == nil)
        #expect(parse("البقرة 300") == nil)
        #expect(parse("البقرة 0") == nil)
    }

    @Test func targetConvertsToASelection() {
        #expect(SelectionTarget.surahDetail(36).asSelection == .surah(36))
        #expect(SelectionTarget.page(42).asSelection == .pageRange(42...42))
        #expect(SelectionTarget.ayah(key(2, 255)).asSelection == .ayahRange(surah: 2, from: 255, to: 255))
        #expect(SelectionTarget.juz(30).asSelection == .juz(30))
        #expect(SelectionTarget.selection(.surah(1)).asSelection == .surah(1))
    }
}
