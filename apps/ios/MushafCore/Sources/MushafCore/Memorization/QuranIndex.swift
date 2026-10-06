public struct AyahLayoutRow: Equatable, Sendable {
    public let key: AyahKey
    public let page: Int
    public let wordCount: Int

    public init(key: AyahKey, page: Int, wordCount: Int) {
        self.key = key
        self.page = page
        self.wordCount = wordCount
    }
}

public struct QuranIndex: Sendable {
    public let ayahKeys: [AyahKey]
    public var totalAyahs: Int { ayahKeys.count }

    private let ordinals: [AyahKey: Int]
    private let ayahPages: [AyahKey: Int]
    private let pageAyat: [Int: [AyahKey]]
    private let surahAyat: [Int: [AyahKey]]
    private let surahPages: [Int: ClosedRange<Int>]
    private let pageJuz: [Int: Int]
    private let juzPages: [Int: ClosedRange<Int>]
    private let weights: [AyahKey: Double]

    public init(rows: [AyahLayoutRow], pageJuz: [Int: Int]) {
        ayahKeys = rows.map(\.key)
        self.pageJuz = pageJuz
        var ordinals: [AyahKey: Int] = [:]
        var ayahPages: [AyahKey: Int] = [:]
        var pageAyat: [Int: [AyahKey]] = [:]
        var surahAyat: [Int: [AyahKey]] = [:]
        var surahPages: [Int: ClosedRange<Int>] = [:]
        var pageWords: [Int: Int] = [:]
        for (ordinal, row) in rows.enumerated() {
            ordinals[row.key] = ordinal
            ayahPages[row.key] = row.page
            pageAyat[row.page, default: []].append(row.key)
            surahAyat[row.key.surah, default: []].append(row.key)
            let range = surahPages[row.key.surah] ?? row.page...row.page
            surahPages[row.key.surah] = min(range.lowerBound, row.page)...max(range.upperBound, row.page)
            pageWords[row.page, default: 0] += row.wordCount
        }
        var weights: [AyahKey: Double] = [:]
        for row in rows {
            let total = pageWords[row.page, default: 0]
            weights[row.key] = total == 0 ? 0 : Double(row.wordCount) / Double(total)
        }
        var juzPages: [Int: ClosedRange<Int>] = [:]
        for (page, juz) in pageJuz {
            let range = juzPages[juz] ?? page...page
            juzPages[juz] = min(range.lowerBound, page)...max(range.upperBound, page)
        }
        self.ordinals = ordinals
        self.ayahPages = ayahPages
        self.pageAyat = pageAyat
        self.surahAyat = surahAyat
        self.surahPages = surahPages
        self.juzPages = juzPages
        self.weights = weights
    }

    public static func load(from db: MushafDatabase) throws -> QuranIndex {
        try QuranIndex(rows: db.ayahLayout(), pageJuz: db.pageJuzMap())
    }

    public func ordinal(of key: AyahKey) -> Int? { ordinals[key] }
    public func ayahCount(surah: Int) -> Int { surahAyat[surah]?.count ?? 0 }
    public func page(of key: AyahKey) -> Int? { ayahPages[key] }
    public func ayat(onPage page: Int) -> [AyahKey] { pageAyat[page] ?? [] }
    public func weight(of key: AyahKey) -> Double { weights[key] ?? 0 }
    public func pages(ofSurah surah: Int) -> ClosedRange<Int>? { surahPages[surah] }
    public func ayat(ofSurah surah: Int) -> [AyahKey] { surahAyat[surah] ?? [] }
    public func juz(ofPage page: Int) -> Int? { pageJuz[page] }
    public func pages(ofJuz juz: Int) -> ClosedRange<Int>? { juzPages[juz] }

    public func ayat(ofJuz juz: Int) -> [AyahKey] {
        guard let range = juzPages[juz] else { return [] }
        return range.filter { pageJuz[$0] == juz }.flatMap { pageAyat[$0] ?? [] }
    }

    public func ayat(inPages pages: ClosedRange<Int>) -> [AyahKey] {
        let lower = max(1, pages.lowerBound)
        let upper = min(mushafPageCount, pages.upperBound)
        guard lower <= upper else { return [] }
        return (lower...upper).flatMap { pageAyat[$0] ?? [] }
    }

    public func ayat(from first: AyahKey, to last: AyahKey) -> [AyahKey] {
        guard let start = ordinals[first], let end = ordinals[last] else { return [] }
        return Array(ayahKeys[min(start, end)...max(start, end)])
    }
}
