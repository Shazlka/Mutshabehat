import Foundation

/// Where backups live: a `Backups` folder inside the iCloud Drive folder the person picked once (the same
/// folder the existing sync reads). The provider is a closure so tests and UI tests can swap the folder.
final class BackupFolder: @unchecked Sendable {
    private let provider: @Sendable () -> URL?

    init(provider: @escaping @Sendable () -> URL?) {
        self.provider = provider
    }

    /// The default: the folder the app already uses for iCloud sync (a saved bookmark or the iCloud container).
    static var iCloud: BackupFolder {
        BackupFolder(provider: { ICloudDatabaseSyncService.shared.resolveSyncFolder() })
    }

    /// `<folder>/Backups`, created on demand; nil when no folder is available.
    func backupsRoot() -> URL? {
        guard let folder = provider() else { return nil }
        let root = folder.appendingPathComponent("Backups", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            return root
        } catch {
            return nil
        }
    }

    var isAvailable: Bool { provider() != nil }
}
