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
        XCTAssertEqual(QiraatClassification.subCategory(for: "ADDITION"), "زيادة حرف")
        XCTAssertEqual(QiraatClassification.subCategory(for: "OMISSION"), "حذف حرف")
        XCTAssertEqual(QiraatClassification.subCategory(for: "WORD_FORM"), "تقديم وتأخير")
        XCTAssertEqual(QiraatClassification.subCategory(for: "REORDER"), "تقديم وتأخير")
        XCTAssertEqual(QiraatClassification.subCategory(for: "reorder"), "تقديم وتأخير")
        XCTAssertEqual(QiraatClassification.subCategory(for: "OTHER"), "أخرى")
        XCTAssertEqual(QiraatClassification.subCategory(for: "MADD"), "أخرى")
        XCTAssertEqual(QiraatClassification.subCategory(for: nil), "أخرى")
        XCTAssertEqual(QiraatClassification.subCategory(for: ""), "أخرى")
    }

    // MARK: - Farsh classification text

    func testFarshClassificationText() {
        let harakah = makeVariant(differenceType: "HARAKAH")
        XCTAssertEqual(QiraatClassification.classification(for: harakah), "فرش الحروف › تشكيل")
        XCTAssertEqual(QiraatClassification.classificationSegments(for: harakah), ["فرش الحروف", "تشكيل"])

        let letter = makeVariant(differenceType: "LETTER")
        XCTAssertEqual(QiraatClassification.classification(for: letter), "فرش الحروف › إبدال حرف")

        let addition = makeVariant(differenceType: "ADDITION")
        XCTAssertEqual(QiraatClassification.classification(for: addition), "فرش الحروف › زيادة حرف")

        let omission = makeVariant(differenceType: "OMISSION")
        XCTAssertEqual(QiraatClassification.classification(for: omission), "فرش الحروف › حذف حرف")

        let wordForm = makeVariant(differenceType: "WORD_FORM")
        XCTAssertEqual(QiraatClassification.classification(for: wordForm), "فرش الحروف › تقديم وتأخير")

        let reorder = makeVariant(differenceType: "reorder")
        XCTAssertEqual(QiraatClassification.classification(for: reorder), "فرش الحروف › تقديم وتأخير")

        let other = makeVariant(differenceType: "UNKNOWN")
        XCTAssertEqual(QiraatClassification.classification(for: other), "فرش الحروف › أخرى")
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
}
