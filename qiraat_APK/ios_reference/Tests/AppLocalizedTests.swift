import MushafCore
import XCTest
@testable import Mutshabehat

extension String {
    /// Foundation wraps substituted text in invisible direction marks (U+2066 to U+2069) so Arabic and English mix
    /// correctly; they are right on screen and wrong for a string comparison.
    var removingBidiIsolates: String {
        String(unicodeScalars.filter { !(0x2066...0x2069).contains($0.value) })
    }
}

/// Strings built in code follow the language chosen in the app, not the device's.
final class AppLocalizedTests: XCTestCase {
    private let key = "app:language:v1"

    private func withLanguage(_ code: String, _ body: () -> Void) {
        let defaults = UserDefaults.standard
        let previous = defaults.object(forKey: key)
        defaults.set(code, forKey: key)
        defer { if let previous { defaults.set(previous, forKey: self.key) } else { defaults.removeObject(forKey: self.key) } }
        body()
    }

    func testAnEnglishAppGetsEnglishStringsWhateverTheDeviceLanguage() {
        withLanguage("en") {
            XCTAssertEqual(appLocalized("خط متصل تحت الكلمة"), "Solid line under the word")
            XCTAssertEqual(appLocalized("الإمام \("نافع")").removingBidiIsolates, "Imam نافع")
        }
    }

    func testAnArabicAppGetsArabicStrings() {
        withLanguage("ar") {
            XCTAssertEqual(appLocalized("خط متصل تحت الكلمة"), "خط متصل تحت الكلمة")
            XCTAssertEqual(appLocalized("الإمام \("نافع")").removingBidiIsolates, "الإمام نافع")
        }
    }

    func testTheLegendRowsFollowTheAppLanguage() throws {
        try HostFiles.requireBuildMachineFiles()
        let catalogURL = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Generated/Qiraat/catalog.json")
        let catalog = try JSONDecoder().decode(QiraatCatalog.self, from: Data(contentsOf: catalogURL))
        withLanguage("en") {
            let english = QiraatLegend.entries(catalog: catalog)
            XCTAssertTrue(english.contains { $0.title == "Solid line under the word" })
            XCTAssertFalse(english.contains { $0.title.contains("خط") }, "no Arabic row title in English")
        }
        withLanguage("ar") {
            XCTAssertTrue(QiraatLegend.entries(catalog: catalog).contains { $0.title == "خط متصل تحت الكلمة" })
        }
    }

    func testTheSyncStatusFollowsTheAppLanguage() {
        let status = QiraatSyncStatus(kind: .confirmed(elapsed: 5 * 60), isOffline: false)
        withLanguage("en") {
            XCTAssertEqual(status.title.removingBidiIsolates, "Updated 5 minutes ago")
            XCTAssertEqual(QiraatSyncStatus(kind: .confirmed(elapsed: 3600), isOffline: false).title.removingBidiIsolates, "Updated 1 hour ago")
            XCTAssertEqual(QiraatSyncStatus(kind: .current, isOffline: false).title, "Updated now")
            XCTAssertEqual(QiraatSyncStatus(kind: .localCopy, isOffline: false).title, "Local copy")
        }
        withLanguage("ar") { XCTAssertEqual(status.title.removingBidiIsolates, "محدّث قبل ٥ دقائق") }
    }
}
