import AppIntents
import Foundation
import MushafCore

/// A surah the system can name in Siri, Shortcuts and Spotlight: its number, its Arabic name and where it starts.
struct SurahEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "سورة"
    static let defaultQuery = SurahEntityQuery()

    let id: Int
    let name: String
    let startPage: Int

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(id)")
    }
}

/// All 114 surahs, read once from the bundled Mushaf database.
enum SurahCatalog {
    @MainActor static let all: [SurahEntity] = {
        guard case let .success(library) = MushafLibrary.load() else { return [] }
        return library.surahs.map { SurahEntity(id: $0.number, name: $0.name, startPage: $0.firstPage) }
    }()
}

struct SurahEntityQuery: EntityStringQuery {
    @MainActor func suggestedEntitiesSync() throws -> [SurahEntity] { SurahCatalog.all }

    @MainActor func entitiesSync(for identifiers: [Int]) throws -> [SurahEntity] {
        SurahCatalog.all.filter { identifiers.contains($0.id) }
    }

    @MainActor func entitiesSync(matching string: String) throws -> [SurahEntity] {
        let wanted = Self.plain(string)
        guard !wanted.isEmpty else { return [] }
        return SurahCatalog.all.filter { Self.plain($0.name).contains(wanted) || String($0.id) == wanted }
    }

    func suggestedEntities() async throws -> [SurahEntity] { try await suggestedEntitiesSync() }
    func entities(for identifiers: [Int]) async throws -> [SurahEntity] { try await entitiesSync(for: identifiers) }
    func entities(matching string: String) async throws -> [SurahEntity] { try await entitiesSync(matching: string) }

    private static func plain(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct ContinueReadingIntent: AppIntent {
    static let title: LocalizedStringResource = "متابعة القراءة"
    static let description = IntentDescription("يفتح التطبيق حيث توقفت عن القراءة.")
    static let openAppWhenRun = true

    @MainActor func run(on router: AppIntentRouter) { router.continueReading() }

    func perform() async throws -> some IntentResult {
        await run(on: .shared)
        return .result()
    }
}

struct OpenMushafPageIntent: AppIntent {
    static let title: LocalizedStringResource = "فتح صفحة من المصحف"
    static let description = IntentDescription("يفتح المصحف على صفحة من ١ إلى ٦٠٤.")
    static let openAppWhenRun = true

    @Parameter(title: "الصفحة", inclusiveRange: (1, 604))
    var page: Int

    @MainActor func run(on router: AppIntentRouter) throws { router.open(page: page) }

    func perform() async throws -> some IntentResult {
        try await run(on: .shared)
        return .result()
    }
}

struct OpenSurahIntent: AppIntent {
    static let title: LocalizedStringResource = "فتح سورة"
    static let description = IntentDescription("يفتح المصحف على بداية سورة.")
    static let openAppWhenRun = true

    @Parameter(title: "السورة")
    var surah: SurahEntity

    @MainActor func run(on router: AppIntentRouter) throws { router.open(page: surah.startPage) }

    func perform() async throws -> some IntentResult {
        try await run(on: .shared)
        return .result()
    }
}

struct QiraatShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: ContinueReadingIntent(),
                    phrases: ["تابع القراءة في \(.applicationName)", "افتح \(.applicationName)"],
                    shortTitle: "متابعة القراءة", systemImageName: "book")
        AppShortcut(intent: OpenSurahIntent(),
                    phrases: ["افتح \(\.$surah) في \(.applicationName)"],
                    shortTitle: "فتح سورة", systemImageName: "text.book.closed")
        AppShortcut(intent: OpenMushafPageIntent(),
                    phrases: ["افتح صفحة في \(.applicationName)"],
                    shortTitle: "فتح صفحة", systemImageName: "doc.text")
    }
}
