import Foundation
#if canImport(os)
import os
#endif

/// One verse's commentary from a classical شرح (الوافي or الهادي): its text and the printed page(s) in the book.
public struct MatnSharhEntry: Codable, Sendable, Hashable {
    public let text: String
    public let pages: [String]

    public init(text: String, pages: [String] = []) {
        self.text = text
        self.pages = pages
    }
}

/// The commentary for one poem (متن), whole.
public struct MatnWorkSharh: Codable, Sendable, Hashable {
    public let title: String
    public let author: String
    public let bookId: Int?
    public let verses: [Int: MatnSharhEntry]

    public init(title: String, author: String, bookId: Int? = nil, verses: [Int: MatnSharhEntry]) {
        self.title = title
        self.author = author
        self.bookId = bookId
        self.verses = verses
    }

    enum CodingKeys: String, CodingKey {
        case title, author, bookId, verses
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decode(String.self, forKey: .title)
        author = try container.decode(String.self, forKey: .author)
        bookId = try container.decodeIfPresent(Int.self, forKey: .bookId)
        let stringKeyed = try container.decode([String: MatnSharhEntry].self, forKey: .verses)
        var parsed: [Int: MatnSharhEntry] = [:]
        for (k, v) in stringKeyed {
            if let num = Int(k) { parsed[num] = v }
        }
        verses = parsed
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(title, forKey: .title)
        try container.encode(author, forKey: .author)
        try container.encodeIfPresent(bookId, forKey: .bookId)
        let stringKeyed = Dictionary(uniqueKeysWithValues: verses.map { (String($0.key), $0.value) })
        try container.encode(stringKeyed, forKey: .verses)
    }
}

/// The verse-by-verse commentary layer for the متون (`mutoon-sharh.json`, built by `make matn-sharh`).
/// Missing, unreadable, or wrong-schema files yield `.empty`.
public struct MatnSharhStore: Sendable {
    public static let fileName = "mutoon-sharh.json"
    public static let supportedSchemaVersion = 1
    public static let empty = MatnSharhStore(commentaries: [:])

    public let commentaries: [QiraatMatn: MatnWorkSharh]
    public var isEmpty: Bool { commentaries.isEmpty }

    public init(commentaries: [QiraatMatn: MatnWorkSharh]) {
        self.commentaries = commentaries
    }

    public init(directory: URL) {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(Self.fileName)) else {
            self = .empty
            return
        }
        guard let file = try? JSONDecoder().decode(File.self, from: data) else {
            Self.log("mutoon-sharh file is not readable")
            self = .empty
            return
        }
        guard file.schemaVersion == Self.supportedSchemaVersion else {
            Self.log("mutoon-sharh file has schema version \(file.schemaVersion), expected \(Self.supportedSchemaVersion)")
            self = .empty
            return
        }
        var loaded: [QiraatMatn: MatnWorkSharh] = [:]
        for (rawWork, workSharh) in file.commentaries {
            if let work = QiraatMatn(rawValue: rawWork) {
                loaded[work] = workSharh
            }
        }
        self.init(commentaries: loaded)
    }

    /// Looks up the explanation of `verse` in `work`.
    public func sharh(for work: QiraatMatn, verse: Int) -> (title: String, author: String, entry: MatnSharhEntry)? {
        guard let workSharh = commentaries[work], let entry = workSharh.verses[verse] else { return nil }
        return (workSharh.title, workSharh.author, entry)
    }

    // MARK: - File format

    private struct File: Decodable {
        let schemaVersion: Int
        let commentaries: [String: MatnWorkSharh]
    }

    private static func log(_ message: String) {
#if canImport(os)
        Logger(subsystem: "com.shazlka.qiraat", category: "mutoon-sharh").error("\(message, privacy: .public)")
#endif
    }
}
