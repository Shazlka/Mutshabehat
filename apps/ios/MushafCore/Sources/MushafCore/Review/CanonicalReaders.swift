#if DEBUG
import Foundation

public struct CanonicalNarrator: Hashable, Sendable {
    public let id: String
    public let nameAr: String
    public let nameShort: String
}

public struct CanonicalReader: Hashable, Sendable {
    public let id: String
    public let nameAr: String
    public let nameShort: String
    public let color: String
    public let narrators: [CanonicalNarrator]
}

/// The ten readers and twenty narrators, in the web's `CANONICAL_READERS` order (checked against it by a
/// golden test). Narrator names are the disambiguated ones: never a bare «خلف» or «الدوري».
public enum CanonicalReaders {
    public static let hafsId = "Q05-R02"

    private static func reader(_ id: String, _ nameAr: String, _ short: String, _ color: String,
                               _ a: (String, String), _ b: (String, String)) -> CanonicalReader {
        CanonicalReader(id: id, nameAr: nameAr, nameShort: short, color: color, narrators: [
            CanonicalNarrator(id: "\(id)-R01", nameAr: a.0, nameShort: a.1),
            CanonicalNarrator(id: "\(id)-R02", nameAr: b.0, nameShort: b.1),
        ])
    }

    public static let all: [CanonicalReader] = [
        reader("Q01", "نافع المدني", "نافع", "#2563EB", ("قالون", "قالون"), ("ورش", "ورش")),
        reader("Q02", "ابن كثير المكي", "ابن كثير", "#16A34A", ("البزي", "البزي"), ("قنبل", "قنبل")),
        reader("Q03", "أبو عمرو البصري", "أبو عمرو", "#0891B2",
               ("الدوري عن أبي عمرو", "الدوري"), ("السوسي", "السوسي")),
        reader("Q04", "ابن عامر الشامي", "ابن عامر", "#7C3AED", ("هشام", "هشام"), ("ابن ذكوان", "ابن ذكوان")),
        reader("Q05", "عاصم الكوفي", "عاصم", "#EA580C", ("شعبة", "شعبة"), ("حفص", "حفص")),
        reader("Q06", "حمزة الكوفي", "حمزة", "#DC2626", ("خلف عن حمزة", "خلف"), ("خلاد", "خلاد")),
        reader("Q07", "الكسائي الكوفي", "الكسائي", "#DB2777",
               ("أبو الحارث", "أبو الحارث"), ("الدوري عن الكسائي", "الدوري")),
        reader("Q08", "أبو جعفر المدني", "أبو جعفر", "#CA8A04", ("ابن وردان", "ابن وردان"), ("ابن جماز", "ابن جماز")),
        reader("Q09", "يعقوب الحضرمي", "يعقوب", "#B45309", ("رويس", "رويس"), ("روح", "روح")),
        reader("Q10", "خلف العاشر", "خلف العاشر", "#475569", ("إسحاق", "إسحاق"), ("إدريس", "إدريس")),
    ]

    public static let allNarratorIds: [String] = all.flatMap { $0.narrators.map(\.id) }

    public static func narratorIds(ofReader readerId: String) -> [String] {
        all.first { $0.id == readerId }?.narrators.map(\.id) ?? []
    }

    public static func narratorName(_ id: String) -> String? {
        all.lazy.flatMap(\.narrators).first { $0.id == id }?.nameAr
    }
}
#endif
