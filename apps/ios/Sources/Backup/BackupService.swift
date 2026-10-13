import Foundation
import MushafCore

enum BackupReason: Sendable {
    case manual, debounced, background, launch
}

struct BackupResult: Equatable, Sendable {
    let createdAt: Date
    let skipped: Bool
    let files: [BackupFileEntry]
}

enum BackupError: LocalizedError, Equatable {
    case folderUnavailable
    case verificationFailed(String)
    case writeFailed(String)

    var errorDescription: String? {
        switch self {
        case .folderUnavailable: "لا يوجد مجلد iCloud للنسخ الاحتياطي. اختر المجلد من إعدادات النسخ الاحتياطي."
        case let .verificationFailed(name): "فشل التحقق من النسخة الاحتياطية (\(name)). لم يتغير شيء في النسخة السابقة."
        case let .writeFailed(detail): "تعذر كتابة النسخة الاحتياطية: \(detail)"
        }
    }
}

struct SnapshotInfo: Identifiable, Equatable {
    var id: String { name }
    let name: String
    let url: URL
    let createdAt: Date
    let manifest: BackupManifest
}

/// Backs up everything the app stores for the person: memorization (as a portable JSON document and a SQLite
/// snapshot), reading and Mutshabehat (SQLite snapshots) and the Qiraat archive, into the iCloud Drive folder.
/// A set is built in a staging folder, verified, and only then moved into place; the previous `latest` is
/// replaced only after the new set is complete. The work runs off the main actor.
@MainActor
@Observable
final class BackupService {
    struct Sources: Sendable {
        var memorizationExport: @Sendable () throws -> MemorizationExport
        var memorizationFileURL: URL
        var readingFileURL: URL
        var mutshabehatFileURL: URL
        /// The Qiraat archive (about 13 MB), or nil when there is no Qiraat store. It is rebuilt only on a
        /// manual backup or when it is missing from the folder, because the data rarely changes.
        var qiraatArchive: (@Sendable () throws -> Data)?
        var deviceID: String
        var appVersion: String
        var qiraatNotesFileURL: URL? = nil
    }

    private let folder: BackupFolder
    private let sources: Sources
    private let now: @MainActor () -> Date
    private let calendar: Calendar
    private let defaults: UserDefaults
    private static let lastSuccessKey = "backup:last-success:v1"

    /// Test seam: runs on the staged set just before verification.
    var beforeVerify: (@Sendable (URL) -> Void)?

    private(set) var lastSuccess: Date?
    private(set) var lastError: String?
    private(set) var isRunning = false

    init(folder: BackupFolder, sources: Sources, now: @escaping @MainActor () -> Date = { Date() },
         calendar: Calendar = .current, defaults: UserDefaults = .standard) {
        self.folder = folder
        self.sources = sources
        self.now = now
        self.calendar = calendar
        self.defaults = defaults
        if let stored = defaults.object(forKey: Self.lastSuccessKey) as? Double {
            lastSuccess = Date(epochMilliseconds: Int64(stored))
        }
    }

    func runBackup(reason: BackupReason) async throws -> BackupResult {
        let moment = now().normalizedToMilliseconds
        guard !isRunning else { return BackupResult(createdAt: moment, skipped: true, files: []) }
        guard let root = folder.backupsRoot() else {
            lastError = BackupError.folderUnavailable.localizedDescription
            throw BackupError.folderUnavailable
        }
        isRunning = true
        defer { isRunning = false }

        let worker = BackupWorker(root: root, sources: sources, reason: reason, now: moment, calendar: calendar,
                                  beforeVerify: beforeVerify)
        do {
            let result = try await Task.detached(priority: .utility) { try worker.run() }.value
            lastSuccess = moment
            defaults.set(Double(moment.epochMilliseconds), forKey: Self.lastSuccessKey)
            lastError = nil
            return result
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    /// The memorization document alone, for the manual export when no backup folder is set up.
    func memorizationExportData() throws -> Data { try sources.memorizationExport().encode() }

    /// Backup sets in the folder, newest first.
    func listSnapshots() -> [SnapshotInfo] {
        guard let root = folder.backupsRoot() else { return [] }
        let history = root.appendingPathComponent("history")
        let names = (try? FileManager.default.contentsOfDirectory(atPath: history.path)) ?? []
        return names.compactMap { name -> SnapshotInfo? in
            let url = history.appendingPathComponent(name)
            guard let manifest = BackupWorker.loadManifest(in: url) else { return nil }
            return SnapshotInfo(name: name, url: url, createdAt: manifest.createdAt, manifest: manifest)
        }.sorted { $0.createdAt > $1.createdAt }
    }
}

struct BackupWorker: Sendable {
    let root: URL
    let sources: BackupService.Sources
    let reason: BackupReason
    let now: Date
    let calendar: Calendar
    let beforeVerify: (@Sendable (URL) -> Void)?

    private static func qiraatName(hash: String) -> String { "shared/qiraat-\(hash).qiraatdata" }
    private var sqliteSources: [(name: String, url: URL)] {
        var files: [(name: String, url: URL)] = [("memorization.sqlite", sources.memorizationFileURL),
         ("reading.sqlite", sources.readingFileURL),
         ("mutshabehat.sqlite", sources.mutshabehatFileURL)]
        if let url = sources.qiraatNotesFileURL { files.append(("qiraat-notes.sqlite", url)) }
        return files
    }

    static func loadManifest(in folder: URL) -> BackupManifest? {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent("manifest.json")) else { return nil }
        return try? BackupCoding.decoder().decode(BackupManifest.self, from: data)
    }

    func run() throws -> BackupResult {
        let fileManager = FileManager.default
        let latestURL = root.appendingPathComponent("latest")
        let historyURL = root.appendingPathComponent("history")
        let sharedURL = root.appendingPathComponent("shared")
        removeStaleStaging()

        let previous = Self.loadManifest(in: latestURL)
        let staging = root.appendingPathComponent(".staging-\(UUID().uuidString)")
        try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: staging) }

        var entries: [BackupFileEntry] = []

        let export = try sources.memorizationExport()
        let exportData = try export.encode()
        try exportData.write(to: staging.appendingPathComponent("memorization.json"))
        entries.append(BackupFileEntry(name: "memorization.json", sha256: BackupHash.sha256Hex(exportData),
                                       size: exportData.count, rowCount: export.records.count))

        var sqliteChanged = previous == nil
        for source in sqliteSources {
            let origin = source.url
            guard fileManager.fileExists(atPath: origin.path) else { continue }
            let target = staging.appendingPathComponent(source.name)
            do { try SQLiteSnapshot.copy(from: origin, to: target) } catch {
                throw BackupError.writeFailed("\(source.name): \(error.localizedDescription)")
            }
            let hash = try BackupHash.sha256Hex(ofFileAt: target)
            let size = (try? fileManager.attributesOfItem(atPath: target.path)[.size] as? Int) ?? 0
            entries.append(BackupFileEntry(name: source.name, sha256: hash, size: size ?? 0, rowCount: nil))
            if previous?.files.first(where: { $0.name == source.name })?.sha256 != hash { sqliteChanged = true }
        }

        var qiraatEntry = previous?.files.first { $0.name.hasPrefix("shared/qiraat") }
        var newQiraatData: Data?
        let previousSharedFile = qiraatEntry.map { root.appendingPathComponent($0.name) }
        let archiveIsValid = qiraatEntry != nil &&
            previousSharedFile.flatMap { try? BackupHash.sha256Hex(ofFileAt: $0) } == qiraatEntry?.sha256
        if let makeArchive = sources.qiraatArchive, reason == .manual || !archiveIsValid {
            let data = try makeArchive()
            let hash = BackupHash.sha256Hex(data)
            let name = Self.qiraatName(hash: hash)
            let existingHash = try? BackupHash.sha256Hex(ofFileAt: root.appendingPathComponent(name))
            if hash != qiraatEntry?.sha256 || existingHash != hash {
                newQiraatData = data
                qiraatEntry = BackupFileEntry(name: name, sha256: hash, size: data.count, rowCount: nil)
            }
        }
        if let qiraatEntry { entries.append(qiraatEntry) }

        if !sqliteChanged, newQiraatData == nil, previous != nil {
            return BackupResult(createdAt: now, skipped: true, files: previous?.files ?? [])
        }

        beforeVerify?(staging)
        try verify(entries: entries, in: staging)

        let manifest = BackupManifest(createdAt: now, deviceID: sources.deviceID, appVersion: sources.appVersion, files: entries)
        try BackupCoding.encoder().encode(manifest).write(to: staging.appendingPathComponent("manifest.json"))

        if let data = newQiraatData, let qiraatEntry {
            try coordinated(writingTo: sharedURL) {
                try fileManager.createDirectory(at: sharedURL, withIntermediateDirectories: true)
                let temporary = sharedURL.appendingPathComponent(".qiraat-\(UUID().uuidString)")
                try data.write(to: temporary)
                let sharedFile = root.appendingPathComponent(qiraatEntry.name)
                if fileManager.fileExists(atPath: sharedFile.path) {
                    if try BackupHash.sha256Hex(ofFileAt: sharedFile) == qiraatEntry.sha256 {
                        try fileManager.removeItem(at: temporary)
                    } else {
                        _ = try fileManager.replaceItemAt(sharedFile, withItemAt: temporary)
                    }
                } else {
                    try fileManager.moveItem(at: temporary, to: sharedFile)
                }
                guard try BackupHash.sha256Hex(ofFileAt: sharedFile) == qiraatEntry.sha256 else {
                    throw BackupError.verificationFailed(qiraatEntry.name)
                }
            }
        }

        let name = uniqueFolderName(in: historyURL)
        let placed = historyURL.appendingPathComponent(name)
        try coordinated(writingTo: historyURL) {
            try fileManager.createDirectory(at: historyURL, withIntermediateDirectories: true)
            try fileManager.moveItem(at: staging, to: placed)
        }

        try coordinated(writingTo: latestURL) {
            let temporary = root.appendingPathComponent(".latest-\(UUID().uuidString)")
            try fileManager.copyItem(at: placed, to: temporary)
            if fileManager.fileExists(atPath: latestURL.path) {
                _ = try fileManager.replaceItemAt(latestURL, withItemAt: temporary)
            } else {
                try fileManager.moveItem(at: temporary, to: latestURL)
            }
        }

        applyRetention(in: historyURL)
        pruneUnusedQiraatArchives(in: sharedURL, history: historyURL, latest: latestURL)
        return BackupResult(createdAt: now, skipped: false, files: entries)
    }

    // MARK: Verification

    private func verify(entries: [BackupFileEntry], in staging: URL) throws {
        for entry in entries where !entry.name.hasPrefix("shared/") {
            let file = staging.appendingPathComponent(entry.name)
            guard let hash = try? BackupHash.sha256Hex(ofFileAt: file), hash == entry.sha256 else {
                throw BackupError.verificationFailed(entry.name)
            }
            if entry.name.hasSuffix(".sqlite"), !SQLiteSnapshot.integrityCheck(at: file) {
                throw BackupError.verificationFailed(entry.name)
            }
            if entry.name == "memorization.json" {
                guard let data = try? Data(contentsOf: file), (try? MemorizationExport.decode(data)) != nil else {
                    throw BackupError.verificationFailed(entry.name)
                }
            }
        }
    }

    // MARK: Folder names and retention

    private func formatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter
    }

    private func uniqueFolderName(in history: URL) -> String {
        let base = formatter().string(from: now)
        var name = base
        var counter = 0
        while FileManager.default.fileExists(atPath: history.appendingPathComponent(name).path) {
            counter += 1
            name = "\(base)-\(counter)"
        }
        return name
    }

    private func applyRetention(in history: URL) {
        let fileManager = FileManager.default
        let formatter = formatter()
        let names = ((try? fileManager.contentsOfDirectory(atPath: history.path)) ?? []).sorted()
        let dated = names.compactMap { name -> (date: Date, name: String)? in
            guard let date = formatter.date(from: String(name.prefix(15))) else { return nil }
            return (date, name)
        }
        var doomed = RetentionPlanner.datesToDelete(existing: dated.map(\.date), now: now, keepDays: 14, calendar: calendar)
        for entry in dated {
            guard let position = doomed.firstIndex(of: entry.date) else { continue }
            doomed.remove(at: position)
            try? coordinated(writingTo: history) { try fileManager.removeItem(at: history.appendingPathComponent(entry.name)) }
        }
    }

    private func pruneUnusedQiraatArchives(in shared: URL, history: URL, latest: URL) {
        let fileManager = FileManager.default
        guard let names = try? fileManager.contentsOfDirectory(atPath: history.path),
              let latestManifest = Self.loadManifest(in: latest) else { return }
        var referenced = Set(latestManifest.files.map(\.name))
        for name in names {
            guard let manifest = Self.loadManifest(in: history.appendingPathComponent(name)) else { return }
            referenced.formUnion(manifest.files.map(\.name))
        }
        for name in (try? fileManager.contentsOfDirectory(atPath: shared.path)) ?? []
            where name.hasPrefix("qiraat-") && name.hasSuffix(".qiraatdata") {
            guard !referenced.contains("shared/\(name)") else { continue }
            try? coordinated(writingTo: shared) { try fileManager.removeItem(at: shared.appendingPathComponent(name)) }
        }
    }

    private func removeStaleStaging() {
        let fileManager = FileManager.default
        for name in (try? fileManager.contentsOfDirectory(atPath: root.path)) ?? [] where name.hasPrefix(".staging-") || name.hasPrefix(".latest-") {
            let url = root.appendingPathComponent(name)
            let modified = (try? fileManager.attributesOfItem(atPath: url.path)[.modificationDate] as? Date) ?? .distantPast
            if now.timeIntervalSince(modified ?? .distantPast) > 3_600 { try? fileManager.removeItem(at: url) }
        }
    }

    private func coordinated(writingTo url: URL, _ body: () throws -> Void) throws {
        var coordinationError: NSError?
        var thrown: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forMerging, error: &coordinationError) { _ in
            do { try body() } catch { thrown = error }
        }
        if let failure = coordinationError ?? thrown {
            throw BackupError.writeFailed(failure.localizedDescription)
        }
    }
}
