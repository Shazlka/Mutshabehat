import Foundation
import MushafCore
@testable import Mutshabehat
import XCTest

/// The filter's names come from the bundled catalog. A narrator whose catalog name is also the opening word of another
/// reader's name («خلف» beside «خلف العاشر») must never be shown bare: AGENTS.md §4.
final class QiraatFilterNameTests: XCTestCase {
    private func catalog() throws -> QiraatCatalog {
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        return try JSONDecoder().decode(QiraatCatalog.self,
                                        from: Data(contentsOf: bundled.appendingPathComponent("catalog.json")))
    }

    /// A substituted name carries invisible direction isolates (U+2066 to U+2069) around it.
    private func plain(_ text: String?) -> String? {
        text.map { String($0.unicodeScalars.filter { !(0x2066...0x2069).contains($0.value) }) }
    }

    func testKhalafAnHamzaIsNeverShownAsABareKhalaf() throws {
        let catalog = try catalog()
        XCTAssertEqual(plain(catalog.filterShortName(.reading("Q06-R01"))), "خلف عن حمزة")
        XCTAssertEqual(plain(catalog.filterShortName(.reader("Q10"))), "خلف العاشر")
    }

    func testNoNarratorChipIsTheOpeningWordOfAnotherReadersName() throws {
        let catalog = try catalog()
        for narrator in catalog.narrators {
            let chip = try XCTUnwrap(plain(catalog.filterShortName(.reading(narrator.id))))
            for other in catalog.readers where other.id != narrator.readerId {
                let opening = other.nameArShort.split(separator: " ").first.map(String.init)
                XCTAssertNotEqual(chip, opening, "\(narrator.id) reads as the start of \(other.id)")
            }
        }
    }
}
