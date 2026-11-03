import XCTest
@testable import Mutshabehat

/// The Mutshabehat diff must not rely on colour alone (audit M4): each coloured kind has a line under it and is
/// named when VoiceOver reads the ayah.
final class ArabicDiffAccessibilityTests: XCTestCase {
    private let key = "app:language:v1"

    private func withLanguage(_ code: String, _ body: () -> Void) {
        let defaults = UserDefaults.standard
        let previous = defaults.object(forKey: key)
        defaults.set(code, forKey: key)
        defer { if let previous { defaults.set(previous, forKey: self.key) } else { defaults.removeObject(forKey: self.key) } }
        body()
    }

    private let parts = [
        PersonalPart(type: "shared", text: "وَإِذْ قَالَ"),
        PersonalPart(type: "diff", text: "مُوسَىٰ"),
        PersonalPart(type: "addition", text: "لِقَوْمِهِ "),
        PersonalPart(type: "unique", text: "يَـٰقَوْمِ"),
        PersonalPart(type: "diff2", text: "ٱذْكُرُوا"),
        PersonalPart(type: "normal", text: "نِعْمَةَ"),
        PersonalPart(type: "blank", text: "   "),
    ]

    func testTheSpokenDiffNamesEachDifferingPartInArabic() {
        withLanguage("ar") {
            XCTAssertEqual(ArabicDiffAccessibility.label(for: parts).removingBidiIsolates,
                           "وَإِذْ قَالَ مُوسَىٰ، اختلاف لِقَوْمِهِ، زيادة يَـٰقَوْمِ، فريد ٱذْكُرُوا، اختلاف ٢ نِعْمَةَ")
        }
    }

    func testTheSpokenDiffNamesTheKindsInEnglishWhenTheAppIsInEnglish() {
        withLanguage("en") {
            XCTAssertEqual(ArabicDiffAccessibility.label(for: parts).removingBidiIsolates,
                           "وَإِذْ قَالَ مُوسَىٰ, difference لِقَوْمِهِ, addition يَـٰقَوْمِ, unique ٱذْكُرُوا, difference 2 نِعْمَةَ")
        }
    }

    func testSharedAndBlankPartsAreReadAsPlainTextAndEmptyPartsAreSkipped() {
        withLanguage("ar") {
            let label = ArabicDiffAccessibility.label(for: [
                PersonalPart(type: "shared", text: "إِنَّ"),
                PersonalPart(type: "diff3", text: " "),
                PersonalPart(type: "blank", text: "ٱللَّهَ"),
            ])
            XCTAssertEqual(label.removingBidiIsolates, "إِنَّ ٱللَّهَ")
            XCTAssertEqual(ArabicDiffAccessibility.label(for: []), "")
        }
    }

    /// Every kind that is coloured as a difference also gets a non-colour line and a spoken name; shared and blank
    /// get neither. Differences, additions and unique parts are told apart by the line itself.
    func testEveryDifferingKindHasANonColourCue() {
        for style in MutshabehatPartStyle.allCases {
            let marksADifference = style != .shared && style != .blank
            XCTAssertEqual(style.nonColorUnderline != nil, marksADifference, "\(style)")
            XCTAssertEqual(style.spokenKind != nil, marksADifference, "\(style)")
        }
        let line = { (style: MutshabehatPartStyle) in String(describing: style.nonColorUnderline!) }
        XCTAssertEqual(line(.difference), line(.difference2))
        XCTAssertEqual(line(.difference), line(.difference3))
        XCTAssertEqual(Set([line(.difference), line(.addition), line(.unique)]).count, 3)
    }
}
