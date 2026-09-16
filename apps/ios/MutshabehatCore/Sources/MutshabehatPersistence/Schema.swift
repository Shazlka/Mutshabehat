import SQLite3

public enum Schema {
    private typealias Migration = @Sendable (SQLiteDatabase) throws -> Void

    private static let migrations: [Migration] = [migrationOne]

    public static func migrate(_ database: SQLiteDatabase) throws {
        let currentVersion = try userVersion(in: database)
        guard currentVersion <= migrations.count else {
            throw SQLiteError(
                code: SQLITE_ERROR,
                message: "Database user_version \(currentVersion) is newer than supported version \(migrations.count)"
            )
        }

        guard currentVersion < migrations.count else { return }
        for index in currentVersion..<migrations.count {
            try database.transaction {
                try migrations[index](database)
                try database.exec("PRAGMA user_version = \(index + 1)")
            }
        }
    }

    private static func userVersion(in database: SQLiteDatabase) throws -> Int {
        let statement = try database.prepare("PRAGMA user_version")
        guard try statement.step() else {
            throw SQLiteError(code: SQLITE_ERROR, message: "PRAGMA user_version returned no row")
        }
        return statement.int(at: 0)
    }

    private static func migrationOne(_ database: SQLiteDatabase) throws {
        try database.exec("""
            CREATE TABLE groups (
              id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL,
              title TEXT NOT NULL, color TEXT NOT NULL,
              note TEXT, unote TEXT,
              status TEXT NOT NULL CHECK (status IN ('draft','published','locked')),
              favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0,1)),
              completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
              source_automated_id INTEGER,
              rasm_skeleton TEXT
            );

            CREATE TABLE verses (
              id TEXT PRIMARY KEY NOT NULL,
              group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
              surah TEXT NOT NULL, ayah INTEGER NOT NULL,
              label TEXT, sort_order INTEGER NOT NULL
            );
            CREATE INDEX verses_group_idx ON verses(group_id, sort_order);

            CREATE TABLE parts (
              id TEXT PRIMARY KEY NOT NULL,
              verse_id TEXT NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
              type TEXT NOT NULL CHECK (type IN ('shared','diff','diff2','diff3','addition','unique','normal')),
              text TEXT NOT NULL, sort_order INTEGER NOT NULL,
              rasm_skeleton TEXT
            );
            CREATE INDEX parts_verse_idx ON parts(verse_id, sort_order);

            CREATE TABLE mushaf_annotations (
              id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL,
              annotation_type TEXT NOT NULL CHECK (annotation_type IN ('note','highlight','bookmark','favorite')),
              target_type TEXT NOT NULL CHECK (target_type IN ('ayah','word','word-range')),
              ayah_key TEXT NOT NULL, page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 604),
              word_id TEXT, line_number INTEGER, word_index_in_line INTEGER,
              word_range_start_id TEXT, word_range_end_id TEXT,
              title TEXT, body TEXT, text_color TEXT, background_color TEXT,
              tags TEXT NOT NULL DEFAULT '[]', metadata TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
              CHECK (target_type <> 'word' OR (word_id IS NOT NULL AND line_number IS NOT NULL AND word_index_in_line IS NOT NULL)),
              CHECK (target_type <> 'word-range' OR (word_range_start_id IS NOT NULL AND word_range_end_id IS NOT NULL))
            );
            CREATE INDEX annotations_page_idx ON mushaf_annotations(page_number, annotation_type);
            CREATE INDEX annotations_ayah_idx ON mushaf_annotations(ayah_key, annotation_type);

            CREATE VIRTUAL TABLE parts_fts USING fts5(
              norm_text, rasm_text, part_id UNINDEXED, tokenize = 'unicode61'
            );
            """)
    }
}
