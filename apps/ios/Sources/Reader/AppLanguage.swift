import SwiftUI

enum AppLanguage: String, CaseIterable, Identifiable {
    case arabic = "ar"
    case english = "en"

    var id: Self { self }

    /// The language the app uses until the reader picks one in Settings: Arabic when the device's first preferred
    /// language is Arabic, English otherwise. A choice already stored under `app:language:v1` always wins; this only
    /// fills the gap on a first launch (or after the stored value is cleared). Read once per launch.
    static let deviceDefault = AppLanguage.defaultLanguage(preferredLanguages: Locale.preferredLanguages)

    /// `deviceDefault` as the raw value every `@AppStorage("app:language:v1")` falls back to.
    static var defaultCode: String { deviceDefault.rawValue }

    /// Arabic for an Arabic first preference ("ar", "ar-AE", "ar_EG"), English for anything else, including no
    /// preference at all. Matches the language subtag, so "arn" (Mapudungun) is not Arabic.
    static func defaultLanguage(preferredLanguages: [String]) -> AppLanguage {
        guard let first = preferredLanguages.first?.lowercased() else { return .english }
        let subtag = first.split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init) ?? first
        return subtag == "ar" ? .arabic : .english
    }

    var title: LocalizedStringKey {
        switch self {
        case .arabic: "العربية"
        case .english: "English"
        }
    }

    var locale: Locale {
        Locale(identifier: rawValue)
    }

    var layoutDirection: LayoutDirection {
        self == .arabic ? .rightToLeft : .leftToRight
    }
}
