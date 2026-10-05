import Foundation

public enum HistorySummary {
    public static func title(_ tx: HistoryTransaction) -> String {
        details(tx).first ?? "تعديل مسجّل"
    }

    public static func details(_ tx: HistoryTransaction) -> [String] {
        tx.changes.map(summary)
    }

    private static func summary(_ change: HistoryChange) -> String {
        if ["qiraat_entry_authorities", "qiraat_entry_narrators", "qiraat_reading_narrators"].contains(change.table) {
            return "تعديل الرواة"
        }
        guard ["qiraat_entries", "qiraat_loci", "qiraat_variant_details", "qiraat_ruling_details"].contains(change.table) else { return "تعديل مسجّل" }
        let subject = change.table == "qiraat_loci" ? "موضع" : "وجه"
        if change.op == "INSERT" { return "إضافة \(subject)" }
        if change.op == "DELETE" { return "حذف \(subject)" }
        guard change.op == "UPDATE", let field = change.field else { return "تعديل مسجّل" }
        if field == "deleted_at" {
            return change.new == .null ? "استعادة \(subject)" : "حذف \(subject)"
        }
        if field == "review_status" {
            return "تعديل الحالة: \(status(change.old)) ← \(status(change.new))"
        }
        if field == "narrators" { return "تعديل الرواة" }
        let labels = [
            "reading_text": "نص القراءة", "uthmani_text": "الرسم العثماني", "description": "الوصف",
            "performance_note": "الأداء", "ruling_text": "الحكم", "notes": "الملاحظات",
            "category_code": "الباب", "category_id": "الباب", "variant_type": "نوع الاختلاف",
            "kind": "نوع الوجه", "applies_wasl": "الوصل", "applies_waqf": "الوقف",
            "hamzah_detail": "تفاصيل الهمز", "verification_status": "حالة التوثيق",
        ]
        guard let label = labels[field] else { return "تعديل مسجّل" }
        return "تعديل \(label): \(value(change.old)) ← \(value(change.new))"
    }

    private static func status(_ value: JSONValue) -> String {
        switch value {
        case .string("unreviewed"): "غير مراجَع"
        case .string("reviewed"): "مُراجَع"
        case .string("flagged"): "معلَّم"
        default: self.value(value)
        }
    }

    private static func value(_ value: JSONValue) -> String {
        switch value {
        case .null: "—"
        case .string(let text): text.components(separatedBy: .newlines).joined(separator: " ")
        case .bool(let flag): flag ? "نعم" : "لا"
        case .number(let number): number.formatted(.number.locale(Locale(identifier: "ar")))
        case .array(let items): "قائمة (\(items.count))"
        case .object: "بيانات مفصّلة"
        }
    }
}
