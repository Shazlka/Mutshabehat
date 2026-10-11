import Foundation
import MushafCore
import SwiftUI

/// Wires the backup and restore services to the app's real stores and decides when a backup runs: 30 seconds
/// after the last change, when the app goes to the background, and at launch when the last one is over a day old.
@MainActor
@Observable
final class BackupController {
    static let debounce: Duration = .seconds(30)
    static let staleAfter: TimeInterval = 7 * 86_400

    let service: BackupService
    private let library: MushafLibrary
    private let store: MemorizationStore
    private let folder: BackupFolder
    private let backupsRootProvider: () -> URL?
    private var pending: Task<Void, Never>?

    private(set) var folderAvailable: Bool

    init(library: MushafLibrary, store: MemorizationStore, folder: BackupFolder = .iCloud,
         defaults: UserDefaults = .standard) {
        self.library = library
        self.store = store
        self.folder = folder
        self.backupsRootProvider = { folder.backupsRoot() }
        self.folderAvailable = folder.isAvailable
        let database = store.database
        var archive: (@Sendable () throws -> Data)?
        if let qiraatStore = library.qiraat {
            archive = { @Sendable in try QiraatBackupService.export(from: qiraatStore) }
        }
        let sources = BackupService.Sources(
            memorizationExport: { database.exportAll(now: Date()) },
            memorizationFileURL: database.fileURL,
            readingFileURL: QuranReadingDatabase.shared.fileURL,
            mutshabehatFileURL: MutshabehatDatabase.shared.fileURL,
            qiraatArchive: archive,
            deviceID: database.deviceID,
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
            qiraatNotesFileURL: QiraatNotesStore.shared.fileURL)
        service = BackupService(folder: folder, sources: sources, defaults: defaults)
        store.onDataChanged = { [weak self] in self?.dataChanged() }
        QiraatNotesStore.shared.onDataChanged = { [weak self] in self?.dataChanged() }
    }

    var lastSuccess: Date? { service.lastSuccess }
    var lastError: String? { service.lastError }
    var isRunning: Bool { service.isRunning }

    /// A banner on the dashboard when backups are not working: no folder, or none for over seven days.
    var needsAttention: Bool {
        if !folder.isAvailable { return true }
        guard let last = service.lastSuccess else { return true }
        return Date().timeIntervalSince(last) > Self.staleAfter
    }

    func refreshFolder() {
        let available = folder.isAvailable
        if available != folderAvailable { folderAvailable = available }
    }

    // MARK: Triggers

    private func dataChanged() {
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: Self.debounce)
            guard !Task.isCancelled else { return }
            await self?.run(.debounced)
        }
    }

    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background:
            pending?.cancel()
            let taskID = UIApplication.shared.beginBackgroundTask(withName: "memorization-backup")
            Task { [weak self] in
                await self?.run(.background)
                UIApplication.shared.endBackgroundTask(taskID)
            }
        case .active:
            launchCheck()
        default: break
        }
    }

    private var didLaunchCheck = false
    func launchCheck() {
        guard !didLaunchCheck else { return }
        didLaunchCheck = true
        if let last = service.lastSuccess, Date().timeIntervalSince(last) < 86_400 { return }
        Task { await run(.launch) }
    }

    @discardableResult
    func run(_ reason: BackupReason) async -> BackupResult? {
        guard folder.isAvailable else { refreshFolder(); return nil }
        refreshFolder()
        return try? await service.runBackup(reason: reason)
    }

    /// The manual button: errors are shown to the person.
    func backupNow() async throws -> BackupResult {
        refreshFolder()
        return try await service.runBackup(reason: .manual)
    }

    // MARK: Restore

    func makeRestoreService() throws -> RestoreService {
        guard let root = backupsRootProvider() else { throw BackupError.folderUnavailable }
        let database = store.database
        let library = library
        let targets = RestoreService.Targets(
            memorizationCurrentExport: { database.exportAll(now: Date()) },
            memorizationMerge: { try database.merge($0, now: Date()) },
            memorizationReplace: { try database.replaceAll(with: $0) },
            memorizationFileURL: database.fileURL,
            readingFileURL: QuranReadingDatabase.shared.fileURL,
            mutshabehatFileURL: MutshabehatDatabase.shared.fileURL,
            readingImport: { try QuranReadingDatabase.shared.importDatabase($0) },
            mutshabehatImport: { try MutshabehatDatabase.shared.importDatabase($0) },
            qiraatInstall: { try library.installQiraatBackup($0) },
            qiraatNotesFileURL: QiraatNotesStore.shared.fileURL,
            qiraatNotesImport: { try QiraatNotesStore.shared.importDatabase($0) })
        let safety = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("BackupSafetyCopies", isDirectory: true)
        return RestoreService(backupsRoot: root, targets: targets, safetyDirectory: safety)
    }

    /// After a restore or import changed what the stores hold.
    func didRestore() {
        store.reloadFromDatabase()
        ReadingTracker.shared.refreshBookmarksCache()
    }
}
