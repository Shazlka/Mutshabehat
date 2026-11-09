import Foundation
import MushafCore

enum BackupStore: CaseIterable, Hashable, Sendable {
    case memorization, reading, mutshabehat, qiraat, qiraatNotes
}

enum MemorizationRestoreMode: Sendable {
    /// Keep the newer row of each ayah, union the history. The default.
    case merge
    /// Make memorization exactly what the backup holds.
    case replace
}

enum RestoreError: LocalizedError, Equatable {
    case fileMissing(String)
    case hashMismatch(String)
    case notDownloaded(String)
    case newerFormat(Int)
    case storeUnavailable(String)

    var errorDescription: String? {
        switch self {
        case let .fileMissing(name): "ملف النسخة الاحتياطية ناقص: \(name)"
        case let .hashMismatch(name): "الملف \(name) تالف أو غير مكتمل، لم يتم تغيير أي بيانات."
        case let .notDownloaded(name):
            String(format: appLocalized("الملف %@ غير متاح على الجهاز بعد. نزّله من تطبيق الملفات ثم أعد المحاولة."), name)
        case let .newerFormat(version): "هذه النسخة من إصدار أحدث من التطبيق (\(version)). حدّث التطبيق ثم أعد المحاولة."
        case let .storeUnavailable(name): "تعذر الاستعادة: \(name)"
        }
    }
}

struct RestorePreview: Equatable {
    let info: SnapshotInfo
    let ayahRecords: Int
    let batches: Int
    let stores: Set<BackupStore>
}

struct RestoreReport: Equatable {
    var restored: Set<BackupStore> = []
    var failed: [BackupStore: String] = [:]
    var safetyCopy: URL?
}

/// Restores a backup set (or a JSON file) into the app. Everything is verified against the manifest first and
/// refused untouched if anything is wrong; before the first change the current data is copied to a local safety
/// folder; each store is then restored on its own, so one failing store cannot undo the others.
///
/// The heavy, UI-free work (hashing, integrity checks, decoding, reading the archives, the safety copy) lives in
/// `nonisolated` helpers. The `…Async` methods run it off the main actor and hold `StoreMaintenanceGate` so a
/// restore never overlaps a backup run; the synchronous methods are kept for callers that cannot await.
@MainActor
final class RestoreService {
    struct Targets {
        var memorizationCurrentExport: () throws -> MemorizationExport
        var memorizationMerge: (MemorizationExport) throws -> Void
        var memorizationReplace: (MemorizationExport) throws -> Void
        var memorizationFileURL: URL
        var readingFileURL: URL
        var mutshabehatFileURL: URL
        var readingImport: (Data) throws -> Void
        var mutshabehatImport: (Data) throws -> Void
        var qiraatInstall: ((Data) throws -> Void)?
        var qiraatNotesFileURL: URL? = nil
        var qiraatNotesImport: ((Data) throws -> Void)? = nil
    }

    private let backupsRoot: URL
    private let targets: Targets
    private let safetyDirectory: URL
    private let now: () -> Date
    private let calendar: Calendar

    private nonisolated static func qiraatEntry(in manifest: BackupManifest) -> BackupFileEntry? {
        manifest.files.first { $0.name.hasPrefix("shared/qiraat") && $0.name.hasSuffix(".qiraatdata") }
    }

    init(backupsRoot: URL, targets: Targets, safetyDirectory: URL, now: @escaping () -> Date = { Date() },
         calendar: Calendar = .current) {
        self.backupsRoot = backupsRoot
        self.targets = targets
        self.safetyDirectory = safetyDirectory
        self.now = now
        self.calendar = calendar
    }

    // MARK: Preview and verification

    func preview(_ info: SnapshotInfo) throws -> RestorePreview {
        try Self.previewFiles(info, backupsRoot: backupsRoot)
    }

    /// The same preview with the hashing and decoding done off the main actor.
    func previewAsync(_ info: SnapshotInfo) async throws -> RestorePreview {
        let root = backupsRoot
        return try await Task.detached(priority: .userInitiated) {
            try Self.previewFiles(info, backupsRoot: root)
        }.value
    }

    private nonisolated static func previewFiles(_ info: SnapshotInfo, backupsRoot: URL) throws -> RestorePreview {
        let export = try verifyFiles(info, backupsRoot: backupsRoot, includingQiraat: false)
        var stores: Set<BackupStore> = [.memorization]
        let names = Set(info.manifest.files.map(\.name))
        if names.contains("qiraat-notes.sqlite") { stores.insert(.qiraatNotes) }
        if names.contains("reading.sqlite") { stores.insert(.reading) }
        if names.contains("mutshabehat.sqlite") { stores.insert(.mutshabehat) }
        if let entry = qiraatEntry(in: info.manifest),
           FileManager.default.fileExists(atPath: backupsRoot.appendingPathComponent(entry.name).path) {
            stores.insert(.qiraat)
        }
        return RestorePreview(info: info, ayahRecords: export.records.count, batches: export.batches.count, stores: stores)
    }

    /// Checks every file against the manifest and returns the decoded memorization document. Pure file work.
    private nonisolated static func verifyFiles(_ info: SnapshotInfo, backupsRoot: URL,
                                                includingQiraat: Bool) throws -> MemorizationExport {
        if info.manifest.formatVersion > BackupManifest.currentFormatVersion {
            throw RestoreError.newerFormat(info.manifest.formatVersion)
        }
        // A manifest is data from a folder anyone with access can edit: its names are joined onto paths below.
        for entry in info.manifest.files where !ManifestNameGuard.isSafe(entry.name) {
            throw RestoreError.hashMismatch(entry.name)
        }
        let fileManager = FileManager.default
        for entry in info.manifest.files where !entry.name.hasPrefix("shared/") {
            let file = info.url.appendingPathComponent(entry.name)
            try requirePresent(file, name: entry.name)
            guard let hash = try? BackupHash.sha256Hex(ofFileAt: file), hash == entry.sha256 else {
                throw RestoreError.hashMismatch(entry.name)
            }
            if entry.name.hasSuffix(".sqlite"), !SQLiteSnapshot.integrityCheck(at: file) {
                throw RestoreError.hashMismatch(entry.name)
            }
        }
        if includingQiraat, let entry = qiraatEntry(in: info.manifest) {
            let file = backupsRoot.appendingPathComponent(entry.name)
            try requirePresent(file, name: entry.name)
            guard let hash = try? BackupHash.sha256Hex(ofFileAt: file), hash == entry.sha256 else {
                throw RestoreError.hashMismatch(entry.name)
            }
        }
        let json = info.url.appendingPathComponent("memorization.json")
        guard fileManager.fileExists(atPath: json.path), let data = try? Data(contentsOf: json) else {
            throw RestoreError.fileMissing("memorization.json")
        }
        do { return try MemorizationExport.decode(data) } catch MemorizationExportError.newerFormat(let version) {
            throw RestoreError.newerFormat(version)
        }
    }

    /// A cloud-backed Files item that is not on the device yet shows up as ".name.icloud": ask for it and refuse.
    private nonisolated static func requirePresent(_ file: URL, name: String) throws {
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: file.path) { return }
        let placeholder = file.deletingLastPathComponent().appendingPathComponent(".\(file.lastPathComponent).icloud")
        if fileManager.fileExists(atPath: placeholder.path) {
            try? fileManager.startDownloadingUbiquitousItem(at: file)
            throw RestoreError.notDownloaded(name)
        }
        throw RestoreError.fileMissing(name)
    }

    // MARK: Restore

    /// Everything a restore reads from disk, loaded before the first store is touched.
    private struct Prepared: Sendable {
        let export: MemorizationExport
        let payloads: [BackupStore: Result<Data, any Error>]

        func data(for store: BackupStore) throws -> Data {
            guard let result = payloads[store] else { throw RestoreError.fileMissing(String(describing: store)) }
            return try result.get()
        }
    }

    /// Verifies the set and reads the files the chosen stores will import. A file that cannot be read fails only
    /// its own store, as before; a set that does not verify refuses the whole restore.
    private nonisolated static func prepare(_ info: SnapshotInfo, backupsRoot: URL,
                                            stores: Set<BackupStore>) throws -> Prepared {
        let export = try verifyFiles(info, backupsRoot: backupsRoot, includingQiraat: stores.contains(.qiraat))
        var payloads: [BackupStore: Result<Data, any Error>] = [:]
        for store in stores {
            switch store {
            case .memorization:
                break
            case .reading:
                payloads[store] = Result { try Data(contentsOf: info.url.appendingPathComponent("reading.sqlite")) }
            case .mutshabehat:
                payloads[store] = Result { try Data(contentsOf: info.url.appendingPathComponent("mutshabehat.sqlite")) }
            case .qiraatNotes:
                // Older backups have no notes file; the store reports that itself when it is applied.
                guard info.manifest.files.contains(where: { $0.name == "qiraat-notes.sqlite" }) else { break }
                payloads[store] = Result { try Data(contentsOf: info.url.appendingPathComponent("qiraat-notes.sqlite")) }
            case .qiraat:
                guard let entry = qiraatEntry(in: info.manifest) else { break }
                payloads[store] = Result { try Data(contentsOf: backupsRoot.appendingPathComponent(entry.name)) }
            }
        }
        return Prepared(export: export, payloads: payloads)
    }

    /// Restore on the calling thread. Kept for callers that cannot await; the app's screens use `restoreAsync`.
    func restore(_ info: SnapshotInfo, stores: Set<BackupStore>, memorizationMode: MemorizationRestoreMode) throws -> RestoreReport {
        let prepared = try Self.prepare(info, backupsRoot: backupsRoot, stores: stores)
        var report = RestoreReport()
        report.safetyCopy = try makeSafetyCopy()
        apply(prepared, info: info, stores: stores, memorizationMode: memorizationMode, into: &report)
        return report
    }

    /// Restore with the reading, hashing and safety copy off the main actor, serialized against backup runs.
    func restoreAsync(_ info: SnapshotInfo, stores: Set<BackupStore>,
                      memorizationMode: MemorizationRestoreMode) async throws -> RestoreReport {
        let root = backupsRoot
        return try await StoreMaintenanceGate.shared.hold {
            let prepared = try await Task.detached(priority: .userInitiated) {
                try Self.prepare(info, backupsRoot: root, stores: stores)
            }.value
            var report = RestoreReport()
            report.safetyCopy = try await self.makeSafetyCopyAsync()
            self.apply(prepared, info: info, stores: stores, memorizationMode: memorizationMode, into: &report)
            return report
        }
    }

    /// Hands the prepared data to each store in turn. The targets are main-actor work (they write live databases).
    private func apply(_ prepared: Prepared, info: SnapshotInfo, stores: Set<BackupStore>,
                       memorizationMode: MemorizationRestoreMode, into report: inout RestoreReport) {
        for store in BackupStore.allCases where stores.contains(store) {
            do {
                switch store {
                case .memorization:
                    switch memorizationMode {
                    case .merge: try targets.memorizationMerge(prepared.export)
                    case .replace: try targets.memorizationReplace(prepared.export)
                    }
                case .reading:
                    try targets.readingImport(try prepared.data(for: .reading))
                case .mutshabehat:
                    try targets.mutshabehatImport(try prepared.data(for: .mutshabehat))
                case .qiraatNotes:
                    let name = "qiraat-notes.sqlite"
                    // Older backups have no notes file and must leave current notes untouched.
                    guard info.manifest.files.contains(where: { $0.name == name }) else {
                        throw RestoreError.fileMissing(name)
                    }
                    guard let restore = targets.qiraatNotesImport else {
                        throw RestoreError.storeUnavailable("ملاحظات القراءات")
                    }
                    try restore(try prepared.data(for: .qiraatNotes))
                case .qiraat:
                    guard let install = targets.qiraatInstall else { throw RestoreError.storeUnavailable("Qiraat") }
                    guard Self.qiraatEntry(in: info.manifest) != nil else { throw RestoreError.fileMissing("Qiraat") }
                    try install(try prepared.data(for: .qiraat))
                }
                report.restored.insert(store)
            } catch {
                report.failed[store] = error.localizedDescription
            }
        }
    }

    // MARK: JSON transfer

    func exportJSON() throws -> Data {
        try targets.memorizationCurrentExport().encode()
    }

    /// Decoding refuses garbage and newer formats before anything is changed.
    func importJSON(_ data: Data, mode: MemorizationRestoreMode) throws {
        let export = try MemorizationExport.decode(data)
        _ = try makeSafetyCopy()
        switch mode {
        case .merge: try targets.memorizationMerge(export)
        case .replace: try targets.memorizationReplace(export)
        }
    }

    /// The same, with decoding and the safety copy off the main actor, serialized against backup runs.
    func importJSONAsync(_ data: Data, mode: MemorizationRestoreMode) async throws {
        try await StoreMaintenanceGate.shared.hold {
            let export = try await Task.detached(priority: .userInitiated) {
                try MemorizationExport.decode(data)
            }.value
            _ = try await self.makeSafetyCopyAsync()
            switch mode {
            case .merge: try self.targets.memorizationMerge(export)
            case .replace: try self.targets.memorizationReplace(export)
            }
        }
    }

    // MARK: Safety copy

    private struct SafetyCopyPlan: Sendable {
        let export: MemorizationExport
        let files: [(name: String, origin: URL)]
        let directory: URL
        let moment: Date
        let calendar: Calendar
    }

    /// Reads what only the main actor can (the live export, the clock); the file work happens in `writeSafetyCopy`.
    private func planSafetyCopy() throws -> SafetyCopyPlan {
        var files: [(name: String, origin: URL)] = [("memorization.sqlite", targets.memorizationFileURL),
                                                    ("reading.sqlite", targets.readingFileURL),
                                                    ("mutshabehat.sqlite", targets.mutshabehatFileURL)]
        if let url = targets.qiraatNotesFileURL { files.append(("qiraat-notes.sqlite", url)) }
        return SafetyCopyPlan(export: try targets.memorizationCurrentExport(), files: files, directory: safetyDirectory,
                              moment: now(), calendar: calendar)
    }

    private func makeSafetyCopy() throws -> URL {
        try Self.writeSafetyCopy(try planSafetyCopy())
    }

    private func makeSafetyCopyAsync() async throws -> URL {
        let plan = try planSafetyCopy()
        return try await Task.detached(priority: .userInitiated) { try Self.writeSafetyCopy(plan) }.value
    }

    /// Copies the current data beside the app before it is replaced. The first copy ever made and the newest two are
    /// kept (`SafetyCopyRetention`).
    private nonisolated static func writeSafetyCopy(_ plan: SafetyCopyPlan) throws -> URL {
        let fileManager = FileManager.default
        let safetyDirectory = plan.directory
        try fileManager.createDirectory(at: safetyDirectory, withIntermediateDirectories: true)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = plan.calendar
        formatter.timeZone = plan.calendar.timeZone
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        let base = formatter.string(from: plan.moment)
        var name = base
        var counter = 0
        while fileManager.fileExists(atPath: safetyDirectory.appendingPathComponent(name).path) {
            counter += 1
            name = "\(base)-\(counter)"
        }
        let folder = safetyDirectory.appendingPathComponent(name)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)

        try plan.export.encode().write(to: folder.appendingPathComponent("memorization.json"))
        for (fileName, origin) in plan.files where fileManager.fileExists(atPath: origin.path) {
            try SQLiteSnapshot.copy(from: origin, to: folder.appendingPathComponent(fileName))
        }

        let copies = ((try? fileManager.contentsOfDirectory(atPath: safetyDirectory.path)) ?? []).sorted()
        for old in SafetyCopyRetention.namesToDelete(sortedNames: copies) {
            try? fileManager.removeItem(at: safetyDirectory.appendingPathComponent(old))
        }
        return folder
    }
}
