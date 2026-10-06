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
