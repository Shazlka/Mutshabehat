import Foundation
import MushafCore

/// Pure logic for Qiraat word sheet classification lines, sub-categories, and ruling explanations.
public enum QiraatClassification {
    public static let farshCategoryTitle = "فرش الحروف"
    public static let usulCategoryTitle = "أصول القراءات"

    /// Maps `differenceType` to the standard Arabic sub-category for farsh variants:
    /// HARAKAH→تشكيل, LETTER→إبدال حرف, ADDITION→زيادة حرف, OMISSION→حذف حرف, WORD_FORM or reorder→تقديم وتأخير, everything else→أخرى.
    public static func subCategory(for differenceType: String?) -> String {
        guard let raw = differenceType?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else {
            return "أخرى"
        }
        switch raw.uppercased() {
        case "HARAKAH":
            return "تشكيل"
        case "LETTER":
            return "إبدال حرف"
        case "ADDITION":
            return "زيادة حرف"
        case "OMISSION":
            return "حذف حرف"
        case "WORD_FORM", "REORDER":
            return "تقديم وتأخير"
        default:
            return "أخرى"
        }
    }

    /// Sub-category for a given farsh variant.
    public static func subCategory(for variant: QiraatVariant) -> String {
        subCategory(for: variant.differenceType)
    }

    /// Classification segments for a farsh variant: [«فرش الحروف», «{sub-category}»].
    public static func classificationSegments(for variant: QiraatVariant) -> [String] {
        [farshCategoryTitle, subCategory(for: variant)]
    }

    /// Classification text for a farsh variant: «فرش الحروف › {sub-category}».
    public static func classification(for variant: QiraatVariant) -> String {
        classificationSegments(for: variant).joined(separator: " › ")
    }

    /// Normalizes Arabic text by stripping diacritics, tatweel, and whitespace for comparison.
    private static func normalizeArabic(_ value: String) -> String {
        var result = ""
        for scalar in value.unicodeScalars {
            // Strip tashkeel (0x064B...0x065F), superscript alef (0x0670), tatweel (0x0640)
            if (0x064B...0x065F).contains(scalar.value) || scalar.value == 0x0670 || scalar.value == 0x0640 {
                continue
            }
            // Unify alef variants (0x0622 = آ, 0x0623 = أ, 0x0625 = إ, 0x0671 = ٱ) to bare alef (0x0627 = ا)
            if scalar.value == 0x0622 || scalar.value == 0x0623 || scalar.value == 0x0625 || scalar.value == 0x0671 {
                result.append(Character(UnicodeScalar(0x0627)!))
            } else {
                result.append(Character(scalar))
            }
        }
        return result.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    /// Whether an action text adds informative detail beyond repeating the ruling's category.
    public static func actionAddsInformation(_ action: String, categoryAr: String) -> Bool {
        let normAction = normalizeArabic(action)
        let normCategory = normalizeArabic(categoryAr)
        return !normAction.isEmpty && normAction != normCategory
    }

    /// Distinct non-empty action texts from a ruling's attributions and readings.
    public static func distinctActions(for ruling: QiraatRuling) -> [String] {
        var actions: [String] = []
        for group in ruling.attributionByAction {
            let action = group.action.trimmingCharacters(in: .whitespacesAndNewlines)
            if !action.isEmpty && !actions.contains(action) {
                actions.append(action)
            }
        }
        if actions.isEmpty {
            for entry in ruling.attribution {
                if let action = entry.action?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !action.isEmpty, !actions.contains(action) {
                    actions.append(action)
                }
            }
        }
        if actions.isEmpty {
            for reading in ruling.readings {
                let action = reading.action.trimmingCharacters(in: .whitespacesAndNewlines)
                if !action.isEmpty && !actions.contains(action) {
                    actions.append(action)
                }
            }
        }
        return actions
    }

    /// The sub-detail for an usul ruling: the reading's action text when it adds information
    /// (e.g. إمالة، تقليل، صلة وصلاً), or nil if it merely repeats the category.
    public static func subDetail(for ruling: QiraatRuling) -> String? {
        let informative = distinctActions(for: ruling).filter {
            actionAddsInformation($0, categoryAr: ruling.categoryAr)
        }
        // A long sentence, or several different ones, are shown in full under each reader group; repeating them
        // in the classification line would only duplicate text. The line carries a short label such as إمالة.
        guard informative.count == 1, let only = informative.first, only.count <= 24 else { return nil }
        return only
    }

    /// Classification segments for an usul ruling: [«أصول القراءات», «{باب}»] or [«أصول القراءات», «{باب}», «{sub-detail}»].
    public static func classificationSegments(for ruling: QiraatRuling) -> [String] {
        var segments = [usulCategoryTitle, ruling.categoryAr]
        if let detail = subDetail(for: ruling), !detail.isEmpty {
            segments.append(detail)
        }
        return segments
    }

    /// Classification text for an usul ruling: «أصول القراءات › {باب} › {sub-detail}» or «أصول القراءات › {باب}».
    public static func classification(for ruling: QiraatRuling) -> String {
        classificationSegments(for: ruling).joined(separator: " › ")
    }

    /// Whether an action label should be displayed in the card explanation.
    /// Unlike the legacy `isRedundantActionLabel`, an action is never dropped simply because
    /// it repeats the category; it is shown once under the category line.
    public static func shouldShowAction(_ action: String?, categoryAr: String) -> Bool {
        guard let action = action?.trimmingCharacters(in: .whitespacesAndNewlines), !action.isEmpty else {
            return false
        }
        return true
    }

    /// Every distinct action text to show in the ruling's explanation section.
    public static func explanationActions(for ruling: QiraatRuling) -> [String] {
        distinctActions(for: ruling)
    }
}
