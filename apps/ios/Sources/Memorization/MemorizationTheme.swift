import MushafCore
import SwiftUI
import UIKit

/// The look and wording of memorization: a restrained palette that never competes with the Qiraat reader
/// colours, one shape per status (so nothing depends on colour alone) and the Arabic/English labels.
enum MemorizationTheme {
    static func uiColor(_ status: MemorizationStatus) -> UIColor {
        switch status {
        case .mastered:
            UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.42, green: 0.74, blue: 0.56, alpha: 1)
                                                      : UIColor(red: 0.10, green: 0.42, blue: 0.29, alpha: 1) }
        case .memorizedWithErrors:
            UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.88, green: 0.70, blue: 0.35, alpha: 1)
                                                      : UIColor(red: 0.72, green: 0.47, blue: 0.10, alpha: 1) }
        case .needsMushaf:
            UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.62, green: 0.69, blue: 0.76, alpha: 1)
                                                      : UIColor(red: 0.33, green: 0.41, blue: 0.48, alpha: 1) }
        case .notMemorized:
            UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.62, alpha: 1) : UIColor(white: 0.50, alpha: 1) }
        }
    }

    static func color(_ status: MemorizationStatus) -> Color { Color(uiColor: uiColor(status)) }

    /// ✓✓ mastered, ! with errors, ◐ needs the Mushaf, ○ not memorized.
    static func shape(_ status: MemorizationStatus) -> String {
        switch status {
        case .mastered: "✓✓"
        case .memorizedWithErrors: "!"
        case .needsMushaf: "◐"
        case .notMemorized: "○"
        }
    }

    static func label(_ status: MemorizationStatus, language: AppLanguage) -> String {
        switch (status, language) {
        case (.mastered, .arabic): "متقن"
        case (.memorizedWithErrors, .arabic): "محفوظ مع أخطاء"
        case (.needsMushaf, .arabic): "يحتاج المصحف"
        case (.notMemorized, .arabic): "غير محفوظ"
        case (.mastered, .english): "Mastered"
        case (.memorizedWithErrors, .english): "Memorized with errors"
        case (.needsMushaf, .english): "Needs Mushaf"
        case (.notMemorized, .english): "Not memorized"
        }
    }

    /// A shorter wording for the narrow banner mark.
    static func shortLabel(_ status: MemorizationStatus, language: AppLanguage) -> String {
        switch (status, language) {
        case (.memorizedWithErrors, .arabic): "مع أخطاء"
        case (.memorizedWithErrors, .english): "With errors"
        default: label(status, language: language)
        }
    }

    /// Arabic-Indic digits with thousands separators for Arabic, plain digits for English (like the page numbers).
    static func number(_ value: Int, language: AppLanguage) -> String {
        let text = value.formatted(.number.locale(Locale(identifier: "en_US")))
        guard language == .arabic else { return text }
        return String(text.unicodeScalars.map { scalar -> Character in
            if let digit = Int(String(scalar)) { return Character(UnicodeScalar(0x0660 + digit)!) }
            return scalar == "," ? "٬" : Character(scalar)
        })
    }

    /// A percentage with one decimal: «٣٨٫٧٪» in Arabic, "38.7%" in English.
    static func percent(_ value: Double, language: AppLanguage) -> String {
        let clamped = min(100, max(0, value))
        let text = String(format: "%.1f", clamped)
        switch language {
        case .english: return text + "%"
        case .arabic:
            let mapped = text.unicodeScalars.map { scalar -> Character in
                if let digit = Int(String(scalar)) { return Character(UnicodeScalar(0x0660 + digit)!) }
                return scalar == "." ? "٫" : Character(scalar)
            }
            return String(mapped) + "٪"
        }
    }

    /// One decimal for page-equivalents («٢٤٥٫٣»).
    static func decimal(_ value: Double, language: AppLanguage) -> String {
        let text = String(format: "%.1f", value)
        guard language == .arabic else { return text }
        return String(text.unicodeScalars.map { scalar -> Character in
            if let digit = Int(String(scalar)) { return Character(UnicodeScalar(0x0660 + digit)!) }
            return scalar == "." ? "٫" : Character(scalar)
        })
    }

    /// The spoken description of a page's state, e.g. «صفحة ٤٢: متقن، ٧ من ١٠ آيات متقنة».
    static func pageSummary(page: Int, progress: MemorizationPageProgress, language: AppLanguage) -> String {
        let state = label(progress.state, language: language)
        let mastered = number(progress.mix.masteredAyahs, language: language)
        let total = number(progress.mix.ayahCount, language: language)
        let pageText = number(page, language: language)
        switch language {
        case .arabic: return "صفحة \(pageText): \(state)، \(mastered) من \(total) آيات متقنة"
        case .english: return "Page \(pageText): \(state), \(mastered) of \(total) ayat mastered"
        }
    }
}
