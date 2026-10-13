import Foundation
import MushafCore

enum BackupStore: CaseIterable, Hashable, Sendable {
    case memorization, reading, mutshabehat, qiraat
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
        case let .notDownloaded(name): "الملف \(name) لم يُنزَّل من iCloud بعد. انتظر قليلاً ثم أعد المحاولة."
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
    }

    private let backupsRoot: URL
    private let targets: Targets
    private let safetyDirectory: URL
    private let now: () -> Date
    private let calendar: Calendar
    private static func qiraatEntry(in manifest: BackupManifest) -> BackupFileEntry? {
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
        let export = try verify(info, includingQiraat: false)
        var stores: Set<BackupStore> = [.memorization]
        let names = Set(info.manifest.files.map(\.name))
        if names.contains("reading.sqlite") { stores.insert(.reading) }
        if names.contains("mutshabehat.sqlite") { stores.insert(.mutshabehat) }
        if let entry = Self.qiraatEntry(in: info.manifest),
           FileManager.default.fileExists(atPath: backupsRoot.appendingPathComponent(entry.name).path) {
            stores.insert(.qiraat)
        }
        return RestorePreview(info: info, ayahRecords: export.records.count, batches: export.batches.count, stores: stores)
    }

    /// Checks every file against the manifest and returns the decoded memorization document.
    @discardableResult
    private func verify(_ info: SnapshotInfo, includingQiraat: Bool) throws -> MemorizationExport {
        if info.manifest.formatVersion > BackupManifest.currentFormatVersion {
            throw RestoreError.newerFormat(info.manifest.formatVersion)
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
        if includingQiraat, let entry = Self.qiraatEntry(in: info.manifest) {
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

    /// An iCloud file that is not on the device yet shows up as ".name.icloud": ask for it and refuse for now.
    private func requirePresent(_ file: URL, name: String) throws {
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

    func restore(_ info: SnapshotInfo, stores: Set<BackupStore>, memorizationMode: MemorizationRestoreMode) throws -> RestoreReport {
        let export = try verify(info, includingQiraat: stores.contains(.qiraat))
        var report = RestoreReport()
        report.safetyCopy = try makeSafetyCopy()

        for store in BackupStore.allCases where stores.contains(store) {
            do {
                switch store {
                case .memorization:
                    switch memorizationMode {
                    case .merge: try targets.memorizationMerge(export)
                    case .replace: try targets.memorizationReplace(export)
                    }
                case .reading:
                    try targets.readingImport(Data(contentsOf: info.url.appendingPathComponent("reading.sqlite")))
                case .mutshabehat:
                    try targets.mutshabehatImport(Data(contentsOf: info.url.appendingPathComponent("mutshabehat.sqlite")))
                case .qiraat:
                    guard let install = targets.qiraatInstall else { throw RestoreError.storeUnavailable("Qiraat") }
                    guard let entry = Self.qiraatEntry(in: info.manifest) else { throw RestoreError.fileMissing("Qiraat") }
                    try install(Data(contentsOf: backupsRoot.appendingPathComponent(entry.name)))
                }
                report.restored.insert(store)
            } catch {
                report.failed[store] = error.localizedDescription
            }
        }
        return report
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

    // MARK: Safety copy

    /// Copies the current data beside the app before it is replaced; the last three copies are kept.
    private func makeSafetyCopy() throws -> URL {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: safetyDirectory, withIntermediateDirectories: true)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        let base = formatter.string(from: now())
        var name = base
        var counter = 0
        while fileManager.fileExists(atPath: safetyDirectory.appendingPathComponent(name).path) {
            counter += 1
            name = "\(base)-\(counter)"
        }
        let folder = safetyDirectory.appendingPathComponent(name)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)

        try targets.memorizationCurrentExport().encode().write(to: folder.appendingPathComponent("memorization.json"))
        let files: [(String, URL)] = [("memorization.sqlite", targets.memorizationFileURL),
                                      ("reading.sqlite", targets.readingFileURL),
                                      ("mutshabehat.sqlite", targets.mutshabehatFileURL)]
        for (fileName, origin) in files where fileManager.fileExists(atPath: origin.path) {
            try SQLiteSnapshot.copy(from: origin, to: folder.appendingPathComponent(fileName))
        }

        let copies = ((try? fileManager.contentsOfDirectory(atPath: safetyDirectory.path)) ?? []).sorted()
        for old in copies.dropLast(3) { try? fileManager.removeItem(at: safetyDirectory.appendingPathComponent(old)) }
        return folder
    }
}
