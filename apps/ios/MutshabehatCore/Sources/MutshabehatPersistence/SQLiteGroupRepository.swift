import Foundation
import MutshabehatDomain
import SQLite3

public final class SQLiteGroupRepository: GroupRepository, @unchecked Sendable {
    private let database: SQLiteDatabase

    public init(database: SQLiteDatabase) {
        self.database = database
    }

    public func allGroups() throws -> [Group] {
        try readGroups(
            sql: """
                SELECT id, user_id, title, color, note, unote, status, favorite, completed,
                       created_at, updated_at, source_automated_id
                FROM groups
                ORDER BY created_at DESC, id
                """
        )
    }

    public func group(id: UUID) throws -> Group? {
        let groups = try readGroups(
            sql: """
                SELECT id, user_id, title, color, note, unote, status, favorite, completed,
                       created_at, updated_at, source_automated_id
                FROM groups
                WHERE id = ?
                LIMIT 1
                """,
            binding: uuidText(id)
        )
        return groups.first
    }

    public func verses(inGroup groupID: UUID) throws -> [Verse] {
        let statement = try database.prepare("""
            SELECT id, group_id, surah, ayah, label, sort_order
            FROM verses
            WHERE group_id = ?
            ORDER BY sort_order, id
            """)
        try statement.bind(uuidText(groupID), at: 1)

        var verses: [Verse] = []
        while try statement.step() {
            verses.append(try verse(from: statement))
        }
        return verses
    }

    public func parts(inVerse verseID: UUID) throws -> [Part] {
        let statement = try database.prepare("""
            SELECT id, verse_id, type, text, sort_order
            FROM parts
            WHERE verse_id = ?
            ORDER BY sort_order, id
            """)
        try statement.bind(uuidText(verseID), at: 1)

        var parts: [Part] = []
        while try statement.step() {
            parts.append(try part(from: statement))
        }
        return parts
    }

    public func search(_ query: String) throws -> [Group] {
        let normalized = ArabicText.normalizeArabic(query)
        guard !normalized.isEmpty else { return [] }

        let exact = try searchFTS(column: "norm_text", value: normalized)
        if !exact.isEmpty {
            return exact
        }

        let skeleton = ArabicText.rasmSkeleton(query)
        guard !skeleton.isEmpty else { return [] }
        return try searchFTS(column: "rasm_text", value: skeleton)
    }

    public func upsert(_ group: Group, verses: [Verse], parts: [Part]) throws {
        let verseIDs = Set(verses.map(\.id))
        guard verses.allSatisfy({ $0.groupID == group.id }),
              parts.allSatisfy({ verseIDs.contains($0.verseID) }) else {
            throw SQLiteError(
                code: SQLITE_CONSTRAINT,
                message: "Every verse and part must belong to the aggregate being upserted"
            )
        }

        try database.transaction {
            try upsertGroup(group)
            try deleteExistingChildren(groupID: group.id)
            try insert(verses: verses)
            try insert(parts: parts)
        }
    }

    public func delete(groupID: UUID) throws {
        try database.transaction {
            let deleteFTS = try database.prepare("""
                DELETE FROM parts_fts
                WHERE part_id IN (
                  SELECT parts.id
                  FROM parts
                  JOIN verses ON verses.id = parts.verse_id
                  WHERE verses.group_id = ?
                )
                """)
            try deleteFTS.bind(uuidText(groupID), at: 1)
            try deleteFTS.step()

            let deleteGroup = try database.prepare("DELETE FROM groups WHERE id = ?")
            try deleteGroup.bind(uuidText(groupID), at: 1)
            try deleteGroup.step()
        }
    }

    private func readGroups(sql: String, binding: String? = nil) throws -> [Group] {
        let statement = try database.prepare(sql)
        if let binding {
            try statement.bind(binding, at: 1)
        }

        var groups: [Group] = []
        while try statement.step() {
            groups.append(try group(from: statement))
        }
        return groups
    }

    private func searchFTS(column: String, value: String) throws -> [Group] {
        let sql = """
            SELECT DISTINCT
                   groups.id, groups.user_id, groups.title, groups.color, groups.note, groups.unote,
                   groups.status, groups.favorite, groups.completed, groups.created_at,
                   groups.updated_at, groups.source_automated_id
            FROM parts_fts
            JOIN parts ON parts.id = parts_fts.part_id
            JOIN verses ON verses.id = parts.verse_id
            JOIN groups ON groups.id = verses.group_id
            WHERE parts_fts.\(column) MATCH ?
            ORDER BY groups.created_at DESC, groups.id
            """
        let statement = try database.prepare(sql)
        try statement.bind(ftsPhrase(value), at: 1)

        var groups: [Group] = []
        while try statement.step() {
            groups.append(try group(from: statement))
        }
        return groups
    }

    private func upsertGroup(_ group: Group) throws {
        let statement = try database.prepare("""
            INSERT INTO groups
              (id, user_id, title, color, note, unote, status, favorite, completed,
               created_at, updated_at, source_automated_id, rasm_skeleton)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              user_id = excluded.user_id,
              title = excluded.title,
              color = excluded.color,
              note = excluded.note,
              unote = excluded.unote,
              status = excluded.status,
              favorite = excluded.favorite,
              completed = excluded.completed,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              source_automated_id = excluded.source_automated_id,
              rasm_skeleton = excluded.rasm_skeleton
            """)
        try statement.bind(uuidText(group.id), at: 1)
        try statement.bind(uuidText(group.userID), at: 2)
        try statement.bind(group.title, at: 3)
        try statement.bind(group.color, at: 4)
        try statement.bind(group.note, at: 5)
        try statement.bind(group.unote, at: 6)
        try statement.bind(group.status.rawValue, at: 7)
        try statement.bind(group.favorite, at: 8)
        try statement.bind(group.completed, at: 9)
        try statement.bind(SQLiteCoding.string(from: group.createdAt), at: 10)
        try statement.bind(SQLiteCoding.string(from: group.updatedAt), at: 11)
        if let sourceAutomatedID = group.sourceAutomatedID {
            try statement.bind(sourceAutomatedID, at: 12)
        } else {
            try statement.bindNull(at: 12)
        }
        try statement.bind(ArabicText.rasmSkeleton(group.title), at: 13)
        try statement.step()
    }

    private func deleteExistingChildren(groupID: UUID) throws {
        let deleteFTS = try database.prepare("""
            DELETE FROM parts_fts
            WHERE part_id IN (
              SELECT parts.id
              FROM parts
              JOIN verses ON verses.id = parts.verse_id
              WHERE verses.group_id = ?
            )
            """)
        try deleteFTS.bind(uuidText(groupID), at: 1)
        try deleteFTS.step()

        let deleteVerses = try database.prepare("DELETE FROM verses WHERE group_id = ?")
        try deleteVerses.bind(uuidText(groupID), at: 1)
        try deleteVerses.step()
    }

    private func insert(verses: [Verse]) throws {
        let statement = try database.prepare("""
            INSERT INTO verses (id, group_id, surah, ayah, label, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
            """)
        for verse in verses {
            try statement.bind(uuidText(verse.id), at: 1)
            try statement.bind(uuidText(verse.groupID), at: 2)
            try statement.bind(verse.surah, at: 3)
            try statement.bind(verse.ayah, at: 4)
            try statement.bind(verse.label, at: 5)
            try statement.bind(verse.sortOrder, at: 6)
            try statement.step()
            try statement.reset()
        }
    }

    private func insert(parts: [Part]) throws {
        let insertPart = try database.prepare("""
            INSERT INTO parts (id, verse_id, type, text, sort_order, rasm_skeleton)
            VALUES (?, ?, ?, ?, ?, ?)
            """)
        let insertFTS = try database.prepare("""
            INSERT INTO parts_fts (norm_text, rasm_text, part_id)
            VALUES (?, ?, ?)
            """)

        for part in parts {
            let skeleton = ArabicText.rasmSkeleton(part.text)
            try insertPart.bind(uuidText(part.id), at: 1)
            try insertPart.bind(uuidText(part.verseID), at: 2)
            try insertPart.bind(part.type.rawValue, at: 3)
            try insertPart.bind(part.text, at: 4)
            try insertPart.bind(part.sortOrder, at: 5)
            try insertPart.bind(skeleton, at: 6)
            try insertPart.step()
            try insertPart.reset()

            try insertFTS.bind(ArabicText.normalizeArabic(part.text), at: 1)
            try insertFTS.bind(skeleton, at: 2)
            try insertFTS.bind(uuidText(part.id), at: 3)
            try insertFTS.step()
            try insertFTS.reset()
        }
    }

    private func group(from statement: SQLiteStatement) throws -> Group {
        guard let id = uuid(at: 0, statement: statement),
              let userID = uuid(at: 1, statement: statement),
              let title = statement.string(at: 2),
              let color = statement.string(at: 3),
              let statusValue = statement.string(at: 6),
              let status = GroupStatus(rawValue: statusValue),
              let createdValue = statement.string(at: 9),
              let createdAt = SQLiteCoding.date(from: createdValue),
              let updatedValue = statement.string(at: 10),
              let updatedAt = SQLiteCoding.date(from: updatedValue) else {
            throw corruptRow("groups")
        }

        return Group(
            id: id,
            userID: userID,
            title: title,
            color: color,
            note: statement.string(at: 4),
            unote: statement.string(at: 5),
            status: status,
            favorite: statement.bool(at: 7),
            completed: statement.bool(at: 8),
            createdAt: createdAt,
            updatedAt: updatedAt,
            sourceAutomatedID: statement.isNull(at: 11) ? nil : statement.int64(at: 11)
        )
    }

    private func verse(from statement: SQLiteStatement) throws -> Verse {
        guard let id = uuid(at: 0, statement: statement),
              let groupID = uuid(at: 1, statement: statement),
              let surah = statement.string(at: 2) else {
            throw corruptRow("verses")
        }
        return Verse(
            id: id,
            groupID: groupID,
            surah: surah,
            ayah: statement.int(at: 3),
            label: statement.string(at: 4),
            sortOrder: statement.int(at: 5)
        )
    }

    private func part(from statement: SQLiteStatement) throws -> Part {
        guard let id = uuid(at: 0, statement: statement),
              let verseID = uuid(at: 1, statement: statement),
              let typeValue = statement.string(at: 2),
              let type = PartType(rawValue: typeValue),
              let text = statement.string(at: 3) else {
            throw corruptRow("parts")
        }
        return Part(
            id: id,
            verseID: verseID,
            type: type,
            text: text,
            sortOrder: statement.int(at: 4)
        )
    }
}

func uuidText(_ uuid: UUID) -> String {
    uuid.uuidString.lowercased()
}

func uuid(at column: Int32, statement: SQLiteStatement) -> UUID? {
    statement.string(at: column).flatMap(UUID.init(uuidString:))
}

func corruptRow(_ table: String) -> SQLiteError {
    SQLiteError(code: SQLITE_MISMATCH, message: "Invalid value in \(table) row")
}

private func ftsPhrase(_ value: String) -> String {
    "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
}

enum SQLiteCoding {
    private static let dateFormatter = LockedISO8601DateFormatter()

    static func string(from date: Date) -> String {
        dateFormatter.string(from: date)
    }

    static func date(from value: String) -> Date? {
        dateFormatter.date(from: value)
    }
}

private final class LockedISO8601DateFormatter: @unchecked Sendable {
    private let lock = NSLock()
    private let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    func string(from date: Date) -> String {
        lock.lock()
        defer { lock.unlock() }
        return formatter.string(from: date)
    }

    func date(from value: String) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        return formatter.date(from: value)
    }
}
