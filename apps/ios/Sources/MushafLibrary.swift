import Foundation
import MushafCore

enum MushafLibraryError: LocalizedError {
    case missingResource(String)
    var errorDescription: String? {
        switch self { case let .missingResource(name): "missing bundle resource \(name)" }
    }
}

/// Everything the reader reads from the app bundle, opened once at launch. Main-actor only:
/// a page is ~140 rows of SQLite, well under a millisecond, so there is no need for a background queue.
@MainActor
final class MushafLibrary {
    let database: MushafDatabase
    let fonts: QCFFontStore
    let surahs: [Surah]
    let juzStartPages: [Int: Int]
    let surahAyahCounts: [Int: Int]
    let surahNames: [Int: String]

    init(bundle: Bundle = .main) throws {
        guard let databaseURL = bundle.url(forResource: "mushaf", withExtension: "sqlite") else {
            throw MushafLibraryError.missingResource("mushaf.sqlite")
        }
        guard let fontsURL = bundle.url(forResource: "Fonts", withExtension: nil) else {
            throw MushafLibraryError.missingResource("Fonts/")
        }
        database = try MushafDatabase(url: databaseURL)
        fonts = QCFFontStore(directory: fontsURL)
        surahs = try database.surahs()
        juzStartPages = try database.juzStartPages()
        surahAyahCounts = Dictionary(uniqueKeysWithValues: surahs.map { ($0.number, $0.ayahCount) })
        surahNames = Dictionary(uniqueKeysWithValues: surahs.map { ($0.number, $0.name) })
    }

    static func load() -> Result<MushafLibrary, Error> {
        Result { try MushafLibrary() }
    }

    func page(_ number: Int) -> MushafPage? {
        try? database.page(clampPage(number))
    }
}
