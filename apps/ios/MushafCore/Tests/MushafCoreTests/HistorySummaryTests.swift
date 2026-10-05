import Foundation
import Testing
@testable import MushafCore

struct HistorySummaryTests {
    private func transaction(_ change: String, undone: Bool = false) throws -> HistoryTransaction {
        try JSONDecoder().decode(HistoryTransaction.self, from: Data("""
        {"txid":1,"at":"2026-10-05T10:00:00Z","undone":\(undone),"changes":[\(change)]}
        """.utf8))
    }

    @Test func statusUpdate() throws {
        let tx = try transaction(#"{"table":"qiraat_entries","op":"UPDATE","field":"review_status","old":"unreviewed","new":"reviewed"}"#)
        #expect(HistorySummary.title(tx) == "تعديل الحالة: غير مراجَع ← مُراجَع")
    }

    @Test func entryInserted() throws {
        let tx = try transaction(#"{"table":"qiraat_entries","op":"INSERT","new":{"id":"e1"}}"#)
        #expect(HistorySummary.title(tx) == "إضافة وجه")
    }

    @Test func softDeleteAndRestore() throws {
        let deleted = try transaction(#"{"table":"qiraat_entries","op":"UPDATE","field":"deleted_at","new":"2026-10-05"}"#)
        let restored = try transaction(#"{"table":"qiraat_entries","op":"UPDATE","field":"deleted_at","old":"2026-10-05","new":null}"#)
        #expect(HistorySummary.title(deleted) == "حذف وجه")
        #expect(HistorySummary.title(restored) == "استعادة وجه")
    }

    @Test func narratorsChanged() throws {
        let tx = try transaction(#"{"table":"qiraat_entry_authorities","op":"INSERT","new":{"narrator_id":"Q01-R02"}}"#)
        #expect(HistorySummary.title(tx) == "تعديل الرواة")
    }

    @Test func unknownTableAndField() throws {
        for change in [#"{"table":"future_table","op":"UPDATE","field":"value"}"#,
                       #"{"table":"qiraat_entries","op":"UPDATE","field":"future_field"}"#] {
            #expect(HistorySummary.title(try transaction(change)) == "تعديل مسجّل")
        }
    }

    @Test func arbitraryValuesAreSafe() throws {
        for value in ["null", "[]", #"{"nested":[null,{},true]}"#, "true", "42"] {
            let tx = try transaction("""
            {"table":"qiraat_entries","op":"UPDATE","field":"notes","old":null,"new":\(value)}
            """)
            #expect(HistorySummary.title(tx).hasPrefix("تعديل الملاحظات:"))
            #expect(HistorySummary.details(tx).count == 1)
        }
    }

    @Test func fieldEditsOnDetailTables() throws {
        let tx = try transaction(#"{"table":"qiraat_variant_details","op":"UPDATE","field":"reading_text","old":"قديم","new":"جديد"}"#)
        #expect(HistorySummary.title(tx) == "تعديل نص القراءة: قديم ← جديد")
        let ruling = try transaction(#"{"table":"qiraat_ruling_details","op":"UPDATE","field":"ruling_text","old":null,"new":"النقل"}"#)
        #expect(HistorySummary.title(ruling) == "تعديل الحكم: — ← النقل")
    }

    @Test func undoneKeepsOriginalSummary() throws {
        let tx = try transaction(#"{"table":"qiraat_entries","op":"INSERT"}"#, undone: true)
        #expect(HistorySummary.title(tx) == "إضافة وجه")
        #expect(HistorySummary.details(tx) == ["إضافة وجه"])
    }
}
