import Foundation
import SQLite3

public final class MutshabehatDatabase: @unchecked Sendable {
    public static let shared = MutshabehatDatabase()
    private var db: OpaquePointer?
    private let lock = NSLock()
    private let databaseURL: URL

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

    public func fetchPersonalGroups(surah: String? = nil, query: String? = nil) -> [PersonalGroup] {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return [] }

        var sql = "SELECT id, title, color, status, favorite, completed, note, unote, created_at, updated_at FROM groups WHERE 1=1"
        var params: [String] = []

        if let surah = surah, !surah.isEmpty {
            sql += " AND id IN (SELECT group_id FROM verses WHERE surah = ?)"
            params.append(surah)
        }
        if let query = query, !query.isEmpty {
            sql += " AND (title LIKE ? OR id IN (SELECT v.group_id FROM verses v JOIN parts p ON p.verse_id = v.id WHERE p.text LIKE ?))"
            params.append("%\(query)%")
            params.append("%\(query)%")
        }
        sql += " ORDER BY favorite DESC, title ASC"

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        for (i, p) in params.enumerated() {
            sqlite3_bind_text(stmt, Int32(i + 1), (p as NSString).utf8String, -1, nil)
        }

        var groups: [PersonalGroup] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let id = String(cString: sqlite3_column_text(stmt, 0))
            let title = String(cString: sqlite3_column_text(stmt, 1))
            let color = sqlite3_column_text(stmt, 2).map { String(cString: $0) } ?? "#55b94f"
            let status = sqlite3_column_text(stmt, 3).map { String(cString: $0) } ?? "draft"
            let favorite = sqlite3_column_int(stmt, 4) != 0
            let completed = sqlite3_column_int(stmt, 5) != 0
            let note = sqlite3_column_text(stmt, 6).map { String(cString: $0) }
            let unote = sqlite3_column_text(stmt, 7).map { String(cString: $0) }
            let createdAt = sqlite3_column_text(stmt, 8).map { String(cString: $0) }
            let updatedAt = sqlite3_column_text(stmt, 9).map { String(cString: $0) }

            let verses = fetchVerses(forGroupId: id, in: db)
            groups.append(PersonalGroup(
                id: id, title: title, color: color, status: status,
                favorite: favorite, completed: completed, note: note, unote: unote,
                createdAt: createdAt, updatedAt: updatedAt, verses: verses
            ))
        }
        sqlite3_finalize(stmt)
        return groups
    }

    private func fetchVerses(forGroupId groupId: String, in db: OpaquePointer) -> [PersonalVerse] {
        let sql = "SELECT id, surah, ayah, label, sort_order FROM verses WHERE group_id = ? ORDER BY sort_order ASC"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        sqlite3_bind_text(stmt, 1, (groupId as NSString).utf8String, -1, nil)

        var verses: [PersonalVerse] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let vid = String(cString: sqlite3_column_text(stmt, 0))
            let surah = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            let ayah = Int(sqlite3_column_int(stmt, 2))
            let label = sqlite3_column_text(stmt, 3).map { String(cString: $0) }
            let sortOrder = Int(sqlite3_column_int(stmt, 4))
            let parts = fetchParts(forVerseId: vid, in: db)

            verses.append(PersonalVerse(id: vid, groupId: groupId, surah: surah, ayah: ayah, label: label, sortOrder: sortOrder, parts: parts))
        }
        sqlite3_finalize(stmt)
        return verses
    }

    private func fetchParts(forVerseId verseId: String, in db: OpaquePointer) -> [PersonalPart] {
        let sql = "SELECT id, type, text, sort_order FROM parts WHERE verse_id = ? ORDER BY sort_order ASC"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        sqlite3_bind_text(stmt, 1, (verseId as NSString).utf8String, -1, nil)

        var parts: [PersonalPart] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let pid = String(cString: sqlite3_column_text(stmt, 0))
            let type = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? "normal"
            let text = sqlite3_column_text(stmt, 2).map { String(cString: $0) } ?? ""
            let sortOrder = Int(sqlite3_column_int(stmt, 3))
            parts.append(PersonalPart(id: pid, type: type, text: text, sortOrder: sortOrder))
        }
        sqlite3_finalize(stmt)
        return parts
    }

    public func toggleFavorite(groupId: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }
        let sql = "UPDATE groups SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ?"
        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, (groupId as NSString).utf8String, -1, nil)
            sqlite3_step(stmt)
        }
        sqlite3_finalize(stmt)
    }

    public func fetchPersonalGroup(id: String) -> PersonalGroup? {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return nil }

        let sql = "SELECT id, title, color, status, favorite, completed, note, unote, created_at, updated_at FROM groups WHERE id = ? LIMIT 1"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)

        guard sqlite3_step(stmt) == SQLITE_ROW else {
            sqlite3_finalize(stmt)
            return nil
        }

        let gid = String(cString: sqlite3_column_text(stmt, 0))
        let title = String(cString: sqlite3_column_text(stmt, 1))
        let color = sqlite3_column_text(stmt, 2).map { String(cString: $0) } ?? "#55b94f"
        let status = sqlite3_column_text(stmt, 3).map { String(cString: $0) } ?? "draft"
        let favorite = sqlite3_column_int(stmt, 4) != 0
        let completed = sqlite3_column_int(stmt, 5) != 0
        let note = sqlite3_column_text(stmt, 6).map { String(cString: $0) }
        let unote = sqlite3_column_text(stmt, 7).map { String(cString: $0) }
        let createdAt = sqlite3_column_text(stmt, 8).map { String(cString: $0) }
        let updatedAt = sqlite3_column_text(stmt, 9).map { String(cString: $0) }
        sqlite3_finalize(stmt)

        let verses = fetchVerses(forGroupId: gid, in: db)
        return PersonalGroup(
            id: gid, title: title, color: color, status: status,
            favorite: favorite, completed: completed, note: note, unote: unote,
            createdAt: createdAt, updatedAt: updatedAt, verses: verses
        )
    }

    public func savePersonalGroup(_ group: PersonalGroup) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }

        execute("BEGIN TRANSACTION;")

        let nowStr = ISO8601DateFormatter().string(from: Date())
        let createdAt = group.createdAt ?? nowStr
        let updatedAt = nowStr

        let groupSql = """
        INSERT OR REPLACE INTO groups (id, title, color, status, favorite, completed, note, unote, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
        var gStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, groupSql, -1, &gStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(gStmt, 1, (group.id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 2, (group.title as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 3, (group.color as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 4, (group.status as NSString).utf8String, -1, nil)
            sqlite3_bind_int(gStmt, 5, group.favorite ? 1 : 0)
            sqlite3_bind_int(gStmt, 6, group.completed ? 1 : 0)
            if let note = group.note { sqlite3_bind_text(gStmt, 7, (note as NSString).utf8String, -1, nil) }
            else { sqlite3_bind_null(gStmt, 7) }
            if let unote = group.unote { sqlite3_bind_text(gStmt, 8, (unote as NSString).utf8String, -1, nil) }
            else { sqlite3_bind_null(gStmt, 8) }
            sqlite3_bind_text(gStmt, 9, (createdAt as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 10, (updatedAt as NSString).utf8String, -1, nil)
            sqlite3_step(gStmt)
        }
        sqlite3_finalize(gStmt)

        // Clear existing verses & parts for this group to support re-ordering and deletions
        let delPartsSql = "DELETE FROM parts WHERE verse_id IN (SELECT id FROM verses WHERE group_id = ?);"
        var dpStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, delPartsSql, -1, &dpStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(dpStmt, 1, (group.id as NSString).utf8String, -1, nil)
            sqlite3_step(dpStmt)
        }
        sqlite3_finalize(dpStmt)

        let delVersesSql = "DELETE FROM verses WHERE group_id = ?;"
        var dvStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, delVersesSql, -1, &dvStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(dvStmt, 1, (group.id as NSString).utf8String, -1, nil)
            sqlite3_step(dvStmt)
        }
        sqlite3_finalize(dvStmt)

        // Insert new verses and parts
        for (vIndex, verse) in group.verses.enumerated() {
            let vSql = "INSERT INTO verses (id, group_id, surah, ayah, label, sort_order) VALUES (?, ?, ?, ?, ?, ?);"
            var vStmt: OpaquePointer?
            if sqlite3_prepare_v2(db, vSql, -1, &vStmt, nil) == SQLITE_OK {
                sqlite3_bind_text(vStmt, 1, (verse.id as NSString).utf8String, -1, nil)
                sqlite3_bind_text(vStmt, 2, (group.id as NSString).utf8String, -1, nil)
                sqlite3_bind_text(vStmt, 3, (verse.surah as NSString).utf8String, -1, nil)
                sqlite3_bind_int(vStmt, 4, Int32(verse.ayah))
                if let label = verse.label { sqlite3_bind_text(vStmt, 5, (label as NSString).utf8String, -1, nil) }
                else { sqlite3_bind_null(vStmt, 5) }
                sqlite3_bind_int(vStmt, 6, Int32(vIndex))
                sqlite3_step(vStmt)
            }
            sqlite3_finalize(vStmt)

            for (pIndex, part) in verse.parts.enumerated() {
                let pSql = "INSERT INTO parts (id, verse_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?);"
                var pStmt: OpaquePointer?
                if sqlite3_prepare_v2(db, pSql, -1, &pStmt, nil) == SQLITE_OK {
                    sqlite3_bind_text(pStmt, 1, (part.id as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(pStmt, 2, (verse.id as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(pStmt, 3, (part.type as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(pStmt, 4, (part.text as NSString).utf8String, -1, nil)
                    sqlite3_bind_int(pStmt, 5, Int32(pIndex))
                    sqlite3_step(pStmt)
                }
                sqlite3_finalize(pStmt)
            }
        }

        execute("COMMIT;")
    }

    public func deletePersonalGroup(groupId: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let db = db else { return }

        execute("BEGIN TRANSACTION;")
        let delParts = "DELETE FROM parts WHERE verse_id IN (SELECT id FROM verses WHERE group_id = ?);"
        var pStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, delParts, -1, &pStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(pStmt, 1, (groupId as NSString).utf8String, -1, nil)
            sqlite3_step(pStmt)
        }
        sqlite3_finalize(pStmt)

        let delVerses = "DELETE FROM verses WHERE group_id = ?;"
        var vStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, delVerses, -1, &vStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(vStmt, 1, (groupId as NSString).utf8String, -1, nil)
            sqlite3_step(vStmt)
        }
        sqlite3_finalize(vStmt)

        let delGroup = "DELETE FROM groups WHERE id = ?;"
        var gStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, delGroup, -1, &gStmt, nil) == SQLITE_OK {
            sqlite3_bind_text(gStmt, 1, (groupId as NSString).utf8String, -1, nil)
            sqlite3_step(gStmt)
        }
        sqlite3_finalize(gStmt)

        execute("COMMIT;")
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
            sqlite3_bind_text(stmt, Int32(i + 1), (p as NSString).utf8String, -1, nil)
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
            sqlite3_bind_text(gStmt, 1, (newGroupId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 2, (title as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 3, (color as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 4, (dateStr as NSString).utf8String, -1, nil)
            sqlite3_bind_text(gStmt, 5, (dateStr as NSString).utf8String, -1, nil)
            sqlite3_step(gStmt)
        }
        sqlite3_finalize(gStmt)

        let verses = parseAutomatedVerses(from: payloadStr)
        for (vi, v) in verses.enumerated() {
            let vid = UUID().uuidString
            let vSql = "INSERT INTO verses (id, group_id, surah, ayah, label, sort_order) VALUES (?, ?, ?, ?, ?, ?);"
            var vStmt: OpaquePointer?
            if sqlite3_prepare_v2(db, vSql, -1, &vStmt, nil) == SQLITE_OK {
                sqlite3_bind_text(vStmt, 1, (vid as NSString).utf8String, -1, nil)
                sqlite3_bind_text(vStmt, 2, (newGroupId as NSString).utf8String, -1, nil)
                sqlite3_bind_text(vStmt, 3, (v.surah as NSString).utf8String, -1, nil)
                sqlite3_bind_int(vStmt, 4, Int32(v.ayah))
                if let l = v.label { sqlite3_bind_text(vStmt, 5, (l as NSString).utf8String, -1, nil) }
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
                    sqlite3_bind_text(pStmt, 1, (pid as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(pStmt, 2, (vid as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(pStmt, 3, (p.type as NSString).utf8String, -1, nil)
                    sqlite3_bind_text(pStmt, 4, (p.text as NSString).utf8String, -1, nil)
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
            sqlite3_bind_text(stmt, 2, (legacyId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (title as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 4, (color as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 5, (surahs as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 6, (payload as NSString).utf8String, -1, nil)

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
        execute("PRAGMA wal_checkpoint(TRUNCATE);")
        return try Data(contentsOf: databaseURL)
    }

    public func importDatabase(_ data: Data) throws {
        let stagingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("mutshabehat-import-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: stagingURL) }
        try data.write(to: stagingURL, options: .atomic)
        try Self.validateDatabase(at: stagingURL)

        lock.lock()
        defer { lock.unlock() }

        execute("PRAGMA wal_checkpoint(TRUNCATE);")
        let previous = try Data(contentsOf: databaseURL)
        if let db {
            sqlite3_close(db)
            self.db = nil
        }
        removeSidecars()

        do {
            try data.write(to: databaseURL, options: .atomic)
            try reopenDatabase()
            NotificationCenter.default.post(name: Notification.Name("mutshabehatDatabaseDidUpdate"), object: nil)
        } catch {
            try? previous.write(to: databaseURL, options: .atomic)
            try? reopenDatabase()
            throw error
        }
    }

    private func reopenDatabase() throws {
        guard sqlite3_open(databaseURL.path, &db) == SQLITE_OK else {
            db = nil
            throw DatabaseTransferError.databaseUnavailable
        }
        execute("PRAGMA journal_mode = WAL;")
        execute("PRAGMA foreign_keys = ON;")
    }

    private func removeSidecars() {
        for suffix in ["-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
        }
    }

    private static func validateDatabase(at url: URL) throws {
        var candidate: OpaquePointer?
        guard sqlite3_open_v2(url.path, &candidate, SQLITE_OPEN_READWRITE, nil) == SQLITE_OK,
              let candidate else {
            if let candidate { sqlite3_close(candidate) }
            throw DatabaseTransferError.invalidDatabase
        }
        defer { sqlite3_close(candidate) }

        let required = Set(["groups", "verses", "parts", "automated_groups"])
        var found = Set<String>()
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(candidate, "SELECT name FROM sqlite_master WHERE type='table'", -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseTransferError.invalidDatabase
        }
        defer { sqlite3_finalize(statement) }
        while sqlite3_step(statement) == SQLITE_ROW, let value = sqlite3_column_text(statement, 0) {
            found.insert(String(cString: value))
        }
        guard required.isSubset(of: found) else { throw DatabaseTransferError.invalidDatabase }
    }
}

public enum DatabaseTransferError: LocalizedError {
    case databaseUnavailable
    case invalidDatabase

    public var errorDescription: String? {
        switch self {
        case .databaseUnavailable: "تعذر فتح قاعدة البيانات"
        case .invalidDatabase: "الملف ليس قاعدة متشابهات صالحة"
        }
    }
}
