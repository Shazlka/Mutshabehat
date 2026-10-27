import Foundation
#if canImport(os)
import os
#endif

/// One verse of a متن as the book prints it: its number, its hemistichs, and where it stands in the book.
public struct MatnVerse: Codable, Sendable, Hashable {
    public let number: Int
    /// The hemistichs, verbatim. A quotation from the book, not Quran text.
    public let lines: [String]
    public let printedPage: String?
    /// The Shamela page id (for a link to the source).
    public let pageId: Int?

    public init(number: Int, lines: [String], printedPage: String? = nil, pageId: Int? = nil) {
        self.number = number; self.lines = lines; self.printedPage = printedPage; self.pageId = pageId
    }
}

/// A chapter (باب، سورة) of a متن with its verses in the book's order.
public struct MatnChapter: Codable, Sendable, Hashable {
    public let title: String
    /// True for the chapters of فرش الحروف.
    public let farsh: Bool
    public let verses: [MatnVerse]

    public init(title: String, farsh: Bool, verses: [MatnVerse]) {
        self.title = title; self.farsh = farsh; self.verses = verses
    }
}

/// One of the three متون, whole.
public struct MatnWork: Codable, Sendable, Hashable {
    public let work: QiraatMatn
    public let title: String
    public let author: String
    public let bookId: Int?
    public let chapters: [MatnChapter]

    public var verseCount: Int { chapters.reduce(0) { $0 + $1.verses.count } }

    public init(work: QiraatMatn, title: String, author: String, bookId: Int? = nil, chapters: [MatnChapter]) {
        self.work = work; self.title = title; self.author = author; self.bookId = bookId; self.chapters = chapters
    }
}

/// A verse found by a search, with its book and chapter.
public struct MatnSearchHit: Sendable, Hashable {
    public let work: QiraatMatn
    public let chapter: String
    public let verse: MatnVerse
}

/// الشاطبية، الدرة وطيبة النشر, from `mutoon.json` (`make mutoon`). A missing, unreadable or newer-format file gives
/// an empty library; a work the app does not know is skipped.
public struct MatnLibrary: Sendable {
    public static let fileName = "mutoon.json"
    public static let supportedSchemaVersion = 1
    public static let empty = MatnLibrary(works: [])

    /// In the order الشاطبية، الدرة، طيبة النشر.
    public let works: [MatnWork]
    public var isEmpty: Bool { works.isEmpty }
    /// The search text of every verse, built once: (work index, chapter index, verse index, key).
    private let index: [(Int, Int, Int, String)]

    public init(works: [MatnWork]) {
        let order = Dictionary(uniqueKeysWithValues: QiraatMatn.allCases.enumerated().map { ($1, $0) })
        self.works = works.sorted { order[$0.work, default: 0] < order[$1.work, default: 0] }
        var index: [(Int, Int, Int, String)] = []
        for (w, work) in self.works.enumerated() {
            for (c, chapter) in work.chapters.enumerated() {
                for (v, verse) in chapter.verses.enumerated() {
                    index.append((w, c, v, Self.searchKey(verse.lines.joined(separator: " "))))
                }
            }
        }
        self.index = index
    }

    /// Reads `mutoon.json` from `directory`; never throws.
    public init(directory: URL) {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(Self.fileName)) else {
            self = .empty
            return
        }
        guard let file = try? JSONDecoder().decode(File.self, from: data) else {
            Self.log("mutoon file is not readable")
            self = .empty
            return
        }
        guard file.schemaVersion == Self.supportedSchemaVersion else {
            Self.log("mutoon file has schema version \(file.schemaVersion), expected \(Self.supportedSchemaVersion)")
            self = .empty
            return
        }
        self.init(works: file.works.compactMap(\.value))
    }

    public func work(_ work: QiraatMatn) -> MatnWork? { works.first { $0.work == work } }

    /// A verse by its number in one book, with the title of its chapter.
    public func verse(_ work: QiraatMatn, number: Int) -> (chapter: String, verse: MatnVerse)? {
        for chapter in self.work(work)?.chapters ?? [] {
            if let verse = chapter.verses.first(where: { $0.number == number }) { return (chapter.title, verse) }
        }
        return nil
    }

    /// Verses whose text holds the query, marks and alef forms ignored; a number (Arabic or Latin digits) finds that
    /// verse in each book. Book order, then the book's own order.
    public func search(_ query: String, limit: Int = 200) -> [MatnSearchHit] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        if let number = Int(trimmed.applyingTransform(.toLatin, reverse: false) ?? trimmed) ?? Int(Self.latinDigits(trimmed)) {
            return works.compactMap { work in
                verse(work.work, number: number).map { MatnSearchHit(work: work.work, chapter: $0.chapter, verse: $0.verse) }
            }
        }
        let key = Self.searchKey(trimmed)
        guard !key.isEmpty else { return [] }
        var hits: [MatnSearchHit] = []
        for (w, c, v, text) in index where text.contains(key) {
            let chapter = works[w].chapters[c]
            hits.append(MatnSearchHit(work: works[w].work, chapter: chapter.title, verse: chapter.verses[v]))
            if hits.count == limit { break }
        }
        return hits
    }

    /// Letters only: marks and tatweel dropped, ا for أ إ آ ٱ and the dagger alef, ي for ى ئ, ه for ة, و for ؤ,
    /// one space between words.
    static func searchKey(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            switch scalar.value {
            case 0x0670, 0x0623, 0x0625, 0x0622, 0x0671: out.append("ا")
            case 0x0649, 0x0626: out.append("ي")
            case 0x0629: out.append("ه")
            case 0x0624: out.append("و")
            case 0x0640, 0x064B...0x065F, 0x06D6...0x06ED: continue
            default: out.append(scalar)
            }
        }
        return String(out).split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private static func latinDigits(_ text: String) -> String {
        String(text.unicodeScalars.map { scalar -> Character in
            if (0x0660...0x0669).contains(scalar.value), let latin = UnicodeScalar(scalar.value - 0x0660 + 0x30) {
                return Character(latin)
            }
            return Character(scalar)
        })
    }

    // MARK: - File format

    private struct File: Decodable {
        let schemaVersion: Int
        let works: [Lossy]
    }

    /// A work that may not decode (an unknown `work`); the others still load.
    private struct Lossy: Decodable {
        let value: MatnWork?
        init(from decoder: Decoder) throws { value = try? MatnWork(from: decoder) }
    }

    private static func log(_ message: String) {
#if canImport(os)
        Logger(subsystem: "com.shazlka.qiraat", category: "mutoon").error("\(message, privacy: .public)")
#endif
    }
}
