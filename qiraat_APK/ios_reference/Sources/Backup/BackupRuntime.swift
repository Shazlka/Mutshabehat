import Foundation

/// Builds the app's `BackupController`. DEBUG builds can point it at no folder or a temporary one
/// (`-backup-folder none|temp`) so UI tests never touch the real iCloud Drive backups.
@MainActor
enum BackupRuntime {
    static func makeController(library: MushafLibrary, store: MemorizationStore) -> BackupController {
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
}
