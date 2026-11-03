import Foundation

/// Where backups live: a `Backups` folder inside the folder the person picked in Files.
/// The provider is a closure so tests and UI tests can swap the folder.
final class BackupFolder: @unchecked Sendable {
    private let provider: @Sendable () -> URL?

    init(provider: @escaping @Sendable () -> URL?) {
        self.provider = provider
    }

    /// The default: the folder saved from the Files picker (or the sync folder in Debug builds).
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
