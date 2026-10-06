import Foundation
import MushafCore

/// Creates the one `MemorizationStore` the app uses. UI tests choose a throw-away, seeded database with
/// `-memorization-seed demo|empty|complete` (DEBUG builds only).
@MainActor
enum MemorizationRuntime {
    static func makeStore(library: MushafLibrary) -> MemorizationStore? {
        guard let index = library.quranIndex else { return nil }
#if DEBUG
        if let name = seedName {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("memorization-ui-\(UUID().uuidString).sqlite")
            let defaults = UserDefaults(suiteName: "memorization-ui-\(UUID().uuidString)") ?? .standard
            let store = MemorizationStore(database: MemorizationDatabase(url: url), index: index, defaults: defaults)
            MemorizationSeed.apply(name, to: store)
            let arguments = ProcessInfo.processInfo.arguments
            if let value = flag("-memorization-banner-mark", in: arguments) { store.showsBannerMark = value }
            if let value = flag("-memorization-ayah-marker", in: arguments) { store.showsAyahMarker = value }
            return store
        }
#endif
        return MemorizationStore(database: MemorizationDatabase(), index: index)
    }

    static func makeBackupController(library: MushafLibrary, store: MemorizationStore) -> BackupController {
#if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let position = arguments.firstIndex(of: "-backup-folder"), arguments.indices.contains(position + 1) {
            let defaults = UserDefaults(suiteName: "backup-ui-\(UUID().uuidString)") ?? .standard
            switch arguments[position + 1] {
            case "none":
                return BackupController(library: library, store: store, folder: BackupFolder(provider: { nil }), defaults: defaults)
            default:
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("backup-ui-\(UUID().uuidString)", isDirectory: true)
                try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                return BackupController(library: library, store: store, folder: BackupFolder(provider: { url }), defaults: defaults)
            }
        }
#endif
        return BackupController(library: library, store: store)
    }

#if DEBUG
    /// `-flag YES|NO` in the launch arguments.
    private static func flag(_ name: String, in arguments: [String]) -> Bool? {
        guard let position = arguments.firstIndex(of: name), arguments.indices.contains(position + 1) else { return nil }
        return ["YES", "yes", "true", "1"].contains(arguments[position + 1])
    }

    private static var seedName: String? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let position = arguments.firstIndex(of: "-memorization-seed"), arguments.indices.contains(position + 1) else {
            return nil
        }
        return arguments[position + 1]
    }
#endif
}
