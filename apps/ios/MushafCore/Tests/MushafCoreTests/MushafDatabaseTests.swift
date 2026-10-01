import Foundation
import SQLite3
import Testing
@testable import MushafCore

@Suite struct MushafDatabaseTests {
    // Run with Guard Malloc to make a second close of the freed handle fail reliably.
    @Test func failedOpenThrowsWithoutClosingTheHandleTwice() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathComponent("missing.sqlite")
        #expect(throws: (any Error).self) {
            do {
                _ = try MushafDatabase(url: url)
            } catch let error as MushafDatabaseError {
                guard case .openFailed(let message) = error else {
                    Issue.record("Expected openFailed, got \(error)")
                    throw error
                }
                #expect(!message.isEmpty)
                throw error
            }
        }
    }

    @Test func malformedFirstAyahKeyThrows() throws {
        try withTemporaryDatabase(pageRow: "(1, 'invalid', '1:7', 'test', 1, 1, 1)") { db in
            #expect(throws: MushafDatabaseError.queryFailed("Invalid first ayah key 'invalid' on page 1")) {
                try db.page(1)
            }
        }
    }

    @Test func malformedLastAyahKeyThrows() throws {
        try withTemporaryDatabase(pageRow: "(1, '1:1', '2:0', 'test', 1, 1, 1)") { db in
            #expect(throws: MushafDatabaseError.queryFailed("Invalid last ayah key '2:0' on page 1")) {
                try db.page(1)
            }
        }
    }

    @Test func missingPageRowThrows() throws {
        try withTemporaryDatabase { db in
            #expect(throws: MushafDatabaseError.queryFailed("Missing metadata for page 1")) {
                try db.page(1)
            }
        }
    }

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

private func withTemporaryDatabase(
    pageRow: String? = nil, _ body: (MushafDatabase) throws -> Void
) throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("mushaf.sqlite")
    var handle: OpaquePointer?
    do {
        defer { sqlite3_close(handle) }
        try #require(sqlite3_open(url.path, &handle) == SQLITE_OK)
        let schema = """
            CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
            INSERT INTO meta VALUES ('schema_version', '1');
            CREATE TABLE pages (number INTEGER PRIMARY KEY, first_ayah_key TEXT, last_ayah_key TEXT,
                                surah_names TEXT, juz INTEGER, hizb INTEGER, rub_in_juz INTEGER);
            CREATE TABLE decorations (page INTEGER, line INTEGER, surah_header INTEGER, basmala INTEGER);
            CREATE TABLE words (id TEXT, page INTEGER, line INTEGER, index_in_line INTEGER,
                                surah INTEGER, ayah INTEGER, index_in_ayah INTEGER,
                                char_type TEXT, glyph TEXT, text_uthmani TEXT);
            """
        try #require(sqlite3_exec(handle, schema, nil, nil, nil) == SQLITE_OK)
        if let pageRow {
            try #require(sqlite3_exec(handle, "INSERT INTO pages VALUES \(pageRow)", nil, nil, nil) == SQLITE_OK)
        }
    }
    try body(MushafDatabase(url: url))
}
