import MushafCore
@testable import Mutshabehat
import XCTest

/// The pieces of the references row that do not need a screen: the environment default and the three works' labels.
final class QiraatReferencesRowTests: XCTestCase {
    func testTheEnvironmentDefaultIsEmptySoACardWithoutAFileShowsNothing() {
        XCTAssertTrue(QiraatReferencesKey.defaultValue.isEmpty)
    }

    func testTheWorksAreNamedAsTheBooksAreAndStayInOrder() {
        XCTAssertEqual(QiraatMatn.allCases.map(\.labelAr), ["الشاطبية", "الدرة", "طيبة النشر"])
    }

    func testAWorksChipShowsItsLeastCheckedReference() {
        func ref(_ status: QiraatReference.Status) -> QiraatReference {
            QiraatReference(variantKey: "1:1:1-1:x", work: .shatibiyyah, lines: ["نص تجريبي"], side: .variant,
                            readingIds: [], status: status)
        }
        XCTAssertEqual(QiraatReferencesRow.weakestStatus([ref(.verified), ref(.extracted)]), .extracted)
        XCTAssertEqual(QiraatReferencesRow.weakestStatus([ref(.verified), ref(.reviewed)]), .reviewed)
        XCTAssertEqual(QiraatReferencesRow.weakestStatus([ref(.verified)]), .verified)
    }

    func testTheRowsStringsHaveEnglish() throws {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Sources/Localizable.xcstrings")
        guard FileManager.default.fileExists(atPath: url.path) else { throw XCTSkip("source tree not on this machine") }
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        let strings = try XCTUnwrap(root["strings"] as? [String: Any])
        for key in ["المصادر", "الشاطبية", "الدرة", "طيبة النشر", "البيت %lld", "لا يطابق قراءات هذه الكلمة، يحتاج مراجعة"] {
            let english = ((strings[key] as? [String: Any])?["localizations"] as? [String: Any])?["en"]
            XCTAssertNotNil(english, "\(key) has no English value")
        }
    }
}
