import XCTest
@testable import Mutshabehat

/// On a first launch the app follows the device: Arabic for an Arabic device, English for everything else.
final class AppLanguageDefaultTests: XCTestCase {
    func testAnArabicDeviceStartsInArabic() {
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["ar-AE"]), .arabic)
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["ar"]), .arabic)
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["ar_EG", "en-US"]), .arabic)
    }

    func testAnyOtherDeviceStartsInEnglish() {
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["en-US"]), .english)
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["fr-FR"]), .english)
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["fr-FR", "ar-AE"]), .english, "only the first preference counts")
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: ["arn-CL"]), .english, "Mapudungun is not Arabic")
        XCTAssertEqual(AppLanguage.defaultLanguage(preferredLanguages: []), .english)
    }

    func testTheSharedDefaultIsTheDevicesOwn() {
        XCTAssertEqual(AppLanguage.deviceDefault, AppLanguage.defaultLanguage(preferredLanguages: Locale.preferredLanguages))
        XCTAssertEqual(AppLanguage.defaultCode, AppLanguage.deviceDefault.rawValue)
    }

    /// A language the reader already chose is kept; only an empty setting falls back to the device.
    func testAStoredChoiceWinsOverTheDeviceDefault() {
        let key = "app:language:v1"
        let defaults = UserDefaults.standard
        let previous = defaults.object(forKey: key)
        defer { if let previous { defaults.set(previous, forKey: key) } else { defaults.removeObject(forKey: key) } }

        let other: AppLanguage = AppLanguage.deviceDefault == .arabic ? .english : .arabic
        defaults.set(other.rawValue, forKey: key)
        XCTAssertEqual(appLanguageCode, other.rawValue)
        defaults.removeObject(forKey: key)
        XCTAssertEqual(appLanguageCode, AppLanguage.defaultCode)
    }
}
