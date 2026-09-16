import Foundation
import MutshabehatDomain
import MutshabehatPersistence
import Testing

func makeMigratedDatabase() throws -> SQLiteDatabase {
    let database = try SQLiteDatabase(path: ":memory:")
    try Schema.migrate(database)
    return database
}

func scalarInt(_ database: SQLiteDatabase, sql: String) throws -> Int64 {
    let statement = try database.prepare(sql)
    guard try statement.step() else {
        throw SQLiteError(code: -1, message: "Expected one row for scalar query")
    }
    return statement.int64(at: 0)
}

@Suite("SQLite schema")
struct SchemaTests {
    @Test("Migration 1 runs from empty and is idempotent")
    func migrationOneIsIdempotent() throws {
        let database = try SQLiteDatabase(path: ":memory:")
        try Schema.migrate(database)
        #expect(try scalarInt(database, sql: "PRAGMA user_version") == 1)
        try Schema.migrate(database)
        #expect(try scalarInt(database, sql: "PRAGMA user_version") == 1)
    }

    @Test("Foreign keys are enabled and group deletion cascades")
    func foreignKeysAndCascade() throws {
        let database = try makeMigratedDatabase()
        #expect(try scalarInt(database, sql: "PRAGMA foreign_keys") == 1)
        try database.exec("""
            INSERT INTO groups
              (id, user_id, title, color, status, favorite, completed, created_at, updated_at)
            VALUES
              ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
               'group', '#ffffff', 'draft', 0, 0, '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z');
            INSERT INTO verses (id, group_id, surah, ayah, sort_order)
            VALUES ('00000000-0000-0000-0000-000000000003',
                    '00000000-0000-0000-0000-000000000001', 'البقرة', 1, 0);
            INSERT INTO parts (id, verse_id, type, text, sort_order)
            VALUES ('00000000-0000-0000-0000-000000000004',
                    '00000000-0000-0000-0000-000000000003', 'shared', 'الم', 0);
            DELETE FROM groups WHERE id = '00000000-0000-0000-0000-000000000001';
            """)
        #expect(try scalarInt(database, sql: "SELECT count(*) FROM verses") == 0)
        #expect(try scalarInt(database, sql: "SELECT count(*) FROM parts") == 0)
    }
}

enum ConstraintCase: String, CaseIterable, Sendable, CustomStringConvertible {
    case badStatus
    case badPartType
    case pageOutOfRange
    case wordMissingShape
    var description: String { rawValue }
}

@Suite("SQLite constraints")
struct SchemaConstraintTests {
    @Test("Invalid values are rejected", arguments: ConstraintCase.allCases)
    func invalidValueIsRejected(_ constraint: ConstraintCase) throws {
        let database = try makeMigratedDatabase()
        switch constraint {
        case .badStatus:
            #expect(throws: SQLiteError.self) {
                try database.exec("""
                    INSERT INTO groups
                      (id, user_id, title, color, status, favorite, completed, created_at, updated_at)
                    VALUES
                      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
                       'group', '#fff', 'invalid', 0, 0, '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z')
                    """)
            }
        case .badPartType:
            try insertConstraintParents(in: database)
            #expect(throws: SQLiteError.self) {
                try database.exec("""
                    INSERT INTO parts (id, verse_id, type, text, sort_order)
                    VALUES ('00000000-0000-0000-0000-000000000004',
                            '00000000-0000-0000-0000-000000000003', 'invalid', 'text', 0)
                    """)
            }
        case .pageOutOfRange:
            #expect(throws: SQLiteError.self) {
                try database.exec(annotationSQL(pageNumber: 999, targetType: "ayah"))
            }
        case .wordMissingShape:
            #expect(throws: SQLiteError.self) {
                try database.exec(annotationSQL(pageNumber: 1, targetType: "word"))
            }
        }
    }

    private func insertConstraintParents(in database: SQLiteDatabase) throws {
        try database.exec("""
            INSERT INTO groups
              (id, user_id, title, color, status, favorite, completed, created_at, updated_at)
            VALUES
              ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
               'group', '#fff', 'draft', 0, 0, '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z');
            INSERT INTO verses (id, group_id, surah, ayah, sort_order)
            VALUES ('00000000-0000-0000-0000-000000000003',
                    '00000000-0000-0000-0000-000000000001', 'البقرة', 1, 0);
            """)
    }

    private func annotationSQL(pageNumber: Int, targetType: String) -> String {
        """
        INSERT INTO mushaf_annotations
          (id, user_id, annotation_type, target_type, ayah_key, page_number,
           tags, metadata, created_at, updated_at)
        VALUES
          ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002',
           'note', '\(targetType)', '1:1', \(pageNumber), '[]', '{}',
           '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z')
        """
    }
}
