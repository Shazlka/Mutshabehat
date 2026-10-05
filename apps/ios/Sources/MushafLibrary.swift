import CoreText
import Foundation
import MushafCore
import UIKit

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
    /// The bundled snapshot of the web app's Qiraat data; nil only if the build shipped without it.
    private(set) var qiraat: QiraatStore?

    init(bundle: Bundle = .main) throws {
        guard let databaseURL = bundle.url(forResource: "mushaf", withExtension: "sqlite") else {
            throw MushafLibraryError.missingResource("mushaf.sqlite")
        }
        guard let fontsURL = bundle.url(forResource: "Fonts", withExtension: nil) else {
            throw MushafLibraryError.missingResource("Fonts/")
        }
        database = try MushafDatabase(url: databaseURL)
        fonts = QCFFontStore(directory: fontsURL)
        Self.registerHafsFontIfNeeded(fontsURL: fontsURL, bundle: bundle)
        surahs = try database.surahs()
        juzStartPages = try database.juzStartPages()
        surahAyahCounts = Dictionary(uniqueKeysWithValues: surahs.map { ($0.number, $0.ayahCount) })
        surahNames = Dictionary(uniqueKeysWithValues: surahs.map { ($0.number, $0.name) })
        let imported = QiraatBackupService.importedDirectory
        qiraat = (try? QiraatStore(directory: imported))
            ?? bundle.url(forResource: "Qiraat", withExtension: nil).flatMap { try? QiraatStore(directory: $0) }
    }

    private static var didRegisterHafsFont = false

    public static func registerHafsFontIfNeeded(fontsURL: URL? = nil, bundle: Bundle = .main) {
        guard !didRegisterHafsFont else { return }
        let candidateURLs: [URL] = [
            fontsURL?.appendingPathComponent("KFGQPC Uthmanic Script HAFS Regular.otf"),
            bundle.url(forResource: "KFGQPC Uthmanic Script HAFS Regular", withExtension: "otf", subdirectory: "Fonts"),
            bundle.url(forResource: "KFGQPC Uthmanic Script HAFS Regular", withExtension: "otf"),
            Bundle.main.url(forResource: "KFGQPC Uthmanic Script HAFS Regular", withExtension: "otf", subdirectory: "Fonts"),
            Bundle.main.url(forResource: "KFGQPC Uthmanic Script HAFS Regular", withExtension: "otf")
        ].compactMap { $0 }

        for url in candidateURLs {
            if FileManager.default.fileExists(atPath: url.path) {
                var error: Unmanaged<CFError>?
                if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) || error == nil {
                    didRegisterHafsFont = true
                    break
                }
            }
        }
    }

    public static func mushafFont(size: CGFloat) -> UIFont {
        if let font = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: size) {
            return font
        }
        registerHafsFontIfNeeded()
        if let font = UIFont(name: "KFGQPCUthmanicScriptHAFS", size: size) {
            return font
        }
        return UIFont.systemFont(ofSize: size, weight: .regular)
    }

    static func load() -> Result<MushafLibrary, Error> {
        Result { try MushafLibrary() }
    }

    func page(_ number: Int) -> MushafPage? {
        try? database.page(clampPage(number))
    }

    func page(of ayah: AyahKey) -> Int? {
        try? database.page(of: ayah)
    }

    func searchAyaat(matching query: String, mode: QuranSearchMode = .smart) -> [AyahSearchResult] {
        (try? database.searchAyaat(matching: query, mode: mode, limit: 200)) ?? []
    }

    func installQiraatBackup(_ data: Data) throws {
        qiraat = try QiraatBackupService.install(data)
    }
}
