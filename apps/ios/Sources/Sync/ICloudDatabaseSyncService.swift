import Foundation
import MushafCore
import SQLite3
import SwiftUI

// MARK: - Notifications

extension Notification.Name {
    static let mutshabehatDatabaseDidUpdate = Notification.Name("mutshabehatDatabaseDidUpdate")
    static let qiraatDatabaseDidUpdate = Notification.Name("qiraatDatabaseDidUpdate")
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
    let syncedAt: Date
    let message: String
}

// MARK: - Sync Service

@Observable
final class ICloudDatabaseSyncService: @unchecked Sendable {
    static let shared = ICloudDatabaseSyncService()

    var isSyncing: Bool = false
    var lastSyncDate: Date?
    var lastStatusMessage: String = ""
    var isConnected: Bool = false
    var manifest: SyncManifest?

    private let defaults = UserDefaults.standard
    private let lock = NSLock()

    private let lastSyncKey = "icloud:sync:last_date"
    private let lastHashKey = "icloud:sync:last_hash"
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

    init() {
        if let ts = defaults.object(forKey: lastSyncKey) as? Date {
            self.lastSyncDate = ts
        }
        refreshConnectionStatus()
    }

    // MARK: - Folder Resolution

    func resolveSyncFolder() -> URL? {
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
        let macFallback = URL(fileURLWithPath: "/Users/amrelshazly/Library/Mobile Documents/com~apple~CloudDocs/Mushaf_Qiraat")
        if FileManager.default.fileExists(atPath: macFallback.path) {
            return macFallback
        }
        #endif

        return nil
    }

    func setCustomFolder(url: URL) throws {
        guard url.startAccessingSecurityScopedResource() else {
            throw NSError(domain: "ICloudSync", code: 1, userInfo: [NSLocalizedDescriptionKey: "تعذر الوصول للمجلد المحدد"])
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

    @MainActor
    func syncFromICloud(library: MushafLibrary? = nil, force: Bool = false) async throws -> SyncSummary {
        guard !isSyncing else {
            throw NSError(domain: "ICloudSync", code: 2, userInfo: [NSLocalizedDescriptionKey: "المزامنة جارية بالفعل"])
        }

        isSyncing = true
        defer { isSyncing = false }

        guard let folder = resolveSyncFolder() else {
            throw NSError(domain: "ICloudSync", code: 3, userInfo: [NSLocalizedDescriptionKey: "لم يتم العثور على مجلد Mushaf_Qiraat في iCloud Drive"])
        }

        // Trigger iCloud download if files are evicted (.icloud)
        try triggerDownloadsIfNeeded(in: folder)

        // Read manifest
        let manifestURL = folder.appendingPathComponent("manifest.json")
        var currentManifest: SyncManifest?
        if let manifestData = try? Data(contentsOf: manifestURL) {
            currentManifest = try? JSONDecoder().decode(SyncManifest.self, from: manifestData)
            self.manifest = currentManifest
        }

        let mutshabehatFile = folder.appendingPathComponent("mutshabehat.sqlite")
        guard FileManager.default.fileExists(atPath: mutshabehatFile.path) else {
            throw NSError(domain: "ICloudSync", code: 4, userInfo: [NSLocalizedDescriptionKey: "ملف mutshabehat.sqlite غير موجود في مجلد المزامنة"])
        }

        // Read and import Mutshabehat database (importDatabase validates schema safely in sandbox temp directory)
        let mutshData = try Data(contentsOf: mutshabehatFile)
        try MutshabehatDatabase.shared.importDatabase(mutshData)
        NotificationCenter.default.post(name: .mutshabehatDatabaseDidUpdate, object: nil)

        // Sync Qiraat if archive exists
        var qiraatPages = 0
        let qiraatArchive = folder.appendingPathComponent("qiraat.qiraatdata")
        if FileManager.default.fileExists(atPath: qiraatArchive.path) {
            if let library {
                do {
                    let qiraatData = try Data(contentsOf: qiraatArchive)
                    try library.installQiraatBackup(qiraatData)
                    qiraatPages = 604
                    NotificationCenter.default.post(name: .qiraatDatabaseDidUpdate, object: nil)
                } catch {
                    print("Notice: Qiraat archive install failed: \(error.localizedDescription)")
                }
            }
        }

        let now = Date()
        self.lastSyncDate = now
        defaults.set(now, forKey: lastSyncKey)
        if let hash = currentManifest?.databases["mutshabehat"]?.sha256 {
            defaults.set(hash, forKey: lastHashKey)
        }

        let groupCount = currentManifest?.databases["mutshabehat"]?.groupsCount ?? MutshabehatDatabase.shared.fetchPersonalGroups().count
        let message = "تمت المزامنة بنجاح: \(groupCount) مجموعة متشابهات و\(qiraatPages) صفحة قراءات"
        self.lastStatusMessage = message
        self.isConnected = true

        NotificationCenter.default.post(name: .iCloudSyncStatusDidChange, object: nil)

        return SyncSummary(
            mutshabehatGroupsCount: groupCount,
            qiraatPagesCount: qiraatPages,
            syncedAt: now,
            message: message
        )
    }

    // MARK: - Direct Web Fallback

    @MainActor
    func syncDirectlyFromWeb(library: MushafLibrary? = nil) async throws -> SyncSummary {
        guard !isSyncing else {
            throw NSError(domain: "ICloudSync", code: 5, userInfo: [NSLocalizedDescriptionKey: "المزامنة جارية بالفعل"])
        }

        isSyncing = true
        defer { isSyncing = false }

        let exportURL = URL(string: "https://mutshabehat-v2.vercel.app/api/groups/export?format=json")!
        var request = URLRequest(url: exportURL, timeoutInterval: 30)
        request.setValue("Mutshabehat-iOS-Client", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw NSError(domain: "ICloudSync", code: 6, userInfo: [NSLocalizedDescriptionKey: "تعذر الاتصال بخادم الويب"])
        }

        let decoded = try JSONDecoder().decode(WebExportPayload.self, from: data)
        guard !decoded.groups.isEmpty else {
            throw NSError(domain: "ICloudSync", code: 7, userInfo: [NSLocalizedDescriptionKey: "استجابة الخادم خالية من المجموعات"])
        }

        // Build temporary SQLite database from export
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("web_mutsh_\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        try compileMutshabehatSqlite(payload: decoded, outputURL: tempURL)
        let sqliteData = try Data(contentsOf: tempURL)

        // Import into MutshabehatDatabase
        try MutshabehatDatabase.shared.importDatabase(sqliteData)
        NotificationCenter.default.post(name: .mutshabehatDatabaseDidUpdate, object: nil)

        // If iCloud folder is available, also update it
        if let folder = resolveSyncFolder() {
            let destDB = folder.appendingPathComponent("mutshabehat.sqlite")
            let destJSON = folder.appendingPathComponent("mutshabehat.json")
            try? sqliteData.write(to: destDB, options: .atomic)
            try? data.write(to: destJSON, options: .atomic)
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

    private func validateSqliteDatabase(at url: URL, requiredTables: [String]) throws {
        var db: OpaquePointer?
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let db else {
            if let db { sqlite3_close(db) }
            throw NSError(domain: "ICloudSync", code: 8, userInfo: [NSLocalizedDescriptionKey: "قاعدة البيانات غير صالحة"])
        }
        defer { sqlite3_close(db) }

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, "SELECT name FROM sqlite_master WHERE type='table'", -1, &stmt, nil) == SQLITE_OK else {
            throw NSError(domain: "ICloudSync", code: 9, userInfo: [NSLocalizedDescriptionKey: "تعذر قراءة جداول قاعدة البيانات"])
        }
        defer { sqlite3_finalize(stmt) }

        var tables = Set<String>()
        while sqlite3_step(stmt) == SQLITE_ROW, let text = sqlite3_column_text(stmt, 0) {
            tables.insert(String(cString: text))
        }

        for req in requiredTables {
            if !tables.contains(req) {
                throw NSError(domain: "ICloudSync", code: 10, userInfo: [NSLocalizedDescriptionKey: "الجدول \(req) مفقود في قاعدة البيانات"])
            }
        }
    }

    private func compileMutshabehatSqlite(payload: WebExportPayload, outputURL: URL) throws {
        var db: OpaquePointer?
        guard sqlite3_open(outputURL.path, &db) == SQLITE_OK, let db else {
            throw NSError(domain: "ICloudSync", code: 11, userInfo: [NSLocalizedDescriptionKey: "تعذر إنشاء ملف قاعدة البيانات المؤقت"])
        }
        defer { sqlite3_close(db) }

        sqlite3_exec(db, """
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
        """, nil, nil, nil)

        let insertGroupSql = "INSERT INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"
        let insertVerseSql = "INSERT INTO verses (id, group_id, surah, ayah, label, sort_order) VALUES (?, ?, ?, ?, ?, ?);"
        let insertPartSql = "INSERT INTO parts (id, verse_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?);"

        var groupStmt: OpaquePointer?
        var verseStmt: OpaquePointer?
        var partStmt: OpaquePointer?

        sqlite3_prepare_v2(db, insertGroupSql, -1, &groupStmt, nil)
        sqlite3_prepare_v2(db, insertVerseSql, -1, &verseStmt, nil)
        sqlite3_prepare_v2(db, insertPartSql, -1, &partStmt, nil)

        defer {
            sqlite3_finalize(groupStmt)
            sqlite3_finalize(verseStmt)
            sqlite3_finalize(partStmt)
        }

        sqlite3_exec(db, "BEGIN TRANSACTION;", nil, nil, nil)

        for g in payload.groups {
            sqlite3_reset(groupStmt)
            sqlite3_bind_text(groupStmt, 1, (g.id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(groupStmt, 2, (g.title as NSString).utf8String, -1, nil)
            sqlite3_bind_text(groupStmt, 3, ((g.color ?? "") as NSString).utf8String, -1, nil)
            sqlite3_bind_text(groupStmt, 4, ((g.status ?? "draft") as NSString).utf8String, -1, nil)
            sqlite3_bind_int(groupStmt, 5, g.favorite ? 1 : 0)
            sqlite3_bind_int(groupStmt, 6, g.completed ? 1 : 0)
            sqlite3_bind_text(groupStmt, 7, ((g.note ?? "") as NSString).utf8String, -1, nil)
            sqlite3_bind_text(groupStmt, 8, ((g.unote ?? "") as NSString).utf8String, -1, nil)
            sqlite3_bind_text(groupStmt, 9, (g.created_at as NSString).utf8String, -1, nil)
            sqlite3_bind_text(groupStmt, 10, (g.updated_at as NSString).utf8String, -1, nil)
            sqlite3_step(groupStmt)

            for v in g.verses {
                sqlite3_reset(verseStmt)
                sqlite3_bind_text(verseStmt, 1, (v.id as NSString).utf8String, -1, nil)
                sqlite3_bind_text(verseStmt, 2, (g.id as NSString).utf8String, -1, nil)
                sqlite3_bind_text(verseStmt, 3, ((v.surah ?? "") as NSString).utf8String, -1, nil)
                sqlite3_bind_int(verseStmt, 4, Int32(v.ayah))
                sqlite3_bind_text(verseStmt, 5, ((v.label ?? "") as NSString).utf8String, -1, nil)
                sqlite3_bind_int(verseStmt, 6, Int32(v.sort_order))
                sqlite3_step(verseStmt)

                for p in v.parts {
                    sqlite3_reset(partStmt)
                    sqlite3_bind_text(partStmt, 1, (p.id as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(partStmt, 2, (v.id as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(partStmt, 3, (p.type as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(partStmt, 4, (p.text as NSString).utf8String, -1, nil)
                    sqlite3_bind_int(partStmt, 5, Int32(p.sort_order))
                    sqlite3_step(partStmt)
                }
            }
        }

        sqlite3_exec(db, "COMMIT;", nil, nil, nil)
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
