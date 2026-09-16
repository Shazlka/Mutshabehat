import Foundation
import MutshabehatDomain

public final class SQLiteAnnotationRepository: AnnotationRepository, @unchecked Sendable {
    private let database: SQLiteDatabase

    public init(database: SQLiteDatabase) {
        self.database = database
    }

    public func annotations(page: PageNumber) throws -> [Annotation] {
        try annotations(where: "page_number = ?", value: String(page.rawValue))
    }

    public func annotations(ayah: AyahKey) throws -> [Annotation] {
        try annotations(where: "ayah_key = ?", value: ayah.rawValue)
    }

    public func upsert(_ annotation: Annotation) throws {
        let tagsData = try JSONEncoder().encode(annotation.tags)
        guard let tags = String(data: tagsData, encoding: .utf8),
              let metadata = String(data: annotation.metadata, encoding: .utf8) else {
            throw SQLiteError(code: 20, message: "Annotation JSON must be valid UTF-8")
        }

        let statement = try database.prepare("""
            INSERT INTO mushaf_annotations
              (id, user_id, annotation_type, target_type, ayah_key, page_number,
               word_id, line_number, word_index_in_line, word_range_start_id, word_range_end_id,
               title, body, text_color, background_color, tags, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              user_id = excluded.user_id,
              annotation_type = excluded.annotation_type,
              target_type = excluded.target_type,
              ayah_key = excluded.ayah_key,
              page_number = excluded.page_number,
              word_id = excluded.word_id,
              line_number = excluded.line_number,
              word_index_in_line = excluded.word_index_in_line,
              word_range_start_id = excluded.word_range_start_id,
              word_range_end_id = excluded.word_range_end_id,
              title = excluded.title,
              body = excluded.body,
              text_color = excluded.text_color,
              background_color = excluded.background_color,
              tags = excluded.tags,
              metadata = excluded.metadata,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
            """)
        try statement.bind(uuidText(annotation.id), at: 1)
        try statement.bind(uuidText(annotation.userID), at: 2)
        try statement.bind(annotation.annotationType.rawValue, at: 3)
        try statement.bind(annotation.targetType.rawValue, at: 4)
        try statement.bind(annotation.ayahKey.rawValue, at: 5)
        try statement.bind(annotation.pageNumber.rawValue, at: 6)
        try statement.bind(annotation.wordID, at: 7)
        try bind(annotation.lineNumber, to: statement, at: 8)
        try bind(annotation.wordIndexInLine, to: statement, at: 9)
        try statement.bind(annotation.wordRangeStartID, at: 10)
        try statement.bind(annotation.wordRangeEndID, at: 11)
        try statement.bind(annotation.title, at: 12)
        try statement.bind(annotation.body, at: 13)
        try statement.bind(annotation.textColor, at: 14)
        try statement.bind(annotation.backgroundColor, at: 15)
        try statement.bind(tags, at: 16)
        try statement.bind(metadata, at: 17)
        try statement.bind(SQLiteCoding.string(from: annotation.createdAt), at: 18)
        try statement.bind(SQLiteCoding.string(from: annotation.updatedAt), at: 19)
        try statement.step()
    }

    public func delete(id: UUID) throws {
        let statement = try database.prepare("DELETE FROM mushaf_annotations WHERE id = ?")
        try statement.bind(uuidText(id), at: 1)
        try statement.step()
    }

    private func annotations(where predicate: String, value: String) throws -> [Annotation] {
        let statement = try database.prepare("""
            SELECT id, user_id, annotation_type, target_type, ayah_key, page_number,
                   word_id, line_number, word_index_in_line, word_range_start_id, word_range_end_id,
                   title, body, text_color, background_color, tags, metadata, created_at, updated_at
            FROM mushaf_annotations
            WHERE \(predicate)
            ORDER BY updated_at DESC, id
            """)
        try statement.bind(value, at: 1)

        var values: [Annotation] = []
        while try statement.step() {
            values.append(try annotation(from: statement))
        }
        return values
    }

    private func annotation(from statement: SQLiteStatement) throws -> Annotation {
        guard let id = uuid(at: 0, statement: statement),
              let userID = uuid(at: 1, statement: statement),
              let annotationTypeValue = statement.string(at: 2),
              let annotationType = AnnotationType(rawValue: annotationTypeValue),
              let targetTypeValue = statement.string(at: 3),
              let targetType = AnnotationTarget(rawValue: targetTypeValue),
              let ayahKeyValue = statement.string(at: 4),
              let ayahKey = AyahKey(ayahKeyValue),
              let pageNumber = PageNumber(statement.int(at: 5)),
              let tagsValue = statement.string(at: 15),
              let tagsData = tagsValue.data(using: .utf8),
              let tags = try? JSONDecoder().decode([String].self, from: tagsData),
              let metadataValue = statement.string(at: 16),
              let createdValue = statement.string(at: 17),
              let createdAt = SQLiteCoding.date(from: createdValue),
              let updatedValue = statement.string(at: 18),
              let updatedAt = SQLiteCoding.date(from: updatedValue) else {
            throw corruptRow("mushaf_annotations")
        }

        return Annotation(
            id: id,
            userID: userID,
            annotationType: annotationType,
            targetType: targetType,
            ayahKey: ayahKey,
            pageNumber: pageNumber,
            wordID: statement.string(at: 6),
            lineNumber: statement.isNull(at: 7) ? nil : statement.int(at: 7),
            wordIndexInLine: statement.isNull(at: 8) ? nil : statement.int(at: 8),
            wordRangeStartID: statement.string(at: 9),
            wordRangeEndID: statement.string(at: 10),
            title: statement.string(at: 11),
            body: statement.string(at: 12),
            textColor: statement.string(at: 13),
            backgroundColor: statement.string(at: 14),
            tags: tags,
            metadata: Data(metadataValue.utf8),
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    private func bind(_ value: Int?, to statement: SQLiteStatement, at index: Int32) throws {
        if let value {
            try statement.bind(value, at: index)
        } else {
            try statement.bindNull(at: index)
        }
    }
}
