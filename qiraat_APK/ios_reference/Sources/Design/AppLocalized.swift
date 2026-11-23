import Foundation

/// The language chosen in the app (`app:language:v1`), the device-derived default when nothing is stored.
var appLanguageCode: String {
    UserDefaults.standard.string(forKey: AppLanguage.storageKey) ?? AppLanguage.defaultCode
}

/// A catalog string in the app's own language, not the device's.
/// SwiftUI `Text` resolves its keys in the environment locale, so views can use literals. Code that builds a plain
/// `String` (a model, an accessibility label) must use this instead of `String(localized:)`, which follows the
/// device language and would show English in an Arabic app on an English device.
func appLocalized(_ key: String.LocalizationValue) -> String {
    String(localized: LocalizedStringResource(key, locale: Locale(identifier: appLanguageCode)))
}
