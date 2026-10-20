import Foundation
import MushafCore
import os
import SQLite3
import SwiftUI

// MARK: - Notifications

extension Notification.Name {
    static let mutshabehatDatabaseDidUpdate = Notification.Name("mutshabehatDatabaseDidUpdate")
    static let qiraatDatabaseDidUpdate = Notification.Name("qiraatDatabaseDidUpdate")
    static let readingDatabaseDidUpdate = Notification.Name("readingDatabaseDidUpdate")
    static let iCloudSyncStatusDidChange = Notification.Name("iCloudSyncStatusDidChange")
}

// MARK: - Manifest Models

struct SyncManifest: Codable, Sendable {
    let schemaVersion: Int
    let exportedAt: String
    let sourceOfTruth: String
    let databases: [String: SyncDatabaseEntry]

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "schema_version"
        case exportedAt = "exported_at"
        case sourceOfTruth = "source_of_truth"
        case databases
    }
}

struct SyncDatabaseEntry: Codable, Sendable {
    let file: String?
    let jsonFile: String?
    let archiveFile: String?
    let dumpFile: String?
    let sqlFile: String?
    let groupsCount: Int?
    let versesCount: Int?
    let partsCount: Int?
    let automatedGroupsCount: Int?
    let mushafAnnotationsCount: Int?
    let pageCount: Int?
    let variantsCount: Int?
    let rulingsCount: Int?
    let sha256: String?
    let sizeBytes: Int?

    enum CodingKeys: String, CodingKey {
        case file
        case jsonFile = "json_file"
        case archiveFile = "archive_file"
        case dumpFile = "dump_file"
        case sqlFile = "sql_file"
        case groupsCount = "groups_count"
        case versesCount = "verses_count"
        case partsCount = "parts_count"
        case automatedGroupsCount = "automated_groups_count"
        case mushafAnnotationsCount = "mushaf_annotations_count"
        case pageCount = "page_count"
        case variantsCount = "variants_count"
        case rulingsCount = "rulings_count"
        case sha256
        case sizeBytes = "size_bytes"
    }
}

struct SyncSummary: Sendable {
    let mutshabehatGroupsCount: Int
    let qiraatPagesCount: Int
    var readingKhatmasCount: Int = 0
    let syncedAt: Date
    let message: String
}

// MARK: - Sync Service

@Observable
final class ICloudDatabaseSyncService: ReadingSyncing, @unchecked Sendable {
    static let shared = ICloudDatabaseSyncService()

    var isSyncing: Bool = false
    var lastSyncDate: Date?
    var lastStatusMessage: String = ""
    /// Why the last sync failed, or nil after a successful one. Shown in the sync settings.
    var lastError: String?
    var isConnected: Bool = false
    var manifest: SyncManifest?

    private static let log = Logger(subsystem: "com.shazlka.qiraat", category: "sync")
    private let defaults: UserDefaults
    /// The stores this service imports into and publishes from (the app's own ones unless a test gives others).
    private let stores: UserStores
    /// Replaces the folder lookup (tests); nil means the normal resolution below.
    private let folderProvider: (() -> URL?)?
    private let lock = NSLock()

    private let lastSyncKey = "icloud:sync:last_date"
    private let autoSyncKey = "icloud:sync:auto_enabled"
    private let bookmarkKey = "icloud:sync:folder_bookmark"

    var autoSyncEnabled: Bool {
        get {
            if defaults.object(forKey: autoSyncKey) == nil { return true }
            return defaults.bool(forKey: autoSyncKey)
        }
        set {
            defaults.set(newValue, forKey: autoSyncKey)
        }
    }

    init(defaults: UserDefaults = .standard, stores: UserStores = .live, folderProvider: (() -> URL?)? = nil) {
        self.defaults = defaults
        self.stores = stores
        self.folderProvider = folderProvider
        if let ts = defaults.object(forKey: lastSyncKey) as? Date {
            self.lastSyncDate = ts
        }
        refreshConnectionStatus()
    }

    // MARK: - Folder Resolution

    func resolveSyncFolder() -> URL? {
        if let folderProvider { return folderProvider() }
#if DEBUG
        // A UI test on a throw-away reading database must never merge with, or push to, the real folder:
        // in the simulator that folder is the Mac's own iCloud Drive.
        if ProcessInfo.processInfo.arguments.contains("-reading-fresh") ||
            ProcessInfo.processInfo.environment["QIRAAT_TEST_ISOLATION"] == "1" { return nil }
#endif
        // 1. Check custom saved security-scoped bookmark
        if let bookmarkData = defaults.data(forKey: bookmarkKey) {
            var isStale = false
            if let resolved = try? URL(resolvingBookmarkData: bookmarkData,
                                      options: .withoutUI,
                                      relativeTo: nil,
                                      bookmarkDataIsStale: &isStale),
               resolved.startAccessingSecurityScopedResource() {
                if FileManager.default.fileExists(atPath: resolved.path) {
                    return resolved
                }
            }
        }

        // 2. Check Ubiquity Documents container
        if let ubiquityURL = FileManager.default.url(forUbiquityContainerIdentifier: "iCloud.com.shazlka.qiraat")?.appendingPathComponent("Documents") {
            if FileManager.default.fileExists(atPath: ubiquityURL.path) {
                return ubiquityURL
            }
        }
        if let defaultUbiquity = FileManager.default.url(forUbiquityContainerIdentifier: nil)?.appendingPathComponent("Documents") {
            if FileManager.default.fileExists(atPath: defaultUbiquity.path) {
                return defaultUbiquity
            }
        }

        // 3. Check standard Simulator & macOS iCloud Drive path: Mushaf_Qiraat
        #if targetEnvironment(simulator)
        if let hostHome = ProcessInfo.processInfo.environment["SIMULATOR_HOST_HOME"] {
            let simCloudDocs = URL(fileURLWithPath: hostHome).appendingPathComponent("Library/Mobile Documents/com~apple~CloudDocs/Mushaf_Qiraat")
            if FileManager.default.fileExists(atPath: simCloudDocs.path) {
                return simCloudDocs
            }
        }
        #endif

        return nil
    }

    func setCustomFolder(url: URL) throws {
        guard url.startAccessingSecurityScopedResource() else {
            throw NSError(domain: "ICloudSync", code: 1, userInfo: [NSLocalizedDescriptionKey: appLocalized("تعذر الوصول للمجلد المحدد")])
        }
        defer { url.stopAccessingSecurityScopedResource() }

        let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
        defaults.set(bookmark, forKey: bookmarkKey)
        refreshConnectionStatus()
    }

    func refreshConnectionStatus() {
        let folder = resolveSyncFolder()
        isConnected = (folder != nil)
        if let folder {
            let manifestFile = folder.appendingPathComponent("manifest.json")
            if let data = try? Data(contentsOf: manifestFile),
               let parsed = try? JSONDecoder().decode(SyncManifest.self, from: data) {
                self.manifest = parsed
            }
        }
    }

    // MARK: - Synchronize from iCloud

    /// What the background import of the iCloud files produced. Applying it (state, notifications, the library)
    /// happens afterwards on the main actor.
    private struct CloudImport: Sendable {
        var manifest: SyncManifest?
        var mutshabehatMerged = false
        var installedQiraat: QiraatStore?
        var qiraatError: String?
    }

    private func importedKey(_ name: String) -> String { "icloud:sync:imported:\(name)" }

    /// Identifies one version of an iCloud file: the hash the Mac wrote into the manifest, else size and date.
    private nonisolated static func signature(of file: URL, manifestHash: String?) -> String? {
        if let manifestHash, !manifestHash.isEmpty { return manifestHash }
        guard let values = try? file.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]) else { return nil }
        return "\(values.fileSize ?? 0)-\(values.contentModificationDate?.timeIntervalSince1970 ?? 0)"
    }

    /// Reads and applies the iCloud files. Runs off the main thread: it reads whole files and rewrites databases.
    /// A file is imported only when its signature differs from the one last imported (or `force`), the personal
    /// groups are merged into the local ones rather than replacing them, and the Qiraat archive is installed beside
    /// the live pages, never over them.
    private nonisolated func importCloudFiles(from folder: URL, force: Bool, includeQiraat: Bool) throws -> CloudImport {
        var result = CloudImport()
        try triggerDownloadsIfNeeded(in: folder)

        if let data = try? Data(contentsOf: folder.appendingPathComponent("manifest.json")) {
            result.manifest = try? JSONDecoder().decode(SyncManifest.self, from: data)
        }

        // This store is optional; reading progress can sync in a fresh iCloud folder.
        let mutshabehatFile = folder.appendingPathComponent("mutshabehat.sqlite")
        if FileManager.default.fileExists(atPath: mutshabehatFile.path),
           let signature = Self.signature(of: mutshabehatFile, manifestHash: result.manifest?.databases["mutshabehat"]?.sha256),
           force || defaults.string(forKey: importedKey("mutshabehat")) != signature {
            // Merge from a private copy: the iCloud file may be rewritten while it is attached.
            let copy = FileManager.default.temporaryDirectory.appendingPathComponent("icloud-mutsh-\(UUID().uuidString).sqlite")
            defer { try? FileManager.default.removeItem(at: copy) }
            try FileManager.default.copyItem(at: mutshabehatFile, to: copy)
            try stores.mutshabehat.mergeDatabase(from: copy)
            defaults.set(signature, forKey: importedKey("mutshabehat"))
            result.mutshabehatMerged = true
        }

        let qiraatArchive = folder.appendingPathComponent("qiraat.qiraatdata")
        if includeQiraat, FileManager.default.fileExists(atPath: qiraatArchive.path),
           let signature = Self.signature(of: qiraatArchive, manifestHash: result.manifest?.databases["qiraat"]?.sha256),
           force || defaults.string(forKey: importedKey("qiraat")) != signature {
            do {
                result.installedQiraat = try QiraatBackupService.install(Data(contentsOf: qiraatArchive))
                defaults.set(signature, forKey: importedKey("qiraat"))
            } catch {
                result.qiraatError = error.localizedDescription
            }
        }
        return result
    }

    /// The sync that runs on its own (launch, foreground, statistics screen): a failure is logged and shown in the
    /// sync settings instead of being dropped.
    @MainActor
    func automaticSync(library: MushafLibrary?) async {
        do {
            _ = try await syncFromICloud(library: library)
        } catch {
            Self.log.error("automatic sync failed: \(error.localizedDescription, privacy: .public)")
            lastError = error.localizedDescription
            NotificationCenter.default.post(name: .iCloudSyncStatusDidChange, object: nil)
        }
    }

    @MainActor
    func syncFromICloud(library: MushafLibrary? = nil, force: Bool = false) async throws -> SyncSummary {
        guard !isSyncing else {
            throw NSError(domain: "ICloudSync", code: 2, userInfo: [NSLocalizedDescriptionKey: appLocalized("المزامنة جارية بالفعل")])
        }

        isSyncing = true
        defer { isSyncing = false }

        guard let folder = resolveSyncFolder() else {
            throw NSError(domain: "ICloudSync", code: 3, userInfo: [NSLocalizedDescriptionKey: appLocalized("لم يتم العثور على مجلد Mushaf_Qiraat في iCloud Drive")])
        }

        let includeQiraat = library != nil
        let imported = try await Task.detached(priority: .utility) { [self] in
            try importCloudFiles(from: folder, force: force, includeQiraat: includeQiraat)
        }.value
        if let manifest = imported.manifest { self.manifest = manifest }
        if imported.mutshabehatMerged {
            NotificationCenter.default.post(name: .mutshabehatDatabaseDidUpdate, object: nil)
        }

        var qiraatPages = library?.qiraat?.catalog.pageCount ?? 0
        var qiraatNotice: String?
        if let installed = imported.installedQiraat, let library {
            do {
                try library.adoptInstalledQiraat(installed, keepLivePages: true)
                qiraatPages = installed.catalog.pageCount
            } catch {
                qiraatNotice = error.localizedDescription
            }
        } else {
            qiraatNotice = imported.qiraatError
        }

        // Each device owns one snapshot. Merge all visible snapshots before publishing ours.
        // The legacy root file remains an input for installations using the earlier layout.
        do {
            _ = try await syncReadingSnapshotsInBackground(in: folder)
        } catch {
            lastStatusMessage = "تعذرت مزامنة القراءة: \(error.localizedDescription)"
            lastError = error.localizedDescription
            Self.log.error("reading snapshots failed: \(error.localizedDescription, privacy: .public)")
            NotificationCenter.default.post(name: .iCloudSyncStatusDidChange, object: nil)
            throw error
        }

        let now = Date()
        self.lastSyncDate = now
        self.lastError = nil
        defaults.set(now, forKey: lastSyncKey)

        let groupCount = imported.manifest?.databases["mutshabehat"]?.groupsCount ?? stores.mutshabehat.fetchPersonalGroups().count
        let khatmaNum = stores.reading.getOrCreateActiveKhatma().khatmaNumber
        var message = "تمت المزامنة بنجاح: \(groupCount) مجموعة متشابهات، \(qiraatPages) صفحة قراءات، والختمة #\(khatmaNum)"
        if let qiraatNotice { message += "\nتعذر تحديث القراءات: \(qiraatNotice)" }
        self.lastStatusMessage = message
        self.isConnected = true

        NotificationCenter.default.post(name: .iCloudSyncStatusDidChange, object: nil)

        return SyncSummary(
            mutshabehatGroupsCount: groupCount,
            qiraatPagesCount: qiraatPages,
            readingKhatmasCount: stores.reading.completedKhatmasCount(),
            syncedAt: now,
            message: message
        )
    }

    // MARK: - Reading Database Push to iCloud

    private var debouncedPushTask: Task<Void, Never>?
    private let readingDeviceIDKey = "reading:sync:device-id:v1"

    private var readingDeviceID: String {
        if let existing = defaults.string(forKey: readingDeviceIDKey) { return existing }
        let created = UUID().uuidString.lowercased()
        defaults.set(created, forKey: readingDeviceIDKey)
        return created
    }

    /// Serializes the file work of two overlapping reading syncs (a push and a sync from the settings screen).
    private let readingSyncLock = NSLock()

    /// Reads every device's snapshot in `folder`, merges them into `database` and writes this device's own snapshot.
    /// All file and database work; safe off the main thread. The caller refreshes the UI.
    private nonisolated func mergeReadingSnapshots(in folder: URL, into database: QuranReadingDatabase,
                                                   deviceID: String?) throws -> Int {
        readingSyncLock.lock()
        defer { readingSyncLock.unlock() }
        let fileManager = FileManager.default
        let devices = folder.appendingPathComponent("ReadingDevices", isDirectory: true)
        try fileManager.createDirectory(at: devices, withIntermediateDirectories: true)
        var sources: [URL] = []
        let legacy = folder.appendingPathComponent("reading.sqlite")
        let backup = folder.appendingPathComponent("Backups/latest/reading.sqlite")
        if fileManager.fileExists(atPath: folder.appendingPathComponent(".reading.sqlite.icloud").path) &&
            !fileManager.fileExists(atPath: legacy.path) {
            try? fileManager.startDownloadingUbiquitousItem(at: legacy)
            throw NSError(domain: "ICloudSync", code: 12,
                          userInfo: [NSLocalizedDescriptionKey: appLocalized("ملف القراءة لم يكتمل تنزيله بعد")])
        }
        if fileManager.fileExists(atPath: legacy.path) { sources.append(legacy) }
        else if fileManager.fileExists(atPath: backup.path) { sources.append(backup) }
        let deviceContents = try fileManager.contentsOfDirectory(at: devices, includingPropertiesForKeys: nil)
        for placeholder in deviceContents where placeholder.pathExtension == "icloud" {
            let filename = String(placeholder.lastPathComponent.dropFirst().dropLast(".icloud".count))
            try? fileManager.startDownloadingUbiquitousItem(at: devices.appendingPathComponent(filename))
            throw NSError(domain: "ICloudSync", code: 12,
                          userInfo: [NSLocalizedDescriptionKey: appLocalized("ملف قراءة من جهاز آخر لم يكتمل تنزيله بعد")])
        }
        sources += deviceContents.filter { $0.pathExtension == "sqlite" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }

        var merged = 0
        for source in sources {
            merged += try database.mergeDatabase(from: source).khatmasMerged
        }
        let own = devices.appendingPathComponent("\(deviceID ?? readingDeviceID).sqlite")
        try database.exportDatabase().write(to: own, options: .atomic)
        return merged
    }

    @MainActor
    private func finishReadingSync(database: QuranReadingDatabase) {
        if database === stores.reading {
            stores.tracker().reloadFromDatabase()
            NotificationCenter.default.post(name: .readingDatabaseDidUpdate, object: nil)
        }
    }

    /// Merges and publishes the reading snapshots off the main thread, then refreshes the tracker on it.
    @MainActor
    @discardableResult
    func syncReadingSnapshotsInBackground(in folder: URL, database requestedDatabase: QuranReadingDatabase? = nil,
                                          deviceID: String? = nil) async throws -> Int {
        let database = requestedDatabase ?? stores.reading
        let merged = try await Task.detached(priority: .utility) { [self] in
            try mergeReadingSnapshots(in: folder, into: database, deviceID: deviceID)
        }.value
        finishReadingSync(database: database)
        return merged
    }

    /// The same on the calling (main) thread, for tests that need it to finish before they continue.
    @MainActor
    @discardableResult
    func syncReadingSnapshots(in folder: URL, database requestedDatabase: QuranReadingDatabase? = nil,
                              deviceID: String? = nil) throws -> Int {
        let database = requestedDatabase ?? stores.reading
        let merged = try mergeReadingSnapshots(in: folder, into: database, deviceID: deviceID)
        finishReadingSync(database: database)
        return merged
    }

    @MainActor
    func scheduleDebouncedReadingPush() {
        debouncedPushTask?.cancel()
        debouncedPushTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            pushReadingToICloud()
        }
    }

    @MainActor
    func pushReadingToICloud() {
        guard let folder = resolveSyncFolder() else { return }

        Task { @MainActor in
            do {
                try await self.syncReadingSnapshotsInBackground(in: folder)
            } catch {
                self.lastStatusMessage = error.localizedDescription
                self.lastError = error.localizedDescription
                Self.log.error("reading push failed: \(error.localizedDescription, privacy: .public)")
                NotificationCenter.default.post(name: .iCloudSyncStatusDidChange, object: nil)
            }
        }
    }

    // MARK: - Direct Web Fallback

    @MainActor
    func syncDirectlyFromWeb(library: MushafLibrary? = nil) async throws -> SyncSummary {
        guard !isSyncing else {
            throw NSError(domain: "ICloudSync", code: 5, userInfo: [NSLocalizedDescriptionKey: appLocalized("المزامنة جارية بالفعل")])
        }

        isSyncing = true
        defer { isSyncing = false }

        let exportURL = AppEndpoints.groupsExport
        var request = URLRequest(url: exportURL, timeoutInterval: 30)
        request.setValue("Mutshabehat-iOS-Client", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw NSError(domain: "ICloudSync", code: 6, userInfo: [NSLocalizedDescriptionKey: appLocalized("تعذر الاتصال بخادم الويب")])
        }

        let decoded = try JSONDecoder().decode(WebExportPayload.self, from: data)
        guard !decoded.groups.isEmpty else {
            throw NSError(domain: "ICloudSync", code: 7, userInfo: [NSLocalizedDescriptionKey: appLocalized("استجابة الخادم خالية من المجموعات")])
        }

        // Build temporary SQLite database from export
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("web_mutsh_\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        try compileMutshabehatSqlite(payload: decoded, outputURL: tempURL)
        let sqliteData = try Data(contentsOf: tempURL)

        // Merge into MutshabehatDatabase: groups made on this device stay, the newer copy of a shared group wins.
        try stores.mutshabehat.mergeDatabase(from: tempURL)
        NotificationCenter.default.post(name: .mutshabehatDatabaseDidUpdate, object: nil)

        // If iCloud folder is available, also update it
        if let folder = resolveSyncFolder() {
            let destDB = folder.appendingPathComponent("mutshabehat.sqlite")
            let destJSON = folder.appendingPathComponent("mutshabehat.json")
            // Best effort: the local merge above already succeeded, but a failed copy is worth a log line.
            do {
                try sqliteData.write(to: destDB, options: .atomic)
                try data.write(to: destJSON, options: .atomic)
            } catch {
                Self.log.error("could not copy the web export to the iCloud folder: \(error.localizedDescription, privacy: .public)")
            }
        }

        let now = Date()
        self.lastSyncDate = now
        defaults.set(now, forKey: lastSyncKey)

        let message = "تم التحديث مباشرة من خادم الويب: \(decoded.count) مجموعة"
        self.lastStatusMessage = message

        NotificationCenter.default.post(name: .iCloudSyncStatusDidChange, object: nil)

        return SyncSummary(
            mutshabehatGroupsCount: decoded.count,
            qiraatPagesCount: 0,
            syncedAt: now,
            message: message
        )
    }

    // MARK: - Helpers & SQLite Validation

    private func triggerDownloadsIfNeeded(in folder: URL) throws {
        let contents = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
        for item in contents {
            if item.lastPathComponent.hasPrefix(".") && item.pathExtension == "icloud" {
                try? FileManager.default.startDownloadingUbiquitousItem(at: item)
            }
        }
    }

    private func compileMutshabehatSqlite(payload: WebExportPayload, outputURL: URL) throws {
        var db: OpaquePointer?
        guard sqlite3_open(outputURL.path, &db) == SQLITE_OK, let db else {
            throw NSError(domain: "ICloudSync", code: 11, userInfo: [NSLocalizedDescriptionKey: appLocalized("تعذر إنشاء ملف قاعدة البيانات المؤقت")])
        }
        defer { sqlite3_close(db) }

        func failure(_ what: String) -> NSError {
            NSError(domain: "ICloudSync", code: 11, userInfo: [NSLocalizedDescriptionKey: "\(what): \(String(cString: sqlite3_errmsg(db)))"])
        }

        guard sqlite3_exec(db, """
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE groups (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, color TEXT, status TEXT,
            favorite INTEGER DEFAULT 0, completed INTEGER DEFAULT 0,
            note TEXT, unote TEXT, created_at TEXT, updated_at TEXT
        );
        CREATE TABLE verses (
            id TEXT PRIMARY KEY, group_id TEXT NOT NULL, surah TEXT, ayah INTEGER,
            label TEXT, sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        );
        CREATE TABLE parts (
            id TEXT PRIMARY KEY, verse_id TEXT NOT NULL, type TEXT NOT NULL,
            text TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (verse_id) REFERENCES verses(id) ON DELETE CASCADE
        );
        CREATE TABLE automated_groups (
            id INTEGER PRIMARY KEY, legacy_id TEXT, title TEXT NOT NULL,
            color TEXT, surahs TEXT, payload TEXT NOT NULL, copied INTEGER DEFAULT 0
        );
        CREATE INDEX idx_verses_group ON verses(group_id);
        CREATE INDEX idx_verses_surah ON verses(surah);
        CREATE INDEX idx_parts_verse ON parts(verse_id);
        CREATE INDEX idx_automated_title ON automated_groups(title);
        """, nil, nil, nil) == SQLITE_OK else { throw failure("تعذر إنشاء جداول قاعدة البيانات المؤقتة") }

        let insertGroupSql = "INSERT INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"
        let insertVerseSql = "INSERT INTO verses (id, group_id, surah, ayah, label, sort_order) VALUES (?, ?, ?, ?, ?, ?);"
        let insertPartSql = "INSERT INTO parts (id, verse_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?);"

        var groupStmt: OpaquePointer?
        var verseStmt: OpaquePointer?
        var partStmt: OpaquePointer?

        guard sqlite3_prepare_v2(db, insertGroupSql, -1, &groupStmt, nil) == SQLITE_OK,
              sqlite3_prepare_v2(db, insertVerseSql, -1, &verseStmt, nil) == SQLITE_OK,
              sqlite3_prepare_v2(db, insertPartSql, -1, &partStmt, nil) == SQLITE_OK else {
            sqlite3_finalize(groupStmt); sqlite3_finalize(verseStmt); sqlite3_finalize(partStmt)
            throw failure("تعذر تجهيز استعلامات الإدراج")
        }

        defer {
            sqlite3_finalize(groupStmt)
            sqlite3_finalize(verseStmt)
            sqlite3_finalize(partStmt)
        }

        guard sqlite3_exec(db, "BEGIN TRANSACTION;", nil, nil, nil) == SQLITE_OK else { throw failure("تعذر بدء الحفظ") }
        var committed = false
        defer { if !committed { sqlite3_exec(db, "ROLLBACK;", nil, nil, nil) } }
        func done(_ stmt: OpaquePointer?) throws {
            guard sqlite3_step(stmt) == SQLITE_DONE else { throw failure("تعذر حفظ مجموعة من خادم الويب") }
        }

        for g in payload.groups {
            sqlite3_reset(groupStmt)
            SQLiteBind.text(groupStmt, 1, g.id)
            SQLiteBind.text(groupStmt, 2, g.title)
            SQLiteBind.text(groupStmt, 3, (g.color ?? ""))
            SQLiteBind.text(groupStmt, 4, (g.status ?? "draft"))
            sqlite3_bind_int(groupStmt, 5, g.favorite ? 1 : 0)
            sqlite3_bind_int(groupStmt, 6, g.completed ? 1 : 0)
            SQLiteBind.text(groupStmt, 7, (g.note ?? ""))
            SQLiteBind.text(groupStmt, 8, (g.unote ?? ""))
            SQLiteBind.text(groupStmt, 9, g.created_at)
            SQLiteBind.text(groupStmt, 10, g.updated_at)
            try done(groupStmt)

            for v in g.verses {
                sqlite3_reset(verseStmt)
                SQLiteBind.text(verseStmt, 1, v.id)
                SQLiteBind.text(verseStmt, 2, g.id)
                SQLiteBind.text(verseStmt, 3, (v.surah ?? ""))
                sqlite3_bind_int(verseStmt, 4, Int32(v.ayah))
                SQLiteBind.text(verseStmt, 5, (v.label ?? ""))
                sqlite3_bind_int(verseStmt, 6, Int32(v.sort_order))
                try done(verseStmt)

                for p in v.parts {
                    sqlite3_reset(partStmt)
                    SQLiteBind.text(partStmt, 1, p.id)
                    SQLiteBind.text(partStmt, 2, v.id)
                    SQLiteBind.text(partStmt, 3, p.type)
                    SQLiteBind.text(partStmt, 4, p.text)
                    sqlite3_bind_int(partStmt, 5, Int32(p.sort_order))
                    try done(partStmt)
                }
            }
        }

        guard sqlite3_exec(db, "COMMIT;", nil, nil, nil) == SQLITE_OK else { throw failure("تعذر إتمام الحفظ") }
        committed = true
        sqlite3_exec(db, "PRAGMA wal_checkpoint(TRUNCATE);", nil, nil, nil)
    }

    // JSON Payload Model for web export
    private struct WebExportPayload: Codable {
        let exported_at: String
        let count: Int
        let groups: [WebGroup]
    }

    private struct WebGroup: Codable {
        let id: String
        let title: String
        let color: String?
        let status: String?
        let favorite: Bool
        let completed: Bool
        let note: String?
        let unote: String?
        let created_at: String
        let updated_at: String
        let verses: [WebVerse]
    }

    private struct WebVerse: Codable {
        let id: String
        let surah: String?
        let ayah: Int
        let label: String?
        let sort_order: Int
        let parts: [WebPart]
    }

    private struct WebPart: Codable {
        let id: String
        let type: String
        let text: String
        let sort_order: Int
    }
}
