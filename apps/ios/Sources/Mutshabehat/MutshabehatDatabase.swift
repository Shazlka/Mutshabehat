import Foundation
import MushafCore
import SQLite3

public final class MutshabehatDatabase: @unchecked Sendable {
    public static let shared = MutshabehatDatabase()
    private var db: OpaquePointer?
    private let lock = NSLock()
    private let databaseURL: URL

    /// The SQLite file this database is stored in (used by backups to take a consistent snapshot).
    public var fileURL: URL { databaseURL }

    public init(url: URL? = nil) {
        let dbUrl: URL
        if let url = url {
            dbUrl = url
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
            dbUrl = appSupport.appendingPathComponent("mutshabehat.sqlite")

            if !FileManager.default.fileExists(atPath: dbUrl.path) {
                if let bundleUrl = Bundle.main.url(forResource: "mutshabehat", withExtension: "sqlite") {
                    try? FileManager.default.copyItem(at: bundleUrl, to: dbUrl)
                }
            }
        }
        databaseURL = dbUrl

        if sqlite3_open(dbUrl.path, &db) != SQLITE_OK {
            db = nil
        } else {
            execute("""
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, color TEXT, status TEXT,
                favorite INTEGER DEFAULT 0, completed INTEGER DEFAULT 0,
                note TEXT, unote TEXT, created_at TEXT, updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS verses (
                id TEXT PRIMARY KEY, group_id TEXT NOT NULL, surah TEXT, ayah INTEGER,
                label TEXT, sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS parts (
                id TEXT PRIMARY KEY, verse_id TEXT NOT NULL, type TEXT NOT NULL,
                text TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (verse_id) REFERENCES verses(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS automated_groups (
                id INTEGER PRIMARY KEY, legacy_id TEXT, title TEXT NOT NULL,
                color TEXT, surahs TEXT, payload TEXT NOT NULL, copied INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_verses_group ON verses(group_id);
            CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surah);
            CREATE INDEX IF NOT EXISTS idx_parts_verse ON parts(verse_id);
            CREATE INDEX IF NOT EXISTS idx_automated_title ON automated_groups(title);
            """)
        }
    }

    deinit {
        if let db = db { sqlite3_close(db) }
    }

    private func execute(_ sql: String) {
        guard let db = db else { return }
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    public func allSurahNames() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }
        var names: [String] = []
        let sql = "SELECT DISTINCT surah FROM verses WHERE surah IS NOT NULL AND surah != '' ORDER BY surah"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                if let c = sqlite3_column_text(stmt, 0) {
                    names.append(String(cString: c))
                }
            }
        }
        sqlite3_finalize(stmt)
        return names
    }

    // MARK: Personal groups

    private static let groupColumns = "id, title, color, status, favorite, completed, note, unote, created_at, updated_at"

    /// `%` and `_` typed by the user are literal characters, not wildcards.
    private static func likePattern(_ text: String) -> String {
        let escaped = text.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
        return "%\(escaped)%"
    }

    public func fetchPersonalGroups(surah: String? = nil, query: String? = nil) -> [PersonalGroup] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        var sql = "SELECT \(Self.groupColumns) FROM groups WHERE 1=1"
        var params: [String] = []

        if let surah = surah, !surah.isEmpty {
            sql += " AND id IN (SELECT group_id FROM verses WHERE surah = ?)"
            params.append(surah)
        }
        if let query = query, !query.isEmpty {
            sql += " AND (title LIKE ? ESCAPE '\\' OR id IN (SELECT v.group_id FROM verses v JOIN parts p ON p.verse_id = v.id WHERE p.text LIKE ? ESCAPE '\\'))"
            params.append(Self.likePattern(query))
            params.append(Self.likePattern(query))
        }
        sql += " ORDER BY favorite DESC, title ASC"

        return attachVerses(readGroups(db, sql: sql, params: params), in: db)
    }

    public func fetchPersonalGroup(id: String) -> PersonalGroup? {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return nil }
        let groups = readGroups(db, sql: "SELECT \(Self.groupColumns) FROM groups WHERE id = ? LIMIT 1", params: [id])
        return attachVerses(groups, in: db).first
    }

    /// The group rows only (no verses). A failed prepare returns nothing; NULL text columns read as empty.
    private func readGroups(_ db: OpaquePointer, sql: String, params: [String]) -> [PersonalGroup] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(stmt) }
        for (i, p) in params.enumerated() { SQLiteBind.text(stmt, Int32(i + 1), p) }

        func text(_ column: Int32) -> String? { sqlite3_column_text(stmt, column).map { String(cString: $0) } }
        var groups: [PersonalGroup] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            groups.append(PersonalGroup(
                id: text(0) ?? "", title: text(1) ?? "", color: text(2) ?? "#55b94f", status: text(3) ?? "draft",
                favorite: sqlite3_column_int(stmt, 4) != 0, completed: sqlite3_column_int(stmt, 5) != 0,
                note: text(6), unote: text(7), createdAt: text(8), updatedAt: text(9), verses: []))
        }
        return groups
    }

    /// Two queries for all groups at once (verses, then parts), instead of one per group and one per verse.
    private func attachVerses(_ groups: [PersonalGroup], in db: OpaquePointer) -> [PersonalGroup] {
        guard !groups.isEmpty else { return groups }
        let ids = Set(groups.map(\.id))
        // Restrict both queries to these groups while the list fits SQLite's variable limit; bigger lists read all.
        let groupFilter = ids.count <= 500
        let placeholders = groupFilter ? " WHERE v.group_id IN (\(Array(repeating: "?", count: ids.count).joined(separator: ",")))" : ""
        let orderedIds = Array(ids)
        func bindIds(_ stmt: OpaquePointer?) {
            guard groupFilter else { return }
            for (i, id) in orderedIds.enumerated() { SQLiteBind.text(stmt, Int32(i + 1), id) }
        }
        var versesByGroup: [String: [PersonalVerse]] = [:]
        var partsByVerse: [String: [PersonalPart]] = [:]

        var partStmt: OpaquePointer?
        let partSQL = "SELECT p.verse_id, p.id, p.type, p.text, p.sort_order FROM parts p JOIN verses v ON v.id = p.verse_id\(placeholders) ORDER BY p.sort_order ASC"
        if sqlite3_prepare_v2(db, partSQL, -1, &partStmt, nil) == SQLITE_OK {
            bindIds(partStmt)
            while sqlite3_step(partStmt) == SQLITE_ROW {
                func text(_ column: Int32) -> String? { sqlite3_column_text(partStmt, column).map { String(cString: $0) } }
                partsByVerse[text(0) ?? "", default: []].append(
                    PersonalPart(id: text(1) ?? "", type: text(2) ?? "normal", text: text(3) ?? "",
                                 sortOrder: Int(sqlite3_column_int(partStmt, 4))))
            }
        }
        sqlite3_finalize(partStmt)

        var verseStmt: OpaquePointer?
        let verseSQL = "SELECT v.id, v.group_id, v.surah, v.ayah, v.label, v.sort_order FROM verses v\(placeholders) ORDER BY v.sort_order ASC"
        if sqlite3_prepare_v2(db, verseSQL, -1, &verseStmt, nil) == SQLITE_OK {
            bindIds(verseStmt)
            while sqlite3_step(verseStmt) == SQLITE_ROW {
                func text(_ column: Int32) -> String? { sqlite3_column_text(verseStmt, column).map { String(cString: $0) } }
                let groupId = text(1) ?? ""
                guard ids.contains(groupId) else { continue }
                let verseId = text(0) ?? ""
                versesByGroup[groupId, default: []].append(PersonalVerse(
                    id: verseId, groupId: groupId, surah: text(2) ?? "", ayah: Int(sqlite3_column_int(verseStmt, 3)),
                    label: text(4), sortOrder: Int(sqlite3_column_int(verseStmt, 5)),
                    parts: partsByVerse[verseId] ?? []))
            }
        }
        sqlite3_finalize(verseStmt)

        return groups.map { group in
            var group = group
            group.verses = versesByGroup[group.id] ?? []
            return group
        }
    }

    public func toggleFavorite(groupId: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        try? run(db, "UPDATE groups SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ?") { stmt in
            SQLiteBind.text(stmt, 1, groupId)
        }
    }

    /// Saves `group` and all its verses and parts in one transaction. Any failing statement rolls everything back,
    /// so a half-written group is never committed over the old one.
    public func saveGroup(_ group: PersonalGroup) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { throw DatabaseTransferError.databaseUnavailable }

        let nowStr = ISO8601DateFormatter().string(from: Date())
        try inTransaction(db) {
            try run(db, """
            INSERT OR REPLACE INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """) { stmt in
                SQLiteBind.text(stmt, 1, group.id)
                SQLiteBind.text(stmt, 2, group.title)
                SQLiteBind.text(stmt, 3, group.color)
                SQLiteBind.text(stmt, 4, group.status)
                sqlite3_bind_int(stmt, 5, group.favorite ? 1 : 0)
                sqlite3_bind_int(stmt, 6, group.completed ? 1 : 0)
                SQLiteBind.text(stmt, 7, group.note)
                SQLiteBind.text(stmt, 8, group.unote)
                SQLiteBind.text(stmt, 9, group.createdAt ?? nowStr)
                SQLiteBind.text(stmt, 10, nowStr)
            }
            // Clear existing verses & parts for this group to support re-ordering and deletions.
            try deleteChildren(of: group.id, in: db)
            for (vIndex, verse) in group.verses.enumerated() {
                try run(db, "INSERT INTO verses (id, group_id, surah, ayah, label, sort_order) VALUES (?, ?, ?, ?, ?, ?);") { stmt in
                    SQLiteBind.text(stmt, 1, verse.id)
                    SQLiteBind.text(stmt, 2, group.id)
                    SQLiteBind.text(stmt, 3, verse.surah)
                    sqlite3_bind_int(stmt, 4, Int32(verse.ayah))
                    SQLiteBind.text(stmt, 5, verse.label)
                    sqlite3_bind_int(stmt, 6, Int32(vIndex))
                }
                for (pIndex, part) in verse.parts.enumerated() {
                    try run(db, "INSERT INTO parts (id, verse_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?);") { stmt in
                        SQLiteBind.text(stmt, 1, part.id)
                        SQLiteBind.text(stmt, 2, verse.id)
                        SQLiteBind.text(stmt, 3, part.type)
                        SQLiteBind.text(stmt, 4, part.text)
                        sqlite3_bind_int(stmt, 5, Int32(pIndex))
                    }
                }
            }
        }
    }

    /// `saveGroup` for callers that only need to know whether it worked.
    @discardableResult
    public func savePersonalGroup(_ group: PersonalGroup) -> Bool {
        do { try saveGroup(group); return true } catch { return false }
    }

    public func deleteGroup(groupId: String) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { throw DatabaseTransferError.databaseUnavailable }
        try inTransaction(db) {
            try deleteChildren(of: groupId, in: db)
            try run(db, "DELETE FROM groups WHERE id = ?;") { SQLiteBind.text($0, 1, groupId) }
        }
    }

    @discardableResult
    public func deletePersonalGroup(groupId: String) -> Bool {
        do { try deleteGroup(groupId: groupId); return true } catch { return false }
    }

    // MARK: Checked statements

    private func deleteChildren(of groupId: String, in db: OpaquePointer) throws {
        try run(db, "DELETE FROM parts WHERE verse_id IN (SELECT id FROM verses WHERE group_id = ?);") { SQLiteBind.text($0, 1, groupId) }
        try run(db, "DELETE FROM verses WHERE group_id = ?;") { SQLiteBind.text($0, 1, groupId) }
    }

    /// Runs one statement and throws unless SQLite reports it finished.
    private func run(_ db: OpaquePointer, _ sql: String, bind: (OpaquePointer?) -> Void = { _ in }) throws {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseTransferError.writeFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        bind(stmt)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw DatabaseTransferError.writeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    private func inTransaction(_ db: OpaquePointer, _ body: () throws -> Void) throws {
        try run(db, "BEGIN IMMEDIATE TRANSACTION;")
        do {
            try body()
            try run(db, "COMMIT;")
        } catch {
            sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
            throw error
        }
    }

    public func fetchAutomatedGroups(surah: String? = nil, query: String? = nil) -> [AutomatedGroup] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        var sql = "SELECT id, legacy_id, title, color, surahs, copied, payload FROM automated_groups WHERE 1=1"
        var params: [String] = []

        if let surah = surah, !surah.isEmpty {
            sql += " AND surahs LIKE ?"
            params.append("%\(surah)%")
        }
        if let query = query, !query.isEmpty {
            sql += " AND title LIKE ?"
            params.append("%\(query)%")
        }
        sql += " ORDER BY copied ASC, id ASC LIMIT 100"

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        for (i, p) in params.enumerated() {
            SQLiteBind.text(stmt, Int32(i + 1), p)
        }

        var list: [AutomatedGroup] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let id = Int(sqlite3_column_int(stmt, 0))
            let legacyId = sqlite3_column_text(stmt, 1).map { String(cString: $0) }
            let title = String(cString: sqlite3_column_text(stmt, 2))
            let color = sqlite3_column_text(stmt, 3).map { String(cString: $0) } ?? "#888"
            let surahsRaw = sqlite3_column_text(stmt, 4).map { String(cString: $0) } ?? ""
            let surahs = surahsRaw.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
            let copied = sqlite3_column_int(stmt, 5) != 0
            let payloadStr = String(cString: sqlite3_column_text(stmt, 6))

            let verses = parseAutomatedVerses(from: payloadStr)
            list.append(AutomatedGroup(id: id, legacyId: legacyId, title: title, color: color, surahs: surahs, copied: copied, verses: verses))
        }
        sqlite3_finalize(stmt)
        return list
    }

    private func parseAutomatedVerses(from jsonStr: String) -> [AutomatedVerse] {
        guard let data = jsonStr.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let vList = json["verses"] as? [[String: Any]] else {
            return []
        }
        return vList.compactMap { v in
            let surah = (v["surah"] as? String) ?? ""
            let ayah = (v["ayah"] as? Int) ?? Int((v["ayah"] as? String) ?? "1") ?? 1
            let label = v["label"] as? String
            let partsRaw = (v["parts"] as? [[String: Any]]) ?? []
            let parts = partsRaw.enumerated().map { i, p in
                PersonalPart(
                    id: UUID().uuidString,
                    type: (p["type"] as? String) ?? "normal",
                    text: (p["text"] as? String) ?? "",
                    sortOrder: i
                )
            }
            return AutomatedVerse(surah: surah, ayah: ayah, label: label, parts: parts)
        }
    }

    public func copyAutomatedToPersonal(automatedId: Int) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }

        var stmt: OpaquePointer?
        let sql = "SELECT id, title, color, payload FROM automated_groups WHERE id = ?"
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        sqlite3_bind_int(stmt, 1, Int32(automatedId))

        guard sqlite3_step(stmt) == SQLITE_ROW else {
            sqlite3_finalize(stmt)
            return
        }

        let title = String(cString: sqlite3_column_text(stmt, 1))
        let color = sqlite3_column_text(stmt, 2).map { String(cString: $0) } ?? "#55b94f"
        let payloadStr = String(cString: sqlite3_column_text(stmt, 3))
        sqlite3_finalize(stmt)

        let newGroupId = UUID().uuidString
        let dateStr = ISO8601DateFormatter().string(from: Date())

        let insertGroupSql = """
        INSERT INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at)
        VALUES (?, ?, ?, 'draft', 0, 0, '', '', ?, ?);
        """
        var gStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, insertGroupSql, -1, &gStmt, nil) == SQLITE_OK {
            SQLiteBind.text(gStmt, 1, newGroupId)
            SQLiteBind.text(gStmt, 2, title)
            SQLiteBind.text(gStmt, 3, color)
            SQLiteBind.text(gStmt, 4, dateStr)
            SQLiteBind.text(gStmt, 5, dateStr)
            sqlite3_step(gStmt)
        }
        sqlite3_finalize(gStmt)

        let verses = parseAutomatedVerses(from: payloadStr)
        for (vi, v) in verses.enumerated() {
            let vid = UUID().uuidString
            let vSql = "INSERT INTO verses (id, group_id, surah, ayah, label, sort_order) VALUES (?, ?, ?, ?, ?, ?);"
            var vStmt: OpaquePointer?
            if sqlite3_prepare_v2(db, vSql, -1, &vStmt, nil) == SQLITE_OK {
                SQLiteBind.text(vStmt, 1, vid)
                SQLiteBind.text(vStmt, 2, newGroupId)
                SQLiteBind.text(vStmt, 3, v.surah)
                sqlite3_bind_int(vStmt, 4, Int32(v.ayah))
                if let l = v.label { SQLiteBind.text(vStmt, 5, l) }
                else { sqlite3_bind_null(vStmt, 5) }
                sqlite3_bind_int(vStmt, 6, Int32(vi))
                sqlite3_step(vStmt)
            }
            sqlite3_finalize(vStmt)

            for (pi, p) in v.parts.enumerated() {
                let pid = UUID().uuidString
                let pSql = "INSERT INTO parts (id, verse_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?);"
                var pStmt: OpaquePointer?
                if sqlite3_prepare_v2(db, pSql, -1, &pStmt, nil) == SQLITE_OK {
                    SQLiteBind.text(pStmt, 1, pid)
                    SQLiteBind.text(pStmt, 2, vid)
                    SQLiteBind.text(pStmt, 3, p.type)
                    SQLiteBind.text(pStmt, 4, p.text)
                    sqlite3_bind_int(pStmt, 5, Int32(pi))
                    sqlite3_step(pStmt)
                }
                sqlite3_finalize(pStmt)
            }
        }

        let markSql = "UPDATE automated_groups SET copied = 1 WHERE id = ?"
        var mStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, markSql, -1, &mStmt, nil) == SQLITE_OK {
            sqlite3_bind_int(mStmt, 1, Int32(automatedId))
            sqlite3_step(mStmt)
        }
        sqlite3_finalize(mStmt)
    }

    public func importAutomatedJSON(data: Data) throws -> Int {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return 0 }

        guard let jsonArray = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return 0
        }

        execute("BEGIN TRANSACTION;")
        var count = 0
        let sql = """
        INSERT OR REPLACE INTO automated_groups (id, legacy_id, title, color, surahs, payload, copied)
        VALUES (?, ?, ?, ?, ?, ?, 0);
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            execute("ROLLBACK;")
            return 0
        }

        for (idx, item) in jsonArray.enumerated() {
            let id = (item["id"] as? Int) ?? (idx + 1)
            let legacyId = (item["legacy_id"] as? String) ?? "\(id)"
            let title = (item["title"] as? String) ?? "بدون عنوان"
            let color = (item["color"] as? String) ?? "#888"
            let surahsList = (item["surahs"] as? [String]) ?? []
            let surahs = surahsList.joined(separator: ", ")
            let payloadData = try? JSONSerialization.data(withJSONObject: item)
            let payload = payloadData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

            sqlite3_bind_int(stmt, 1, Int32(id))
            SQLiteBind.text(stmt, 2, legacyId)
            SQLiteBind.text(stmt, 3, title)
            SQLiteBind.text(stmt, 4, color)
            SQLiteBind.text(stmt, 5, surahs)
            SQLiteBind.text(stmt, 6, payload)

            if sqlite3_step(stmt) == SQLITE_DONE {
                count += 1
            }
            sqlite3_reset(stmt)
        }

        sqlite3_finalize(stmt)
        execute("COMMIT;")
        return count
    }

    public func exportDatabase() throws -> Data {
        lock.lock()
        defer { lock.unlock() }
        guard db != nil else { throw DatabaseTransferError.databaseUnavailable }
        let snapshot = FileManager.default.temporaryDirectory
            .appendingPathComponent("mutshabehat-export-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: snapshot) }
        do {
            try SQLiteSnapshot.copy(from: databaseURL, to: snapshot)
            return try Data(contentsOf: snapshot)
        } catch {
            throw DatabaseTransferError.databaseUnavailable
        }
    }

    /// Replaces the whole database with `data` after checking that it is a SQLite file holding the Mutshabehat
    /// tables. If the swap fails, the previous file is put back (see `SQLiteFile.replaceContents`).
    public func importDatabase(_ data: Data) throws {
        try replaceContents(with: data)
        // Posted after the lock is released: observers run synchronously and read this database.
        NotificationCenter.default.post(name: Notification.Name("mutshabehatDatabaseDidUpdate"), object: nil)
    }

    private static let requiredTables: Set<String> = ["groups", "verses", "parts", "automated_groups"]

    /// Folds another Mutshabehat database (the Mac's or the web's export) into this one without losing local work:
    /// - a group only here stays;
    /// - a group only in `sourceURL` is added;
    /// - a group in both keeps whichever copy was saved last (`updated_at`), with its verses and parts;
    /// - automated candidates come from the source, and one copied to a personal group on either side stays marked copied.
    /// A group deleted at the source is not deleted here. Posts no notification: the caller does, on the main thread.
    public func mergeDatabase(from sourceURL: URL) throws {
        do { try SQLiteFile.validate(at: sourceURL, requiredTables: Self.requiredTables) } catch {
            throw DatabaseTransferError.invalidDatabase
        }
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { throw DatabaseTransferError.databaseUnavailable }

        let escapedPath = sourceURL.path.replacingOccurrences(of: "'", with: "''")
        try run(db, "ATTACH DATABASE '\(escapedPath)' AS source_db;")
        defer { sqlite3_exec(db, "DETACH DATABASE source_db;", nil, nil, nil) }

        try inTransaction(db) {
            try run(db, """
            CREATE TEMP TABLE sync_ids AS
            SELECT s.id FROM source_db.groups s LEFT JOIN main.groups g ON g.id = s.id
            WHERE g.id IS NULL OR COALESCE(julianday(s.updated_at), 0) > COALESCE(julianday(g.updated_at), 0);
            """)
            defer { sqlite3_exec(db, "DROP TABLE IF EXISTS temp.sync_ids;", nil, nil, nil) }
            try run(db, "DELETE FROM parts WHERE verse_id IN (SELECT id FROM verses WHERE group_id IN (SELECT id FROM temp.sync_ids));")
            try run(db, "DELETE FROM verses WHERE group_id IN (SELECT id FROM temp.sync_ids);")
            try run(db, """
            INSERT OR REPLACE INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at)
            SELECT id, title, color, status, favorite, completed, note, unote, created_at, updated_at
            FROM source_db.groups WHERE id IN (SELECT id FROM temp.sync_ids);
            """)
            try run(db, """
            INSERT INTO verses (id, group_id, surah, ayah, label, sort_order)
            SELECT id, group_id, surah, ayah, label, sort_order
            FROM source_db.verses WHERE group_id IN (SELECT id FROM temp.sync_ids);
            """)
            try run(db, """
            INSERT INTO parts (id, verse_id, type, text, sort_order)
            SELECT id, verse_id, type, text, sort_order FROM source_db.parts
            WHERE verse_id IN (SELECT id FROM source_db.verses WHERE group_id IN (SELECT id FROM temp.sync_ids));
            """)
            try run(db, """
            INSERT OR REPLACE INTO automated_groups (id, legacy_id, title, color, surahs, payload, copied)
            SELECT s.id, s.legacy_id, s.title, s.color, s.surahs, s.payload,
                   MAX(COALESCE(s.copied, 0), COALESCE((SELECT a.copied FROM main.automated_groups a WHERE a.id = s.id), 0))
            FROM source_db.automated_groups s;
            """)
        }
    }

    private func replaceContents(with data: Data) throws {
        lock.lock()
        defer { lock.unlock() }

        do {
            try SQLiteFile.replaceContents(
                of: databaseURL, with: data, requiredTables: Self.requiredTables,
                // With no open connection (it failed to open) there is nothing to fold in, as before.
                checkpoint: { if let db { try SQLiteFile.checkpointTruncate(db, busyTimeoutMs: 2000) } },
                close: { try closeConnection() },
                reopen: { try reopenDatabase() })
        } catch let error as SQLiteFileError {
            switch error {
            case .unreadable, .missingTables, .integrity: throw DatabaseTransferError.invalidDatabase
            case .replaceFailed: throw DatabaseTransferError.databaseUnavailable
            }
        }
    }

    /// Closes the connection and clears `db` only if SQLite agreed to close it.
    private func closeConnection() throws {
        guard let handle = db else { return }
        guard sqlite3_close(handle) == SQLITE_OK else { throw DatabaseTransferError.databaseUnavailable }
        db = nil
    }

    /// Opens the file and checks the connection is configured; on any failure nothing stays open.
    private func reopenDatabase() throws {
        var handle: OpaquePointer?
        guard sqlite3_open(databaseURL.path, &handle) == SQLITE_OK, let opened = handle else {
            if let handle { sqlite3_close_v2(handle) }
            db = nil
            throw DatabaseTransferError.databaseUnavailable
        }
        do {
            try SQLiteFile.enableWALAndForeignKeys(opened)
        } catch {
            sqlite3_close_v2(opened)
            db = nil
            throw DatabaseTransferError.databaseUnavailable
        }
        db = opened
    }
}

public enum DatabaseTransferError: LocalizedError, Equatable {
    case databaseUnavailable
    case invalidDatabase
    /// A statement failed; the text is SQLite's own message. Nothing of the failed write is kept.
    case writeFailed(String)

    public var errorDescription: String? {
        switch self {
        case .databaseUnavailable: "تعذر فتح قاعدة البيانات"
        case .invalidDatabase: "الملف ليس قاعدة متشابهات صالحة"
        case let .writeFailed(message): "تعذر حفظ التغييرات: \(message)"
        }
    }
}
