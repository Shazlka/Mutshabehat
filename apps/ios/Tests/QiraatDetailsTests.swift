import Foundation
import MushafCore
@testable import MushafCore
@testable import Mutshabehat
import XCTest

/// Unit tests for Qiraat word sheet details:
/// classification text, sub-category label mapping, and ruling action visibility.
final class QiraatDetailsTests: XCTestCase {
    // MARK: - Sub-category label mapping

    func testSubCategoryLabelForEachDifferenceType() {
        XCTAssertEqual(QiraatClassification.subCategory(for: "HARAKAH"), "تشكيل")
        XCTAssertEqual(QiraatClassification.subCategory(for: "LETTER"), "إبدال حرف")
        XCTAssertEqual(QiraatClassification.subCategory(for: "ADDITION"), "زيادة حرف أو كلمة")
        XCTAssertEqual(QiraatClassification.subCategory(for: "OMISSION"), "حذف حرف أو كلمة")
        XCTAssertEqual(QiraatClassification.subCategory(for: "WORD_FORM"), "تقديم وتأخير")
        XCTAssertEqual(QiraatClassification.subCategory(for: "REORDER"), "تقديم وتأخير")
        XCTAssertEqual(QiraatClassification.subCategory(for: "reorder"), "تقديم وتأخير")
        XCTAssertEqual(QiraatClassification.subCategory(for: "OTHER"), "غير مصنَّف")
        XCTAssertEqual(QiraatClassification.subCategory(for: "MADD"), "مد")
        XCTAssertEqual(QiraatClassification.subCategory(for: "WORD_CHANGE"), "اختلاف كلمة")
        XCTAssertEqual(QiraatClassification.subCategory(for: nil), "غير مصنَّف")
        XCTAssertEqual(QiraatClassification.subCategory(for: ""), "غير مصنَّف")
    }

    /// The classification chips are translated through the string catalog, so every difference type needs a
    /// catalog key whose Arabic value is the web's label and which has an English translation.
    func testSubCategoryKeyResolvesToTheArabicLabelAndAnEnglishTranslation() throws {
        let arabic = try XCTUnwrap(Bundle(path: try XCTUnwrap(Bundle.main.path(forResource: "ar", ofType: "lproj"))))
        let english = try XCTUnwrap(Bundle(path: try XCTUnwrap(Bundle.main.path(forResource: "en", ofType: "lproj"))))
        let types: [String?] = ["HARAKAH", "LETTER", "ADDITION", "OMISSION", "MADD", "HAMZ", "IMALAH", "IDGHAM", "WAQF", "NAQL",
                                "SILAH", "ORTHOGRAPHY", "WORD_FORM", "REORDER", "WORD_CHANGE", "SAKT", "OTHER", "weird", "", nil]
        for type in types {
            let key = QiraatClassification.subCategoryKey(for: type)
            XCTAssertEqual(arabic.localizedString(forKey: key, value: "MISSING", table: nil),
                           QiraatClassification.subCategory(for: type), "Arabic value of \(key)")
            let text = english.localizedString(forKey: key, value: "MISSING", table: nil)
            XCTAssertNotEqual(text, "MISSING", "\(key) has an English value")
            XCTAssertNil(text.range(of: "\\p{Arabic}", options: .regularExpression), "\(key) is translated: \(text)")
        }
        for title in [QiraatClassification.farshCategoryTitle, QiraatClassification.usulCategoryTitle] {
            let text = english.localizedString(forKey: title, value: "MISSING", table: nil)
            XCTAssertNil(text.range(of: "\\p{Arabic}", options: .regularExpression), "\(title) is translated: \(text)")
        }
    }

    // MARK: - Farsh classification text

    func testFarshClassificationText() {
        let harakah = makeVariant(differenceType: "HARAKAH")
        XCTAssertEqual(QiraatClassification.classification(for: harakah), "فرش الحروف › تشكيل")
        XCTAssertEqual(QiraatClassification.classificationSegments(for: harakah), ["فرش الحروف", "تشكيل"])

        let letter = makeVariant(differenceType: "LETTER")
        XCTAssertEqual(QiraatClassification.classification(for: letter), "فرش الحروف › إبدال حرف")

        let addition = makeVariant(differenceType: "ADDITION")
        XCTAssertEqual(QiraatClassification.classification(for: addition), "فرش الحروف › زيادة حرف أو كلمة")

        let omission = makeVariant(differenceType: "OMISSION")
        XCTAssertEqual(QiraatClassification.classification(for: omission), "فرش الحروف › حذف حرف أو كلمة")

        let wordForm = makeVariant(differenceType: "WORD_FORM")
        XCTAssertEqual(QiraatClassification.classification(for: wordForm), "فرش الحروف › تقديم وتأخير")

        let reorder = makeVariant(differenceType: "reorder")
        XCTAssertEqual(QiraatClassification.classification(for: reorder), "فرش الحروف › تقديم وتأخير")

        let other = makeVariant(differenceType: "UNKNOWN")
        XCTAssertEqual(QiraatClassification.classification(for: other), "فرش الحروف › غير مصنَّف")
    }

    // MARK: - Usul classification text

    func testUsulClassificationTextWithInformativeAction() {
        let imalah = makeRuling(categoryAr: "الممال والمقلل", action: "إمالة")
        XCTAssertEqual(QiraatClassification.classification(for: imalah), "أصول القراءات › الممال والمقلل › إمالة")
        XCTAssertEqual(QiraatClassification.classificationSegments(for: imalah), ["أصول القراءات", "الممال والمقلل", "إمالة"])
        XCTAssertEqual(QiraatClassification.subDetail(for: imalah), "إمالة")

        let silah = makeRuling(categoryAr: "ميم الجمع", action: "صلة وصلاً")
        XCTAssertEqual(QiraatClassification.classification(for: silah), "أصول القراءات › ميم الجمع › صلة وصلاً")
        XCTAssertEqual(QiraatClassification.subDetail(for: silah), "صلة وصلاً")

        let tarqiq = makeRuling(categoryAr: "ترقيق الراءات", action: "ترقيق")
        XCTAssertEqual(QiraatClassification.classification(for: tarqiq), "أصول القراءات › ترقيق الراءات › ترقيق")
        XCTAssertEqual(QiraatClassification.subDetail(for: tarqiq), "ترقيق")
    }

    func testUsulClassificationPrefersTheDatabaseSubCategory() {
        let base = makeRuling(categoryAr: "ميم الجمع", action: "قرأ بصلة ميم الجمع وصلاً بخلف عنه.")
        let labelled = QiraatRuling(id: base.id, category: base.category, categoryAr: base.categoryAr, color: base.color, wordAnchored: base.wordAnchored,
                                    surah: base.surah, ayah: base.ayah, startToken: base.startToken, endToken: base.endToken, baseText: base.baseText,
                                    verificationStatus: base.verificationStatus, hasAlternate: base.hasAlternate, attribution: base.attribution,
                                    readings: base.readings, subCategory: "صلة ميم الجمع (أوجه متعددة)")
        XCTAssertEqual(QiraatClassification.classification(for: labelled), "أصول القراءات › ميم الجمع › صلة ميم الجمع (أوجه متعددة)")
        XCTAssertEqual(QiraatClassification.usulSubCategory(for: labelled), "صلة ميم الجمع (أوجه متعددة)")
    }

    func testUsulClassificationTextWhenActionRepeatsCategory() {
        let tarkGhunnah = makeRuling(categoryAr: "ترك الغنة", action: "ترك الغنة")
        // When action repeats the category, sub-detail is omitted from the classification line to avoid redundancy.
        XCTAssertEqual(QiraatClassification.classification(for: tarkGhunnah), "أصول القراءات › ترك الغنة")
        XCTAssertEqual(QiraatClassification.classificationSegments(for: tarkGhunnah), ["أصول القراءات", "ترك الغنة"])
        XCTAssertNil(QiraatClassification.subDetail(for: tarkGhunnah))
    }

    func testLongActionSentenceIsNotRepeatedInTheClassificationLine() {
        let long = makeRuling(categoryAr: "ميم الجمع", action: "قرأ بصلة ميم الجمع وصلاً بخلف عنه.")
        XCTAssertNil(QiraatClassification.subDetail(for: long))
        XCTAssertEqual(QiraatClassification.classification(for: long), "أصول القراءات › ميم الجمع")
    }

    // MARK: - Action shown once under the category line

    func testRulingWhoseActionEqualsCategoryStillShowsActionOnce() {
        let ruling = makeRuling(categoryAr: "ترك الغنة", action: "ترك الغنة")
        // The action is never hidden in the explanation/card simply because it equals the category.
        XCTAssertTrue(QiraatClassification.shouldShowAction("ترك الغنة", categoryAr: "ترك الغنة"))
        let actions = QiraatClassification.explanationActions(for: ruling)
        XCTAssertEqual(actions, ["ترك الغنة"])
        XCTAssertEqual(actions.count, 1)

        let groups = ruling.attributionByAction
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(groups.first?.action, "ترك الغنة")
        XCTAssertTrue(QiraatClassification.shouldShowAction(groups.first?.action, categoryAr: ruling.categoryAr))
    }

    // MARK: - Test helpers

    private func makeVariant(differenceType: String?) -> QiraatVariant {
        QiraatVariant(
            id: "fixture-variant",
            surah: 1, ayah: 4, startToken: 1, endToken: 1,
            hafsText: "مَـٰلِكِ",
            variantText: "مَلِكِ",
            differenceType: differenceType,
            verificationStatus: "REVIEWED",
            readingIds: ["Q01-R01"]
        )
    }

    private func makeRuling(categoryAr: String, action: String?, color: String = "#C026D3") -> QiraatRuling {
        let attribution = action.map { [QiraatRulingAttribution(authorityId: "Q01-R01", action: $0)] } ?? []
        return QiraatRuling(
            id: "fixture-ruling",
            category: "FIXTURE_CAT",
            categoryAr: categoryAr,
            color: color,
            wordAnchored: true,
            surah: 2, ayah: 20, startToken: 1, endToken: 1,
            baseText: "يَخْطَفُ",
            verificationStatus: "REVIEWED",
            hasAlternate: false,
            attribution: attribution,
            readings: []
        )
    }

    // MARK: - Dabt Symbols (Tashil & Sakt)

    func testTashilSymbolDetectedFromVariousActions() {
        let actions = [
            "التسهيل مع الإدخال",
            "تسهيل الثانية بين بين",
            "التسهيل بدون إدخال",
            "تسهيل الأولى وصلاً",
            "تسهيل الهمزة بالروم"
        ]
        for action in actions {
            let symbols = QiraatDabtSymbol.symbols(for: action)
            XCTAssertTrue(symbols.contains(.tashil), "Expected .tashil for action: \(action)")
            XCTAssertFalse(symbols.contains(.sakt), "Did not expect .sakt for action: \(action)")
        }
    }

    func testSaktSymbolDetectedFromVariousActions() {
        let actions = [
            "السكت",
            "السكت وصلاً",
            "السكت اللطيف",
            "وقف بهاء السكت باتفاق.",
            "سكت على الساكن قبل الهمز"
        ]
        for action in actions {
            let symbols = QiraatDabtSymbol.symbols(for: action)
            XCTAssertTrue(symbols.contains(.sakt), "Expected .sakt for action: \(action)")
            XCTAssertFalse(symbols.contains(.tashil), "Did not expect .tashil for action: \(action)")
        }
    }

    func testActionWithBothTashilAndSakt() {
        let action = "السكت في الأولى، وتسهيل الثانية"
        let symbols = QiraatDabtSymbol.symbols(for: action)
        XCTAssertEqual(symbols, [.tashil, .sakt], "Expected both symbols when action mentions both")
    }

    func testUnrelatedActionsReturnNoSymbols() {
        let unrelated = [
            "إبدال الهمزة ياء",
            "نقل حركة الهمزة",
            "إمالة كبرى",
            "تقليل",
            "ترك الغنة",
            "تحقيق"
        ]
        for action in unrelated {
            let symbols = QiraatDabtSymbol.symbols(for: action)
            XCTAssertTrue(symbols.isEmpty, "Expected no symbols for unrelated action: \(action)")
        }
    }

    @MainActor
    func testDabtSymbolViewsCanBeInstantiated() {
        let tashilView = QiraatDabtSymbol(kind: .tashil)
        XCTAssertNotNil(tashilView.body)

        let saktView = QiraatDabtSymbol(kind: .sakt)
        XCTAssertNotNil(saktView.body)
    }
}

