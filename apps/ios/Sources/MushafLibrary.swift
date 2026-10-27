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
    /// The scholarly references (الشاطبية، الدرة، طيبة النشر) per variant, from the optional `QiraatReferences` bundle
    /// folder. Empty when the build ships without it; the card then shows no references row. Read on first use (the
    /// first Qiraat card), not at launch: the full file is a few MB.
    private(set) lazy var qiraatReferences: QiraatReferenceStore =
        qiraatReferencesURL.map { QiraatReferenceStore(directory: $0) } ?? .empty
    private let qiraatReferencesURL: URL?
#if DEBUG
    /// UI tests only (`-qiraat-references-fixture`): one synthetic reference per work for every variant on page 1.
    /// The text is a placeholder, never real matn text.
    private(set) lazy var qiraatReferencesFixture: QiraatReferenceStore = {
        let variants = qiraat?.page(1)?.variants ?? []
        return QiraatReferenceStore(entries: variants.flatMap { variant in
            QiraatMatn.allCases.enumerated().map { index, work in
                QiraatReference(variantId: variant.id, variantKey: QiraatReferenceStore.key(for: variant), work: work,
                                verse: index + 1, lines: ["نص تجريبي"], symbolText: "رمز", side: .variant,
                                readingIds: variant.readingIds, printedPage: "\(index + 1)",
                                status: [.extracted, .reviewed, .verified][index])
            }
        })
    }()
#endif

    /// The ayah → page/juz index memorization is computed from, built once on first use.
    private(set) lazy var quranIndex: QuranIndex? = try? QuranIndex.load(from: database)

    /// The one memorization store of the app, created on first use.
    private(set) lazy var memorizationStore: MemorizationStore? = MemorizationRuntime.makeStore(library: self)

    /// Backups and restores of the person's data, created together with the memorization store.
    private(set) lazy var backupController: BackupController? = {
        guard let store = memorizationStore else { return nil }
        return MemorizationRuntime.makeBackupController(library: self, store: store)
    }()

    init(bundle: Bundle = .main, qiraatStore: QiraatStore? = nil) throws {
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
        qiraatReferencesURL = bundle.url(forResource: "QiraatReferences", withExtension: nil)
#if DEBUG
        if ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" {
            qiraat = qiraatStore ?? bundle.url(forResource: "Qiraat", withExtension: nil)
                .flatMap { try? QiraatStore(directory: $0) }
            return
        }
#endif
        let imported = QiraatBackupService.importedDirectory
        let live = QiraatLiveSync.overlayDirectory
        qiraat = qiraatStore ?? (try? QiraatStore(directory: imported, overlayDirectory: live))
            ?? bundle.url(forResource: "Qiraat", withExtension: nil).flatMap { try? QiraatStore(directory: $0, overlayDirectory: live) }
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

    /// The text of one Quran word (surah, ayah, word index), looked up on `page` and the pages next to it,
    /// or nil when it is not there. Used to show a Qiraat rule that works across a word boundary.
    func wordText(surah: Int, ayah: Int, token: Int, near page: Int) -> String? {
        for number in [page, page + 1, page - 1] where (1...mushafPageCount).contains(number) {
            guard let p = self.page(number) else { continue }
            for word in p.lines.flatMap(\.words) where word.charType == .word
                && word.ayahKey.surah == surah && word.ayahKey.ayah == ayah && word.indexInAyah == token {
                return word.textUthmani
            }
        }
        return nil
    }

    func page(of ayah: AyahKey) -> Int? {
        try? database.page(of: ayah)
    }

    func searchAyaat(matching query: String, mode: QuranSearchMode = .smart) -> [AyahSearchResult] {
        (try? database.searchAyaat(matching: query, mode: mode, limit: 200)) ?? []
    }

    /// An explicit restore: the backup replaces the snapshot, so pages fetched live earlier (laid over the old one)
    /// are dropped; `QiraatBulkSync` fetches them again.
    func installQiraatBackup(_ data: Data) throws {
        try adoptInstalledQiraat(try QiraatBackupService.install(data), keepLivePages: false)
    }

    /// Starts reading from a Qiraat snapshot that is already installed on disk (the heavy install runs off the
    /// main thread). `keepLivePages: true` is for automatic syncs: the live pages are newer than any archive and
    /// still win over it.
    func adoptInstalledQiraat(_ installed: QiraatStore, keepLivePages: Bool,
                              overlayDirectory: URL = QiraatLiveSync.overlayDirectory) throws {
        let replacement = try QiraatStore(directory: installed.directory, overlayDirectory: overlayDirectory)
        if !keepLivePages { try? FileManager.default.removeItem(at: overlayDirectory) }
        qiraat = replacement
        NotificationCenter.default.post(name: .qiraatDatabaseDidUpdate, object: nil)
    }
}
